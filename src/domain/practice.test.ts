import { describe, expect, it } from 'vitest';
import {
  scoreBugHunter,
  scoreBugHunterExercise,
  scoreDevSwipe,
  verdictFromSwipe,
  type Verdict,
} from './practice';

describe('DevSwipe — SCENARI I2', () => {
  it('mazzo di 10 carte, 3 errori → 7/10 e le 3 sbagliate vengono riproposte', () => {
    const expected: Verdict[] = Array(10).fill('corretto');
    const given: Verdict[] = [...expected];
    given[1] = 'errato';
    given[4] = 'errato';
    given[8] = 'errato';
    const r = scoreDevSwipe(expected, given);
    expect(r.correct).toBe(7);
    expect(r.total).toBe(10);
    expect(r.score).toBe(0.7);
    expect(r.toRetry).toEqual([1, 4, 8]);
  });

  it('swipe a destra = corretto, a sinistra = errato', () => {
    expect(verdictFromSwipe('destra')).toBe('corretto');
    expect(verdictFromSwipe('sinistra')).toBe('errato');
  });
});

describe('Bug Hunter — SCENARI I3', () => {
  it('riga errata 4: tocco su 4 al primo tentativo → 2 punti', () => {
    expect(scoreBugHunterExercise(4, [4])).toEqual({ points: 2, solved: true });
  });

  it('tocco su 2, poi su 4 → 1 punto', () => {
    expect(scoreBugHunterExercise(4, [2, 4])).toEqual({ points: 1, solved: true });
  });

  it('due errori → 0 punti e soluzione mostrata', () => {
    expect(scoreBugHunterExercise(4, [2, 3])).toEqual({ points: 0, solved: false });
  });

  it('il terzo tocco non conta (max 2 tentativi)', () => {
    expect(scoreBugHunterExercise(4, [2, 3, 4]).points).toBe(0);
  });

  it('punteggio finale = punti / (2 × esercizi)', () => {
    const r = scoreBugHunter([2, 1, 0]);
    expect(r).toEqual({ points: 3, max: 6, score: 0.5 });
  });
});
