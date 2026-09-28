import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webClock } from './clock';

// Battito dell'adapter web (D-SCHED-1 n. 6): scatta al cambio di minuto, non un minuto dopo l'avvio.
describe('Battito al cambio di minuto — MECC §9, SCENARI G4 (app aperta a mezzanotte)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 22, 23, 59, 30)); // martedì 22 settembre, 23:59:30 locali
  });
  afterEach(() => vi.useRealTimers());

  it('il primo scatto cade alle 00:00:00, poi a ogni minuto; dopo lo stop nessuno', () => {
    const scatti: Date[] = [];
    const stop = webClock.every(60_000, () => scatti.push(new Date()));
    vi.advanceTimersByTime(29_999);
    expect(scatti).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(scatti.map((d) => [d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()])).toEqual([[23, 0, 0, 0]]);
    vi.advanceTimersByTime(60_000);
    expect(scatti).toHaveLength(2);
    stop();
    vi.advanceTimersByTime(180_000);
    expect(scatti).toHaveLength(2);
  });
});
