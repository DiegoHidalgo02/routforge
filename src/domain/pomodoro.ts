/**
 * Pomodoro: segmenti studio/pausa che tassellano la durata della sessione.
 * Fonte: RoutForge_MECCANISMI.md §10.3 — criterio: SCENARI D3.
 *
 * - Preset 25/5, 50/10, 90/20.
 * - I segmenti tassellano la durata: l'ultimo viene troncato; un segmento
 *   troncato a 0 minuti è omesso (D3: 80' → 25/5/25/5/20, pausa finale omessa).
 * - Senza durata (cronometro): 4 cicli studio+pausa (decisione D-POMO-1: 8 segmenti).
 */

export type PomodoroPreset = '25/5' | '50/10' | '90/20';

export type SegmentKind = 'studio' | 'pausa';

export interface Segment {
  kind: SegmentKind;
  minutes: number;
  /** Indice del ciclo (0-based) a cui appartiene il segmento. */
  cycle: number;
}

export const PRESETS: Record<PomodoroPreset, { studio: number; pausa: number }> = {
  '25/5': { studio: 25, pausa: 5 },
  '50/10': { studio: 50, pausa: 10 },
  '90/20': { studio: 90, pausa: 20 },
};

const CYCLES_WITHOUT_DURATION = 4;

/**
 * Pianifica i segmenti.
 * @param totalMinutes durata pianificata della sessione; `null` = cronometro (4 cicli).
 */
export function planSegments(preset: PomodoroPreset, totalMinutes: number | null): Segment[] {
  const { studio, pausa } = PRESETS[preset];
  const out: Segment[] = [];

  if (totalMinutes === null) {
    for (let c = 0; c < CYCLES_WITHOUT_DURATION; c++) {
      out.push({ kind: 'studio', minutes: studio, cycle: c });
      out.push({ kind: 'pausa', minutes: pausa, cycle: c });
    }
    return out;
  }

  let remaining = Math.max(0, Math.floor(totalMinutes));
  let cycle = 0;
  while (remaining > 0) {
    const s = Math.min(studio, remaining);
    out.push({ kind: 'studio', minutes: s, cycle });
    remaining -= s;
    if (remaining <= 0) break;
    const p = Math.min(pausa, remaining);
    out.push({ kind: 'pausa', minutes: p, cycle });
    remaining -= p;
    cycle++;
  }
  return out;
}

/** Somma dei minuti di tutti i segmenti (le pause contano nel totale, §10.3). */
export function totalMinutes(segments: readonly Segment[]): number {
  return segments.reduce((acc, s) => acc + s.minutes, 0);
}

/**
 * Attribuzione del tempo per unità: ogni segmento di studio può avere un'unità
 * diversa; le pause non si attribuiscono. L'esito resta sull'unità pianificata (§10.3).
 * @param unitBySegment unità attiva per indice di segmento (undefined = nessuna)
 */
export function minutesByUnit(
  segments: readonly Segment[],
  unitBySegment: ReadonlyArray<string | undefined>,
): Map<string, number> {
  const acc = new Map<string, number>();
  segments.forEach((seg, i) => {
    const unit = unitBySegment[i];
    if (seg.kind !== 'studio' || !unit) return;
    acc.set(unit, (acc.get(unit) ?? 0) + seg.minutes);
  });
  return acc;
}
