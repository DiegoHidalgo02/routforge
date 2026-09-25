/**
 * Checklist dei todo: la spunta di una voce e il suo effetto sullo stato del todo.
 * Fonte: MECCANISMI §4; FUNZIONALITA §6. Scenario: A3. I limiti (60 voci, 120 caratteri) li applica `validateActivity`
 * (activity.ts); il completamento e la riapertura passano dall'unica operazione di §3 (completion.ts).
 */
import type { StatoBlocco, VoceChecklist } from './types';

/** La spunta inverte solo la voce `i` (§4); la lista di partenza non cambia. */
export const toggleItem = (voci: readonly VoceChecklist[], i: number): VoceChecklist[] =>
  voci.map((v, j) => (j === i ? { ...v, fatta: !v.fatta } : v));

/**
 * Effetto della spunta della voce `i` sul todo, data la lista già aggiornata (§4): tutte spuntate e todo non completato
 * → si completa; una despuntata su todo completato → si riapre; altrimenti niente. La lista vuota non è «tutto fatto».
 */
export function afterToggle(
  voci: readonly VoceChecklist[],
  i: number,
  stato: StatoBlocco,
): 'completa' | 'riapri' | null {
  const tutte = voci.length > 0 && voci.every((v) => v.fatta);
  if (tutte && stato !== 'completato') return 'completa';
  if (stato === 'completato' && voci[i]?.fatta === false) return 'riapri';
  return null;
}
