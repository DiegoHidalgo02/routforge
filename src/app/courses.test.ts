// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { list } from '../data/repository';
import { local } from '../domain/time';
import { importSampleCourse } from './courseImport';
import { readUnitMaterial } from './courses';

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-corsi-${++n}`);
});
afterEach(() => db.delete());

describe('Materiale dell’unità — FORMATO_CORSO §4', () => {
  it('unità 0.7 del corso di esempio: concetto core, quattro sezioni in ordine, risorse con host e video', async () => {
    await importSampleCourse(db, local(2026, 9, 22, 9, 0));
    const u = (await list(db, 'unita')).find((x) => x.numero === '0.7')!;
    const m = await readUnitMaterial(db, u.id);
    expect(m?.concettoCore?.titolo).toBe('una sola corsia, e le code che la alimentano');
    expect(m?.sezioni.map((s) => [s.tipo, s.titolo])).toEqual([
      ['teoria', 'Fondamenta'],
      ['studio', 'Visualizzazione'],
      ['pratica', 'Testing & Debugging'],
      ['progetto', 'Batteria di previsioni: 10 su Loupe'],
    ]);
    expect(m?.sezioni[0]?.risorse).toEqual([
      {
        titolo: 'Event loop: microtasks and macrotasks — javascript.info',
        url: 'https://javascript.info/event-loop',
        host: 'javascript.info',
        youtube: false,
      },
    ]);
    expect(m?.sezioni[1]?.risorse[0]?.youtube).toBe(true);
    expect(await readUnitMaterial(db, 'nessuna')).toBeNull();
  });
});
