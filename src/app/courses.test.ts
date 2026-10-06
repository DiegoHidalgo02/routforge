// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { list } from '../data/repository';
import { local } from '../domain/time';
import { importSampleCourse } from './courseImport';
import { createActivity } from './activities';
import { readCourse, readModule, readUnitMaterial, setCriterion } from './courses';

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

describe('Corso → moduli — FUNZ §9.3, MECCANISMI §11', () => {
  it('corso di esempio: moduli in ordine con lo stato e le unità, puntatore sulla prima unità aperta, routine del corso', async () => {
    const now = local(2026, 9, 22, 9, 0);
    await importSampleCourse(db, now);
    const id = (await list(db, 'corsi'))[0]!.id;
    const prima = await readCourse(db, id);
    expect(prima?.scheda).toMatchObject({ moduli: 2, unita: 13, completate: 0, pct: 0 });
    expect(prima?.moduli.map((m) => [m.numero, m.stato, m.unita.length])).toEqual([
      [0, 'aperto', 9],
      [1, 'bloccato', 4],
    ]);
    expect(prima?.puntatore?.numero).toBe('0.1');
    expect(prima?.moduli[0]).toMatchObject({ domande: 10, criteri: { fatti: 0, totali: 7 } });
    expect(prima?.moduli[0]?.progetto).toContain('Task Tracker');
    expect(prima?.routine).toBeNull();
    await createActivity(
      db,
      {
        tipo: 'studio',
        titolo: '',
        note: '',
        promemoria: { modo: 'auto' },
        corsoId: id,
        giorni: [1, 3, 5],
        inizio: '16:00',
        fine: '16:45',
        dataInizio: '2026-09-22',
        termine: null,
      },
      now,
      'Europe/Rome',
    );
    expect((await readCourse(db, id))?.routine).toEqual({ giorni: [1, 3, 5], orarioInizio: '16:00' });
    expect(await readCourse(db, 'nessuno')).toBeNull();
  });
});

describe('Modulo e criteri Go/No-Go — MECCANISMI §11, §16', () => {
  it('il modulo con la verifica; i criteri manuali si spuntano, gli automatici no; tutti sì → il successivo si apre', async () => {
    const now = local(2026, 9, 22, 9, 0);
    await importSampleCourse(db, now);
    const id = (await list(db, 'corsi'))[0]!.id;
    const m0 = await readModule(db, id, 0);
    expect(m0?.modulo).toMatchObject({ numero: 0, stato: 'aperto' });
    expect(m0?.modulo.obiettivi.length).toBeGreaterThan(0);
    expect(m0?.unita).toHaveLength(9);
    expect(m0?.unita.find((u) => u.numero === '0.7')).toMatchObject({ sezioni: 4, link: 4 });
    const criteri = m0!.modulo.criteri;
    const auto = criteri.findIndex((c) => c.auto);
    if (auto >= 0) {
      await setCriterion(db, m0!.modulo.id, auto, true, now, 'Europe/Rome');
      expect((await readModule(db, id, 0))?.modulo.criteri[auto]?.fatto).toBe(false);
    }
    for (const [i, c] of criteri.entries())
      if (!c.auto) await setCriterion(db, m0!.modulo.id, i, true, now, 'Europe/Rome');
    expect((await readModule(db, id, 0))?.modulo.criteri.filter((c) => !c.auto).every((c) => c.fatto)).toBe(true);
    expect((await readModule(db, id, 1))?.modulo.stato).toBe(auto >= 0 ? 'bloccato' : 'aperto');
    expect(await readModule(db, id, 9)).toBeNull();
  });
});
