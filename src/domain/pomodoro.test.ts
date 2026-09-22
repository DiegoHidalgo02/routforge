import { describe, expect, it } from 'vitest';
import { minutesByUnit, planSegments, totalMinutes } from './pomodoro';

const shape = (s: ReturnType<typeof planSegments>) => s.map((x) => `${x.kind[0]}${x.minutes}`).join('/');

describe('Pomodoro — MECCANISMI §10.3 / SCENARI D3', () => {
  it('D3: 90\' con 25/5 → 25/5/25/5/25/5 (tassellano esattamente)', () => {
    const segs = planSegments('25/5', 90);
    expect(shape(segs)).toBe('s25/p5/s25/p5/s25/p5');
    expect(totalMinutes(segs)).toBe(90);
  });

  it('D3: 80\' con 25/5 → l\'ultimo studio è troncato a 20 e la pausa a 0 è omessa', () => {
    const segs = planSegments('25/5', 80);
    expect(shape(segs)).toBe('s25/p5/s25/p5/s20');
    expect(totalMinutes(segs)).toBe(80);
  });

  it('50/10 su 100\' → 50/10/40', () => {
    expect(shape(planSegments('50/10', 100))).toBe('s50/p10/s40');
  });

  it('senza durata (cronometro) → 4 cicli studio+pausa', () => {
    const segs = planSegments('90/20', null);
    expect(segs).toHaveLength(8);
    expect(segs.filter((s) => s.kind === 'studio')).toHaveLength(4);
  });

  it('D3 multi-materia: 50\' sulla prima unità e 25\' sulla seconda', () => {
    const segs = planSegments('25/5', 90); // s p s p s p
    const units = ['u1', undefined, 'u1', undefined, 'u2', undefined];
    const m = minutesByUnit(segs, units);
    expect(m.get('u1')).toBe(50);
    expect(m.get('u2')).toBe(25);
  });
});
