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

export type Verdetto = 'corretto' | 'errato';
export type DirezioneSwipe = 'destra' | 'sinistra';

/** Mappa lo swipe al verdetto dell'utente (§18: destra = corretto, sinistra = errato). */
export function verdictFromSwipe(direction: DirezioneSwipe): Verdetto {
  return direction === 'destra' ? 'corretto' : 'errato';
}

export interface RisultatoDevSwipe {
  giuste: number;
  totali: number;
  /** Frazione 0..1 = giuste al primo passaggio / totali. */
  punteggio: number;
  /** Indici delle carte sbagliate al primo passaggio, da riproporre una volta. */
  daRiproporre: number[];
}

/**
 * @param expected verdetti attesi delle carte, in ordine
 * @param firstPass verdetti dati dall'utente al primo passaggio, stesso ordine
 */
export function scoreDevSwipe(expected: readonly Verdetto[], firstPass: readonly Verdetto[]): RisultatoDevSwipe {
  if (expected.length !== firstPass.length) {
    throw new Error('scoreDevSwipe: expected e firstPass devono avere la stessa lunghezza');
  }
  const daRiproporre: number[] = [];
  let giuste = 0;
  expected.forEach((v, i) => {
    if (firstPass[i] === v) giuste++;
    else daRiproporre.push(i);
  });
  const totali = expected.length;
  return { giuste, totali, punteggio: totali === 0 ? 0 : giuste / totali, daRiproporre };
}

// -------------------------------------------------------------- Bug Hunter

export interface RisultatoEsercizioBugHunter {
  /** 2 al primo tentativo, 1 al secondo, altrimenti 0. */
  punti: 0 | 1 | 2;
  /** La riga sbagliata è stata trovata. */
  risolto: boolean;
  /** L'esercizio è chiuso (riga trovata o due tentativi): si mostrano codice corretto e spiegazione. */
  finito: boolean;
}

/**
 * @param wrongLine numero (1-based) della riga sbagliata dell'esercizio
 * @param taps sequenza delle righe toccate dall'utente (max 2 righe diverse considerate: ritoccare la stessa riga
 *   sbagliata non consuma il secondo tentativo)
 */
export function scoreBugHunterExercise(wrongLine: number, taps: readonly number[]): RisultatoEsercizioBugHunter {
  const [first, second] = [...new Set(taps)];
  if (first === wrongLine) return { punti: 2, risolto: true, finito: true };
  if (second === wrongLine) return { punti: 1, risolto: true, finito: true };
  return { punti: 0, risolto: false, finito: second !== undefined };
}

/** Punteggio finale = punti / (2 × esercizi). */
export function scoreBugHunter(points: readonly number[]): { punti: number; massimo: number; punteggio: number } {
  const sum = points.reduce((a, b) => a + b, 0);
  const massimo = 2 * points.length;
  return { punti: sum, massimo, punteggio: massimo === 0 ? 0 : sum / massimo };
}
