// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { local } from '../domain/time';
import { openDb, SCHEMA_V1, type RoutForgeDb, type Tabelle } from './db';
import { get, remove, save, saveBlock } from './repository';

/** Le tabelle di docs/02_ARCHITETTURA.md §3: una per entità di MECC §1. */
const TABELLE: (keyof Tabelle)[] = [
  'corsi',
  'moduli',
  'unita',
  'sezioni',
  'risorse',
  'ricorrenze',
  'blocchi',
  'sessioni',
  'logFasi',
  'mazzi',
  'carte',
  'pratiche',
  'conversazioni',
  'messaggi',
  'materiali',
  'materialiBinari',
  'fileCodice',
  'preferenze',
  'registroNotifiche',
  'syncCoda',
];
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

let n = 0;
let db: RoutForgeDb;
const apri = (): RoutForgeDb => (db = openDb(`test-schema-${++n}`));
afterEach(() => db.delete());

describe('Schema v1 e v2 — docs/02_ARCHITETTURA.md §3, D-DATA-1 (v2: coda della sync, T-033)', () => {
  it('contiene tutte le tabelle, ognuna con chiave primaria `id` esplicita (niente autoincremento)', async () => {
    await apri().open();
    expect(db.verno).toBe(2);
    expect(db.tables.map((t) => t.name).sort()).toEqual([...TABELLE].sort());
    for (const t of db.tables) {
      expect([t.name, t.schema.primKey.keyPath, !!t.schema.primKey.auto]).toEqual([t.name, 'id', false]);
    }
  });

  it('i dati sopravvivono alla chiusura e alla riapertura del database', async () => {
    const nome = `test-schema-${++n}`;
    const primo = openDb(nome);
    const pref = await save(primo, 'preferenze', { id: 'ultimaApertura', valore: 1 }, local(2026, 9, 24, 8, 0));
    primo.close();
    db = openDb(nome);
    expect(await get(db, 'preferenze', 'ultimaApertura')).toEqual(pref);
  });

  it('migrazione v1 → v2: i dati di un database della versione 1 restano, la coda della sync nasce vuota', async () => {
    const nome = `test-schema-${++n}`;
    const v1 = new Dexie(nome);
    v1.version(1).stores(SCHEMA_V1);
    await v1.table('preferenze').put({ id: 'ultimaApertura', valore: 1, createdAt: 1, updatedAt: 1, deletedAt: null });
    v1.close();
    db = openDb(nome);
    expect(await get(db, 'preferenze', 'ultimaApertura')).toMatchObject({ valore: 1 });
    expect(db.verno).toBe(2);
    expect(await db.syncCoda.count()).toBe(0);
  });
});

describe('Campi comuni e tombstone in ogni tabella — INV-14, MECC §25', () => {
  it('ogni record salvato ha id UUID v4, createdAt, updatedAt, deletedAt; eliminarlo lascia una tombstone', async () => {
    apri();
    const now = local(2026, 9, 24, 8, 0);
    const dopo = local(2026, 9, 24, 9, 0);
    for (const t of TABELLE) {
      const r =
        t === 'blocchi'
          ? await saveBlock(
              db,
              { tipo: 'evento', stato: 'programmato', inizio: now, fine: dopo, conOrario: true },
              now,
              'Europe/Rome',
            )
          : await save(db, t, {} as never, now);
      expect(r.id, t).toMatch(UUID_V4);
      expect([t, r.createdAt, r.updatedAt, r.deletedAt]).toEqual([t, now, now, null]);

      await remove(db, t, r.id, dopo);
      expect(await get(db, t, r.id), t).toBeUndefined();
      expect(await db.table(t).get(r.id)).toEqual({ id: r.id, createdAt: now, updatedAt: dopo, deletedAt: dopo });
    }
  });
});
