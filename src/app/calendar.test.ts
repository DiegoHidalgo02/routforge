// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { remove, saveBlock } from '../data/repository';
import { monthGrid } from '../domain/calendar';
import { addLocalDays, local } from '../domain/time';
import type { Blocco, Priorita } from '../domain/types';
import { calendarDays } from './calendar';

const NOW = local(2026, 9, 22, 8, 0);
const FUSO = 'Europe/Rome';
let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-calendario-${++n}`);
});
afterEach(() => db.delete());

const blocco = (titolo: string, inizio: number, extra: Partial<Blocco> = {}) =>
  saveBlock(
    db,
    { tipo: 'todo', stato: 'programmato', inizio, fine: null, conOrario: true, titolo, ...extra },
    NOW,
    FUSO,
  );
const senzaOrario = (titolo: string, priorita: Priorita) =>
  blocco(titolo, local(2026, 9, 22), { conOrario: false, priorita, orizzonte: 'giorno' });

describe('Vista Giorno — SCENARI A5', () => {
  it('tre todo senza orario (bassa, alta, normale): in cima alta, normale, bassa, prima dei blocchi con orario', async () => {
    await blocco('Riunione', local(2026, 9, 22, 7, 0), { tipo: 'evento', fine: local(2026, 9, 22, 8, 0) });
    await senzaOrario('Bassa', 'bassa');
    await senzaOrario('Alta', 'alta');
    await senzaOrario('Normale', 'normale');
    const giorni = await calendarDays(db, ['2026-09-22']);
    expect(giorni.get('2026-09-22')?.map((b) => b.titolo)).toEqual(['Alta', 'Normale', 'Bassa', 'Riunione']);
  });
});

describe('Settimana e Mese — MECC §24', () => {
  it('un elenco per ogni giorno del periodo, anche vuoto; i terminali restano nel giorno; gli eliminati no', async () => {
    await blocco('Fatto', local(2026, 9, 23, 9, 0), { stato: 'completato' });
    await blocco('Perso', local(2026, 9, 23, 10, 0), { stato: 'perso' });
    const via = await blocco('Eliminato', local(2026, 9, 23, 11, 0));
    await remove(db, 'blocchi', via.id, NOW);
    await blocco('Fuori', local(2026, 9, 25, 9, 0));
    const giorni = await calendarDays(db, ['2026-09-22', '2026-09-23', '2026-09-24']);
    expect([...giorni.keys()]).toEqual(['2026-09-22', '2026-09-23', '2026-09-24']);
    expect(giorni.get('2026-09-22')).toEqual([]);
    expect(giorni.get('2026-09-23')?.map((b) => b.titolo)).toEqual(['Fatto', 'Perso']);
  });

  it('in un periodo di più giorni la fascia senza orario resta in testa al suo giorno', async () => {
    await blocco('Presto', local(2026, 9, 23, 6, 0));
    await blocco('Senza orario', local(2026, 9, 23), { conOrario: false, priorita: 'bassa' });
    const giorni = await calendarDays(db, ['2026-09-22', '2026-09-23']);
    expect(giorni.get('2026-09-23')?.map((b) => b.titolo)).toEqual(['Senza orario', 'Presto']);
  });

  // Il tempo (0,5 s, HANDOFF §3) vale sul dispositivo: su fake-indexeddb, scritto in JavaScript, non lo dice e sotto
  // carico rende il gate rosso senza un errore (audit P2-14)
  it('500 blocchi in un mese: la griglia del mese li legge tutti (HANDOFF §3, T-008)', async () => {
    // Una transazione sola per i 500 blocchi (con la coda della sync, che `saveBlock` apre con loro, T-033)
    await db.transaction('rw', [db.blocchi, db.syncCoda], async () => {
      for (let i = 0; i < 500; i++) await blocco(`B${i}`, addLocalDays(local(2026, 9, 1, 7, i % 60), i % 30));
    });
    const giorni = await calendarDays(
      db,
      monthGrid('2026-09-01').map((c) => c.giorno),
    );
    expect([...giorni.values()].reduce((s, g) => s + g.length, 0)).toBe(500);
  });
});
