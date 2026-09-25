/**
 * Ordine dei blocchi nella vista Giorno.
 * Fonte: MECCANISMI §24 (fascia senza orario per priorità → blocchi con orario cronologici), §6 (alta → normale →
 * bassa, poi inizio). Scenari: A5 (la parte di dominio; vista Giorno in T-008, widget in T-023).
 *
 * Un blocco senza orario senza priorità (evento tutto il giorno) vale «normale» (D-CREA-1).
 */
import type { Blocco, Priorita } from './types';

const PESO: Record<Priorita, number> = { alta: 0, normale: 1, bassa: 2 };

/** I blocchi di un giorno nell'ordine della vista: prima la fascia senza orario, poi quelli con orario. */
export function sortDay<T extends Pick<Blocco, 'conOrario' | 'inizio' | 'priorita'>>(blocchi: readonly T[]): T[] {
  const peso = (b: T) => (b.conOrario ? 3 : PESO[b.priorita ?? 'normale']);
  return [...blocchi].sort((a, b) => peso(a) - peso(b) || a.inizio - b.inizio);
}
