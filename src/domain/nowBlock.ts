/**
 * Il blocco "Adesso / prossimo".
 * Fonte: RoutForge_MECCANISMI.md §14 — criteri: SCENARI G1, G2, E3. Decisioni: D-NOW-1, D-NOW-2.
 *
 * - Candidati: non terminali (§1: completato, parziale, indietro, saltato, perso — parziale e indietro sono esiti di
 *   una sessione già chiusa, §11; D-NOW-2), con orario, adesso ∈ [inizio − 30', fine + 30'].
 * - In corso = `in_corso`, oppure adesso ∈ [inizio, fine) (fine esclusa: al confine vince
 *   il blocco che inizia). Se nessuno è in corso, il primo candidato cronologico.
 * - Stato: minuti mancanti; "adesso" con i minuti alla fine; fine passata → "recupera" (routine/studio) con
 *   l'ultimo istante utile per avviare il recupero (fine + 30', §8) o "orario passato" (todo/evento).
 * - Chiusura: memorizzata per giorno e per blocco; riappare il giorno dopo o con un blocco
 *   in corso diverso.
 */
import { effectiveEnd, lostAtInstant } from './lost';
import { localDayKey, minutes } from './time';
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

export function isInProgress(block: Blocco, now: number): boolean {
  if (block.stato === 'in_corso') return true;
  return now >= block.inizio && now < effectiveEnd(block);
}

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

/**
 * Seleziona il blocco da mostrare. `dismissed` = chiusure memorizzate per giorno+blocco
 * (chiave `${giorno}|${blockId}`); la chiusura vale solo per quel blocco e quel giorno.
 */
export function selectNowBlock<B extends Blocco>(
  blocks: readonly B[],
  now: number,
  dismissed: ReadonlySet<string> = new Set(),
): SelezioneAdesso<B> | null {
  const candidates = blocks.filter((b) => isNowCandidate(b, now)).sort((a, b) => a.inizio - b.inizio);
  if (candidates.length === 0) return null;

  // Tra più blocchi in corso vince quello iniziato più di recente (al confine vince chi inizia).
  const inProgress = candidates.filter((b) => isInProgress(b, now)).sort((a, b) => b.inizio - a.inizio);
  const chosen = inProgress[0] ?? candidates[0]!;

  if (dismissed.has(dismissKey(chosen, now))) return null;
  return { blocco: chosen, stato: statusOf(chosen, now) };
}

/** Chiave di chiusura del blocco Adesso: per giorno e per blocco (§14). */
export function dismissKey(block: Pick<Blocco, 'id'>, now: number): string {
  return `${localDayKey(now)}|${block.id}`;
}
