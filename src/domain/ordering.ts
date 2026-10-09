/**
 * Ordine dei blocchi nella vista Giorno e riordino dei todo senza orario.
 * Fonte: MECCANISMI §24 (fascia senza orario per priorità → blocchi con orario cronologici), §6 (alta → normale →
 * bassa, poi l'ordine scelto dall'utente, altrimenti l'inizio; chi entra in un gruppo va in fondo), §15 (riordino solo
 * fra todo senza orario della stessa priorità). Scenari: A5, G3 (la parte di dominio).
 *
 * Un blocco senza orario senza priorità (evento tutto il giorno) vale «normale» (D-CREA-1).
 */
import type { Blocco, Priorita } from './types';

const PESO: Record<Priorita, number> = { alta: 0, normale: 1, bassa: 2 };

type Ordinabile = Pick<Blocco, 'conOrario' | 'inizio' | 'priorita' | 'ordine'>;

/** La chiave nel gruppo di priorità: l'ordine scelto, altrimenti l'inizio (dati di prima di T-044). */
const chiave = (b: Ordinabile): number => b.ordine ?? b.inizio;

/** I blocchi di un giorno nell'ordine della vista: prima la fascia senza orario, poi quelli con orario. */
export function sortDay<T extends Ordinabile>(blocchi: readonly T[]): T[] {
  const peso = (b: T) => (b.conOrario ? 3 : PESO[b.priorita ?? 'normale']);
  return [...blocchi].sort(
    (a, b) => peso(a) - peso(b) || (a.conOrario ? a.inizio - b.inizio : chiave(a) - chiave(b) || a.inizio - b.inizio),
  );
}

/**
 * L'ordine della vista Giorno su desktop (§24, D-DESIGN-1 n. 3): prima i blocchi con orario, poi la fascia senza orario
 * in coda, sempre per priorità. È anche l'ordine del fuoco, per questo non basta riordinare con il CSS.
 */
export function sortDayDesktop<T extends Ordinabile>(blocchi: readonly T[]): T[] {
  const ordinati = sortDay(blocchi);
  return [...ordinati.filter((b) => b.conOrario), ...ordinati.filter((b) => !b.conOrario)];
}

/** Un todo che entra nel suo gruppo di priorità (nuovo, spostato a oggi, priorità cambiata) va in fondo (§6). */
export const enterGroup = <B extends object>(b: B, now: number): B & { ordine: number } => ({ ...b, ordine: now });

/** Si riordinano solo i todo senza orario aperti (§15, G3): eventi, routine, todo con orario e persi no. */
export const canReorder = (b: Pick<Blocco, 'tipo' | 'conOrario' | 'stato'>): boolean =>
  b.tipo === 'todo' && !b.conOrario && b.stato === 'programmato';

type Riordinabile = Ordinabile & Pick<Blocco, 'id' | 'tipo' | 'stato'>;

/** Il gruppo del todo `id` nel giorno (§15): i todo riordinabili con la sua priorità, nell'ordine della vista. */
export function reorderGroup<B extends Riordinabile>(giorno: readonly B[], id: string): B[] {
  const b = giorno.find((x) => x.id === id);
  if (!b || !canReorder(b)) return [];
  const p = b.priorita ?? 'normale';
  return sortDay(giorno.filter((x) => canReorder(x) && (x.priorita ?? 'normale') === p));
}

/**
 * Il todo `id` alla posizione `a` del suo gruppo (§15; D-RIORD-1 n. 3, n. 5): fuori dal gruppo resta dov'era. Cambia solo
 * la sua chiave, scelta fra quelle dei nuovi vicini (prima del successivo in cima, dopo il precedente in fondo, in mezzo
 * altrimenti): gli altri, e ciò che sta fra loro senza riordinarsi (l'evento tutto il giorno), restano dove sono. Solo
 * senza spazio fra i due vicini le chiavi del gruppo si riscrivono distinte dalla più piccola, così chi entra dopo resta
 * in fondo. Restituisce solo le chiavi che cambiano; `null` se il todo non si riordina.
 */
export function reorder<B extends Riordinabile>(
  giorno: readonly B[],
  id: string,
  a: number,
): Map<string, number> | null {
  const gruppo = reorderGroup(giorno, id);
  const da = gruppo.findIndex((x) => x.id === id);
  if (da < 0) return null;
  if (a === da || a < 0 || a >= gruppo.length) return new Map();
  const nuovo = [...gruppo];
  const [b] = nuovo.splice(da, 1);
  nuovo.splice(a, 0, b!);
  const prima = nuovo[a - 1];
  const dopo = nuovo[a + 1];
  const k = !prima ? chiave(dopo!) - 1 : !dopo ? chiave(prima) + 1 : Math.floor((chiave(prima) + chiave(dopo)) / 2);
  if ((!prima || k > chiave(prima)) && (!dopo || k < chiave(dopo))) return new Map([[id, k]]);
  const base = Math.min(...gruppo.map(chiave));
  const chiavi = new Map<string, number>();
  nuovo.forEach((x, i) => {
    if (x.ordine !== base + i) chiavi.set(x.id, base + i);
  });
  return chiavi;
}
