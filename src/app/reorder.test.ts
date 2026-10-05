// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { blocksBetween, get } from '../data/repository';
import type { BozzaAttivita } from '../domain/activity';
import type { Priorita } from '../domain/types';
import { sortDay } from '../domain/ordering';
import { local } from '../domain/time';
import { createActivity } from './activities';
import { reorderTodo } from './reorder';

const FUSO = 'Europe/Rome';
// Settembre 2026: mercoledì 23 (oggi nei test)
const oggi = (h: number, m = 0) => local(2026, 9, 23, h, m);
const comune = { note: '', promemoria: { modo: 'auto' } } as const;

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-riordino-${++n}`);
});
afterEach(() => db.delete());

const todo = (titolo: string, priorita: Priorita, orario: { inizio: string; durata: number } | null = null) =>
  ({
    ...comune,
    tipo: 'todo',
    titolo,
    giorno: '2026-09-23',
    orario,
    orizzonte: 'settimana',
    priorita,
    checklist: [],
    corsoId: null,
  }) satisfies BozzaAttivita;
async function crea(bozza: BozzaAttivita, now: number): Promise<string> {
  const r = await createActivity(db, bozza, now, FUSO);
  if (!r.ok) throw new Error(r.errori.join());
  return r.id;
}
/** La fascia senza orario di oggi, nell'ordine della vista. */
const fascia = async () =>
  sortDay(await blocksBetween(db, '2026-09-23', '2026-09-23'))
    .filter((b) => !b.conOrario)
    .map((b) => b.titolo);

describe('Riordino — SCENARI G3 (servizio)', () => {
  let valigia: string;
  beforeEach(async () => {
    valigia = await crea(todo('Prepara la valigia', 'alta'), oggi(8));
    await crea(todo('Prenota il treno', 'alta'), oggi(8, 1));
    await crea(todo('Chiama Marco', 'normale'), oggi(8, 2));
  });

  it('un todo nuovo entra in fondo al suo gruppo (§6)', async () => {
    expect(await fascia()).toEqual(['Prepara la valigia', 'Prenota il treno', 'Chiama Marco']);
    await crea(todo('Comprare il caricabatterie', 'alta'), oggi(9));
    expect(await fascia()).toEqual([
      'Prepara la valigia',
      'Prenota il treno',
      'Comprare il caricabatterie',
      'Chiama Marco',
    ]);
  });

  it('«Prepara la valigia» sotto «Prenota il treno»: senza orario, stesso giorno, stato e orizzonte', async () => {
    const prima = (await get(db, 'blocchi', valigia))!;
    expect(await reorderTodo(db, valigia, 1, oggi(10), FUSO)).toBe(true);
    expect(await fascia()).toEqual(['Prenota il treno', 'Prepara la valigia', 'Chiama Marco']);
    const dopo = (await get(db, 'blocchi', valigia))!;
    expect([dopo.conOrario, dopo.giornoLocale, dopo.inizio, dopo.fine, dopo.stato, dopo.orizzonte]).toEqual([
      prima.conOrario,
      prima.giornoLocale,
      prima.inizio,
      prima.fine,
      prima.stato,
      prima.orizzonte,
    ]);
  });

  it('non scende sotto «Chiama Marco»; un todo con orario o un id sconosciuto non si riordinano', async () => {
    await reorderTodo(db, valigia, 5, oggi(10), FUSO);
    expect(await fascia()).toEqual(['Prenota il treno', 'Prepara la valigia', 'Chiama Marco']);
    const spesa = await crea(todo('Spesa', 'normale', { inizio: '18:00', durata: 30 }), oggi(8, 3));
    expect(await reorderTodo(db, spesa, 0, oggi(10), FUSO)).toBe(false);
    expect(await reorderTodo(db, 'nessuno', 0, oggi(10), FUSO)).toBe(false);
  });
});
