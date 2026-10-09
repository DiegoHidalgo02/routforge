/**
 * Pomodoro: i preset e i segmenti senza durata.
 * Fonte: RoutForge_MECCANISMI.md §10.3 — criterio: SCENARI D3 (verificato in `timer.test.ts`).
 *
 * - Preset 25/5, 50/10, 90/20.
 * - Con una durata i segmenti la tassellano sul tempo attivo, l'ultimo troncato: `segmentTimeline` di `timer.ts`, la
 *   sola regola (audit P2-19: qui ce n'era una copia al minuto che il timer non usava).
 * - Senza durata (cronometro): 4 cicli studio+pausa (decisione D-POMO-1: 8 segmenti).
 */

export type PresetPomodoro = '25/5' | '50/10' | '90/20';

export type TipoSegmento = 'studio' | 'pausa';

export interface Segmento {
  tipo: TipoSegmento;
  minuti: number;
}

export const PRESETS: Record<PresetPomodoro, { studio: number; pausa: number }> = {
  '25/5': { studio: 25, pausa: 5 },
  '50/10': { studio: 50, pausa: 10 },
  '90/20': { studio: 90, pausa: 20 },
};

const CYCLES_WITHOUT_DURATION = 4;

/** I segmenti del cronometro (senza durata): 4 cicli studio+pausa del preset (D-POMO-1). */
export function planSegments(preset: PresetPomodoro): Segmento[] {
  const { studio, pausa } = PRESETS[preset];
  const out: Segmento[] = [];
  for (let c = 0; c < CYCLES_WITHOUT_DURATION; c++) {
    out.push({ tipo: 'studio', minuti: studio });
    out.push({ tipo: 'pausa', minuti: pausa });
  }
  return out;
}
// Il tempo per unità si attribuisce sul tempo reale, non sui minuti pianificati: `summary` di `timer.ts` (D-TIMER-1).
