/**
 * Punteggi delle pratiche generate dall'AI.
 * Fonte: RoutForge_MECCANISMI.md §18 — criteri: SCENARI I2 (DevSwipe), I3 (Bug Hunter).
 *
 * DevSwipe:   destra = corretto, sinistra = errato. A fine mazzo gli errori vengono
 *             riproposti UNA volta; punteggio = giuste al PRIMO passaggio / totali.
 * Bug Hunter: tocco sulla riga. Primo tentativo giusto = 2 punti; secondo = 1;
 *             altrimenti 0 e soluzione mostrata. Punteggio = punti / (2 × esercizi).
 */

// ---------------------------------------------------------------- DevSwipe

export type Verdict = 'corretto' | 'errato';
export type SwipeDirection = 'destra' | 'sinistra';

/** Mappa lo swipe al verdetto dell'utente (§18: destra = corretto, sinistra = errato). */
export function verdictFromSwipe(direction: SwipeDirection): Verdict {
  return direction === 'destra' ? 'corretto' : 'errato';
}

export interface DevSwipeResult {
  correct: number;
  total: number;
  /** Frazione 0..1 = giuste al primo passaggio / totali. */
  score: number;
  /** Indici delle carte sbagliate al primo passaggio, da riproporre una volta. */
  toRetry: number[];
}

/**
 * @param expected verdetti attesi delle carte, in ordine
 * @param firstPass verdetti dati dall'utente al primo passaggio, stesso ordine
 */
export function scoreDevSwipe(expected: readonly Verdict[], firstPass: readonly Verdict[]): DevSwipeResult {
  if (expected.length !== firstPass.length) {
    throw new Error('scoreDevSwipe: expected e firstPass devono avere la stessa lunghezza');
  }
  const toRetry: number[] = [];
  let correct = 0;
  expected.forEach((v, i) => {
    if (firstPass[i] === v) correct++;
    else toRetry.push(i);
  });
  const total = expected.length;
  return { correct, total, score: total === 0 ? 0 : correct / total, toRetry };
}

// -------------------------------------------------------------- Bug Hunter

export const BUG_HUNTER_MAX_ATTEMPTS = 2;

export interface BugHunterExerciseResult {
  /** 2 al primo tentativo, 1 al secondo, altrimenti 0. */
  points: 0 | 1 | 2;
  /** true se la soluzione va mostrata perché l'utente non ha trovato la riga. */
  solved: boolean;
}

/**
 * @param wrongLine numero (1-based) della riga sbagliata dell'esercizio
 * @param taps sequenza delle righe toccate dall'utente (max 2 considerate)
 */
export function scoreBugHunterExercise(wrongLine: number, taps: readonly number[]): BugHunterExerciseResult {
  const first = taps[0];
  const second = taps[1];
  if (first === wrongLine) return { points: 2, solved: true };
  if (second === wrongLine) return { points: 1, solved: true };
  return { points: 0, solved: false };
}

/** Punteggio finale = punti / (2 × esercizi). */
export function scoreBugHunter(points: readonly number[]): { points: number; max: number; score: number } {
  const sum = points.reduce((a, b) => a + b, 0);
  const max = 2 * points.length;
  return { points: sum, max, score: max === 0 ? 0 : sum / max };
}
