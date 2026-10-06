/**
 * Dettaglio di un'attività (S5; FUNZ §4–§6, MECC §3–§5): spunta e annulla, «Saltata», «Completa evento», checklist,
 * revisione delle fasi con il log, follow-up, eliminazione con ripristino; la spunta diretta dal cerchio della card del
 * calendario (`checkFromCalendar`, MECC §24, D-DETT-3) usa le stesse regole. Ogni completamento passa da un'unica
 * operazione (§3): lo stato lo decidono `completed` e `reopened` del dominio e lo scrive `saveBlock`; le notifiche del
 * blocco seguono da sole la scrittura (T-019). Le regole stanno nel dominio (`completion.ts`, `checklist.ts`, `phases.ts`).
 * Eliminare una singola occorrenza di routine = il giorno del suo slot in `dateSaltate` (D-OCC-1; il giorno dello slot,
 * non quello attuale: un'occorrenza spostata resta lo stesso slot, D-DATA-2): una tombstone da sola verrebbe rianimata
 * dalla generazione successiva; il blocco si elimina comunque, perché la modifica lascia in vita l'occorrenza di oggi
 * già iniziata. Decisione: D-DETT-1.
 */
import type { RoutForgeDb, Tabelle } from '../data/db';
import { get, inTransaction, listBy, remove, save, saveBlock } from '../data/repository';
import { afterToggle, leftoverDraft, toggleItem } from '../domain/checklist';
import {
  canCheckFromCalendar,
  canComplete,
  completed,
  directCheckStep,
  reopened,
  skipped,
  type PassoSpunta,
} from '../domain/completion';
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
  /** Lo studio con un'unità: quella proposta dal puntatore, il suo modulo e quante unità del modulo sono fatte (S5). */
  unita?: {
    numero: string;
    titolo: string;
    concettoCore: { titolo: string; testo: string } | null;
    modulo: { numero: number; titolo: string; fatte: number; totali: number };
  };
}

export async function readDetail(db: RoutForgeDb, id: string): Promise<DettaglioAttivita | undefined> {
  const blocco = await get(db, 'blocchi', id);
  if (!blocco) return undefined;
  const ricorrenza = blocco.ricorrenzaId ? await get(db, 'ricorrenze', blocco.ricorrenzaId) : undefined;
  const corso = blocco.corsoId ? await get(db, 'corsi', blocco.corsoId) : undefined;
  const log = await get(db, 'logFasi', id);
  const unita = blocco.tipo === 'studio' && blocco.unitaId ? await get(db, 'unita', blocco.unitaId) : undefined;
  const modulo = unita ? await get(db, 'moduli', unita.moduloId) : undefined;
  // Unità fatte del modulo = completate (MECC §11)
  const delModulo = unita ? await listBy(db, 'unita', 'moduloId', unita.moduloId) : [];
  return {
    blocco,
    fasi: ricorrenza?.fasi ?? blocco.fasi ?? [],
    log: log?.fasi ?? null,
    ...(ricorrenza && { ricorrenza }),
    ...(corso && { corso: { titolo: corso.titolo } }),
    ...(unita &&
      modulo && {
        unita: {
          numero: unita.numero,
          titolo: unita.titolo,
          concettoCore: unita.concettoCore,
          modulo: {
            numero: modulo.numero,
            titolo: modulo.titolo,
            fatte: delModulo.filter((u) => u.stato === 'completata').length,
            totali: delModulo.length,
          },
        },
      }),
  };
}

const TABELLE = ['blocchi', 'ricorrenze', 'corsi', 'logFasi'] as const;

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
    await saveBlock(db, completed({ ...d.blocco, ...(checklist && { checklist }) }, now), now, fuso);
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

/**
 * Spunta diretta dal cerchio della card del calendario (§3, §24, D-DETT-3): se non c'è restituisce `null` senza
 * scrivere; con le fasi, con voci non spuntate o per lo studio non scrive e dice quale sheet del dettaglio aprire
 * (`revisione`, `residuo`, `esito`, C10); altrimenti completa subito con la stessa scrittura di «Segna come fatto»
 * (`completa`, anche «Completa evento», T-049).
 */
export async function checkFromCalendar(
  db: RoutForgeDb,
  id: string,
  now: number,
  fuso: string,
): Promise<PassoSpunta | null> {
  return inTransaction(db, TABELLE, async () => {
    const d = await readDetail(db, id);
    if (!d || !canCheckFromCalendar(d.blocco, now)) return null;
    const passo = directCheckStep(d.blocco, d.fasi.length > 0);
    if (passo === 'completa') await saveBlock(db, completed(d.blocco, now), now, fuso);
    return passo;
  });
}

/** Annulla spunta / «Riapri» (§3): torna programmato, il log fasi sparisce (§5), le voci si azzerano (S5). */
export async function reopenBlock(db: RoutForgeDb, id: string, now: number, fuso: string): Promise<void> {
  await inTransaction(db, ['blocchi', 'logFasi'], async () => {
    const b = await get(db, 'blocchi', id);
    if (!b || b.stato !== 'completato') return;
    const checklist = b.checklist?.map((v) => ({ ...v, fatta: false }));
    await saveBlock(db, reopened({ ...b, ...(checklist && { checklist }) }), now, fuso);
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
        return saveBlock(db, completed(aggiornato, now), now, fuso);
      case 'riapri':
        return saveBlock(db, reopened(aggiornato), now, fuso);
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
 * le voci rimaste (stessa scadenza). Restituisce l'id del nuovo todo; `null` se non consentito, se il todo è già
 * completato (una sheet rimasta aperta non crea un secondo todo derivato, D-DETT-3) o senza voci rimaste.
 */
export async function completeWithLeftover(
  db: RoutForgeDb,
  id: string,
  now: number,
  fuso: string,
): Promise<string | null> {
  return inTransaction(db, TABELLE, async () => {
    const b = await get(db, 'blocchi', id);
    if (!b || b.tipo !== 'todo' || b.stato === 'completato' || !canComplete(b, now)) return null;
    const bozza = leftoverDraft(b, now);
    if (!bozza) return null;
    await saveBlock(db, completed(b, now), now, fuso);
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
