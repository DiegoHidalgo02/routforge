/**
 * Dettaglio di un'attività (S5; FUNZ §4–§6, MECC §3–§5): spunta e annulla, «Saltata», «Completa evento», checklist,
 * revisione delle fasi con il log, follow-up, eliminazione con ripristino. Ogni completamento passa da un'unica
 * operazione (§3): `writeCompleted` e `writeReopened` sono gli unici punti che scrivono lo stato, e lì T-019 cancella
 * o ri-arma le notifiche del blocco. Le regole stanno nel dominio (`completion.ts`, `checklist.ts`, `phases.ts`).
 * Eliminare una singola occorrenza di routine = il giorno del suo slot in `dateSaltate` (D-OCC-1; il giorno dello slot,
 * non quello attuale: un'occorrenza spostata resta lo stesso slot, D-DATA-2): una tombstone da sola verrebbe rianimata
 * dalla generazione successiva; il blocco si elimina comunque, perché la modifica lascia in vita l'occorrenza di oggi
 * già iniziata. Decisione: D-DETT-1.
 */
import type { RoutForgeDb, Tabelle } from '../data/db';
import { get, inTransaction, remove, save, saveBlock, watch } from '../data/repository';
import { afterToggle, leftoverDraft, toggleItem } from '../domain/checklist';
import { canComplete, completed, reopened, skipped } from '../domain/completion';
import { followUpDraft, phaseLog } from '../domain/phases';
import { occurrenceDay } from '../domain/scheduler/occurrences';
import type { FaseLog, FaseTemplate, Ricorrenza } from '../domain/types';
import { createActivity } from './activities';
import { editRecurrence } from './recurrences';

type RigaBlocco = Tabelle['blocchi'];

/** Ciò che il dettaglio mostra: blocco, template delle fasi (definizione della routine o evento), log se chiuso, definizione e corso. */
export interface DettaglioAttivita {
  blocco: RigaBlocco;
  fasi: FaseTemplate[];
  log: FaseLog[] | null;
  ricorrenza?: Ricorrenza;
  corso?: { titolo: string };
}

export async function readDetail(db: RoutForgeDb, id: string): Promise<DettaglioAttivita | undefined> {
  const blocco = await get(db, 'blocchi', id);
  if (!blocco) return undefined;
  const ricorrenza = blocco.ricorrenzaId ? await get(db, 'ricorrenze', blocco.ricorrenzaId) : undefined;
  const corso = blocco.corsoId ? await get(db, 'corsi', blocco.corsoId) : undefined;
  const log = await get(db, 'logFasi', id);
  return {
    blocco,
    fasi: ricorrenza?.fasi ?? blocco.fasi ?? [],
    log: log?.fasi ?? null,
    ...(ricorrenza && { ricorrenza }),
    ...(corso && { corso: { titolo: corso.titolo } }),
  };
}

/** Osserva il dettaglio: `onChange` riceve subito e a ogni scrittura; `undefined` se il blocco non c'è (più). */
export const watchDetail = (
  db: RoutForgeDb,
  id: string,
  onChange: (d: DettaglioAttivita | undefined) => void,
): (() => void) => watch(() => readDetail(db, id), onChange);

const TABELLE = ['blocchi', 'ricorrenze', 'corsi', 'logFasi'] as const;

/** L'unica scrittura del completamento (§3): stato e istante. T-019: qui si cancellano le notifiche del blocco. */
const writeCompleted = (db: RoutForgeDb, b: RigaBlocco, now: number, fuso: string) =>
  saveBlock(db, completed(b, now), now, fuso);

/** L'unica scrittura dell'annulla spunta (§3): torna programmato. T-019: qui si ri-armano le notifiche del blocco. */
const writeReopened = (db: RoutForgeDb, b: RigaBlocco, now: number, fuso: string) =>
  saveBlock(db, reopened(b), now, fuso);

/**
 * Spunta (§3): se non è consentita adesso non scrive nulla (false). Con fasi scrive il log con le `saltate` (§5,
 * sovrascrive il precedente). Nel todo segna fatte tutte le voci (S5, D-DETT-1).
 */
export async function completeBlock(
  db: RoutForgeDb,
  id: string,
  now: number,
  fuso: string,
  saltate: readonly string[] = [],
): Promise<boolean> {
  return inTransaction(db, TABELLE, async () => {
    const d = await readDetail(db, id);
    if (!d || !canComplete(d.blocco, now)) return false;
    const checklist = d.blocco.checklist?.map((v) => ({ ...v, fatta: true }));
    await writeCompleted(db, { ...d.blocco, ...(checklist && { checklist }) }, now, fuso);
    if (d.fasi.length > 0)
      await save(
        db,
        'logFasi',
        { id, ricorrenzaId: d.blocco.ricorrenzaId ?? null, fasi: phaseLog(d.fasi, saltate) },
        now,
      );
    return true;
  });
}

/** Annulla spunta / «Riapri» (§3): torna programmato, il log fasi sparisce (§5), le voci si azzerano (S5). */
export async function reopenBlock(db: RoutForgeDb, id: string, now: number, fuso: string): Promise<void> {
  await inTransaction(db, ['blocchi', 'logFasi'], async () => {
    const b = await get(db, 'blocchi', id);
    if (!b || b.stato !== 'completato') return;
    const checklist = b.checklist?.map((v) => ({ ...v, fatta: false }));
    await writeReopened(db, { ...b, ...(checklist && { checklist }) }, now, fuso);
    await remove(db, 'logFasi', id, now);
  });
}

/** «Saltata» (FUNZ §4.3): solo routine, solo nella finestra della spunta (anche se già persa nel suo giorno); nessun log. */
export async function skipBlock(db: RoutForgeDb, id: string, now: number, fuso: string): Promise<boolean> {
  return inTransaction(db, ['blocchi'], async () => {
    const b = await get(db, 'blocchi', id);
    if (!b || b.tipo !== 'routine' || b.stato === 'completato' || !canComplete(b, now)) return false;
    await saveBlock(db, skipped(b, now), now, fuso);
    return true;
  });
}

/** Spunta di una voce della checklist (§4, A3): la voce si inverte; se era l'ultima il todo si completa, una despuntata lo riapre. */
export async function toggleChecklist(
  db: RoutForgeDb,
  id: string,
  indice: number,
  now: number,
  fuso: string,
): Promise<void> {
  await inTransaction(db, ['blocchi'], async () => {
    const b = await get(db, 'blocchi', id);
    if (!b?.checklist?.[indice]) return;
    const checklist = toggleItem(b.checklist, indice);
    const aggiornato = { ...b, checklist };
    switch (afterToggle(checklist, indice, b.stato)) {
      case 'completa':
        return writeCompleted(db, aggiornato, now, fuso);
      case 'riapri':
        return writeReopened(db, aggiornato, now, fuso);
      default:
        return saveBlock(db, aggiornato, now, fuso);
    }
  });
}

/** Follow-up delle fasi saltate di un evento (§5, E1, D-DETT-2): un todo per etichetta, senza orario, nel giorno dell'evento (mai prima di oggi), orizzonte giorno. Restituisce gli id. */
export async function createFollowUps(
  db: RoutForgeDb,
  eventoId: string,
  etichette: readonly string[],
  now: number,
  fuso: string,
): Promise<string[]> {
  const evento = await get(db, 'blocchi', eventoId);
  if (!evento) return [];
  const ids: string[] = [];
  for (const etichetta of etichette) {
    const r = await createActivity(db, followUpDraft(etichetta, evento, now), now, fuso);
    if (r.ok) ids.push(r.id);
  }
  return ids;
}

/**
 * «Segna come fatto» con voci non spuntate (D-DETT-2): completa il todo lasciando le voci com'erano e crea il todo con
 * le voci rimaste (stessa scadenza). Restituisce l'id del nuovo todo; `null` se non consentito o senza voci rimaste.
 */
export async function completeWithLeftover(
  db: RoutForgeDb,
  id: string,
  now: number,
  fuso: string,
): Promise<string | null> {
  return inTransaction(db, TABELLE, async () => {
    const b = await get(db, 'blocchi', id);
    if (!b || b.tipo !== 'todo' || !canComplete(b, now)) return null;
    const bozza = leftoverDraft(b, now);
    if (!bozza) return null;
    await writeCompleted(db, b, now, fuso);
    const r = await createActivity(db, bozza, now, fuso);
    return r.ok ? r.id : null;
  });
}

/** «Elimina» dal dettaglio: tombstone del blocco e del suo log (§5); per un'occorrenza di routine anche il giorno del suo slot in `dateSaltate` (D-OCC-1). */
export async function deleteBlock(db: RoutForgeDb, id: string, now: number, fuso: string): Promise<void> {
  await inTransaction(db, ['blocchi', 'ricorrenze', 'logFasi'], async () => {
    const b = await get(db, 'blocchi', id);
    if (!b) return;
    const r = b.ricorrenzaId ? await get(db, 'ricorrenze', b.ricorrenzaId) : undefined;
    if (r) {
      const giorno = occurrenceDay(b.id, r.id);
      if (!r.dateSaltate.includes(giorno))
        await editRecurrence(db, { ...r, dateSaltate: [...r.dateSaltate, giorno] }, now, fuso);
    }
    await remove(db, 'blocchi', id, now);
    await remove(db, 'logFasi', id, now);
  });
}

/** «Annulla» dell'eliminazione: il blocco e il log tornano com'erano; il giorno dello slot esce da `dateSaltate` (la generazione lo ricrea, poi il blocco lo sovrascrive). */
export async function restoreBlock(db: RoutForgeDb, d: DettaglioAttivita, now: number, fuso: string): Promise<void> {
  const { blocco } = d;
  await inTransaction(db, ['blocchi', 'ricorrenze', 'logFasi'], async () => {
    const r = blocco.ricorrenzaId ? await get(db, 'ricorrenze', blocco.ricorrenzaId) : undefined;
    if (r) {
      const giorno = occurrenceDay(blocco.id, r.id);
      await editRecurrence(db, { ...r, dateSaltate: r.dateSaltate.filter((g) => g !== giorno) }, now, fuso);
    }
    await saveBlock(db, blocco, now, fuso);
    if (d.log)
      await save(db, 'logFasi', { id: blocco.id, ricorrenzaId: blocco.ricorrenzaId ?? null, fasi: d.log }, now);
  });
}
