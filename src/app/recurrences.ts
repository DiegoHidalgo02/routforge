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
import { get, inTransaction, listBy, listKeyRange, remove, save, saveBlock } from '../data/repository';
import {
  editPlan,
  horizonSlotRange,
  isMovedOccurrence,
  missingOccurrences,
  removableOccurrences,
} from '../domain/scheduler/occurrences';
import type { Ricorrenza } from '../domain/types';

const occurrencesOf = (db: RoutForgeDb, ricorrenzaId: string) => listBy(db, 'blocchi', 'ricorrenzaId', ricorrenzaId);

/**
 * Crea le occorrenze mancanti da oggi a oggi + 28 (§7) e ne restituisce il numero; senza cambiamenti non scrive nulla.
 * Legge solo gli slot dell'orizzonte, per chiave: il ciclo la chiama a ogni minuto e la storia cresce (D-SCHED-1).
 */
export async function generateOccurrences(db: RoutForgeDb, r: Ricorrenza, now: number, fuso: string): Promise<number> {
  return inTransaction(db, ['blocchi'], async () => {
    const mancanti = missingOccurrences(r, await listKeyRange(db, 'blocchi', ...horizonSlotRange(r, now)), now);
    for (const b of mancanti) await saveBlock(db, b, now, fuso, 'ciclo');
    return mancanti.length;
  });
}

/**
 * Le occorrenze seguono la definizione (§7): le future programmate non più previste si eliminano, le altre si
 * rigenerano. Dopo una modifica fatta qui le eliminazioni sono dell'utente e viaggiano con la sync (le tombstone degli
 * slot superati raggiungono gli altri dispositivi); le occorrenze riscritte no, ognuno le rigenera dalla definizione
 * (T-033, D-SYNC-4), salvo le spostate (C4) riportate allo slot: sono dati dell'utente e il ripristino viaggia.
 * Per una definizione `ricevuta` le eliminazioni sono del ciclo, perché bastano quelle di chi l'ha modificata (spedite di
 * nuovo rimbalzerebbero), con l'istante del gesto della definizione e non quello della ricezione: in una fusione futura
 * non battono un completamento fatto altrove prima di lui (audit N-1). Restano come sono le spostate (ci pensa chi
 * modifica) e le occorrenze `intatte`, con una modifica dell'utente in coda più recente (D-SYNC-6).
 */
async function followDefinition(
  db: RoutForgeDb,
  r: Ricorrenza,
  now: number,
  fuso: string,
  ricevuta?: { intatte: ReadonlySet<string>; istante: number },
): Promise<void> {
  const occorrenze = await occurrencesOf(db, r.id);
  const piano = editPlan(r, occorrenze, now);
  const spostate = new Set(occorrenze.filter((b) => isMovedOccurrence(b, r.id)).map((b) => b.id));
  const intatte = ricevuta ? new Set([...ricevuta.intatte, ...spostate]) : new Set<string>();
  for (const id of piano.daEliminare)
    if (!intatte.has(id))
      await remove(db, 'blocchi', id, ricevuta ? ricevuta.istante : now, ricevuta ? 'ciclo' : 'utente');
  for (const b of piano.daScrivere)
    if (!intatte.has(b.id)) await saveBlock(db, b, now, fuso, !ricevuta && spostate.has(b.id) ? 'utente' : 'ciclo');
}

/** Modifica la definizione (§7): la salva nel fuso corrente e le occorrenze la seguono. */
export async function editRecurrence(db: RoutForgeDb, r: Ricorrenza, now: number, fuso: string): Promise<void> {
  await inTransaction(db, ['ricorrenze', 'blocchi'], async () => {
    await save(db, 'ricorrenze', { ...r, fuso }, now);
    await followDefinition(db, r, now, fuso);
  });
}

/**
 * Una ricorrenza eliminata su un altro dispositivo (T-033): le sue occorrenze programmate di qui spariscono, come in
 * `deleteRecurrence`; eliminazioni del ciclo, perché le tombstone di chi l'ha eliminata bastano (D-SYNC-6), con l'istante
 * dell'eliminazione ricevuta (audit N-1).
 */
export function dropOccurrences(db: RoutForgeDb, ricorrenzaId: string, eliminataIl: number): Promise<void> {
  return inTransaction(db, ['blocchi'], async () => {
    for (const id of removableOccurrences(await occurrencesOf(db, ricorrenzaId)))
      await remove(db, 'blocchi', id, eliminataIl, 'ciclo');
  });
}

/**
 * Una ricorrenza ricevuta dalla sync (T-033, J2): le occorrenze di questo dispositivo seguono la definizione ricevuta,
 * tranne `intatte` (quelle con una modifica dell'utente in coda più recente, D-SYNC-6); le eliminazioni hanno
 * l'istante del gesto della definizione, `ricevutaIl` (audit N-1).
 */
export function followRecurrence(
  db: RoutForgeDb,
  r: Ricorrenza,
  now: number,
  fuso: string,
  intatte: ReadonlySet<string> = new Set(),
  ricevutaIl: number = now,
): Promise<void> {
  return inTransaction(db, ['blocchi'], () => followDefinition(db, r, now, fuso, { intatte, istante: ricevutaIl }));
}

/**
 * Elimina la routine (§7): occorrenze programmate (anche passate), definizione e log fasi; completate e perse restano.
 * Restituisce l'annulla del toast (S5 «Routine eliminata»), che rimette definizione, occorrenze e log com'erano.
 */
export async function deleteRecurrence(
  db: RoutForgeDb,
  ricorrenzaId: string,
  now: number,
): Promise<(now: number, fuso: string) => Promise<void>> {
  return inTransaction(db, ['ricorrenze', 'blocchi', 'logFasi'], async () => {
    const r = await get(db, 'ricorrenze', ricorrenzaId);
    const occorrenze = await occurrencesOf(db, ricorrenzaId);
    const via = new Set(removableOccurrences(occorrenze));
    const tolte = occorrenze.filter((b) => via.has(b.id));
    const log = await listBy(db, 'logFasi', 'ricorrenzaId', ricorrenzaId);
    for (const b of tolte) await remove(db, 'blocchi', b.id, now);
    for (const l of log) await remove(db, 'logFasi', l.id, now);
    await remove(db, 'ricorrenze', ricorrenzaId, now);
    return (adesso: number, fuso: string) =>
      inTransaction(db, ['ricorrenze', 'blocchi', 'logFasi'], async () => {
        if (r) await save(db, 'ricorrenze', r, adesso);
        for (const b of tolte) await saveBlock(db, b, adesso, fuso);
        for (const l of log) await save(db, 'logFasi', l, adesso);
      });
  });
}
