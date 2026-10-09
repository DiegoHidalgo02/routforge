// Il servizio della sync su Supabase (porta `SyncBackend`; T-033, D-SYNC-1): accesso con email e codice (OTP), la
// sessione salvata dal client nel dispositivo, l'id del dispositivo = `session_id` del JWT, le buste con le RPC
// `pull_records`, `push_records` e `revoke_device` di `supabase/schema.sql`, i dispositivi dalla tabella `devices`.
// URL e chiave anonima arrivano da `.env.local` (mai nel repository); la chiave `service_role` non c'è mai. La revoca
// arriva come errore «dispositivo_revocato» dell'SQL e diventa `RevocatoError`.
import { createClient, type Session } from '@supabase/supabase-js';
import { RevocatoError, type Dispositivo, type Sessione, type SyncBackend } from '../app/ports/sync';
import type { BustaRicevuta, TabellaSincronizzata } from '../domain/sync';

/** I claim di un JWT (base64url del payload); `null` se non si leggono. */
function claims(token: string): { session_id?: unknown; role?: unknown } | null {
  try {
    const payload = token.split('.')[1] ?? '';
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
      session_id?: unknown;
      role?: unknown;
    } | null;
  } catch {
    return null;
  }
}

/** Il `session_id` dai claim del token, che lega il dispositivo alla sessione dell'accesso. */
function sessionId(token: string): string | null {
  const id = claims(token)?.session_id;
  return typeof id === 'string' ? id : null;
}

/**
 * La chiave è quella anonima di Supabase, pubblica per costruzione: una «publishable» o un JWT col ruolo `anon`. Una
 * segreta (`sb_secret_`, `service_role`) scavalca l'RLS per chiunque abbia l'app: il build la rifiuta (`vite.config.ts`,
 * audit P2-21).
 */
export const isAnonKey = (chiave: string): boolean =>
  chiave.startsWith('sb_publishable_') || claims(chiave)?.role === 'anon';

const sessioneDa = (s: Session | null): Sessione | null => {
  const dispositivo = s && sessionId(s.access_token);
  return s && dispositivo ? { userId: s.user.id, email: s.user.email ?? '', dispositivo } : null;
};

/** Un errore del servizio: la revoca del dispositivo è il suo tipo, il resto un errore col messaggio. */
const errore = (e: { message: string }): Error =>
  e.message.includes('dispositivo_revocato') ? new RevocatoError() : new Error(e.message);

interface RigaRecord {
  tabella: TabellaSincronizzata;
  id: string;
  dati: Record<string, unknown>;
  updated_at: number;
  deleted_at: number | null;
  generata: boolean;
  device_id: string;
  seq: number;
}

/** Dove il client salva la sessione nel dispositivo (le chiavi che toglie anche la sua uscita). */
const CHIAVE_SESSIONE = 'routforge-sync';

export function supabaseSyncBackend(url: string, chiaveAnonima: string): SyncBackend {
  const client = createClient(url, chiaveAnonima, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: CHIAVE_SESSIONE },
  });
  let sessione: Sessione | null = null;
  const ascolti = new Set<(s: Sessione | null) => void>();
  const cambia = (s: Sessione | null) => {
    sessione = s;
    for (const f of ascolti) f(s);
  };
  // La sessione salvata arriva all'avvio con INITIAL_SESSION; poi accessi, rinnovi e uscite (anche una revoca)
  client.auth.onAuthStateChange((_evento, s) => cambia(sessioneDa(s)));
  const attiva = (): Sessione => {
    if (!sessione) throw new RevocatoError();
    return sessione;
  };
  return {
    session: () => sessione,
    onSessionChange(f) {
      ascolti.add(f);
      return () => void ascolti.delete(f);
    },
    async sendCode(email) {
      // L'account lo crea l'utente nel progetto (passi in testa a supabase/schema.sql): dall'app nessuna registrazione
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false } });
      if (error) throw errore(error);
    },
    async verifyCode(email, codice) {
      const { data, error } = await client.auth.verifyOtp({ email: email.trim(), token: codice.trim(), type: 'email' });
      if (error) throw errore(error);
      const s = sessioneDa(data.session);
      if (!s) throw new Error('sessione senza session_id');
      sessione = s;
      return s;
    },
    async registerDevice(nome, piattaforma) {
      const s = attiva();
      const { error } = await client.from('devices').upsert(
        {
          session_id: s.dispositivo,
          user_id: s.userId,
          nome,
          piattaforma,
          ultima_attivita: new Date().toISOString(),
        },
        { onConflict: 'session_id', ignoreDuplicates: true },
      );
      if (error) throw errore(error);
    },
    async signOut() {
      // Solo questo dispositivo: il default di supabase-js è «global» e farebbe uscire tutti. Offline col token scaduto
      // il client si ferma sul rinnovo fallito e la sessione resta: la sync ripartirebbe da sola al ritorno della rete,
      // anche dopo un import o «Elimina tutti i dati». Allora la si toglie qui, con le chiavi che toglie il client
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (!error) return;
      for (const k of ['', '-user', '-code-verifier']) localStorage.removeItem(CHIAVE_SESSIONE + k);
      cambia(null);
    },
    async pull(daSeq, limite) {
      const { data, error } = await client.rpc('pull_records', { p_da: daSeq, p_limite: limite });
      if (error) throw errore(error);
      const righe = (data ?? []) as RigaRecord[];
      const buste: BustaRicevuta[] = righe.map((r) => ({
        tabella: r.tabella,
        id: r.id,
        dati: r.dati,
        updatedAt: Number(r.updated_at),
        deletedAt: r.deleted_at === null ? null : Number(r.deleted_at),
        generata: r.generata,
        dispositivo: r.device_id,
        seq: Number(r.seq),
      }));
      return { buste, ultimoSeq: buste.at(-1)?.seq ?? daSeq };
    },
    async push(buste) {
      const p_righe = buste.map((b) => ({
        tabella: b.tabella,
        id: b.id,
        dati: b.dati,
        updated_at: b.updatedAt,
        deleted_at: b.deletedAt,
        generata: b.generata,
      }));
      const { error } = await client.rpc('push_records', { p_righe });
      if (error) throw errore(error);
    },
    async devices() {
      const s = attiva();
      const { data, error } = await client
        .from('devices')
        .select('session_id, nome, piattaforma, ultima_attivita')
        .is('revoked_at', null);
      if (error) throw errore(error);
      return (
        (data ?? []) as { session_id: string; nome: string; piattaforma: string; ultima_attivita: string | null }[]
      ).map((d): Dispositivo => ({
        id: d.session_id,
        nome: d.nome,
        piattaforma: d.piattaforma,
        ultimaAttivita: d.ultima_attivita ? Date.parse(d.ultima_attivita) : null,
        corrente: d.session_id === s.dispositivo,
      }));
    },
    async revokeDevice(id) {
      const { error } = await client.rpc('revoke_device', { p_session: id });
      if (error) throw errore(error);
    },
    async eraseRemote() {
      const s = attiva();
      const { error } = await client.from('records').delete().eq('user_id', s.userId);
      if (error) throw errore(error);
    },
  };
}

/** Il nome di questo dispositivo nell'elenco dell'account (non modificabile): il sistema e, sul web, il browser. */
export function deviceDescription(piattaforma: string): { nome: string; piattaforma: string } {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const sistema = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : 'Linux';
  if (piattaforma !== 'web') return { nome: `RoutForge · ${sistema}`, piattaforma };
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Firefox\//.test(ua)
      ? 'Firefox'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : 'Safari';
  return { nome: `${browser} · ${sistema}`, piattaforma };
}
