import { describe, expect, it } from 'vitest';
import { local } from '../time';
import { quietShift, type OreSilenziose } from './quietHours';

// Lunedì 28 settembre 2026.
const oggi = (h: number, m = 0) => local(2026, 9, 28, h, m);
const domani = (h: number, m = 0) => local(2026, 9, 29, h, m);
const ore = (dalle: string, alle: string, attive = true): OreSilenziose => ({ attive, dalle, alle });

describe('Ore silenziose — MECCANISMI §13.4, SCENARI F3', () => {
  const notte = ore('22:00', '07:00');

  it('22:00–07:00: la notifica delle 06:00 va alle 07:00 (F3); quella delle 23:30 alle 07:00 del giorno dopo', () => {
    expect(quietShift(oggi(6), notte)).toBe(oggi(7));
    expect(quietShift(oggi(23, 30), notte)).toBe(domani(7));
  });

  it('fuori dalla fascia non si sposta: le 08:00 e il bordo di uscita 07:00; il bordo d’ingresso 22:00 è dentro', () => {
    expect(quietShift(oggi(8), notte)).toBe(oggi(8));
    expect(quietShift(oggi(7), notte)).toBe(oggi(7));
    expect(quietShift(oggi(22), notte)).toBe(domani(7));
  });

  it('fascia dentro lo stesso giorno 13:00–15:00: le 14:00 vanno alle 15:00, le 15:00 e le 12:59 restano', () => {
    const pomeriggio = ore('13:00', '15:00');
    expect(quietShift(oggi(14), pomeriggio)).toBe(oggi(15));
    expect(quietShift(oggi(15), pomeriggio)).toBe(oggi(15));
    expect(quietShift(oggi(12, 59), pomeriggio)).toBe(oggi(12, 59));
  });

  it('spente, o con inizio e fine uguali: nessuno spostamento', () => {
    expect(quietShift(oggi(6), ore('22:00', '07:00', false))).toBe(oggi(6));
    expect(quietShift(oggi(6), ore('07:00', '07:00'))).toBe(oggi(6));
  });

  it('la fine è un’ora di parete anche nella notte del cambio d’ora (25 ottobre 2026)', () => {
    expect(quietShift(local(2026, 10, 24, 23, 30), notte)).toBe(local(2026, 10, 25, 7, 0));
  });
});
