// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { blocksBetween, get, listBy, remove, saveBlock } from '../data/repository';
import type { BozzaAttivita } from '../domain/activity';
import { endOfLocalDay, local } from '../domain/time';
import { createActivity } from './activities';
import { completeBlock } from './completion';
import { moveBlock } from './drag';
import { runCycle } from './scheduler';

const FUSO = 'Europe/Rome';
// Settembre 2026: lunedì 28 (oggi nei test), martedì 29.
const oggi = (h: number, m = 0) => local(2026, 9, 28, h, m);
const comune = { note: '', promemoria: { modo: 'auto' } } as const;

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-trascinamento-${++n}`);
});
afterEach(() => db.delete());

async function crea(bozza: BozzaAttivita, now = oggi(7)): Promise<string> {
  const r = await createActivity(db, bozza, now, FUSO);
  if (!r.ok) throw new Error(r.errori.join());
  return r.id;
}
const evento = (titolo: string, inizio: string, fine: string): BozzaAttivita => ({
  ...comune,
  tipo: 'evento',
  titolo,
  giorno: '2026-09-28',
  orario: { inizio, fine },
  luogo: '',
  fasi: [],
});
const leggere: BozzaAttivita = {
  ...comune,
  tipo: 'todo',
  titolo: 'Leggere 20 pagine',
  giorno: '2026-09-28',
  orario: null,
  orizzonte: 'giorno',
  priorita: 'normale',
  checklist: [],
  corsoId: null,
};
/** «Palestra», il lunedì alle 08:30–09:30 da oggi. */
const palestra: BozzaAttivita = {
  ...comune,
  tipo: 'routine',
  titolo: 'Palestra',
  giorni: [1],
  inizio: '08:30',
  fine: '09:30',
  dataInizio: '2026-09-28',
  termine: null,
  fasi: [],
};
const blocco = async (id: string) => (await get(db, 'blocchi', id))!;
const posto = async (id: string) => {
  const b = await blocco(id);
  return [b.stato, b.conOrario, b.giornoLocale, b.orarioInizio, b.orarioFine];
};

describe('Trascinamento — SCENARI G3 (servizio)', () => {
  it('il todo senza orario rilasciato alle 15:40 diventa un todo con orario 15:40–16:10', async () => {
    await crea(evento('Lezione', '15:00', '15:40'));
    await crea(evento('Ripasso', '16:00', '17:00'));
    const id = await crea(leggere);
    expect(await moveBlock(db, id, { inizio: oggi(15, 40) }, oggi(9), FUSO)).toBeTypeOf('function');
    expect(await posto(id)).toEqual(['programmato', true, '2026-09-28', '15:40', '16:10']);
  });

  it('il todo senza orario perso trascinato a domani nella striscia torna programmato, senza orario', async () => {
    const ieri = local(2026, 9, 27, 12);
    const perso = {
      tipo: 'todo',
      stato: 'perso',
      persoIl: oggi(0, 30),
      orizzonte: 'giorno',
      conOrario: false,
    } as const;
    const { id } = await saveBlock(db, { ...perso, inizio: ieri, fine: endOfLocalDay(ieri) }, ieri, FUSO);
    await moveBlock(db, id, { giorno: '2026-09-29' }, oggi(9), FUSO);
    expect(await posto(id)).toEqual(['programmato', false, '2026-09-29', '12:00', '23:59']);
    expect((await blocco(id)).persoIl).toBeNull();
  });

  it('la routine persa «Palestra» trascinata a domani torna programmata alle 08:30 e il ciclo la lascia lì', async () => {
    const r = await crea(palestra);
    await runCycle(db, oggi(10, 30), FUSO);
    const [persa] = await listBy(db, 'blocchi', 'ricorrenzaId', r);
    expect(persa?.stato).toBe('perso');

    await moveBlock(db, persa!.id, { giorno: '2026-09-29' }, oggi(10, 30), FUSO);
    await runCycle(db, oggi(10, 31), FUSO);
    expect(await posto(persa!.id)).toEqual(['programmato', true, '2026-09-29', '08:30', '09:30']);
    // Lo slot di oggi resta suo: la generazione non lo ricrea
    expect((await blocksBetween(db, '2026-09-28', '2026-09-28')).map((b) => b.id)).toEqual([]);
  });

  it('«Annulla» ripristina giorno, orario e stato «perso»', async () => {
    const r = await crea(palestra);
    await runCycle(db, oggi(10, 30), FUSO);
    const [persa] = await listBy(db, 'blocchi', 'ricorrenzaId', r);
    const annulla = await moveBlock(db, persa!.id, { giorno: '2026-09-29' }, oggi(10, 30), FUSO);
    await annulla!(oggi(10, 30) + 4000);
    const dopo = await blocco(persa!.id);
    expect([dopo.stato, dopo.persoIl, dopo.giornoLocale, dopo.orarioInizio, dopo.inizio]).toEqual([
      'perso',
      persa!.persoIl,
      '2026-09-28',
      '08:30',
      oggi(8, 30),
    ]);
  });

  it('«Annulla» lascia ciò che è successo dopo lo spostamento: la spunta, l’eliminazione', async () => {
    const id = await crea(leggere);
    const annulla = await moveBlock(db, id, { giorno: '2026-09-29' }, oggi(9), FUSO);
    await completeBlock(db, id, oggi(9) + 1000, FUSO);
    await annulla!(oggi(9) + 2000);
    expect(await posto(id)).toEqual(['completato', false, '2026-09-29', '12:00', '23:59']);

    const altro = await crea({ ...leggere, titolo: 'Altro' });
    const annullaAltro = await moveBlock(db, altro, { giorno: '2026-09-29' }, oggi(9), FUSO);
    await remove(db, 'blocchi', altro, oggi(9) + 1000);
    await annullaAltro!(oggi(9) + 2000);
    expect(await get(db, 'blocchi', altro)).toBeUndefined();

    // Un secondo spostamento nei 5 s: l'annulla del primo non lo disfa
    const terzo = await crea({ ...leggere, titolo: 'Terzo' });
    const annullaPrimo = await moveBlock(db, terzo, { giorno: '2026-09-29' }, oggi(9), FUSO);
    await moveBlock(db, terzo, { giorno: '2026-09-30' }, oggi(9) + 1000, FUSO);
    await annullaPrimo!(oggi(9) + 2000);
    expect((await blocco(terzo)).giornoLocale).toBe('2026-09-30');
  });

  it('un rilascio che non vale non scrive nulla e non offre l’annulla', async () => {
    const e = await crea(evento('Lezione', '15:00', '15:40'));
    const t = await crea(leggere);
    const prima = [await blocco(e), await blocco(t)];
    expect(await moveBlock(db, e, { inizio: oggi(18) }, oggi(9), FUSO)).toBeNull();
    expect(await moveBlock(db, t, { giorno: '2026-09-28' }, oggi(9), FUSO)).toBeNull();
    expect(await moveBlock(db, t, { inizio: oggi(8) }, oggi(9), FUSO)).toBeNull();
    expect(await moveBlock(db, 'assente', { giorno: '2026-09-29' }, oggi(9), FUSO)).toBeNull();
    expect([await blocco(e), await blocco(t)]).toEqual(prima);
  });
});
