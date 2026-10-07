// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, list, remove, save, saveBlock } from '../data/repository';
import type { DatiEsito } from '../domain/outcome';
import type { SceltaSessione } from '../domain/session';
import { local } from '../domain/time';
import type { Blocco, Esito, StatoUnita } from '../domain/types';
import { readDetail } from './completion';
import { readStreak, registerOutcome, registerOutcomeUndoable } from './outcome';
import { recomputePointer } from './pointer';
import { runCycle } from './scheduler';
import { endSession, readActiveSession, startSession } from './session';

const FUSO = 'Europe/Rome';
// Lunedì 28 settembre 2026 (oggi nei test).
const oggi = (h: number, m = 0) => local(2026, 9, 28, h, m);
const domani = (h: number) => local(2026, 9, 29, h);

let db: RoutForgeDb;
let n = 0;
beforeEach(async () => {
  db = openDb(`test-esito-${++n}`);
  // Il corso c'è, come dopo `saveCourse`: un blocco col corso che qui non c'è perde l'unità al ciclo (D-SYNC-5)
  await save(db, 'corsi', { id: 'c1', titolo: 'Corso', sottotitolo: '', importatoIl: 0, esempio: false }, 1);
  await save(db, 'moduli', modulo('m1', 1), 1);
  await save(db, 'moduli', modulo('m2', 2), 1);
  await save(db, 'unita', unita('u11', 1, 1, '1.1'), 1);
  await save(db, 'unita', unita('u12', 1, 2, '1.2'), 1);
  await save(db, 'unita', unita('u21', 2, 1, '2.1'), 1);
});
afterEach(() => db.delete());

const studio = (id: string, over: Partial<Blocco> = {}) =>
  saveBlock(
    db,
    {
      id,
      tipo: 'studio',
      stato: 'programmato',
      conOrario: true,
      inizio: oggi(9),
      fine: oggi(10),
      corsoId: 'c1',
      unitaId: 'u11',
      ...over,
    },
    oggi(7),
    FUSO,
  );
const scelta = (over: Partial<SceltaSessione> = {}): SceltaSessione => ({
  unitaId: null,
  corsoId: null,
  durata: 25,
  modalita: 'continua',
  iperfocus: false,
  ...over,
});
const esito = (e: Esito, over: Partial<DatiEsito> = {}): DatiEsito => ({
  esito: e,
  confidenza: 3,
  nota: '',
  contaNelPiano: true,
  ...over,
});
const statoUnita = async (id: string) => (await get(db, 'unita', id))?.stato;

describe('Continua — SCENARI C2', () => {
  it('45 minuti su 1.1 con Continua: blocco parziale, 1.1 parziale con 45 minuti, domani punta ancora a 1.1', async () => {
    await studio('s1');
    await studio('d1', { inizio: domani(9), fine: domani(10), unitaId: 'u12' });
    await startSession(db, 's1', scelta(), oggi(9, 15), FUSO);
    const chiusa = await endSession(db, oggi(10), FUSO, esito('continua'));
    expect(chiusa?.esito).toEqual(esito('continua'));
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'parziale', confidenza: 3, minuti: 45 });
    expect(await get(db, 'unita', 'u11')).toMatchObject({
      stato: 'parziale',
      minuti: 45,
      progresso: 45 / 180,
      confidenza: 3,
    });
    expect((await get(db, 'blocchi', 'd1'))?.unitaId).toBe('u11');
    expect(await readActiveSession(db)).toBeNull();
  });
  it('la streak aumenta di 1, una sola volta anche con due sessioni oggi (§12)', async () => {
    await save(db, 'preferenze', { id: 'streak', valore: { conteggio: 4, ultimoGiorno: '2026-09-27' } }, 1);
    await startSession(db, null, scelta({ unitaId: 'u11', corsoId: 'c1' }), oggi(9), FUSO);
    await endSession(db, oggi(9, 25), FUSO, esito('continua'));
    await startSession(db, null, scelta({ unitaId: 'u11', corsoId: 'c1' }), oggi(11), FUSO);
    await endSession(db, oggi(11, 25), FUSO, esito('completata'));
    expect(await readStreak(db, oggi(12))).toBe(5);
    expect(await readStreak(db, local(2026, 9, 30, 12))).toBe(0);
  });
  it('Indietro, Salta e una sessione che non conta non alimentano la streak (§12)', async () => {
    await startSession(db, null, scelta({ unitaId: 'u12', corsoId: 'c1' }), oggi(9), FUSO);
    await endSession(db, oggi(9, 25), FUSO, esito('indietro'));
    await startSession(db, null, scelta({ unitaId: 'u12', corsoId: 'c1' }), oggi(10), FUSO);
    await endSession(db, oggi(10, 25), FUSO, esito('completata', { contaNelPiano: false }));
    expect(await readStreak(db, oggi(12))).toBe(0);
  });
});

describe('Completata, Indietro, Salta — SCENARI C3', () => {
  it('Completata su 1.1, poi Indietro su 1.2, poi Salta su 1.1, col puntatore ricalcolato', async () => {
    await studio('s1');
    await studio('s2', { inizio: oggi(11), fine: oggi(12), unitaId: 'u12' });
    await studio('s3', { inizio: oggi(13), fine: oggi(14), unitaId: 'u21' });
    await studio('d1', { inizio: domani(9), fine: domani(10), unitaId: 'u21' });
    await startSession(db, 's1', scelta(), oggi(9), FUSO);
    await endSession(db, oggi(10), FUSO, esito('completata'));
    expect(await statoUnita('u11')).toBe('completata');
    const unitaDi = async (...ids: string[]) =>
      Promise.all(ids.map(async (id) => (await get(db, 'blocchi', id))?.unitaId));
    expect(await unitaDi('s2', 's3', 'd1')).toEqual(['u12', 'u21', null]);

    await startSession(db, 's2', scelta(), oggi(11), FUSO);
    await endSession(db, oggi(12), FUSO, esito('indietro'));
    expect([await statoUnita('u11'), await statoUnita('u12')]).toEqual(['da_rivedere', 'non_iniziata']);
    // 1.1 è di nuovo la prossima
    expect(await unitaDi('s3', 'd1')).toEqual(['u11', 'u12']);

    await startSession(db, 's3', scelta(), oggi(13), FUSO);
    await endSession(db, oggi(14), FUSO, esito('salta'));
    expect(await statoUnita('u11')).toBe('saltata');
    expect(await unitaDi('d1')).toEqual(['u12']);
  });
});

describe('Esito su blocco perso — SCENARI C6', () => {
  it('«Registra esito → Completata» su un’occorrenza persa ieri: completato, marcatura azzerata, minuti pianificati', async () => {
    await studio('s1', { inizio: local(2026, 9, 27, 9), fine: local(2026, 9, 27, 10) });
    await studio('d1', { inizio: domani(9), fine: domani(10), unitaId: 'u11' });
    await runCycle(db, oggi(8), FUSO);
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('perso');
    expect(await registerOutcome(db, 's1', { esito: 'completata', confidenza: 4, nota: 'fatto' }, oggi(8), FUSO)).toBe(
      true,
    );
    expect(await get(db, 'blocchi', 's1')).toMatchObject({
      stato: 'completato',
      persoIl: null,
      chiusoIl: oggi(8),
      minuti: 60,
      notaEsito: 'fatto',
    });
    expect(await get(db, 'unita', 'u11')).toMatchObject({ stato: 'completata', minuti: 60, confidenza: 4 });
    expect((await get(db, 'blocchi', 'd1'))?.unitaId).toBe('u12');
    expect(await readStreak(db, oggi(8))).toBe(1);
  });
  it('non si registra su un blocco prima della sua fine, già chiuso o in corso', async () => {
    await studio('s1');
    const dati = { esito: 'completata' as const, confidenza: null, nota: '' };
    expect(await registerOutcome(db, 's1', dati, oggi(9, 30), FUSO)).toBe(false);
    await startSession(db, 's1', scelta(), oggi(9, 30), FUSO);
    expect(await registerOutcome(db, 's1', dati, oggi(10, 5), FUSO)).toBe(false);
    expect(await registerOutcome(db, 'nessuno', dati, oggi(10, 5), FUSO)).toBe(false);
    expect(await statoUnita('u11')).toBe('non_iniziata');
  });
});

describe('Annulla dell’esito dal cerchio — SCENARI C10 (servizio)', () => {
  it('«Completata» alle 10:20 su 09:00–10:00: «Annulla» rimette blocco, unità, streak e puntatore com’erano', async () => {
    await studio('s1');
    await studio('d1', { inizio: domani(9), fine: domani(10), unitaId: null });
    await recomputePointer(db, 'c1', oggi(10, 20), FUSO);
    const prima = { blocco: await get(db, 'blocchi', 's1'), unita: await get(db, 'unita', 'u11') };
    expect((await get(db, 'blocchi', 'd1'))?.unitaId).toBe('u11');
    const annulla = await registerOutcomeUndoable(
      db,
      's1',
      { esito: 'completata', confidenza: 4, nota: '' },
      oggi(10, 20),
      FUSO,
    );
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'completato', minuti: 60 });
    expect([await statoUnita('u11'), (await get(db, 'blocchi', 'd1'))?.unitaId]).toEqual(['completata', 'u12']);
    expect(await readStreak(db, oggi(10, 20))).toBe(1);

    await annulla?.(oggi(10, 21));
    const [b, u] = [await get(db, 'blocchi', 's1'), await get(db, 'unita', 'u11')];
    expect([b?.stato, b?.minuti, b?.chiusoIl]).toEqual([
      prima.blocco?.stato,
      prima.blocco?.minuti,
      prima.blocco?.chiusoIl,
    ]);
    expect([u?.stato, u?.minuti, u?.progresso]).toEqual([
      prima.unita?.stato,
      prima.unita?.minuti,
      prima.unita?.progresso,
    ]);
    expect(await readStreak(db, oggi(10, 21))).toBe(0);
    expect((await get(db, 'blocchi', 'd1'))?.unitaId).toBe('u11');
  });

  it('non registrabile: nessun annulla e nessuna scrittura; dopo un’altra scrittura sul blocco l’annulla non tocca nulla', async () => {
    await studio('s1');
    expect(
      await registerOutcomeUndoable(db, 's1', { esito: 'continua', confidenza: null, nota: '' }, oggi(9, 30), FUSO),
    ).toBeNull();
    const annulla = await registerOutcomeUndoable(
      db,
      's1',
      { esito: 'completata', confidenza: 4, nota: '' },
      oggi(10, 20),
      FUSO,
    );
    const riscritto = await saveBlock(
      db,
      { ...(await get(db, 'blocchi', 's1'))!, notaEsito: 'dopo' },
      oggi(10, 22),
      FUSO,
    );
    await annulla?.(oggi(10, 23));
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'completato', notaEsito: riscritto.notaEsito });
  });
});

describe('Dettaglio dello studio — FUNZIONALITA §4 (S5 «Prossima unità proposta»)', () => {
  it('l’unità del puntatore con il suo modulo e le unità fatte del modulo; senza unità nessuna', async () => {
    await save(
      db,
      'unita',
      { ...unita('u12', 1, 2, '1.2', 'completata'), concettoCore: { titolo: 'C', testo: 'Il cuore' } },
      2,
    );
    await studio('s1', { unitaId: 'u12' });
    expect((await readDetail(db, 's1'))?.unita).toEqual({
      numero: '1.2',
      titolo: 'Unità 1.2',
      concettoCore: { titolo: 'C', testo: 'Il cuore' },
      modulo: { numero: 1, titolo: 'M', fatte: 1, totali: 2 },
    });
    await studio('s2', { unitaId: null });
    expect((await readDetail(db, 's2'))?.unita).toBeUndefined();
  });
});

describe('Sessione libera che conta — SCENARI C7', () => {
  it('libera di 25′ su 2.1 che conta: blocco retroattivo 25′ con l’esito e puntatore ricalcolato', async () => {
    await studio('d1', { inizio: domani(9), fine: domani(10), unitaId: 'u11' });
    await studio('d2', { inizio: local(2026, 9, 30, 9), fine: local(2026, 9, 30, 10), unitaId: 'u12' });
    await startSession(db, null, scelta({ unitaId: 'u21', corsoId: 'c1' }), oggi(9), FUSO);
    await endSession(db, oggi(9, 25), FUSO, esito('completata'));
    const retro = (await list(db, 'blocchi')).filter((b) => b.inizio === oggi(9));
    expect(retro).toMatchObject([
      { tipo: 'studio', stato: 'completato', fine: oggi(9, 25), unitaId: 'u21', corsoId: 'c1', minuti: 25 },
    ]);
    expect(await get(db, 'unita', 'u21')).toMatchObject({ stato: 'completata', minuti: 25 });
    expect((await get(db, 'blocchi', 'd2'))?.unitaId).toBe('u12');
  });
  it('che non conta: nessun blocco, l’unità non cambia, la sessione resta in `sessioni`', async () => {
    await startSession(db, null, scelta({ unitaId: 'u21', corsoId: 'c1' }), oggi(9), FUSO);
    await endSession(db, oggi(9, 25), FUSO, esito('completata', { contaNelPiano: false }));
    expect(await list(db, 'blocchi')).toEqual([]);
    expect(await get(db, 'unita', 'u21')).toMatchObject({ stato: 'non_iniziata', minuti: 0 });
    expect(await list(db, 'sessioni')).toMatchObject([{ chiusura: 'completata', esito: { contaNelPiano: false } }]);
  });
  it('sul blocco, che non conta: il blocco in corso torna programmato (§11)', async () => {
    await studio('s1');
    await startSession(db, 's1', scelta(), oggi(9), FUSO);
    await endSession(db, oggi(9, 40), FUSO, esito('continua', { contaNelPiano: false }));
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('programmato');
    expect(await statoUnita('u11')).toBe('non_iniziata');
  });
  it('la ripresa di un parziale scrive l’esito nuovo sullo stesso blocco (D-SESS-1)', async () => {
    await studio('s1', { stato: 'parziale', inizio: oggi(15), fine: oggi(16) });
    await startSession(db, 's1', scelta(), oggi(15, 10), FUSO);
    await endSession(db, oggi(15, 40), FUSO, esito('completata'));
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('completato');
    expect(await statoUnita('u11')).toBe('completata');
  });
  it('libera senza unità con «conta» attivato: blocco retroattivo senza unità, streak +1, nessuna unità toccata', async () => {
    await startSession(db, null, scelta(), oggi(9), FUSO);
    await endSession(db, oggi(9, 25), FUSO, esito('continua'));
    expect(await list(db, 'blocchi')).toMatchObject([{ stato: 'parziale', unitaId: null, corsoId: null }]);
    expect((await list(db, 'unita')).map((u) => u.minuti)).toEqual([0, 0, 0]);
    expect(await readStreak(db, oggi(10))).toBe(1);
  });
  it('blocco eliminato durante la sessione: con «conta» nasce un blocco retroattivo (D-ESITO-1)', async () => {
    await studio('s1');
    await startSession(db, 's1', scelta(), oggi(9), FUSO);
    await remove(db, 'blocchi', 's1', oggi(9, 10));
    await endSession(db, oggi(9, 40), FUSO, esito('continua'));
    expect(await list(db, 'blocchi')).toMatchObject([{ stato: 'parziale', inizio: oggi(9), fine: oggi(9, 40) }]);
    expect(await get(db, 'blocchi', 's1')).toBeUndefined();
  });
});

describe('Idempotenza — MECCANISMI §11, INV-15', () => {
  it('un esito ripetuto non scrive; il ciclo subito dopo un esito non cambia nulla', async () => {
    await studio('s1', { inizio: local(2026, 9, 27, 9), fine: local(2026, 9, 27, 10), stato: 'perso' });
    await studio('d1', { inizio: domani(9), fine: domani(10) });
    const dati = { esito: 'continua' as const, confidenza: 2, nota: '' };
    expect(await registerOutcome(db, 's1', dati, oggi(8), FUSO)).toBe(true);
    const dopo = await list(db, 'blocchi');
    expect(await registerOutcome(db, 's1', dati, oggi(8, 1), FUSO)).toBe(false);
    await runCycle(db, oggi(8, 1), FUSO);
    expect(await list(db, 'blocchi')).toEqual(dopo);
    expect(await get(db, 'unita', 'u11')).toMatchObject({ minuti: 60 });
  });
  it('una riga di `sessioni` scritta prima di T-018, senza esito, si legge', async () => {
    await startSession(db, null, scelta(), oggi(9), FUSO);
    await endSession(db, oggi(9, 25), FUSO, esito('continua', { contaNelPiano: false }));
    const [riga] = await list(db, 'sessioni');
    if (!riga) throw new Error('nessuna sessione');
    const { esito: _, ...vecchia } = riga;
    void _;
    await save(db, 'sessioni', vecchia, oggi(10));
    expect((await list(db, 'sessioni'))[0]?.esito ?? null).toBeNull();
  });
});

describe('Routine di studio senza corso — SCENARI C9', () => {
  it('con 1.2 scelta nel setup, Completata chiude il blocco e completa 1.2; il puntatore del corso si ricalcola', async () => {
    await studio('s1', { corsoId: null, unitaId: null, inizio: oggi(20), fine: oggi(21) });
    await studio('d1', { inizio: domani(9), fine: domani(10), unitaId: 'u12' });
    await startSession(db, 's1', scelta({ unitaId: 'u12', corsoId: 'c1' }), oggi(20), FUSO);
    await endSession(db, oggi(21), FUSO, esito('completata'));
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'completato', unitaId: 'u12', corsoId: 'c1' });
    expect(await statoUnita('u12')).toBe('completata');
    expect((await get(db, 'blocchi', 'd1'))?.unitaId).toBe('u11');
  });
  it('senza unità l’esito chiude solo il blocco, la streak aumenta, nessuna unità cambia', async () => {
    await studio('s1', { corsoId: null, unitaId: null, inizio: oggi(20), fine: oggi(21) });
    await startSession(db, 's1', scelta(), oggi(20), FUSO);
    await endSession(db, oggi(21), FUSO, esito('completata', { nota: 'ok' }));
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'completato', unitaId: null, notaEsito: 'ok' });
    expect((await list(db, 'unita')).map((u) => u.stato)).toEqual(['non_iniziata', 'non_iniziata', 'non_iniziata']);
    expect(await readStreak(db, oggi(21))).toBe(1);
  });
  it('«Registra esito» su un blocco senza unità non registra la confidenza (§11 «routine generiche»)', async () => {
    await studio('s1', { corsoId: null, unitaId: null });
    await registerOutcome(db, 's1', { esito: 'continua', confidenza: 4, nota: '' }, oggi(11), FUSO);
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'parziale', confidenza: null, minuti: 60 });
  });
});

function modulo(id: string, numero: number) {
  return {
    id,
    corsoId: 'c1',
    numero,
    nn: String(numero).padStart(2, '0'),
    titolo: 'M',
    tipo: '',
    prerequisiti: '',
    finestraIndicativa: '',
    trasversali: '',
    intro: '',
    obiettivi: [],
    domande: [],
    esercizi: [],
    criteri: [],
    noGo: '',
    riassunto: '',
    progetto: null,
    testDiFit: null,
    markdown: '',
  };
}
function unita(id: string, moduloNumero: number, ordine: number, numero: string, stato: StatoUnita = 'non_iniziata') {
  return {
    id,
    corsoId: 'c1',
    moduloId: `m${moduloNumero}`,
    moduloNumero,
    numero,
    ordine,
    titolo: `Unità ${numero}`,
    markdown: '',
    concettoCore: null,
    oreStimate: null,
    difficolta: null,
    stato,
    progresso: 0,
    minuti: 0,
    confidenza: null,
  };
}
