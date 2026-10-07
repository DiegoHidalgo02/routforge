// Il servizio della sync in memoria (porta `SyncBackend`, T-033): le stesse regole dell'SQL di `supabase/schema.sql`
// (ultimo vince per record con la parità sul dispositivo, la riga `generata` che non sovrascrive e cede, l'istante
// limitato a 5 minuti avanti, il cursore `seq`, il filtro delle righe del proprio dispositivo, la revoca). È la
// specifica eseguibile dell'SQL (salvo i 5 s in cui l'SQL trattiene le righe appena ricevute, che servono solo con push
// concorrenti: qui non ce ne sono): più istanze sullo stesso archivio sono più dispositivi dello stesso account. Accetta ogni
// email col codice 000000; `main.tsx` lo usa finché mancano le chiavi di Supabase («servizio finto» in Diagnostica).
import { RevocatoError, type Dispositivo, type Sessione, type SyncBackend } from '../app/ports/sync';
import { clampUpdatedAt, serverAccepts, type Busta, type BustaRicevuta } from '../domain/sync';

interface RigaServizio {
  userId: string;
  busta: BustaRicevuta;
}
interface DispositivoServizio {
  userId: string;
  nome: string;
  piattaforma: string;
  ultimaAttivita: number | null;
  revocato: boolean;
}
export interface ArchivioSync {
  righe: Map<string, RigaServizio>;
  dispositivi: Map<string, DispositivoServizio>;
  account: Map<string, string>;
  seq: number;
}

export const createSyncStore = (): ArchivioSync => ({
  righe: new Map(),
  dispositivi: new Map(),
  account: new Map(),
  seq: 0,
});

/** Il codice accettato dal servizio finto. */
export const CODICE_FINTO = '000000';

export function memorySyncBackend(archivio: ArchivioSync, ora: () => number, nuovoId: () => string): SyncBackend {
  let sessione: Sessione | null = null;
  const ascolti = new Set<(s: Sessione | null) => void>();
  const cambia = (s: Sessione | null) => {
    sessione = s;
    for (const f of ascolti) f(s);
  };
  /** Come `assert_device` dell'SQL: il dispositivo esiste, non è revocato; aggiorna l'ultima attività. */
  const attivo = (): Sessione => {
    const d = sessione && archivio.dispositivi.get(sessione.dispositivo);
    if (!sessione || !d || d.revocato) throw new RevocatoError();
    d.ultimaAttivita = ora();
    return sessione;
  };
  return {
    session: () => sessione,
    onSessionChange(f) {
      ascolti.add(f);
      return () => void ascolti.delete(f);
    },
    sendCode: () => Promise.resolve(),
    verifyCode(email, codice) {
      if (codice !== CODICE_FINTO) return Promise.reject(new Error('codice non valido'));
      const chiave = email.trim().toLowerCase();
      const userId = archivio.account.get(chiave) ?? nuovoId();
      archivio.account.set(chiave, userId);
      const s = { userId, email: chiave, dispositivo: nuovoId() };
      cambia(s);
      return Promise.resolve(s);
    },
    registerDevice(nome, piattaforma) {
      if (!sessione) return Promise.reject(new Error('senza sessione'));
      archivio.dispositivi.set(sessione.dispositivo, {
        userId: sessione.userId,
        nome,
        piattaforma,
        ultimaAttivita: ora(),
        revocato: false,
      });
      return Promise.resolve();
    },
    signOut() {
      cambia(null);
      return Promise.resolve();
    },
    pull(daSeq, limite) {
      try {
        const s = attivo();
        const buste = [...archivio.righe.values()]
          .filter((r) => r.userId === s.userId && r.busta.seq > daSeq && r.busta.dispositivo !== s.dispositivo)
          .map((r) => r.busta)
          .sort((a, b) => a.seq - b.seq)
          .slice(0, limite);
        return Promise.resolve({ buste, ultimoSeq: buste.at(-1)?.seq ?? daSeq });
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
    },
    push(buste: readonly Busta[]) {
      try {
        const s = attivo();
        for (const b of buste) {
          const chiave = `${s.userId}:${b.tabella}:${b.id}`;
          const arrivata = { ...b, updatedAt: clampUpdatedAt(b.updatedAt, ora()), dispositivo: s.dispositivo };
          const memorizzata = archivio.righe.get(chiave)?.busta;
          if (serverAccepts(memorizzata, arrivata))
            archivio.righe.set(chiave, { userId: s.userId, busta: { ...arrivata, seq: ++archivio.seq } });
        }
        return Promise.resolve();
      } catch (e) {
        return Promise.reject(e instanceof Error ? e : new Error(String(e)));
      }
    },
    devices() {
      const s = sessione;
      if (!s) return Promise.resolve([]);
      const elenco: Dispositivo[] = [...archivio.dispositivi.entries()]
        .filter(([, d]) => d.userId === s.userId && !d.revocato)
        .map(([id, d]) => ({
          id,
          nome: d.nome,
          piattaforma: d.piattaforma,
          ultimaAttivita: d.ultimaAttivita,
          corrente: id === s.dispositivo,
        }));
      return Promise.resolve(elenco);
    },
    revokeDevice(id) {
      const d = archivio.dispositivi.get(id);
      if (sessione && d && d.userId === sessione.userId) d.revocato = true;
      return Promise.resolve();
    },
    eraseRemote() {
      const s = sessione;
      if (s) for (const [k, r] of archivio.righe) if (r.userId === s.userId) archivio.righe.delete(k);
      return Promise.resolve();
    },
  };
}
