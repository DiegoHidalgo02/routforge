/**
 * «Il tuo progresso oggi», «Prossime attività» e «Giornata chiusa» di Oggi (S1).
 * Fonte: FUNZIONALITA §2, MECCANISMI §20 (focus delle sessioni concluse, delta sul periodo precedente), §24 (chiusi);
 * valori di `claude-design/docs/DATI-UI.md`. Scenari: A7 e C10 («Completate» sale anche con «Continua»). Decisione:
 * D-PROG-1.
 */
import { ORDINE_TIPI } from './calendar';
import { STATI_TERMINALI, type Blocco, type StatoBlocco, type TipoBlocco } from './types';

/** Le completate della giornata: il completato, e gli esiti di una sessione di studio registrata (C10: «Continua»). */
const FATTI: ReadonlySet<StatoBlocco> = new Set(['completato', 'parziale', 'indietro']);

export const isDone = (b: Pick<Blocco, 'stato'>): boolean => FATTI.has(b.stato);

/** «Completate»: fatte su tutte le attività del giorno, con la percentuale intera. */
export function dayProgress(blocchi: readonly Pick<Blocco, 'stato'>[]): {
  fatte: number;
  totale: number;
  percento: number;
} {
  const fatte = blocchi.filter(isDone).length;
  return { fatte, totale: blocchi.length, percento: blocchi.length ? Math.round((fatte / blocchi.length) * 100) : 0 };
}

/** Il delta del focus di oggi su ieri in percentuale intera (§20); senza focus ieri non c'è confronto. */
export const focusDelta = (oggi: number, ieri: number): number | null =>
  ieri > 0 ? Math.round(((oggi - ieri) / ieri) * 100) : null;

/** Il tipo che pesa di più fra i blocchi dati (colore dei grafici della terna, DATI-UI); a parità l'ordine dei tipi. */
export function heaviestType(blocchi: readonly Pick<Blocco, 'tipo'>[]): TipoBlocco | null {
  let migliore: TipoBlocco | null = null;
  let max = 0;
  for (const tipo of ORDINE_TIPI) {
    const n = blocchi.filter((b) => b.tipo === tipo).length;
    if (n > max) [migliore, max] = [tipo, n];
  }
  return migliore;
}

/** Giornata chiusa (S1 `variant=done`): almeno un'attività, e tutte chiuse (§1: completate, saltate, perse, esiti). */
export const dayClosed = (blocchi: readonly Pick<Blocco, 'stato'>[]): boolean =>
  blocchi.length > 0 && blocchi.every((b) => STATI_TERMINALI.has(b.stato));

/**
 * «Prossime attività»: i primi due giorni dopo `oggi` che hanno attività, nell'ordine dei giorni (FUNZ §2). `giorni` è
 * una mappa giorno → blocchi, anche con giorni vuoti.
 */
export function upcomingDays<B>(giorni: ReadonlyMap<string, readonly B[]>, oggi: string): [string, readonly B[]][] {
  return [...giorni]
    .filter(([g, blocchi]) => g > oggi && blocchi.length > 0)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(0, 2);
}
