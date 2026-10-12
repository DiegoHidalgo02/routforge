/**
 * La card "Adesso".
 * Fonte: RoutForge_MECCANISMI.md §14 — criteri: SCENARI G1, G2, E3. Decisioni: D-NOW-1, D-NOW-2.
 *
 * - Candidati: non terminali (§1: completato, parziale, indietro, saltato, perso — parziale e indietro sono esiti di
 *   una sessione già chiusa, §11; D-NOW-2), con orario, adesso ∈ [inizio − 30', fine + 30'].
 * - In corso = `in_corso`, oppure adesso ∈ [inizio, fine) (fine esclusa: al confine vince
 *   il blocco che inizia). Se nessuno è in corso, il primo candidato cronologico.
 * - Stato: minuti mancanti; "adesso" con i minuti alla fine; fine passata → "recupera" (routine/studio) con
 *   l'ultimo istante utile per avviare il recupero (fine + 30', §8) o "orario passato" (todo/evento).
 * - Hero: la card dell'attività scelta, salvo l'orario passato (nessuna card diventa hero). Nessuna chiusura: cambia
 *   solo con i candidati.
 */
import { effectiveEnd, lostAtInstant } from './lost';
import { minutes } from './time';
import { STATI_TERMINALI, type Blocco } from './types';

export type StatoAdesso =
  | { tipo: 'tra'; minutiAllInizio: number }
  /** `minutiAllaFine` è `null` senza durata (fine 23:59, D-NOW-1); 0 se la fine è passata con la sessione ancora aperta. */
  | { tipo: 'adesso'; minutiAllaFine: number | null }
  /** `ultimoAvvio` = fine effettiva + 30': l'ultimo istante in cui il recupero è ancora avviabile («ultimo avvio» del mock S1). */
  | { tipo: 'recupera'; ultimoAvvio: number }
  | { tipo: 'orario_passato' };

export interface SelezioneAdesso<B extends Blocco = Blocco> {
  blocco: B;
  stato: StatoAdesso;
}

const WINDOW = minutes(30);

export function isNowCandidate(block: Blocco, now: number): boolean {
  if (STATI_TERMINALI.has(block.stato)) return false;
  if (!block.conOrario) return false; // E3: tutto il giorno / senza orario non occupano "Adesso"
  const end = effectiveEnd(block);
  return now >= block.inizio - WINDOW && now <= end + WINDOW;
}

function isInProgress(block: Blocco, now: number): boolean {
  if (block.stato === 'in_corso') return true;
  return now >= block.inizio && now < effectiveEnd(block);
}

/**
 * Card «in corso» del calendario (S1, D-CAL-2): aperta, con orario e in corso come in §14 (`in_corso`, oppure adesso ∈
 * [inizio, fine)); senza la finestra dei candidati del blocco Adesso, così una sessione oltre fine + 30' resta «in
 * corso» sulla sua card.
 */
export const isLiveBlock = (block: Blocco, now: number): boolean =>
  block.conOrario && !STATI_TERMINALI.has(block.stato) && isInProgress(block, now);

export function statusOf(block: Blocco, now: number): StatoAdesso {
  // Prima "in corso" (§14: `in_corso` vale anche se avviato in anticipo o a fine passata), poi il tempo
  if (isInProgress(block, now)) {
    const minutiAllaFine = block.fine === null ? null : Math.max(0, Math.ceil((block.fine - now) / minutes(1)));
    return { tipo: 'adesso', minutiAllaFine };
  }
  if (now < block.inizio) {
    return { tipo: 'tra', minutiAllInizio: Math.ceil((block.inizio - now) / minutes(1)) };
  }
  return block.tipo === 'routine' || block.tipo === 'studio'
    ? { tipo: 'recupera', ultimoAvvio: lostAtInstant(block) }
    : { tipo: 'orario_passato' };
}

/** L'attività scelta fra i candidati (§14), con il suo stato. */
export function selectNowBlock<B extends Blocco>(blocks: readonly B[], now: number): SelezioneAdesso<B> | null {
  const candidates = blocks.filter((b) => isNowCandidate(b, now)).sort((a, b) => a.inizio - b.inizio);
  if (candidates.length === 0) return null;

  // Tra più blocchi in corso vince quello iniziato più di recente (al confine vince chi inizia).
  const inProgress = candidates.filter((b) => isInProgress(b, now)).sort((a, b) => b.inizio - a.inizio);
  const chosen = inProgress[0] ?? candidates[0]!;
  return { blocco: chosen, stato: statusOf(chosen, now) };
}

/** Gli stati della card hero: «orario passato» non ne ha (§14). */
export type StatoHero = Exclude<StatoAdesso, { tipo: 'orario_passato' }>;

/** La card che cresce a hero (§14 «Resa»): la scelta, salvo un todo o un evento con l'orario passato. */
export function heroBlock<B extends Blocco>(blocks: readonly B[], now: number): { blocco: B; stato: StatoHero } | null {
  const sel = selectNowBlock(blocks, now);
  return sel && sel.stato.tipo !== 'orario_passato' ? { blocco: sel.blocco, stato: sel.stato } : null;
}
