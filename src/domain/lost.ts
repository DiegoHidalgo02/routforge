/**
 * Blocchi persi, orfani, scadenza di recupero, finestra di spunta delle routine.
 * Fonti: RoutForge_MECCANISMI.md §3 (spunta), §6 (todo "non fatto"), §8 (persi, recupero, orfani).
 * Criteri: SCENARI A1, B2, B3, B4, B7, C8, E2.
 *
 * - Fine effettiva = fine reale, oppure 23:59 del giorno d'inizio (senza durata / senza orario).
 * - `perso`: blocco `programmato`, non evento, non todo entro orizzonte, fine effettiva
 *   passata da > 30 minuti. Un evento non è mai perso.
 * - Scadenza di recupero = fine − 50% della durata (senza durata: inizio + 30').
 */
import { addLocalDays, endOfLocalDay, HOUR, localInstant, minutes, sameLocalDay, startOfLocalDay } from './time';
import { weekOffset, type InizioSettimana } from './settings';
import type { Blocco } from './types';

const MARGINE_PERSO_MS = minutes(30);

/** Fine effettiva (§8): fine reale, o 23:59 locale del giorno d'inizio. */
export function effectiveEnd(block: Pick<Blocco, 'inizio' | 'fine' | 'conOrario'>): number {
  return block.fine ?? endOfLocalDay(block.inizio);
}

/**
 * Ultimo giorno incluso dell'orizzonte di un todo (§6):
 * giorno → data scelta; settimana → ultimo giorno della settimana (la domenica, il sabato se la settimana inizia di
 * domenica: Impostazioni, FUNZ §23); mese → ultimo giorno del mese.
 * Ritorna 00:00 locale di quel giorno.
 */
export function horizonLastDay(
  start: number,
  horizon: NonNullable<Blocco['orizzonte']>,
  inizioSettimana: InizioSettimana = 1,
): number {
  const day0 = startOfLocalDay(start);
  const d = new Date(day0);
  switch (horizon) {
    case 'giorno':
      return day0;
    case 'settimana': {
      // Giorni mancanti all'ultimo giorno della settimana
      return addLocalDays(day0, 6 - weekOffset(d.getDay(), inizioSettimana));
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
function todoWithinHorizon(
  block: Blocco & { giornoLocale?: string },
  now: number,
  inizioSettimana: InizioSettimana = 1,
): boolean {
  const horizon = block.orizzonte ?? 'giorno';
  const giorno = block.giornoLocale ? localInstant(block.giornoLocale, '12:00') : block.inizio;
  return startOfLocalDay(now) <= horizonLastDay(giorno, horizon, inizioSettimana);
}

/** Todo con orizzonte settimana o mese ancora aperto (§6): rotola a oggi invece di diventare «non fatto». */
export const isRollingTodo = (
  block: Blocco & { giornoLocale?: string },
  now: number,
  inizioSettimana: InizioSettimana = 1,
): boolean =>
  block.tipo === 'todo' && (block.orizzonte ?? 'giorno') !== 'giorno' && todoWithinHorizon(block, now, inizioSettimana);

/**
 * Il blocco va marcato `perso` adesso? (§8 marcatura; §6 per i todo)
 * - evento: mai;
 * - todo con orizzonte ≠ giorno e ancora entro l'orizzonte: no (rotola invece, §6);
 * - altrimenti: `programmato` e adesso ≥ fine effettiva + 30': «alle 10:30 è perso» (SCENARI B2, B7, D7 prevalgono sul
 *   «> 30 minuti» di §8; audit P3-6).
 */
export function shouldMarkLost(
  block: Blocco & { giornoLocale?: string },
  now: number,
  inizioSettimana: InizioSettimana = 1,
): boolean {
  if (block.stato !== 'programmato') return false;
  if (block.tipo === 'evento') return false;
  if (isRollingTodo(block, now, inizioSettimana)) return false;
  return now >= effectiveEnd(block) + MARGINE_PERSO_MS;
}

/**
 * Un `in_corso` arrivato dalla sync è la sessione di un altro dispositivo, che qui non si vede (§25: la sessione attiva
 * non viaggia): non è orfano per 12 ore dal gesto che l'ha avviato là, poi vale §8 (audit P3-4, D-SYNC-7).
 */
export const ATTESA_SESSIONE_ALTROVE_MS = 12 * HOUR;

/**
 * Orfano `in corso` (§8): un blocco resta `in_corso` solo mentre la sessione attiva lo punta. Non collegato a
 * `bloccoSessioneAttiva` e con la fine effettiva passata da > 30' torna `programmato`, prima della marcatura dei persi
 * (§9). Con la sessione attiva sul blocco non è mai orfano, anche nel tempo extra (§10.4). Arrivato `in_corso` da un
 * altro dispositivo, avviato là all'istante `avviatoAltroveIl` (il gesto della busta), non lo è per
 * `ATTESA_SESSIONE_ALTROVE_MS` da quell'istante, finché la riga di qui ha ancora quel gesto (`gestoIl`): una sessione
 * avviata qui o un'altra modifica la tolgono dalla protezione (revisione di P3-4).
 */
export function isOrphan(
  block: Pick<Blocco, 'id' | 'stato' | 'inizio' | 'fine' | 'conOrario'> & { gestoIl?: number },
  bloccoSessioneAttiva: string | null,
  now: number,
  avviatoAltroveIl?: number,
): boolean {
  const altrove =
    avviatoAltroveIl !== undefined &&
    block.gestoIl === avviatoAltroveIl &&
    now < avviatoAltroveIl + ATTESA_SESSIONE_ALTROVE_MS;
  return (
    block.stato === 'in_corso' &&
    block.id !== bloccoSessioneAttiva &&
    now > effectiveEnd(block) + MARGINE_PERSO_MS &&
    !altrove
  );
}

/** Istante esatto in cui il blocco diventa perso (utile a test e diagnostica). */
export function lostAtInstant(block: Pick<Blocco, 'inizio' | 'fine' | 'conOrario'>): number {
  return effectiveEnd(block) + MARGINE_PERSO_MS;
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
  return sameLocalDay(block.inizio, now) || (block.fine !== null && now >= block.inizio && now <= block.fine);
}

/** Un blocco nato dopo la propria fine (un'attività scritta per un orario già passato, D-OCC-1): niente avvisi. */
export const createdAfterEnd = (block: Blocco & { createdAt?: number }): boolean =>
  block.createdAt !== undefined && block.createdAt > effectiveEnd(block);

/**
 * Notifica "blocco perso" (§8): solo routine/studio, solo se la fine è entro le ultime 2 ore. Non se sul blocco era
 * partita una sessione (`minutiRitardo`, D-SESS-1: l'utente l'ha già gestito, C8; «conta nel piano» spento, D-ESITO-1)
 * né se il blocco è nato dopo la propria fine (routine creata dopo il suo orario, D-OCC-1). Decisione: D-NOTIF-2.
 */
export function lostNotificationDue(block: Blocco & { createdAt?: number }, now: number): boolean {
  if (block.tipo !== 'routine' && block.tipo !== 'studio') return false;
  if (block.minutiRitardo != null) return false;
  if (createdAfterEnd(block)) return false;
  return now - effectiveEnd(block) <= 2 * HOUR;
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
