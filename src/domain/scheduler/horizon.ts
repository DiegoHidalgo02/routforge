/**
 * Todo: spostamento a oggi e avviso «in ritardo».
 * Fonte: MECCANISMI §6 (orizzonte, spostamento a oggi con ancora 12:00 o slot libero 08:00–22:00, «non fatto»,
 * avviso una volta per todo), §1 (ancora dei todo senza orario 12:00–23:59), §9 (lo spostamento precede la
 * marcatura dei persi). Decisioni: D-TIME-2 (ora di parete), D-HOR-1 (letture di §6). Scenari: A1, A2.
 *
 * Schema «differenza da applicare» (docs/02_ARCHITETTURA.md §4): il servizio (`src/app/horizon.ts`) legge i blocchi,
 * `rollPlan` restituisce i todo da riscrivere a oggi con i nuovi istanti; giorno locale e ora di parete li ricalcola
 * `saveBlock`. Il «non fatto» è la marcatura dei persi (`shouldMarkLost` in `lost.ts`), applicata dal ciclo (T-013).
 */
import { ANCORA_TODO } from '../activity';
import { isRollingTodo } from '../lost';
import { endOfLocalDay, localDayKey, localInstant, minutes } from '../time';
import type { Blocco, BloccoAncorato } from '../types';

/** Finestra dello slot libero dei todo con orario (§6). */
export const FINESTRA_SLOT = { inizio: '08:00', fine: '22:00' } as const;
/** Un todo che rotola è al più di 30 giorni fa: l'orizzonte più lungo è il mese, dal primo al 31 (§6). */
export const GIORNI_INDIETRO = 30;
/** La ricerca da adesso parte dal multiplo di 5' successivo: il passo delle durate e dell'aggancio (§2, §15; D-HOR-1). */
export const PASSO = minutes(5);

export interface PianoSpostamento<B extends BloccoAncorato> {
  /**
   * I todo da riscrivere a oggi, nell'ordine di collocazione: nuovi istanti, `orarioOriginale` e, alla prima volta,
   * `ritardoIl`. Giorno locale e ora di parete sono ancora quelli di prima: li ricalcola `saveBlock`.
   */
  spostati: B[];
  /** Id dei todo il cui avviso «in ritardo» parte adesso (§6, §13.6). */
  avvisi: string[];
}

/** L'avviso «todo in ritardo» spetta una volta per todo (§6): allo spostamento a oggi o alla marcatura «non fatto». */
export const lateNoticeDue = (b: Blocco): boolean => b.tipo === 'todo' && b.ritardoIl == null;

/** Rotola a oggi (§6): todo `programmato`, orizzonte ≠ giorno, giorno di parete passato, ancora entro l'orizzonte. */
const rolls = (b: BloccoAncorato, now: number): boolean =>
  b.stato === 'programmato' && b.giornoLocale < localDayKey(now) && isRollingTodo(b, now);

/**
 * Inizio dello slot libero di durata `d` (§6): (1) l'orario originale (quello scelto dall'utente, `orarioOriginale`,
 * altrimenti l'ora di parete del todo) se sta nella finestra e non si sovrappone; (2) il primo varco ≥ d da adesso (al
 * multiplo di 5' successivo) entro la fine della finestra; (3) l'orario originale anche se sovrapposto, se sta nella
 * finestra, altrimenti l'inizio della finestra (D-HOR-1).
 */
function freeSlot(
  originale: number,
  d: number,
  occupati: readonly (readonly [number, number])[],
  finestra: readonly [number, number],
  now: number,
): number {
  const [w0, w1] = finestra;
  const inFinestra = (s: number) => s >= w0 && s + d <= w1;
  if (inFinestra(originale) && occupati.every(([a, b]) => originale + d <= a || b <= originale)) return originale;
  let s = Math.max(w0, Math.ceil(now / PASSO) * PASSO);
  for (const [a, b] of [...occupati].sort((x, y) => x[0] - y[0])) {
    if (b <= s) continue;
    if (a >= s + d) break;
    s = b;
  }
  if (s + d <= w1) return s;
  return inFinestra(originale) ? originale : w0;
}

/**
 * I todo che rotolano a oggi (§6), dai blocchi letti (da `GIORNI_INDIETRO` giorni fa a oggi). Occupano tempo i blocchi
 * con orario e durata `programmati` o `in_corso` che toccano la finestra di oggi, anche di ieri, e i todo già collocati
 * da questo piano: si collocano nell'ordine d'inizio (D-HOR-1).
 */
export function rollPlan<B extends BloccoAncorato>(blocchi: readonly B[], now: number): PianoSpostamento<B> {
  const oggi = localDayKey(now);
  const finestra = [localInstant(oggi, FINESTRA_SLOT.inizio), localInstant(oggi, FINESTRA_SLOT.fine)] as const;
  const occupati: (readonly [number, number])[] = [];
  for (const b of blocchi)
    if (
      b.conOrario &&
      (b.stato === 'programmato' || b.stato === 'in_corso') &&
      b.fine !== null &&
      b.fine > b.inizio &&
      b.inizio < finestra[1] &&
      b.fine > finestra[0] &&
      !rolls(b, now)
    )
      occupati.push([b.inizio, b.fine]);

  const piano: PianoSpostamento<B> = { spostati: [], avvisi: [] };
  const candidati = blocchi.filter((b) => rolls(b, now)).sort((a, b) => a.inizio - b.inizio || (a.id < b.id ? -1 : 1));
  for (const t of candidati) {
    const avviso = lateNoticeDue(t);
    const spostato: B = { ...t, ...(avviso && { ritardoIl: now }) };
    if (t.conOrario) {
      // Senza fine (dati non nati dal form) il todo è un istante: non occupa tempo
      const d = (t.fine ?? t.inizio) - t.inizio;
      const originale = t.orarioOriginale ?? t.orarioInizio;
      const alSuoOrario = localInstant(oggi, originale);
      spostato.inizio = freeSlot(alSuoOrario, d, occupati, finestra, now);
      spostato.fine = t.fine === null ? null : spostato.inizio + d;
      spostato.orarioOriginale = spostato.inizio === alSuoOrario ? null : originale;
      if (d > 0) occupati.push([spostato.inizio, spostato.inizio + d]);
    } else {
      spostato.inizio = localInstant(oggi, ANCORA_TODO);
      spostato.fine = t.fine === null ? null : endOfLocalDay(spostato.inizio);
    }
    piano.spostati.push(spostato);
    if (avviso) piano.avvisi.push(t.id);
  }
  return piano;
}
