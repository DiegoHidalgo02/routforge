/**
 * Streak: giorni consecutivi con almeno uno studio che conta nel piano, con esito Completata o Continua.
 * Fonte: RoutForge_MECCANISMI.md §12 e §25 («ricalcolata localmente dai blocchi») — criteri: SCENARI C2.
 *
 * Regole:
 * - Un giorno conta se ha un blocco di studio `completato` (Completata) o `parziale` (Continua): Indietro e Salta danno
 *   altri stati, e con «conta nel piano» spento il blocco non si chiude (D-ESITO-1). Il giorno è quello in cui lo studio
 *   è cominciato, stimato dall'esito (`chiusoIl`) meno i suoi minuti (D-ESITO-1 n. 4). Valgono anche i blocchi ricevuti
 *   dalla sync (audit P2-2); un parziale chiuso poi con Indietro o Salta perde il giorno del suo Continua (si legge
 *   solo lo stato attuale del blocco, l'unico che viaggia).
 * - +1 una sola volta al giorno: due sessioni oggi sono un giorno solo (C2).
 * - Il valore mostrato vale solo se l'ultimo giorno contato è oggi o ieri; altrimenti 0.
 */
import { addLocalDays, localDayKey, MINUTE } from './time';
import type { Blocco } from './types';

/**
 * Il giorno di uno studio fatto: quello in cui è cominciato, stimato come l'esito meno i suoi minuti. Una sessione serale
 * chiusa dopo mezzanotte conta per la sera (audit P2-2, A-3); un recupero o uno studio anticipato contano il giorno in cui
 * si è studiato, e «Registra esito» su un perso di giorni fa conta oggi (D-ESITO-1 n. 4). Le pause spostano la stima in
 * avanti: una sessione cominciata poco prima di mezzanotte con una pausa lunga può contare per il giorno dopo.
 */
const studyDay = (b: Pick<Blocco, 'inizio' | 'chiusoIl' | 'minuti'>): string => {
  const esito = b.chiusoIl ?? b.inizio;
  const minuti = typeof b.minuti === 'number' && Number.isFinite(b.minuti) && b.minuti > 0 ? b.minuti : 0;
  return localDayKey(esito - minuti * MINUTE);
};

/** I giorni locali ("YYYY-MM-DD") con uno studio fatto, in ordine: la base di streak e record (§20). */
export function studyDays(
  blocchi: readonly Pick<Blocco, 'tipo' | 'stato' | 'inizio' | 'chiusoIl' | 'minuti'>[],
): string[] {
  return [
    ...new Set(
      blocchi.filter((b) => b.tipo === 'studio' && (b.stato === 'completato' || b.stato === 'parziale')).map(studyDay),
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
