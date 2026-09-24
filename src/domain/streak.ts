/**
 * Streak: giorni consecutivi con almeno una sessione che conta nel piano
 * con esito Completata o Continua.
 * Fonte: RoutForge_MECCANISMI.md §12 — criteri: SCENARI C2 (+1 una sola volta al giorno).
 *
 * Regole:
 * - +1 una sola volta al giorno, solo per Completata/Continua su un blocco di studio che conta.
 * - Se l'ultimo giorno contato è ieri → +1, altrimenti riparte da 1.
 * - Il valore mostrato vale solo se l'ultimo giorno contato è oggi o ieri; altrimenti 0.
 */
import { addLocalDays, localDayKey } from './time';
import type { Esito } from './types';

export interface StatoStreak {
  conteggio: number;
  /** Chiave del giorno locale dell'ultimo accredito ("YYYY-MM-DD"), o null. */
  ultimoGiorno: string | null;
}

export const EMPTY_STREAK: StatoStreak = { conteggio: 0, ultimoGiorno: null };

/** Solo Completata e Continua alimentano la streak (§12). */
export function outcomeCountsForStreak(outcome: Esito): boolean {
  return outcome === 'completata' || outcome === 'continua';
}

/**
 * Accredita la giornata `at` (epoch ms) alla streak.
 * Idempotente nello stesso giorno: una seconda sessione oggi non cambia nulla.
 */
export function creditStreak(state: StatoStreak, at: number): StatoStreak {
  const today = localDayKey(at);
  if (state.ultimoGiorno === today) return state;
  const yesterday = localDayKey(addLocalDays(at, -1));
  const conteggio = state.ultimoGiorno === yesterday ? state.conteggio + 1 : 1;
  return { conteggio, ultimoGiorno: today };
}

/** Valore da mostrare "adesso": 0 se l'ultimo giorno contato non è oggi né ieri. */
export function currentStreak(state: StatoStreak, now: number): number {
  if (!state.ultimoGiorno) return 0;
  const today = localDayKey(now);
  const yesterday = localDayKey(addLocalDays(now, -1));
  return state.ultimoGiorno === today || state.ultimoGiorno === yesterday ? state.conteggio : 0;
}
