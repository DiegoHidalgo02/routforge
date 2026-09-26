/**
 * Blocchi persi, scadenza di recupero, finestra di spunta delle routine.
 * Fonti: RoutForge_MECCANISMI.md §3 (spunta), §6 (todo "non fatto"), §8 (persi e recupero).
 * Criteri: SCENARI A1, B2, B3, B4, B7, E2.
 *
 * - Fine effettiva = fine reale, oppure 23:59 del giorno d'inizio (senza durata / senza orario).
 * - `perso`: blocco `programmato`, non evento, non todo entro orizzonte, fine effettiva
 *   passata da > 30 minuti. Un evento non è mai perso.
 * - Scadenza di recupero = fine − 50% della durata (senza durata: inizio + 30').
 */
import { addLocalDays, endOfLocalDay, localDayKey, localInstant, minutes, sameLocalDay, startOfLocalDay } from './time';
import type { Blocco } from './types';

export const LOST_GRACE_MS = minutes(30);

/** Fine effettiva (§8): fine reale, o 23:59 locale del giorno d'inizio. */
export function effectiveEnd(block: Pick<Blocco, 'inizio' | 'fine' | 'conOrario'>): number {
  return block.fine ?? endOfLocalDay(block.inizio);
}

/**
 * Ultimo giorno incluso dell'orizzonte di un todo (§6):
 * giorno → data scelta; settimana → domenica della settimana; mese → ultimo giorno del mese.
 * Ritorna 00:00 locale di quel giorno.
 */
export function horizonLastDay(start: number, horizon: NonNullable<Blocco['orizzonte']>): number {
  const day0 = startOfLocalDay(start);
  const d = new Date(day0);
  switch (horizon) {
    case 'giorno':
      return day0;
    case 'settimana': {
      // getDay(): 0 = domenica … 6 = sabato → giorni mancanti alla domenica
      const toSunday = (7 - d.getDay()) % 7;
      return addLocalDays(day0, toSunday);
    }
    case 'mese':
      return new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime();
  }
}

/**
 * true se oggi (giorno locale di `now`) è ancora entro l'orizzonte del todo. L'orizzonte parte dal giorno del todo:
 * quello di parete memorizzato (`giornoLocale`) quando c'è, perché dopo un cambio di fuso gli istanti di un giorno
 * passato restano quelli di prima e possono cadere in un altro giorno (D-TIME-2); mezzogiorno è dentro il giorno anche
 * con l'ora legale.
 */
export function todoWithinHorizon(block: Blocco & { giornoLocale?: string }, now: number): boolean {
  const horizon = block.orizzonte ?? 'giorno';
  const giorno = block.giornoLocale ? localInstant(block.giornoLocale, '12:00') : block.inizio;
  return startOfLocalDay(now) <= horizonLastDay(giorno, horizon);
}

/** Todo con orizzonte settimana o mese ancora aperto (§6): rotola a oggi invece di diventare «non fatto». */
export const isRollingTodo = (block: Blocco & { giornoLocale?: string }, now: number): boolean =>
  block.tipo === 'todo' && (block.orizzonte ?? 'giorno') !== 'giorno' && todoWithinHorizon(block, now);

/**
 * Il blocco va marcato `perso` adesso? (§8 marcatura; §6 per i todo)
 * - evento: mai;
 * - todo con orizzonte ≠ giorno e ancora entro l'orizzonte: no (rotola invece, §6);
 * - altrimenti: `programmato` e adesso > fine effettiva + 30'.
 */
export function shouldMarkLost(block: Blocco & { giornoLocale?: string }, now: number): boolean {
  if (block.stato !== 'programmato') return false;
  if (block.tipo === 'evento') return false;
  if (isRollingTodo(block, now)) return false;
  return now > effectiveEnd(block) + LOST_GRACE_MS;
}

/** Istante esatto in cui il blocco diventa perso (utile a test e diagnostica). */
export function lostAtInstant(block: Pick<Blocco, 'inizio' | 'fine' | 'conOrario'>): number {
  return effectiveEnd(block) + LOST_GRACE_MS;
}

/**
 * Scadenza di recupero (§8): fine − 50% della durata; senza durata: inizio + 30'.
 * A quell'istante scatta la notifica di verifica se il blocco non è stato avviato né chiuso.
 */
export function recoveryDeadline(block: Pick<Blocco, 'inizio' | 'fine'>): number {
  if (block.fine === null) return block.inizio + minutes(30);
  const duration = block.fine - block.inizio;
  return block.fine - duration / 2;
}

/**
 * Spunta diretta di una routine (§3): solo se il giorno locale dell'inizio è oggi,
 * OPPURE (routine a cavallo di mezzanotte) l'istante corrente è dentro [inizio, fine].
 * Mai prima, mai dopo.
 */
export function canCheckRoutine(block: Pick<Blocco, 'inizio' | 'fine'>, now: number): boolean {
  if (sameLocalDay(block.inizio, now)) return true;
  if (block.fine !== null && now >= block.inizio && now <= block.fine) return true;
  return false;
}

/** Notifica "blocco perso" (§8): solo routine/studio, solo se la fine è entro le ultime 2 ore. */
export function lostNotificationDue(block: Blocco, now: number): boolean {
  if (block.tipo !== 'routine' && block.tipo !== 'studio') return false;
  return now - effectiveEnd(block) <= 2 * 60 * minutes(1);
}

/**
 * Esiti pendenti (§8): blocchi di studio `persi` negli ultimi 3 giorni o `programmati`
 * con fine reale passata; dal più recente; massimo 5.
 */
export function pendingOutcomes(blocks: readonly Blocco[], now: number, max = 5): Blocco[] {
  const threeDaysAgo = addLocalDays(startOfLocalDay(now), -3);
  return blocks
    .filter((b) => b.tipo === 'studio')
    .filter((b) => {
      if (b.stato === 'perso') return (b.persoIl ?? effectiveEnd(b)) >= threeDaysAgo;
      if (b.stato === 'programmato') return b.fine !== null && b.fine < now;
      return false;
    })
    .sort((a, b) => b.inizio - a.inizio)
    .slice(0, max);
}

/** Comodo per i log/diagnostica: giorno locale del blocco (§1). */
export function blockDay(block: Pick<Blocco, 'inizio'>): string {
  return localDayKey(block.inizio);
}
