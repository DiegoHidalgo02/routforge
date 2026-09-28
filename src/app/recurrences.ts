/**
 * Routine e routine di studio (MECC §7): le occorrenze si generano alla creazione, si rigenerano alla modifica e si
 * tolgono all'eliminazione. La differenza la calcola il dominio (`src/domain/scheduler/occurrences.ts`); qui si legge
 * e si scrive, in una transazione per operazione (generazioni concorrenti serializzate, §7). Il ciclo che estende
 * tutte le ricorrenze e il puntatore delle occorrenze di studio stanno in `scheduler.ts` e `pointer.ts` (T-013, che
 * parte anche a ogni scrittura sulle ricorrenze); le notifiche T-019.
 * Per saltare una singola occorrenza si aggiunge il suo giorno a `dateSaltate` con `editRecurrence`: eliminare il
 * blocco non basta, la generazione successiva lo ricreerebbe con lo stesso id (D-DATA-2, D-OCC-1).
 */
import type { RoutForgeDb } from '../data/db';
import { inTransaction, listBy, listKeyRange, remove, save, saveBlock } from '../data/repository';
import { editPlan, horizonSlotRange, missingOccurrences, removableOccurrences } from '../domain/scheduler/occurrences';
import type { Ricorrenza } from '../domain/types';

const occurrencesOf = (db: RoutForgeDb, ricorrenzaId: string) => listBy(db, 'blocchi', 'ricorrenzaId', ricorrenzaId);

/**
 * Crea le occorrenze mancanti da oggi a oggi + 28 (§7) e ne restituisce il numero; senza cambiamenti non scrive nulla.
 * Legge solo gli slot dell'orizzonte, per chiave: il ciclo la chiama a ogni minuto e la storia cresce (D-SCHED-1).
 */
export async function generateOccurrences(db: RoutForgeDb, r: Ricorrenza, now: number, fuso: string): Promise<number> {
  return inTransaction(db, ['blocchi'], async () => {
    const mancanti = missingOccurrences(r, await listKeyRange(db, 'blocchi', ...horizonSlotRange(r.id, now)), now);
    for (const b of mancanti) await saveBlock(db, b, now, fuso);
    return mancanti.length;
  });
}

/** Modifica la definizione (§7): la salva nel fuso corrente, elimina le future programmate non più previste e rigenera le altre. */
export async function editRecurrence(db: RoutForgeDb, r: Ricorrenza, now: number, fuso: string): Promise<void> {
  await inTransaction(db, ['ricorrenze', 'blocchi'], async () => {
    await save(db, 'ricorrenze', { ...r, fuso }, now);
    const piano = editPlan(r, await occurrencesOf(db, r.id), now);
    for (const id of piano.daEliminare) await remove(db, 'blocchi', id, now);
    for (const b of piano.daScrivere) await saveBlock(db, b, now, fuso);
  });
}

/** Elimina la routine (§7): occorrenze programmate (anche passate), definizione e log fasi; completate e perse restano. */
export async function deleteRecurrence(db: RoutForgeDb, ricorrenzaId: string, now: number): Promise<void> {
  await inTransaction(db, ['ricorrenze', 'blocchi', 'logFasi'], async () => {
    for (const id of removableOccurrences(await occurrencesOf(db, ricorrenzaId))) await remove(db, 'blocchi', id, now);
    for (const log of await listBy(db, 'logFasi', 'ricorrenzaId', ricorrenzaId))
      await remove(db, 'logFasi', log.id, now);
    await remove(db, 'ricorrenze', ricorrenzaId, now);
  });
}
