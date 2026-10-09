import { describe, expect, it } from 'vitest';
import { planSegments } from './pomodoro';

const shape = (s: ReturnType<typeof planSegments>) => s.map((x) => `${x.tipo[0]}${x.minuti}`).join('/');

// Con una durata i segmenti la tassellano in `segmentTimeline`: D3 e il multi-materia stanno in `timer.test.ts`
describe('Pomodoro senza durata — MECCANISMI §10.3, D-POMO-1', () => {
  it('cronometro → 4 cicli studio+pausa del preset', () => {
    const segs = planSegments('90/20');
    expect(shape(segs)).toBe('s90/p20/s90/p20/s90/p20/s90/p20');
  });
});
