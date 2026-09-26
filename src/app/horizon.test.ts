// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, saveBlock } from '../data/repository';
import { shouldMarkLost } from '../domain/lost';
import { endOfLocalDay, local } from '../domain/time';
import type { Blocco } from '../domain/types';
import { rollTodos } from './horizon';

const FUSO = 'Europe/Rome';
let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-orizzonte-${++n}`);
});
afterEach(() => db.delete());

const blocco = (dati: Partial<Blocco> & Pick<Blocco, 'inizio' | 'fine'>) =>
  saveBlock(db, { tipo: 'todo', stato: 'programmato', conOrario: true, ...dati }, dati.inizio, FUSO);
const letto = async (id: string) => (await get(db, 'blocchi', id))!;

// Settembre 2026: martedì 22, mercoledì 23, domenica 27, lunedì 28.
describe('Spostamento a oggi — SCENARI A2 (todo «Spesa» di martedì 18:00, 30 minuti, orizzonte settimana)', () => {
  let id: string;
  beforeEach(async () => {
    const spesa = await blocco({
      titolo: 'Spesa',
      orizzonte: 'settimana',
      inizio: local(2026, 9, 22, 18, 0),
      fine: local(2026, 9, 22, 18, 30),
      checklist: [
        { testo: 'Latte', fatta: true },
        { testo: 'Pane', fatta: false },
      ],
    });
    id = spesa.id;
  });

  it("mercoledì all'apertura è a mercoledì alle 18:00; le voci già spuntate restano spuntate; parte l'avviso", async () => {
    const now = local(2026, 9, 23, 9, 0);
    expect(await rollTodos(db, now, FUSO)).toEqual([id]);
    const b = await letto(id);
    expect([b.giornoLocale, b.orarioInizio, b.orarioFine]).toEqual(['2026-09-23', '18:00', '18:30']);
    expect(b.checklist).toEqual([
      { testo: 'Latte', fatta: true },
      { testo: 'Pane', fatta: false },
    ]);
    expect(b.ritardoIl).toBe(now);
  });

  it("con le 18:00 occupate da un blocco di oggi va nel primo varco di 30' dopo l'ora corrente", async () => {
    await blocco({
      tipo: 'evento',
      titolo: 'Cena',
      inizio: local(2026, 9, 23, 18, 0),
      fine: local(2026, 9, 23, 19, 0),
    });
    await rollTodos(db, local(2026, 9, 23, 10, 0), FUSO);
    const mercoledi = await letto(id);
    expect([mercoledi.orarioInizio, mercoledi.orarioOriginale]).toEqual(['10:00', '18:00']);
    // Giovedì le 18:00 sono libere: il todo torna all'orario scelto (D-HOR-1)
    await rollTodos(db, local(2026, 9, 24, 9, 0), FUSO);
    const giovedi = await letto(id);
    expect([giovedi.giornoLocale, giovedi.orarioInizio, giovedi.orarioOriginale]).toEqual([
      '2026-09-24',
      '18:00',
      null,
    ]);
  });

  it('rotola ogni giorno fino a domenica con un solo avviso; lunedì resta a domenica ed è «non fatto»', async () => {
    const avvisi: string[] = [];
    for (let giorno = 23; giorno <= 27; giorno++)
      avvisi.push(...(await rollTodos(db, local(2026, 9, giorno, 9, 0), FUSO)));
    expect(avvisi).toEqual([id]);
    expect((await letto(id)).giornoLocale).toBe('2026-09-27');
    const lunedi = local(2026, 9, 28, 9, 0);
    expect(await rollTodos(db, lunedi, FUSO)).toEqual([]);
    const b = await letto(id);
    expect(b.giornoLocale).toBe('2026-09-27');
    expect(shouldMarkLost(b, lunedi)).toBe(true);
  });

  it('rieseguire senza cambiamenti non scrive nulla (MECCANISMI §9, INV-15)', async () => {
    await rollTodos(db, local(2026, 9, 23, 9, 0), FUSO);
    const prima = await letto(id);
    expect(await rollTodos(db, local(2026, 9, 23, 9, 5), FUSO)).toEqual([]);
    expect((await letto(id)).updatedAt).toBe(prima.updatedAt);
  });
});

describe('Non fatto — SCENARI A1 (todo «Chiama Marco», senza orario, orizzonte giorno)', () => {
  it('alle 00:30 del giorno dopo non rotola: resta nel giorno di ieri, senza avviso dallo spostamento', async () => {
    const marco = await blocco({
      titolo: 'Chiama Marco',
      conOrario: false,
      orizzonte: 'giorno',
      inizio: local(2026, 9, 22, 12, 0),
      fine: endOfLocalDay(local(2026, 9, 22, 12, 0)),
    });
    const now = local(2026, 9, 23, 0, 30);
    expect(await rollTodos(db, now, FUSO)).toEqual([]);
    const b = await letto(marco.id);
    expect(b.giornoLocale).toBe('2026-09-22');
    expect(b.updatedAt).toBe(marco.updatedAt);
    expect(shouldMarkLost(b, now)).toBe(true);
  });
});

describe('Spostamento a oggi — MECCANISMI §6 (lettura fino a 31 giorni indietro)', () => {
  it("un todo con orizzonte mese del primo del mese rotola anche l'ultimo giorno", async () => {
    const t = await blocco({ orizzonte: 'mese', inizio: local(2026, 8, 1, 9, 0), fine: local(2026, 8, 1, 9, 30) });
    expect(await rollTodos(db, local(2026, 8, 31, 7, 0), FUSO)).toEqual([t.id]);
    expect((await letto(t.id)).giornoLocale).toBe('2026-08-31');
  });
});
