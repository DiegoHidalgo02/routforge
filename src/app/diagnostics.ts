/**
 * Diagnostica (FUNZ §24, MECC §23; T-032; INV-16): gli errori che i servizi non mandano alla UI (cicli dello scheduler,
 * riconciliazione delle notifiche, porte di schermo acceso e Non Disturbare, ricorrenze che non si leggono, D-SCHED-1
 * n. 8) e l'esito dell'ultima riconciliazione; il rapporto li legge con la coda delle notifiche salvata. L'orologio lo
 * inietta il punto di composizione, come gli adapter di `sessionDevice.ts`.
 */
import type { RoutForgeDb } from '../data/db';
import { list } from '../data/repository';
import type { Clock } from './ports/clock';

export type Sorgente = 'ciclo' | 'notifiche' | 'dispositivo' | 'materiali' | 'backup' | 'ai' | 'sync' | 'interfaccia';
export interface EventoDiagnostica {
  istante: number;
  sorgente: Sorgente;
  messaggio: string;
  /** Un evento noto ha un codice: il testo nella lingua dell'app lo scrive la UI (il messaggio ne porta i dati). */
  codice?: 'ricorrenze_non_lette';
}

/** Eventi tenuti, il più recente in testa. */
export const MAX_EVENTI = 20;

// ponytail: in memoria, si perdono al ricaricamento; una tabella se servirà il registro fra un avvio e l'altro
const eventi: EventoDiagnostica[] = [];
let riconciliazione: { istante: number; errore: string | null } | null = null;
let orologio: Pick<Clock, 'now'> = { now: () => 0 };

export function configureDiagnostics(clock: Pick<Clock, 'now'>): void {
  orologio = clock;
}

const testo = (e: unknown): string => {
  try {
    return e instanceof Error ? e.message : String(e);
  } catch {
    return '?';
  }
};

/**
 * Un errore da mostrare in Diagnostica: lo stesso errore ripetuto (il ciclo gira ogni minuto) resta una riga sola, che
 * torna in testa con l'istante nuovo.
 */
export function logError(sorgente: Sorgente, errore: unknown, codice?: EventoDiagnostica['codice']): void {
  const e: EventoDiagnostica = {
    istante: orologio.now(),
    sorgente,
    messaggio: testo(errore),
    ...(codice && { codice }),
  };
  const uguale = eventi.findIndex((x) => x.sorgente === e.sorgente && x.messaggio === e.messaggio);
  if (uguale >= 0) eventi.splice(uguale, 1);
  eventi.unshift(e);
  eventi.length = Math.min(eventi.length, MAX_EVENTI);
}

/** L'esito dell'ultima riconciliazione delle notifiche (§13.3). */
export function logReconcile(istante: number, errore: unknown): void {
  riconciliazione = { istante, errore: errore == null ? null : testo(errore) };
  if (errore != null) logError('notifiche', errore);
}

export async function readDiagnostics(db: RoutForgeDb, now: number) {
  // Col database che non risponde gli eventi in memoria restano visibili: sono proprio quelli che spiegano il guasto
  // (audit P1-13)
  const registro = await list(db, 'registroNotifiche').catch(() => []);
  const coda = registro.filter((v) => v.istante > now).sort((a, b) => a.istante - b.istante);
  return { armate: coda.length, prossima: coda[0]?.istante ?? null, riconciliazione, eventi: [...eventi] };
}

export type Diagnostica = Awaited<ReturnType<typeof readDiagnostics>>;
