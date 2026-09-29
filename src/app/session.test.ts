// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, save, saveBlock } from '../data/repository';
import type { SceltaSessione } from '../domain/session';
import { local } from '../domain/time';
import type { Blocco, StatoUnita } from '../domain/types';
import { runCycle } from './scheduler';
import { abandonSession, anticipateSession, readActiveSession, setupInputs, startSession } from './session';

const FUSO = 'Europe/Rome';
// Lunedì 28 settembre 2026 (oggi nei test).
const oggi = (h: number, m = 0) => local(2026, 9, 28, h, m);

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-sessione-${++n}`);
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
      inizio: oggi(15),
      fine: oggi(16),
      corsoId: 'c1',
      unitaId: 'u07',
      titolo: 'Studio',
      ...over,
    },
    oggi(7),
    FUSO,
  );
const scelta = (over: Partial<SceltaSessione> = {}): SceltaSessione => ({
  unitaId: null,
  corsoId: null,
  durata: 50,
  modalita: 'continua',
  iperfocus: false,
  ...over,
});

describe('Anticipo — SCENARI C4', () => {
  it('«Inizia» alle 14:40 apre una sessione libera e l’occorrenza resta com’è', async () => {
    await studio('s1');
    const s = await startSession(db, 's1', scelta({ unitaId: 'u07', corsoId: 'c1' }), oggi(14, 40), FUSO);
    expect(s).toMatchObject({ contesto: 'libera', bloccoId: null, unitaId: 'u07' });
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'programmato', inizio: oggi(15), fine: oggi(16) });
  });
  it('«Anticipa» sposta a 14:40–15:40 con 20 minuti di anticipo; il setup la propone come routine', async () => {
    await studio('s1');
    expect(await anticipateSession(db, 's1', oggi(14, 40), FUSO)).toBe(true);
    expect(await get(db, 'blocchi', 's1')).toMatchObject({
      inizio: oggi(14, 40),
      fine: oggi(15, 40),
      orarioInizio: '14:40',
      orarioFine: '15:40',
      minutiAnticipo: 20,
    });
    const s = await startSession(db, 's1', scelta(), oggi(14, 41), FUSO);
    expect(s).toMatchObject({ contesto: 'routine', bloccoId: 's1', fine: oggi(15, 40) });
  });
  it('«Anticipa» fuori dall’anticipo non scrive nulla', async () => {
    await studio('s1');
    expect(await anticipateSession(db, 's1', oggi(14, 56), FUSO)).toBe(false);
    expect((await get(db, 'blocchi', 's1'))?.inizio).toBe(oggi(15));
  });
});

describe('Recupero tardivo e ritardo — SCENARI C5', () => {
  it('09:00–10:00 avviata alle 10:20 con 50′: blocco in corso con ritardo 80′, sessione attiva sul blocco', async () => {
    await studio('s1', { inizio: oggi(9), fine: oggi(10) });
    const s = await startSession(db, 's1', scelta({ durata: 50 }), oggi(10, 20), FUSO);
    expect(s).toMatchObject({ contesto: 'recupero', bloccoId: 's1', durata: 50, fine: oggi(11, 10) });
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'in_corso', minutiRitardo: 80 });
    expect(await readActiveSession(db)).toEqual(s);
  });
  it('il ciclo non tratta da orfano il blocco della sessione attiva (D-SCHED-1)', async () => {
    await studio('s1', { inizio: oggi(9), fine: oggi(10) });
    await startSession(db, 's1', scelta({ durata: 50 }), oggi(10, 20), FUSO);
    await runCycle(db, oggi(11, 30), FUSO);
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('in_corso');
  });
});

describe('Routine di studio senza corso, setup — SCENARI C9', () => {
  it('le occorrenze senza unità: nel setup si sceglie l’unità 1.2, oppure niente', async () => {
    await studio('s1', { corsoId: null, unitaId: null, inizio: oggi(20), fine: oggi(21) });
    const s = await startSession(db, 's1', scelta({ unitaId: 'u12', corsoId: 'c2' }), oggi(20, 5), FUSO);
    expect(s).toMatchObject({ bloccoId: 's1', unitaId: 'u12', corsoId: 'c2', contesto: 'routine' });
    await abandonSession(db, oggi(20, 6), FUSO);
    const vuota = await startSession(db, 's1', scelta(), oggi(20, 7), FUSO);
    expect(vuota).toMatchObject({ unitaId: null, corsoId: null });
  });
  it('gli ingressi del setup elencano i corsi con le unità in ordine e l’unità corrente proposta', async () => {
    await save(db, 'corsi', { id: 'c2', titolo: 'Corso', sottotitolo: '', importatoIl: 1, esempio: false }, 1);
    await save(db, 'moduli', modulo('m1', 1), 1);
    await save(db, 'unita', unita('u12', 1, 2, '1.2', 'non_iniziata'), 1);
    await save(db, 'unita', unita('u11', 1, 1, '1.1', 'completata'), 1);
    await studio('s1', { corsoId: null, unitaId: null });
    const ingressi = await setupInputs(db, 's1');
    expect(ingressi.blocco?.id).toBe('s1');
    expect(ingressi.corsi).toEqual([
      {
        id: 'c2',
        titolo: 'Corso',
        proposta: 'u12',
        unita: [
          { id: 'u11', moduloNumero: 1, numero: '1.1', titolo: 'Unità u11', stato: 'completata' },
          { id: 'u12', moduloNumero: 1, numero: '1.2', titolo: 'Unità u12', stato: 'non_iniziata' },
        ],
      },
    ]);
  });
});

describe('Una sola sessione — SCENARI D6', () => {
  it('con una sessione attiva, un avvio da un altro blocco restituisce quella e non tocca l’altro', async () => {
    await studio('s1', { inizio: oggi(9), fine: oggi(10) });
    await studio('s2', { inizio: oggi(10), fine: oggi(11) });
    const prima = await startSession(db, 's1', scelta(), oggi(10, 20), FUSO);
    const seconda = await startSession(db, 's2', scelta(), oggi(10, 25), FUSO);
    expect(seconda).toEqual(prima);
    expect((await get(db, 'blocchi', 's2'))?.stato).toBe('programmato');
    expect((await setupInputs(db, 's2')).attiva).toEqual(prima);
  });
});

describe('Abbandono — MECCANISMI §8, §10.5', () => {
  it('riporta subito il blocco a programmato e toglie la sessione attiva, insieme', async () => {
    await studio('s1', { inizio: oggi(9), fine: oggi(10) });
    await startSession(db, 's1', scelta(), oggi(10, 20), FUSO);
    await abandonSession(db, oggi(10, 30), FUSO);
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'programmato', minutiRitardo: 80 });
    expect(await readActiveSession(db)).toBeNull();
  });
  it('la ripresa di un parziale abbandonata lo lascia parziale, con il suo esito', async () => {
    await studio('s1', { stato: 'parziale' });
    expect(await startSession(db, 's1', scelta(), oggi(15, 10), FUSO)).toMatchObject({ bloccoId: 's1' });
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('parziale');
    await abandonSession(db, oggi(15, 20), FUSO);
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('parziale');
  });
  it('«Anticipa» con una sessione attiva su un altro blocco non scrive (D6)', async () => {
    await studio('s1', { inizio: oggi(9), fine: oggi(10) });
    await studio('s2');
    await startSession(db, 's1', scelta(), oggi(10, 20), FUSO);
    expect(await anticipateSession(db, 's2', oggi(14, 40), FUSO)).toBe(false);
    expect((await get(db, 'blocchi', 's2'))?.inizio).toBe(oggi(15));
  });
});

function modulo(id: string, numero: number) {
  return {
    id,
    corsoId: 'c2',
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
function unita(id: string, moduloNumero: number, ordine: number, numero: string, stato: StatoUnita) {
  return {
    id,
    corsoId: 'c2',
    moduloId: 'm1',
    moduloNumero,
    numero,
    ordine,
    titolo: `Unità ${id}`,
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
