import { describe, expect, it } from 'vitest';
import { creditStreak, currentStreak, EMPTY_STREAK, outcomeCountsForStreak } from './streak';
import { local } from './time';

describe('Streak — MECCANISMI §12 / SCENARI C2', () => {
  it('la prima sessione che conta porta la streak a 1', () => {
    const s = creditStreak(EMPTY_STREAK, local(2026, 9, 22, 9, 30));
    expect(s.conteggio).toBe(1);
    expect(s.ultimoGiorno).toBe('2026-09-22');
  });

  it('C2: +1 una sola volta anche con due sessioni oggi', () => {
    const s1 = creditStreak(EMPTY_STREAK, local(2026, 9, 22, 9, 30));
    const s2 = creditStreak(s1, local(2026, 9, 22, 21, 0));
    expect(s2.conteggio).toBe(1);
  });

  it('giorni consecutivi: ieri → oggi = +1', () => {
    let s = creditStreak(EMPTY_STREAK, local(2026, 9, 21, 9, 30));
    s = creditStreak(s, local(2026, 9, 22, 9, 30));
    expect(s.conteggio).toBe(2);
  });

  it('si spezza se passa un giorno intero senza: riparte da 1', () => {
    let s = creditStreak(EMPTY_STREAK, local(2026, 9, 20, 9, 30));
    s = creditStreak(s, local(2026, 9, 22, 9, 30));
    expect(s.conteggio).toBe(1);
  });

  it("valore mostrato: 0 se l'ultimo giorno contato non è oggi né ieri", () => {
    const s = creditStreak(EMPTY_STREAK, local(2026, 9, 20, 9, 30));
    expect(currentStreak(s, local(2026, 9, 21, 8, 0))).toBe(1); // ieri
    expect(currentStreak(s, local(2026, 9, 22, 8, 0))).toBe(0); // due giorni dopo
  });

  it('solo Completata e Continua contano', () => {
    expect(outcomeCountsForStreak('completata')).toBe(true);
    expect(outcomeCountsForStreak('continua')).toBe(true);
    expect(outcomeCountsForStreak('indietro')).toBe(false);
    expect(outcomeCountsForStreak('salta')).toBe(false);
  });
});
