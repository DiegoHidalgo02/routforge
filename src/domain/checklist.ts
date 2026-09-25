/**
 * Checklist dei todo: la spunta di una voce, il suo effetto sullo stato del todo, il todo con le voci rimaste.
 * Fonte: MECCANISMI §4; FUNZIONALITA §6. Scenario: A3. Decisione D-DETT-2 (scelta dell'utente del 25/09/2026): «Segna
 * come fatto» con voci non spuntate può creare un todo con le voci rimaste, che eredita la scadenza del todo da cui
 * nasce, mai prima di oggi. I limiti (60 voci, 120 caratteri) li applica `validateActivity` (activity.ts); il
 * completamento e la riapertura passano dall'unica operazione di §3 (completion.ts).
 */
import type { BozzaAttivita } from './activity';
import { localDayKey } from './time';
import type { Blocco, StatoBlocco, VoceChecklist } from './types';

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

/** Giorno di un todo derivato (D-DETT-2): quello dell'attività da cui nasce, mai prima di oggi. */
export function inheritedDay(inizio: number, now: number): string {
  const giorno = localDayKey(inizio);
  const oggi = localDayKey(now);
  return giorno < oggi ? oggi : giorno;
}

/**
 * Bozza del todo con le voci rimaste (D-DETT-2): stesso titolo, note, priorità, corso e orizzonte del todo da cui
 * nasce, le voci non fatte come checklist, senza orario, nel giorno del todo (mai prima di oggi): la scadenza è la
 * stessa. `null` se le voci sono tutte fatte.
 */
export function leftoverDraft(todo: Blocco, now: number): BozzaAttivita | null {
  const rimaste = (todo.checklist ?? []).filter((v) => !v.fatta).map((v) => v.testo);
  if (rimaste.length === 0) return null;
  return {
    tipo: 'todo',
    titolo: todo.titolo ?? '',
    note: todo.note ?? '',
    promemoria: { modo: 'auto' },
    giorno: inheritedDay(todo.inizio, now),
    orario: null,
    orizzonte: todo.orizzonte ?? 'giorno',
    priorita: todo.priorita ?? 'normale',
    checklist: rimaste,
    corsoId: todo.corsoId ?? null,
  };
}
