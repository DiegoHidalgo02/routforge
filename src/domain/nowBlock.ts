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
import type { Block } from './types';

export type NowStatus =
  | { kind: 'tra'; minutesToStart: number }
  | { kind: 'adesso' }
  | { kind: 'recupera' }
  | { kind: 'orario_passato' };

export interface NowSelection {
  block: Block;
  status: NowStatus;
}

const WINDOW = minutes(30);
const EXCLUDED: ReadonlySet<Block['state']> = new Set(['completato', 'saltato', 'perso']);

export function isNowCandidate(block: Block, now: number): boolean {
  if (EXCLUDED.has(block.state)) return false;
  if (!block.hasTime) return false; // E3: tutto il giorno / senza orario non occupano "Adesso"
  const end = effectiveEnd(block);
  return now >= block.start - WINDOW && now <= end + WINDOW;
}

export function isInProgress(block: Block, now: number): boolean {
  if (block.state === 'in_corso') return true;
  return now >= block.start && now < effectiveEnd(block);
}

export function statusOf(block: Block, now: number): NowStatus {
  if (now < block.start) {
    return { kind: 'tra', minutesToStart: Math.ceil((block.start - now) / minutes(1)) };
  }
  if (isInProgress(block, now)) return { kind: 'adesso' };
  return block.kind === 'routine' || block.kind === 'studio' ? { kind: 'recupera' } : { kind: 'orario_passato' };
}

/**
 * Seleziona il blocco da mostrare. `dismissed` = chiusure memorizzate per giorno+blocco
 * (chiave `${giorno}|${blockId}`); la chiusura vale solo per quel blocco e quel giorno.
 */
export function selectNowBlock(
  blocks: readonly Block[],
  now: number,
  dismissed: ReadonlySet<string> = new Set(),
): NowSelection | null {
  const candidates = blocks.filter((b) => isNowCandidate(b, now)).sort((a, b) => a.start - b.start);
  if (candidates.length === 0) return null;

  // Tra più blocchi in corso vince quello iniziato più di recente (al confine vince chi inizia).
  const inProgress = candidates.filter((b) => isInProgress(b, now)).sort((a, b) => b.start - a.start);
  const chosen = inProgress[0] ?? candidates[0]!;

  if (dismissed.has(dismissKey(chosen, now))) return null;
  return { block: chosen, status: statusOf(chosen, now) };
}

/** Chiave di chiusura del blocco Adesso: per giorno e per blocco (§14). */
export function dismissKey(block: Pick<Block, 'id'>, now: number): string {
  return `${localDayKey(now)}|${block.id}`;
}
