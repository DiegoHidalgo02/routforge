/**
 * Porta dell'orologio del dispositivo (docs/02_ARCHITETTURA.md §1; D-TIME-2, D-SCHED-1): il tempo, il fuso e i momenti
 * in cui il tempo dell'app avanza o salta arrivano da qui, mai da `Date.now()`, `Intl` o dai timer dentro `app` e
 * `domain`. L'adapter web è `src/platform/clock.ts`; nei test un orologio finto con l'ora impostabile.
 */
export interface Clock {
  /** Istante corrente (epoch ms). */
  now(): number;
  /** Nome IANA del fuso corrente del dispositivo (es. "Europe/Rome"): il dominio lo riceve come dato (D-TIME-2). */
  fuso(): string;
  /** Chiama `fn` a ogni multiplo di `ms` dall'epoch: con un minuto, al cambio di ogni minuto. Restituisce lo stop. */
  every(ms: number, fn: () => void): () => void;
  /** Chiama `fn` a ogni ritorno dell'app in primo piano (MECC §9). Restituisce lo stop. */
  onForeground(fn: () => void): () => void;
}
