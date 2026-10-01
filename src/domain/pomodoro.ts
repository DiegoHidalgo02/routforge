/**
 * Pomodoro: segmenti studio/pausa che tassellano la durata della sessione.
 * Fonte: RoutForge_MECCANISMI.md §10.3 — criterio: SCENARI D3.
 *
 * - Preset 25/5, 50/10, 90/20.
 * - I segmenti tassellano la durata: l'ultimo viene troncato; un segmento
 *   troncato a 0 minuti è omesso (D3: 80' → 25/5/25/5/20, pausa finale omessa).
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

/**
 * Pianifica i segmenti.
 * @param totalMinutes durata pianificata della sessione; `null` = cronometro (4 cicli).
 */
export function planSegments(preset: PresetPomodoro, totalMinutes: number | null): Segmento[] {
  const { studio, pausa } = PRESETS[preset];
  const out: Segmento[] = [];

  if (totalMinutes === null) {
    for (let c = 0; c < CYCLES_WITHOUT_DURATION; c++) {
      out.push({ tipo: 'studio', minuti: studio });
      out.push({ tipo: 'pausa', minuti: pausa });
    }
    return out;
  }

  let remaining = Math.max(0, Math.floor(totalMinutes));
  while (remaining > 0) {
    const s = Math.min(studio, remaining);
    out.push({ tipo: 'studio', minuti: s });
    remaining -= s;
    if (remaining <= 0) break;
    const p = Math.min(pausa, remaining);
    out.push({ tipo: 'pausa', minuti: p });
    remaining -= p;
  }
  return out;
}
// Il tempo per unità si attribuisce sul tempo reale, non sui minuti pianificati: `summary` di `timer.ts` (D-TIMER-1).
