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
  /** Indice del ciclo (0-based) a cui appartiene il segmento. */
  ciclo: number;
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
      out.push({ tipo: 'studio', minuti: studio, ciclo: c });
      out.push({ tipo: 'pausa', minuti: pausa, ciclo: c });
    }
    return out;
  }

  let remaining = Math.max(0, Math.floor(totalMinutes));
  let ciclo = 0;
  while (remaining > 0) {
    const s = Math.min(studio, remaining);
    out.push({ tipo: 'studio', minuti: s, ciclo });
    remaining -= s;
    if (remaining <= 0) break;
    const p = Math.min(pausa, remaining);
    out.push({ tipo: 'pausa', minuti: p, ciclo });
    remaining -= p;
    ciclo++;
  }
  return out;
}

/** Somma dei minuti di tutti i segmenti (le pause contano nel totale, §10.3). */
export function totalMinutes(segments: readonly Segmento[]): number {
  return segments.reduce((acc, s) => acc + s.minuti, 0);
}

/**
 * Attribuzione del tempo per unità: ogni segmento di studio può avere un'unità
 * diversa; le pause non si attribuiscono. L'esito resta sull'unità pianificata (§10.3).
 * @param unitBySegment unità attiva per indice di segmento (undefined = nessuna)
 */
export function minutesByUnit(
  segments: readonly Segmento[],
  unitBySegment: ReadonlyArray<string | undefined>,
): Map<string, number> {
  const acc = new Map<string, number>();
  segments.forEach((seg, i) => {
    const unit = unitBySegment[i];
    if (seg.tipo !== 'studio' || !unit) return;
    acc.set(unit, (acc.get(unit) ?? 0) + seg.minuti);
  });
  return acc;
}
