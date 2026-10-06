// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, list, save, saveBlock } from '../data/repository';
import { newCard } from '../domain/sm2';
import { local } from '../domain/time';
import { importSampleCourse } from './courseImport';
import { createActivity } from './activities';
import { endSession, startSession } from './session';
import {
  courseCards,
  courseCascade,
  deleteCourse,
  readCourse,
  readModule,
  readUnit,
  readUnitMaterial,
  setCriterion,
} from './courses';

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
    expect(prima?.scheda).toMatchObject({ moduli: 5, unita: 13, completate: 0, pct: 0 });
    expect(prima?.moduli.map((m) => [m.numero, m.stato, m.unita.length])).toEqual([
      [0, 'aperto', 9],
      [1, 'bloccato', 4],
      [2, 'bloccato', 0],
      [3, 'bloccato', 0],
      [4, 'bloccato', 0],
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

describe('Eliminazione corso — SCENARI H3, MECCANISMI §16', () => {
  const FUSO = 'Europe/Rome';
  const studio = (corsoId: string | null, giorni = [0, 1, 2, 3, 4, 5, 6]) => ({
    tipo: 'studio' as const,
    titolo: '',
    note: '',
    promemoria: { modo: 'auto' as const },
    corsoId,
    giorni,
    inizio: '16:00',
    fine: '16:45',
    dataInizio: '2026-09-22',
    termine: null,
  });
  // Un record per tabella sull'unità `unitaId`
  const materiale = async (unitaId: string, corsoId: string, now: number) => {
    const mazzo = await save(db, 'mazzi', { unitaId }, now);
    await save(db, 'carte', { ...newCard(now), mazzoId: mazzo.id }, now);
    await save(db, 'pratiche', { unitaId, tipo: 'quiz', creataIl: now }, now);
    const m = await save(
      db,
      'materiali',
      { unitaId, corsoId, tipo: 'pdf', titolo: 'a.pdf', byte: 1, testoEstratto: null },
      now,
    );
    await save(db, 'materialiBinari', { id: m.id, materialeId: m.id, dati: new Uint8Array([1]) }, now);
    await save(db, 'fileCodice', { unitaId, sessioneId: null }, now);
  };

  it('sparisce tutto ciò che è del corso, con le tombstone; l’altro corso, i todo, le altre routine e le sessioni restano', async () => {
    const now = local(2026, 9, 22, 9, 0);
    await importSampleCourse(db, now);
    await importSampleCourse(db, now + 1);
    const [corso, altro] = (await list(db, 'corsi')).sort((a, b) => a.importatoIl - b.importatoIl);
    const unita = (await list(db, 'unita')).find((u) => u.corsoId === corso!.id)!;
    const sua = (await list(db, 'unita')).find((u) => u.corsoId === altro!.id)!;
    await createActivity(db, studio(corso!.id), now, FUSO);
    await createActivity(db, studio(altro!.id), now, FUSO);
    await createActivity(
      db,
      { ...studio(null), tipo: 'routine', titolo: 'Corsa', fine: '17:00', fasi: [] } as never,
      now,
      FUSO,
    );
    await materiale(unita.id, corso!.id, now);
    await materiale(sua.id, altro!.id, now);
    // Una sessione libera chiusa sul corso: resta nelle statistiche
    const scelta = {
      unitaId: unita.id,
      corsoId: corso!.id,
      durata: 25,
      modalita: 'continua',
      iperfocus: false,
    } as const;
    await startSession(db, null, scelta, now, FUSO);
    await endSession(db, now + 25 * 60_000, FUSO, {
      esito: 'continua',
      confidenza: null,
      nota: '',
      contaNelPiano: false,
    });
    const conta = async () => ({
      corso: (await list(db, 'blocchi')).filter((b) => b.corsoId === corso!.id).length,
      altro: (await list(db, 'blocchi')).filter((b) => b.corsoId === altro!.id).length,
      routine: (await list(db, 'blocchi')).filter((b) => b.tipo === 'routine').length,
    });
    const prima = await conta();
    expect(prima.corso).toBeGreaterThan(0);
    expect(await courseCascade(db, corso!.id)).toMatchObject({
      routine: 1,
      occorrenze: prima.corso,
      mazzi: 1,
      carte: 1,
    });

    const via = now + 2;
    await deleteCourse(db, corso!.id, via);
    expect(await conta()).toEqual({ corso: 0, altro: prima.altro, routine: prima.routine });
    for (const t of ['mazzi', 'carte', 'pratiche', 'materiali', 'materialiBinari', 'fileCodice'] as const)
      expect(await list(db, t)).toHaveLength(1);
    expect((await list(db, 'corsi')).map((c) => c.id)).toEqual([altro!.id]);
    expect((await list(db, 'unita')).every((u) => u.corsoId === altro!.id)).toBe(true);
    expect((await list(db, 'ricorrenze')).some((r) => r.corsoId === corso!.id)).toBe(false);
    expect(await list(db, 'sessioni')).toHaveLength(1);
    // Tombstone per la sync (§25)
    expect(await db.table('corsi').get(corso!.id)).toMatchObject({ deletedAt: via });
    expect(await db.table('unita').get(unita.id)).toMatchObject({ deletedAt: via });
  });

  it('un blocco del corso di una routine senza corso si stacca dal corso, non sparisce (lo slot non torna al ciclo)', async () => {
    const now = local(2026, 9, 22, 9, 0);
    await importSampleCourse(db, now);
    const corso = (await list(db, 'corsi'))[0]!;
    const unita = (await list(db, 'unita'))[0]!;
    const r = await createActivity(db, studio(null), now, FUSO);
    if (!r.ok) throw new Error('routine');
    // L'esito di oggi ha scritto sul blocco il corso dell'unità scelta (C9)
    const oggi = (await list(db, 'blocchi')).find((b) => b.ricorrenzaId === r.id && b.giornoLocale === '2026-09-22')!;
    await saveBlock(db, { ...oggi, stato: 'completato', corsoId: corso.id, unitaId: unita.id }, now, FUSO);
    await deleteCourse(db, corso.id, now + 1);
    expect(await get(db, 'blocchi', oggi.id)).toMatchObject({ stato: 'completato', corsoId: null, unitaId: null });
    expect(await get(db, 'ricorrenze', r.id)).toBeDefined();
  });

  it('una sessione attiva sul corso eliminato si chiude senza blocchi orfani', async () => {
    const now = local(2026, 9, 22, 9, 0);
    await importSampleCourse(db, now);
    const corso = (await list(db, 'corsi'))[0]!;
    const unita = (await list(db, 'unita'))[0]!;
    const scelta = {
      unitaId: unita.id,
      corsoId: corso.id,
      durata: 25,
      modalita: 'continua',
      iperfocus: false,
    } as const;
    await startSession(db, null, scelta, now, FUSO);
    await deleteCourse(db, corso.id, now + 60_000);
    await endSession(db, now + 25 * 60_000, FUSO, {
      esito: 'completata',
      confidenza: null,
      nota: '',
      contaNelPiano: true,
    });
    const blocchi = await list(db, 'blocchi');
    expect(blocchi.some((b) => b.corsoId === corso.id || b.unitaId === unita.id)).toBe(false);
  });
});

describe('Puntatore, esito e moduli nelle pagine dei corsi — MECCANISMI §11, SCENARI C7', () => {
  it('a percorso bloccato (M0 finito, Go/No-Go a no) non c’è una «Prossima»; il precedente di M1 è M0', async () => {
    const now = local(2026, 9, 22, 9, 0);
    await importSampleCourse(db, now);
    const id = (await list(db, 'corsi'))[0]!.id;
    expect((await readCourse(db, id))?.moduli.map((m) => m.precedente)).toEqual([null, 0, 1, 2, 3]);
    for (const u of await list(db, 'unita'))
      if (u.moduloNumero === 0) await save(db, 'unita', { ...u, stato: 'completata' }, now);
    expect((await readCourse(db, id))?.puntatore).toBeNull();
    expect((await courseCards(db))[0]?.prossima).toBeNull();
    expect((await readModule(db, id, 0))?.cta).toBeNull();
  });

  it('C7: l’ultima sessione libera senza «conta» mostra i minuti ma non l’esito', async () => {
    const now = local(2026, 9, 22, 9, 0);
    await importSampleCourse(db, now);
    const u = (await list(db, 'unita')).find((x) => x.numero === '0.7')!;
    const scelta = { unitaId: u.id, corsoId: u.corsoId, durata: 25, modalita: 'continua', iperfocus: false } as const;
    await startSession(db, null, scelta, now, 'Europe/Rome');
    await endSession(db, now + 25 * 60_000, 'Europe/Rome', {
      esito: 'completata',
      confidenza: null,
      nota: '',
      contaNelPiano: false,
    });
    expect((await readUnit(db, u.id))?.ultimaSessione).toEqual({ avvio: now, minuti: 25, esito: null });
  });
});
