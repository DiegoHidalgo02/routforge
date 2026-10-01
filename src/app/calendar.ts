/**
 * Calendario di Oggi (S1; FUNZ §2, MECC §24): i blocchi di un periodo, giorno per giorno, nell'ordine della vista
 * Giorno (`sortDay`: fascia senza orario per priorità, poi con orario). Criterio: SCENARI A5; vista pronta in meno di
 * 0,5 s su 500 blocchi (indice `[giornoLocale+inizio]`, una sola lettura per periodo).
 */
import type { RoutForgeDb } from '../data/db';
import { blocksBetween } from '../data/repository';
import { sortDay } from '../domain/ordering';
import type { Blocco, OraDiParete } from '../domain/types';

/** Un blocco come lo mostra il calendario: con gli orari di parete memorizzati (D-TIME-2). */
export type BloccoCalendario = Blocco & OraDiParete & { giornoLocale: string };

/**
 * I blocchi ordinati di ogni giorno del periodo (chiavi "YYYY-MM-DD" consecutive, come le danno `weekOf` e
 * `monthGrid`); un giorno libero ha l'elenco vuoto.
 */
export async function calendarDays(
  db: RoutForgeDb,
  giorni: readonly string[],
): Promise<Map<string, BloccoCalendario[]>> {
  const periodo = new Map(giorni.map((g) => [g, [] as BloccoCalendario[]]));
  const [primo, ultimo] = [giorni[0], giorni.at(-1)];
  if (primo && ultimo) for (const b of await blocksBetween(db, primo, ultimo)) periodo.get(b.giornoLocale)?.push(b);
  for (const [g, blocchi] of periodo) periodo.set(g, sortDay(blocchi));
  return periodo;
}
