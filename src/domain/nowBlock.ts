/**
 * Il blocco "Adesso / prossimo".
 * Fonte: RoutForge_MECCANISMI.md §14 — criteri: SCENARI G1, G2, E3.
 *
 * - Candidati: non completati/saltati/persi, con orario, adesso ∈ [inizio − 30', fine + 30'].
 * - In corso = `in_corso`, oppure adesso ∈ [inizio, fine) (fine esclusa: al confine vince
 *   il blocco che inizia). Se nessuno è in corso, il primo candidato cronologico.
 * - Stato: minuti mancanti; "adesso"; fine passata → "recupera" (routine/studio) o
 *   "orario passato" (todo/evento).
 * - Chiusura: memorizzata per giorno e per blocco; riappare il giorno dopo o con un blocco
 *   in corso diverso.
 */
import { effectiveEnd } from './lost';
import { localDayKey, minutes } from './time';
import type { Blocco } from './types';

export type StatoAdesso =
  | { tipo: 'tra'; minutiAllInizio: number }
  | { tipo: 'adesso' }
  | { tipo: 'recupera' }
  | { tipo: 'orario_passato' };

export interface SelezioneAdesso {
  blocco: Blocco;
  stato: StatoAdesso;
}

const WINDOW = minutes(30);
const EXCLUDED: ReadonlySet<Blocco['stato']> = new Set(['completato', 'saltato', 'perso']);

export function isNowCandidate(block: Blocco, now: number): boolean {
  if (EXCLUDED.has(block.stato)) return false;
  if (!block.conOrario) return false; // E3: tutto il giorno / senza orario non occupano "Adesso"
  const end = effectiveEnd(block);
  return now >= block.inizio - WINDOW && now <= end + WINDOW;
}

export function isInProgress(block: Blocco, now: number): boolean {
  if (block.stato === 'in_corso') return true;
  return now >= block.inizio && now < effectiveEnd(block);
}

export function statusOf(block: Blocco, now: number): StatoAdesso {
  if (now < block.inizio) {
    return { tipo: 'tra', minutiAllInizio: Math.ceil((block.inizio - now) / minutes(1)) };
  }
  if (isInProgress(block, now)) return { tipo: 'adesso' };
  return block.tipo === 'routine' || block.tipo === 'studio' ? { tipo: 'recupera' } : { tipo: 'orario_passato' };
}

/**
 * Seleziona il blocco da mostrare. `dismissed` = chiusure memorizzate per giorno+blocco
 * (chiave `${giorno}|${blockId}`); la chiusura vale solo per quel blocco e quel giorno.
 */
export function selectNowBlock(
  blocks: readonly Blocco[],
  now: number,
  dismissed: ReadonlySet<string> = new Set(),
): SelezioneAdesso | null {
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
