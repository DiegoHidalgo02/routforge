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
import type { Outcome } from './types';

export interface StreakState {
  count: number;
  /** Chiave del giorno locale dell'ultimo accredito ("YYYY-MM-DD"), o null. */
  lastDay: string | null;
}

export const EMPTY_STREAK: StreakState = { count: 0, lastDay: null };

/** Solo Completata e Continua alimentano la streak (§12). */
export function outcomeCountsForStreak(outcome: Outcome): boolean {
  return outcome === 'completata' || outcome === 'continua';
}

/**
 * Accredita la giornata `at` (epoch ms) alla streak.
 * Idempotente nello stesso giorno: una seconda sessione oggi non cambia nulla.
 */
export function creditStreak(state: StreakState, at: number): StreakState {
  const today = localDayKey(at);
  if (state.lastDay === today) return state;
  const yesterday = localDayKey(addLocalDays(at, -1));
  const count = state.lastDay === yesterday ? state.count + 1 : 1;
  return { count, lastDay: today };
}

/** Valore da mostrare "adesso": 0 se l'ultimo giorno contato non è oggi né ieri. */
export function currentStreak(state: StreakState, now: number): number {
  if (!state.lastDay) return 0;
  const today = localDayKey(now);
  const yesterday = localDayKey(addLocalDays(now, -1));
  return state.lastDay === today || state.lastDay === yesterday ? state.count : 0;
}
