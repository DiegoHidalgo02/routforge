/**
 * Periodi del calendario di Oggi: settimana, griglia del mese, scorrimento, carico di un giorno.
 * Fonte: FUNZIONALITA §2 (viste Giorno/Settimana/Mese, scorrere lateralmente), MECCANISMI §24 (Settimana/Mese: per ogni
 * giorno conteggio e tipo dei blocchi). Scenari: nessuno diretto (A5 è l'ordine del giorno, in `ordering.ts`).
 *
 * I giorni sono chiavi locali "YYYY-MM-DD" (time.ts); la settimana inizia di lunedì (D-CAL-1).
 */
import { addLocalDays, localDayKey, localInstant } from './time';
import type { Blocco, TipoBlocco } from './types';

export type Vista = 'giorno' | 'settimana' | 'mese';

/** Ordine dei tipi nei puntini e nella legenda del mese (S1). */
export const ORDINE_TIPI: readonly TipoBlocco[] = ['studio', 'routine', 'todo', 'evento'];
/** Da quanti blocchi una cella del mese è «carica» (S1 «Mese con carico»; D-CAL-1). */
export const CARICO_ALTO = 3;

/** 00:00 locale del giorno "YYYY-MM-DD". */
const dayStart = (giorno: string): number => localInstant(giorno, '00:00');

/** true se `x` è un giorno che esiste, scritto "YYYY-MM-DD" (es. da un indirizzo: `2026-02-31` no). */
export const isDayKey = (x: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(x) && localDayKey(dayStart(x)) === x;

const addDays = (giorno: string, n: number): string => localDayKey(addLocalDays(dayStart(giorno), n));

/** I sette giorni, da lunedì a domenica, della settimana che contiene `giorno`. */
export function weekOf(giorno: string): string[] {
  const lunedi = addDays(giorno, -((new Date(dayStart(giorno)).getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => addDays(lunedi, i));
}

/** Celle della griglia del mese di `giorno`: settimane intere da lunedì, 35 o 42 celle. */
export function monthGrid(giorno: string): { giorno: string; delMese: boolean }[] {
  const mese = giorno.slice(0, 7);
  const primo = weekOf(`${mese}-01`)[0] ?? giorno;
  const ultimo = weekOf(addDays(shiftPeriod(`${mese}-01`, 'mese', 1), -1))[6] ?? giorno;
  const celle: { giorno: string; delMese: boolean }[] = [];
  for (let g = primo; g <= ultimo; g = addDays(g, 1)) celle.push({ giorno: g, delMese: g.startsWith(mese) });
  return celle;
}

/** Il giorno `n` periodi dopo (o prima): giorni, settimane o mesi; nei mesi al più l'ultimo giorno del mese. */
export function shiftPeriod(giorno: string, vista: Vista, n: number): string {
  if (vista !== 'mese') return addDays(giorno, vista === 'giorno' ? n : 7 * n);
  const d = new Date(dayStart(giorno));
  const ultimo = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return localDayKey(new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), ultimo)).getTime());
}

/**
 * Il giorno scelto dopo aver scorso di `n` periodi (D-CAL-2): Giorno e Settimana come `shiftPeriod`; nel Mese oggi se
 * il mese lo contiene, altrimenti il primo del mese, così la selezione si sposta a vista a ogni scorrimento.
 */
export function swipeDay(giorno: string, vista: Vista, n: number, oggi: string): string {
  if (vista !== 'mese') return shiftPeriod(giorno, vista, n);
  const mese = shiftPeriod(`${giorno.slice(0, 7)}-01`, 'mese', n).slice(0, 7);
  return oggi.startsWith(mese) ? oggi : `${mese}-01`;
}

/** Carico di un giorno per Settimana e Mese: quanti blocchi, di quali tipi (MECC §24) e il livello della cella. */
export function dayLoad(blocchi: readonly Pick<Blocco, 'tipo'>[]): {
  n: number;
  tipi: TipoBlocco[];
  livello: 'alto' | 'basso' | null;
} {
  const n = blocchi.length;
  const livello = n >= CARICO_ALTO ? 'alto' : n ? 'basso' : null;
  return { n, tipi: ORDINE_TIPI.filter((t) => blocchi.some((b) => b.tipo === t)), livello };
}

/** Legenda del mese: per ogni tipo, in quanti dei giorni dati c'è almeno un suo blocco. */
export const monthLegend = (
  giorni: readonly (readonly Pick<Blocco, 'tipo'>[])[],
): { tipo: TipoBlocco; giorni: number }[] =>
  ORDINE_TIPI.map((tipo) => ({ tipo, giorni: giorni.filter((g) => g.some((b) => b.tipo === tipo)).length }));
