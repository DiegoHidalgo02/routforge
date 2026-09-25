/**
 * Fasi di routine ed eventi: log al completamento, fasi mostrate nel dettaglio, follow-up.
 * Fonte: MECCANISMI §5 (completamento a inversione, log, dettaglio di un'occorrenza chiusa, follow-up solo eventi);
 * FUNZIONALITA §5. Scenari: B5, E1. La chiave del log è l'id del blocco dell'occorrenza (D-DATA-2): salvarlo di nuovo
 * sovrascrive. Il titolo del follow-up è l'etichetta della fase (S5, D-DETT-1).
 */
import type { BozzaAttivita } from './activity';
import { localDayKey } from './time';
import type { FaseLog, FaseTemplate, StatoFase } from './types';

const inOrdine = (fasi: readonly FaseTemplate[]): FaseTemplate[] => [...fasi].sort((a, b) => a.ordine - b.ordine);

/** Fotografia al Conferma (§5): ogni fase del template, nell'ordine, `fatta` salvo quelle marcate `saltate`. */
export function phaseLog(fasi: readonly FaseTemplate[], saltate: readonly string[]): FaseLog[] {
  return inOrdine(fasi).map((f) => ({
    id: f.id,
    etichetta: f.etichetta,
    stato: saltate.includes(f.id) ? 'saltata' : 'fatta',
  }));
}

/** Fasi nel dettaglio (§5): con il log valgono le sue etichette congelate; senza, il template corrente con stato nullo. */
export function shownPhases(
  fasi: readonly FaseTemplate[],
  log: readonly FaseLog[] | null,
): { id: string; etichetta: string; stato: StatoFase | null }[] {
  if (log) return log.map((f) => ({ id: f.id, etichetta: f.etichetta, stato: f.stato }));
  return inOrdine(fasi).map((f) => ({ id: f.id, etichetta: f.etichetta, stato: null }));
}

/** Bozza del todo di follow-up di una fase saltata (§5, E1): senza orario, oggi, orizzonte mese, priorità normale. */
export const followUpDraft = (titolo: string, now: number): BozzaAttivita => ({
  tipo: 'todo',
  titolo,
  note: '',
  promemoria: { modo: 'auto' },
  giorno: localDayKey(now),
  orario: null,
  orizzonte: 'mese',
  priorita: 'normale',
  checklist: [],
  corsoId: null,
});
