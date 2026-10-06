// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { local } from '../domain/time';
import { readNotificationSettings } from './notifications';
import { editNotificationSettings, readSettings, saveSettings } from './settings';

const ADESSO = local(2026, 9, 23, 16, 8);
let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-settings-${++n}`);
});
afterEach(() => db.delete());

describe('Impostazioni — FUNZIONALITA §23, MECCANISMI §13.1', () => {
  it('due cambi successivi si sommano; le notifiche partono dai default e si rileggono', async () => {
    await saveSettings(db, { celebrazioni: 'piena' }, ADESSO);
    await saveSettings(db, { inizioSettimana: 0 }, ADESSO);
    expect(await readSettings(db)).toEqual({
      animazioni: 'auto',
      celebrazioni: 'piena',
      aptico: true,
      inizioSettimana: 0,
    });
    await editNotificationSettings(
      db,
      (v) => ({ ...v, perTipo: { ...v.perTipo, todo: { ...v.perTipo.todo, silenzioso: true, anticipi: [60] } } }),
      ADESSO,
    );
    expect((await readNotificationSettings(db)).perTipo.todo).toEqual({
      attivo: true,
      anticipi: [60],
      silenzioso: true,
    });
  });
});
