// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, list, listBy, remove, save, saveBlock } from '../data/repository';
import type { BozzaAttivita } from '../domain/activity';
import { occurrenceId } from '../domain/scheduler/occurrences';
import { local } from '../domain/time';
import type { Ricorrenza } from '../domain/types';
import { createActivity } from './activities';
import { deleteRecurrence, editRecurrence, generateOccurrences } from './recurrences';

const FUSO = 'Europe/Rome';
/** Mercoledì 23 settembre 2026 alle 08:00. */
const NOW = local(2026, 9, 23, 8, 0);
/** «Corsa», lunedì/mercoledì/venerdì 07:00–08:00 a partire da oggi (B1). */
const corsa: BozzaAttivita = {
  tipo: 'routine',
  titolo: 'Corsa',
  note: '',
  promemoria: { modo: 'auto' },
  giorni: [1, 3, 5],
  inizio: '07:00',
  fine: '08:00',
  dataInizio: '2026-09-23',
  termine: null,
  fasi: [],
};

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-ricorrenze-${++n}`);
});
afterEach(() => db.delete());

async function creaCorsa(): Promise<Ricorrenza> {
  const r = await createActivity(db, corsa, NOW, FUSO);
  if (!r.ok) throw new Error(r.errori.join());
  return (await get(db, 'ricorrenze', r.id))!;
}

const occorrenze = (r: Ricorrenza) => listBy(db, 'blocchi', 'ricorrenzaId', r.id);

describe('Generazione e orizzonte — SCENARI B1 (servizio)', () => {
  it('«+ Crea» salva la definizione e le occorrenze da oggi a oggi + 28 (§7), con id di slot, giorno locale e fuso', async () => {
    const r = await creaCorsa();
    const occ = await occorrenze(r);
    expect(occ.map((b) => b.giornoLocale)).toEqual([
      '2026-09-23',
      '2026-09-25',
      '2026-09-28',
      '2026-09-30',
      '2026-10-02',
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
      '2026-10-12',
      '2026-10-14',
      '2026-10-16',
      '2026-10-19',
      '2026-10-21',
    ]);
    for (const b of occ) {
      expect(b).toMatchObject({
        id: occurrenceId(r.id, b.giornoLocale, '07:00'),
        tipo: 'routine',
        stato: 'programmato',
        orarioInizio: '07:00',
        orarioFine: '08:00',
        fuso: FUSO,
        titolo: 'Corsa',
      });
    }
  });

  it('rieseguire la generazione senza cambiamenti non scrive nulla', async () => {
    const r = await creaCorsa();
    const prima = await occorrenze(r);
    expect(await generateOccurrences(db, r, local(2026, 9, 23, 9, 0), FUSO)).toBe(0);
    expect(await occorrenze(r)).toEqual(prima);
  });

  it("dieci giorni dopo l'orizzonte si allunga a quel giorno + 28: solo le nuove, nessun duplicato", async () => {
    const r = await creaCorsa();
    expect(await generateOccurrences(db, r, local(2026, 10, 3, 8, 0), FUSO)).toBe(4);
    const occ = await occorrenze(r);
    expect(occ).toHaveLength(17);
    expect(occ.map((b) => b.giornoLocale).slice(-4)).toEqual(['2026-10-23', '2026-10-26', '2026-10-28', '2026-10-30']);
  });
});

describe('Occorrenza spostata — MECC §7, D-DATA-2 (anticipata dall’utente, riconosciuta con lo stesso id)', () => {
  it('la generazione la ritrova con `get` e non la ricrea al suo orario', async () => {
    const r = await creaCorsa();
    const [oggi] = await occorrenze(r);
    await saveBlock(db, { ...oggi!, inizio: local(2026, 9, 23, 6, 40), fine: local(2026, 9, 23, 7, 40) }, NOW, FUSO);
    expect(await generateOccurrences(db, r, local(2026, 9, 23, 9, 0), FUSO)).toBe(0);
    expect(await get(db, 'blocchi', oggi!.id)).toMatchObject({ orarioInizio: '06:40', orarioFine: '07:40' });
  });
});

describe('Modifica della routine — SCENARI B6 (servizio)', () => {
  it('alle 15:00 «Corsa» passa alle 18:00: stamattina (completata) resta, le future sono alle 18:00, quella di oggi esiste', async () => {
    const r = await creaCorsa();
    const stamattina = occurrenceId(r.id, '2026-09-23', '07:00');
    const alle745 = local(2026, 9, 23, 7, 45);
    const completata = await saveBlock(
      db,
      { ...(await get(db, 'blocchi', stamattina))!, stato: 'completato' },
      alle745,
      FUSO,
    );
    const vecchie = (await occorrenze(r)).filter((b) => b.id !== stamattina).map((b) => b.id);

    const alle15 = local(2026, 9, 23, 15, 0);
    await editRecurrence(db, { ...r, orarioInizio: '18:00', orarioFine: '19:00' }, alle15, FUSO);

    expect(await get(db, 'ricorrenze', r.id)).toMatchObject({ orarioInizio: '18:00', orarioFine: '19:00' });
    expect(await get(db, 'blocchi', stamattina)).toEqual(completata);
    const vive = await occorrenze(r);
    expect(vive.filter((b) => b.stato === 'programmato').every((b) => b.orarioInizio === '18:00')).toBe(true);
    expect(await get(db, 'blocchi', occurrenceId(r.id, '2026-09-23', '18:00'))).toMatchObject({
      inizio: local(2026, 9, 23, 18, 0),
      fine: local(2026, 9, 23, 19, 0),
    });
    for (const id of vecchie) expect((await db.blocchi.get(id))?.deletedAt).toBe(alle15);
  });
});

describe('Eliminazione della routine — MECC §7 (servizio)', () => {
  it('toglie le occorrenze programmate, la definizione e i log fasi; la completata resta', async () => {
    const r = await creaCorsa();
    const stamattina = occurrenceId(r.id, '2026-09-23', '07:00');
    await saveBlock(db, { ...(await get(db, 'blocchi', stamattina))!, stato: 'completato' }, NOW, FUSO);
    await save(db, 'logFasi', { id: stamattina, ricorrenzaId: r.id, fasi: [] }, NOW);

    await deleteRecurrence(db, r.id, local(2026, 9, 23, 9, 0));

    expect((await list(db, 'blocchi')).map((b) => [b.id, b.stato])).toEqual([[stamattina, 'completato']]);
    expect(await get(db, 'ricorrenze', r.id)).toBeUndefined();
    expect(await list(db, 'logFasi')).toEqual([]);
  });

  it('l’annulla del toast rimette definizione, occorrenze programmate e log fasi (S5 «Routine eliminata»)', async () => {
    const r = await creaCorsa();
    const stamattina = occurrenceId(r.id, '2026-09-23', '07:00');
    await save(db, 'logFasi', { id: stamattina, ricorrenzaId: r.id, fasi: [] }, NOW);
    const prima = (await occorrenze(r)).map((b) => [b.id, b.stato]);

    const annulla = await deleteRecurrence(db, r.id, local(2026, 9, 23, 9, 0));
    expect(await occorrenze(r)).toEqual([]);
    await annulla(local(2026, 9, 23, 9, 1), FUSO);

    expect(await get(db, 'ricorrenze', r.id)).toMatchObject({ titolo: 'Corsa' });
    expect((await occorrenze(r)).map((b) => [b.id, b.stato])).toEqual(prima);
    expect((await list(db, 'logFasi')).map((l) => l.id)).toEqual([stamattina]);
  });
});

describe('Modifica ripetuta e occorrenza singola — MECC §7, D-DATA-2, D-TIME-2 (servizio)', () => {
  it('modificare due volte con la stessa definizione non elimina né duplica nulla; la definizione registra il fuso corrente', async () => {
    const r = await creaCorsa();
    const prima = await occorrenze(r);
    const alle9 = local(2026, 9, 23, 9, 0);
    await editRecurrence(db, r, alle9, 'Europe/Berlin');
    await editRecurrence(db, r, local(2026, 9, 23, 9, 5), 'Europe/Berlin');
    const dopo = await occorrenze(r);
    expect(dopo.map((b) => b.id)).toEqual(prima.map((b) => b.id));
    expect((await db.blocchi.toArray()).filter((b) => b.deletedAt !== null)).toEqual([]);
    expect(await get(db, 'ricorrenze', r.id)).toMatchObject({ fuso: 'Europe/Berlin' });
    expect(dopo.filter((b) => b.inizio > alle9).every((b) => b.fuso === 'Europe/Berlin')).toBe(true);
  });

  it('eliminare una singola occorrenza con `remove` non basta (la generazione la rianima): si salta con `dateSaltate`', async () => {
    const r = await creaCorsa();
    const venerdi = occurrenceId(r.id, '2026-09-25', '07:00');
    await remove(db, 'blocchi', venerdi, NOW);
    expect(await generateOccurrences(db, r, local(2026, 9, 23, 9, 0), FUSO)).toBe(1);
    expect(await get(db, 'blocchi', venerdi)).toBeDefined();

    await editRecurrence(db, { ...r, dateSaltate: ['2026-09-25'] }, local(2026, 9, 23, 9, 5), FUSO);
    const saltata = (await get(db, 'ricorrenze', r.id))!;
    expect(await get(db, 'blocchi', venerdi)).toBeUndefined();
    expect(await generateOccurrences(db, saltata, local(2026, 9, 23, 9, 10), FUSO)).toBe(0);
  });
});

describe('Coda della sync — INV-21 (T-033): modificare la routine', () => {
  it('accoda la definizione e le tombstone degli slot superati, non le occorrenze rigenerate (ognuno le ricrea)', async () => {
    const r = await creaCorsa();
    const vecchie = (await occorrenze(r)).filter((b) => b.inizio > NOW).map((b) => `blocchi:${b.id}`);
    await db.syncCoda.clear();
    await editRecurrence(db, { ...r, orarioInizio: '18:00', orarioFine: '19:00' }, NOW, FUSO);
    const voci = (await list(db, 'syncCoda')).map((v) => v.id).sort();
    expect(voci).toEqual([`ricorrenze:${r.id}`, ...vecchie].sort());
    expect(voci.some((id) => id.endsWith(':18:00'))).toBe(false);
  });
});
