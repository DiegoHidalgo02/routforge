/**
 * Streak: giorni consecutivi con almeno uno studio che conta nel piano, con esito Completata o Continua.
 * Fonte: RoutForge_MECCANISMI.md §12 e §25 («ricalcolata localmente dai blocchi») — criteri: SCENARI C2.
 *
 * Regole:
 * - Un giorno conta se ha un blocco di studio `completato` (Completata) o `parziale` (Continua): Indietro e Salta danno
 *   altri stati, e con «conta nel piano» spento il blocco non si chiude (D-ESITO-1). Il giorno è quello dell'esito
 *   (`chiusoIl`, D-ESITO-1 n. 4). Valgono anche i blocchi ricevuti dalla sync (audit P2-2).
 * - +1 una sola volta al giorno: due sessioni oggi sono un giorno solo (C2).
 * - Il valore mostrato vale solo se l'ultimo giorno contato è oggi o ieri; altrimenti 0.
 */
import { addLocalDays, localDayKey } from './time';
import type { Blocco } from './types';

/** I giorni locali ("YYYY-MM-DD") con uno studio fatto, in ordine: la base di streak e record (§20). */
export function studyDays(blocchi: readonly Pick<Blocco, 'tipo' | 'stato' | 'inizio' | 'chiusoIl'>[]): string[] {
  return [
    ...new Set(
      blocchi
        .filter((b) => b.tipo === 'studio' && (b.stato === 'completato' || b.stato === 'parziale'))
        .map((b) => localDayKey(b.chiusoIl ?? b.inizio)),
    ),
  ].sort();
}

/** La streak di `now` (§12): i giorni consecutivi che finiscono oggi o ieri; 0 se non conta né oggi né ieri. */
export function currentStreak(giorni: readonly string[], now: number): number {
  const contati = new Set(giorni);
  let giorno = contati.has(localDayKey(now)) ? now : addLocalDays(now, -1);
  let n = 0;
  while (contati.has(localDayKey(giorno))) {
    n++;
    giorno = addLocalDays(giorno, -1);
  }
  return n;
}
