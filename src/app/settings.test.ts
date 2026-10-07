// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, saveBlock } from '../data/repository';
import { local } from '../domain/time';
import { editNotificationSettings, readNotificationSettings } from './notifications';
import { runCycle } from './scheduler';
import { readSettings, saveSettings } from './settings';

const ADESSO = local(2026, 9, 23, 16, 8);
const FUSO = 'Europe/Rome';
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
    expect(await readSettings(db)).toMatchObject({
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

describe('Inizio settimana nel ciclo — FUNZIONALITA §23 (T-032)', () => {
  it('un todo della settimana di mercoledì rotola a domenica; con la settimana dalla domenica domenica è già fuori orizzonte', async () => {
    const settimanale = () =>
      saveBlock(
        db,
        {
          tipo: 'todo',
          stato: 'programmato',
          titolo: 'Spesa',
          orizzonte: 'settimana',
          inizio: local(2026, 9, 23, 9),
          fine: local(2026, 9, 23, 9, 30),
          conOrario: true,
        },
        local(2026, 9, 23, 8),
        FUSO,
      );
    const lunedi = await settimanale();
    await runCycle(db, local(2026, 9, 27, 10), FUSO);
    expect((await get(db, 'blocchi', lunedi.id))?.stato).toBe('programmato');
    await saveSettings(db, { inizioSettimana: 0 }, local(2026, 9, 27, 10));
    const domenica = await settimanale();
    await runCycle(db, local(2026, 9, 27, 10, 5), FUSO);
    expect((await get(db, 'blocchi', domenica.id))?.stato).toBe('perso');
    // D-IMPOST-1 (7): il cambio vale dal giorno in cui il todo sta adesso; spostato a domenica 27, la sua settimana dalla
    // domenica arriva al 3/10 e resta da fare
    expect((await get(db, 'blocchi', lunedi.id))?.stato).toBe('programmato');
  });
});
