// Il servizio della sync su Supabase (porta `SyncBackend`; T-033, D-SYNC-1): accesso con email e codice (OTP), la
// sessione salvata dal client nel dispositivo, l'id del dispositivo = `session_id` del JWT, le buste con le RPC
// `pull_records`, `push_records` e `revoke_device` di `supabase/schema.sql`, i dispositivi dalla tabella `devices`.
// URL e chiave anonima arrivano da `.env.local` (mai nel repository); la chiave `service_role` non c'è mai. La revoca
// arriva come errore «dispositivo_revocato» dell'SQL e diventa `RevocatoError`.
import { createClient, type Session } from '@supabase/supabase-js';
import { RevocatoError, type Dispositivo, type Sessione, type SyncBackend } from '../app/ports/sync';
import type { BustaRicevuta, TabellaSincronizzata } from '../domain/sync';

/** Il `session_id` dai claim del token (base64url del payload), che lega il dispositivo alla sessione dell'accesso. */
function sessionId(token: string): string | null {
  try {
    const payload = token.split('.')[1] ?? '';
    const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { session_id?: unknown };
    return typeof claims.session_id === 'string' ? claims.session_id : null;
  } catch {
    return null;
  }
}

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

export function supabaseSyncBackend(url: string, chiaveAnonima: string): SyncBackend {
  const client = createClient(url, chiaveAnonima, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
  });
  let sessione: Sessione | null = null;
  const ascolti = new Set<(s: Sessione | null) => void>();
  // La sessione salvata arriva all'avvio con INITIAL_SESSION; poi accessi, rinnovi e uscite (anche una revoca)
  client.auth.onAuthStateChange((_evento, s) => {
    sessione = sessioneDa(s);
    for (const f of ascolti) f(sessione);
  });
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
      const { error } = await client.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
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
      // Solo questo dispositivo: il default di supabase-js è «global» e farebbe uscire tutti
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw errore(error);
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
