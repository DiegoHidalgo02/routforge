// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, saveBlock } from '../data/repository';
import { local } from '../domain/time';
import { addInterruption } from '../domain/timer';
import { completeBlock } from './completion';
import { runCycle } from './scheduler';
import { editActiveSession, endSession, startSession } from './session';
import { readStats } from './stats';

const FUSO = 'Europe/Rome';
const ADESSO = local(2026, 9, 23, 16, 8);

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-stats-${++n}`);
});
afterEach(() => db.delete());

describe('Panoramica — MECCANISMI §20', () => {
  it('focus della sessione chiusa, disciplina dei blocchi, giorni con attività; vuoto senza niente', async () => {
    expect((await readStats(db, 7, ADESSO)).vuoto).toBe(true);
    const scelta = { unitaId: null, corsoId: null, durata: 25, modalita: 'continua', iperfocus: false } as const;
    await startSession(db, null, scelta, local(2026, 9, 23, 9), FUSO);
    await endSession(db, local(2026, 9, 23, 9, 25), FUSO, {
      esito: 'completata',
      confidenza: null,
      nota: '',
      contaNelPiano: false,
    });
    await saveBlock(
      db,
      {
        tipo: 'todo',
        stato: 'perso',
        inizio: local(2026, 9, 22, 18),
        fine: local(2026, 9, 22, 18, 30),
        conOrario: true,
      },
      ADESSO,
      FUSO,
    );
    await saveBlock(
      db,
      {
        tipo: 'evento',
        stato: 'completato',
        inizio: local(2026, 9, 21, 15),
        fine: local(2026, 9, 21, 16),
        conOrario: true,
      },
      ADESSO,
      FUSO,
    );
    const { vuoto, panoramica: p } = await readStats(db, 7, ADESSO);
    expect(vuoto).toBe(false);
    expect(p).toMatchObject({ focus: 25, focusPrima: 0, sessioni: { numero: 1, media: 25 } });
    expect(p.disciplina.globale).toBe(1 / 2);
    expect(p.attivita.giorni).toBe(1);
    expect(p.attivita.mappa.find((g) => g.giorno === '2026-09-21')?.minuti).toBe(60);
  });
});

describe('Risposta al trigger — SCENARI B7', () => {
  it('routine 18:00–20:00: spuntata alle 19:40 risponde; non toccata diventa persa alle 20:30 e non risponde', async () => {
    const routine = () =>
      saveBlock(
        db,
        {
          tipo: 'routine',
          stato: 'programmato',
          titolo: 'Corsa',
          inizio: local(2026, 9, 22, 18),
          fine: local(2026, 9, 22, 20),
          conOrario: true,
        },
        local(2026, 9, 22, 8),
        FUSO,
      );
    const spuntata = await routine();
    const lasciata = await routine();
    expect(await completeBlock(db, spuntata.id, local(2026, 9, 22, 19, 40), FUSO)).toBe(true);
    await runCycle(db, local(2026, 9, 22, 20, 31), FUSO); // perso oltre 30′ dalla fine (§8)
    expect((await get(db, 'blocchi', lasciata.id))?.stato).toBe('perso');
    expect((await readStats(db, 7, ADESSO)).trigger).toEqual({ scattati: 2, risposti: 1, persi: 1, tasso: 1 / 2 });
  });
});

describe('Uscite d’emergenza — SCENARI D5', () => {
  it('l’uscita forzata dall’iperfocus conta fra le uscite d’emergenza della sessione', async () => {
    const avvio = local(2026, 9, 23, 9);
    const scelta = { unitaId: null, corsoId: null, durata: 50, modalita: 'continua', iperfocus: true } as const;
    await startSession(db, null, scelta, avvio, FUSO);
    await editActiveSession(db, (s) => addInterruption(s, avvio + 20 * 60_000, true), avvio + 20 * 60_000);
    await endSession(db, avvio + 54 * 60_000, FUSO, {
      esito: 'completata',
      confidenza: null,
      nota: '',
      contaNelPiano: false,
    });
    expect((await readStats(db, 7, ADESSO)).studio.iperfocus).toMatchObject({ sessioni: 1, totali: 1, uscite: 1 });
  });
});
