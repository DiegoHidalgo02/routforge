/**
 * Il servizio remoto della sincronizzazione (MECC §1, §25; T-033): l'account email + codice, le buste in uscita e in
 * entrata (cursore = numero d'ordine del servizio), i dispositivi dell'account. Adapter: Supabase
 * (`platform/syncSupabase.ts`) e il servizio in memoria (`platform/syncMemory.ts`, senza chiavi e nei test). Il nome
 * `SyncService` è del servizio in `app/sync.ts`, come `SchedulerService`. Un errore arriva come eccezione, che il
 * servizio registra in Diagnostica; `RevocatoError` dice che questo dispositivo è stato scollegato.
 */
import type { Busta, BustaRicevuta } from '../../domain/sync';

export interface Sessione {
  userId: string;
  email: string;
  /** L'id di questo dispositivo nell'account (la sessione dell'accesso): la parità di «ultimo vince» lo usa. */
  dispositivo: string;
}

export interface Dispositivo {
  id: string;
  nome: string;
  piattaforma: string;
  ultimaAttivita: number | null;
  corrente: boolean;
}

/** Il dispositivo è stato scollegato da un altro: si esce, dati e coda restano (rientra con un nuovo codice). */
export class RevocatoError extends Error {
  constructor() {
    super('dispositivo_revocato');
    this.name = 'RevocatoError';
  }
}

export interface SyncBackend {
  session(): Sessione | null;
  onSessionChange(f: (s: Sessione | null) => void): () => void;
  /** Manda il codice di 6 cifre all'email (l'account nasce al primo accesso). */
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, codice: string): Promise<Sessione>;
  registerDevice(nome: string, piattaforma: string): Promise<void>;
  /** Esce solo da questo dispositivo. */
  signOut(): Promise<void>;
  /** Le buste degli altri dispositivi dopo `daSeq`, in ordine, al massimo `limite`. */
  pull(daSeq: number, limite: number): Promise<{ buste: BustaRicevuta[]; ultimoSeq: number }>;
  push(buste: readonly Busta[]): Promise<void>;
  devices(): Promise<Dispositivo[]>;
  revokeDevice(id: string): Promise<void>;
  /** Cancella i dati dell'account dal servizio (non dai dispositivi). */
  eraseRemote(): Promise<void>;
}
