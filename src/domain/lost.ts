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
import { addLocalDays, endOfLocalDay, localDayKey, minutes, sameLocalDay, startOfLocalDay } from './time';
import type { Block } from './types';

export const LOST_GRACE_MS = minutes(30);

/** Fine effettiva (§8): fine reale, o 23:59 locale del giorno d'inizio. */
export function effectiveEnd(block: Pick<Block, 'start' | 'end' | 'hasTime'>): number {
  return block.end ?? endOfLocalDay(block.start);
}

/**
 * Ultimo giorno incluso dell'orizzonte di un todo (§6):
 * giorno → data scelta; settimana → domenica della settimana; mese → ultimo giorno del mese.
 * Ritorna 00:00 locale di quel giorno.
 */
export function horizonLastDay(start: number, horizon: NonNullable<Block['horizon']>): number {
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

/** true se oggi (giorno locale di `now`) è ancora entro l'orizzonte del todo. */
export function todoWithinHorizon(block: Block, now: number): boolean {
  const horizon = block.horizon ?? 'giorno';
  const last = horizonLastDay(block.start, horizon);
  return startOfLocalDay(now) <= last;
}

/**
 * Il blocco va marcato `perso` adesso? (§8 marcatura; §6 per i todo)
 * - evento: mai;
 * - todo con orizzonte ≠ giorno e ancora entro l'orizzonte: no (rotola invece, §6);
 * - altrimenti: `programmato` e adesso > fine effettiva + 30'.
 */
export function shouldMarkLost(block: Block, now: number): boolean {
  if (block.state !== 'programmato') return false;
  if (block.kind === 'evento') return false;
  if (block.kind === 'todo' && (block.horizon ?? 'giorno') !== 'giorno' && todoWithinHorizon(block, now)) {
    return false;
  }
  return now > effectiveEnd(block) + LOST_GRACE_MS;
}

/** Istante esatto in cui il blocco diventa perso (utile a test e diagnostica). */
export function lostAtInstant(block: Pick<Block, 'start' | 'end' | 'hasTime'>): number {
  return effectiveEnd(block) + LOST_GRACE_MS;
}

/**
 * Scadenza di recupero (§8): fine − 50% della durata; senza durata: inizio + 30'.
 * A quell'istante scatta la notifica di verifica se il blocco non è stato avviato né chiuso.
 */
export function recoveryDeadline(block: Pick<Block, 'start' | 'end'>): number {
  if (block.end === null) return block.start + minutes(30);
  const duration = block.end - block.start;
  return block.end - duration / 2;
}

/**
 * Spunta diretta di una routine (§3): solo se il giorno locale dell'inizio è oggi,
 * OPPURE (routine a cavallo di mezzanotte) l'istante corrente è dentro [inizio, fine].
 * Mai prima, mai dopo.
 */
export function canCheckRoutine(block: Pick<Block, 'start' | 'end'>, now: number): boolean {
  if (sameLocalDay(block.start, now)) return true;
  if (block.end !== null && now >= block.start && now <= block.end) return true;
  return false;
}

/** Notifica "blocco perso" (§8): solo routine/studio, solo se la fine è entro le ultime 2 ore. */
export function lostNotificationDue(block: Block, now: number): boolean {
  if (block.kind !== 'routine' && block.kind !== 'studio') return false;
  return now - effectiveEnd(block) <= 2 * 60 * minutes(1);
}

/**
 * Esiti pendenti (§8): blocchi di studio `persi` negli ultimi 3 giorni o `programmati`
 * con fine reale passata; dal più recente; massimo 5.
 */
export function pendingOutcomes(blocks: readonly Block[], now: number, max = 5): Block[] {
  const threeDaysAgo = addLocalDays(startOfLocalDay(now), -3);
  return blocks
    .filter((b) => b.kind === 'studio')
    .filter((b) => {
      if (b.state === 'perso') return (b.lostAt ?? effectiveEnd(b)) >= threeDaysAgo;
      if (b.state === 'programmato') return b.end !== null && b.end < now;
      return false;
    })
    .sort((a, b) => b.start - a.start)
    .slice(0, max);
}

/** Comodo per i log/diagnostica: giorno locale del blocco (§1). */
export function blockDay(block: Pick<Block, 'start'>): string {
  return localDayKey(block.start);
}
