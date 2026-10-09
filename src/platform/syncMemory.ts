// Il servizio della sync in memoria (porta `SyncBackend`, T-033): le stesse regole dell'SQL di `supabase/schema.sql`
// (ultimo vince per record con la parità sul dispositivo, la riga `generata` che non sovrascrive e cede, l'istante
// limitato a 5 minuti avanti, il cursore `seq`, il filtro delle righe del proprio dispositivo, la revoca, le righe fuori
// ambito o con l'id dei dati diverso scartate, il lotto rifiutato intero per una riga oltre il `check`). È la specifica
// eseguibile dell'SQL: più istanze sullo stesso archivio sono più dispositivi dello stesso account. I 5 s in cui l'SQL
// trattiene le righe appena ricevute sono `trattieniMs`, 0 se non dato (audit P2-7). Accetta ogni email col codice
// 000000; `main.tsx` lo usa finché mancano le chiavi di Supabase («servizio finto» in Diagnostica).
import { RevocatoError, type Dispositivo, type Sessione, type SyncBackend } from '../app/ports/sync';
import { clampUpdatedAt, isSynced, sendable, serverAccepts, type Busta, type BustaRicevuta } from '../domain/sync';

interface RigaServizio {
  userId: string;
  busta: BustaRicevuta;
  /** `received_at` dell'SQL. */
  ricevutaIl: number;
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

export function memorySyncBackend(
  archivio: ArchivioSync,
  ora: () => number,
  nuovoId: () => string,
  { trattieniMs = 0 }: { trattieniMs?: number } = {},
): SyncBackend {
  let sessione: Sessione | null = null;
  const ascolti = new Set<(s: Sessione | null) => void>();
  const cambia = (s: Sessione | null) => {
    sessione = s;
    for (const f of ascolti) f(s);
  };
  /**
   * Come `assert_device` dell'SQL: il dispositivo esiste (altrimenti un errore da ritentare: la registrazione non è
   * ancora arrivata), non è revocato; aggiorna l'ultima attività.
   */
  const attivo = (): Sessione => {
    if (!sessione) throw new RevocatoError();
    const d = archivio.dispositivi.get(sessione.dispositivo);
    if (!d) throw new Error('dispositivo_sconosciuto');
    if (d.revocato) throw new RevocatoError();
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
          .filter(
            (r) =>
              r.userId === s.userId &&
              r.busta.seq > daSeq &&
              r.busta.dispositivo !== s.dispositivo &&
              ora() - r.ricevutaIl >= trattieniMs,
          )
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
        // Come push_records: un lotto oltre 500 righe (l'app ne manda 200) si rifiuta intero (audit P2-21)
        if (buste.length > 500) throw new Error('lotto_troppo_grande');
        // Il `check` di `records` e il `jsonb` del parametro fanno fallire tutta la chiamata, prima di ogni scrittura
        if (!buste.every((b) => sendable(b.dati))) throw new Error('new row violates check constraint');
        // La `where` di push_records: fuori ambito, id dei dati diverso o istante mancante si scartano in silenzio
        const valide = buste.filter(
          (b) => isSynced(b.tabella, b.id) && b.dati.id === b.id && Number.isFinite(b.updatedAt),
        );
        for (const b of valide) {
          const chiave = `${s.userId}:${b.tabella}:${b.id}`;
          const arrivata = { ...b, updatedAt: clampUpdatedAt(b.updatedAt, ora()), dispositivo: s.dispositivo };
          const memorizzata = archivio.righe.get(chiave)?.busta;
          const riga = { userId: s.userId, ricevutaIl: ora() };
          if (serverAccepts(memorizzata, arrivata))
            archivio.righe.set(chiave, { ...riga, busta: { ...arrivata, seq: ++archivio.seq } });
          // Ha perso: la memorizzata di un altro dispositivo torna a chi ha spedito col prossimo pull, come nell'SQL
          else if (memorizzata && memorizzata.dispositivo !== s.dispositivo)
            archivio.righe.set(chiave, { ...riga, busta: { ...memorizzata, seq: ++archivio.seq } });
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
