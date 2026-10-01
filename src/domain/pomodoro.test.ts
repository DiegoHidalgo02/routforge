import { describe, expect, it } from 'vitest';
import { planSegments } from './pomodoro';

const shape = (s: ReturnType<typeof planSegments>) => s.map((x) => `${x.tipo[0]}${x.minuti}`).join('/');

describe('Pomodoro — MECCANISMI §10.3 / SCENARI D3', () => {
  it("D3: 90' con 25/5 → 25/5/25/5/25/5 (tassellano esattamente)", () => {
    const segs = planSegments('25/5', 90);
    expect(shape(segs)).toBe('s25/p5/s25/p5/s25/p5');
    expect(segs.reduce((a, s) => a + s.minuti, 0)).toBe(90);
  });

  it("D3: 80' con 25/5 → l'ultimo studio è troncato a 20 e la pausa a 0 è omessa", () => {
    const segs = planSegments('25/5', 80);
    expect(shape(segs)).toBe('s25/p5/s25/p5/s20');
    expect(segs.reduce((a, s) => a + s.minuti, 0)).toBe(80);
  });

  it("50/10 su 100' → 50/10/40", () => {
    expect(shape(planSegments('50/10', 100))).toBe('s50/p10/s40');
  });

  it('senza durata (cronometro) → 4 cicli studio+pausa', () => {
    const segs = planSegments('90/20', null);
    expect(segs).toHaveLength(8);
    expect(segs.filter((s) => s.tipo === 'studio')).toHaveLength(4);
  });
  // Multi-materia (minuti per unità dal tempo reale): `timer.test.ts` (T-017, D-TIMER-1)
});
