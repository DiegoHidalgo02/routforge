// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, list, save, saveBlock } from '../data/repository';
import type { DatiEsito } from '../domain/outcome';
import type { SceltaSessione, SessioneAttiva } from '../domain/session';
import { local, MINUTE } from '../domain/time';
import {
  addInterruption,
  beat,
  changeUnit,
  countInterval,
  pauseSession,
  resumeSession,
  timerState,
  type TipoChiusura,
} from '../domain/timer';
import type { Blocco, Esito, StatoBlocco, StatoUnita } from '../domain/types';
import { readStreak } from './outcome';
import type { Clock } from './ports/clock';
import { runCycle } from './scheduler';
import { configureSessionDevice } from './sessionDevice';
import {
  abandonSession,
  anticipateSession,
  CHIAVE_SESSIONE_ATTIVA,
  editActiveSession,
  endSession,
  followSessionInForeground,
  readActiveSession,
  readSessionView,
  releaseDoNotDisturb,
  setupInputs,
  startHeartbeat,
  startSession,
  type SessioneRegistrata,
} from './session';

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
const ESITO: DatiEsito = { esito: 'continua', confidenza: null, nota: '', contaNelPiano: true };
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
  it('l’esito registrato lo chiude e il ritardo resta (T-018)', async () => {
    await studio('s1', { inizio: oggi(9), fine: oggi(10) });
    await startSession(db, 's1', scelta({ durata: 50 }), oggi(10, 20), FUSO);
    await endSession(db, oggi(11, 10), FUSO, { ...ESITO, esito: 'completata' });
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'completato', minutiRitardo: 80, minuti: 50 });
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

describe('Note della sessione — FUNZIONALITA §11.2', () => {
  it('le note scritte durante la sessione restano nella sessione chiusa', async () => {
    await startSession(db, null, scelta(), oggi(9), FUSO);
    await editActiveSession(db, (x) => ({ ...x, note: '- una sola corsia' }), oggi(9, 10));
    await endSession(db, oggi(9, 30), FUSO, ESITO);
    expect((await list(db, 'sessioni')).map((x) => x.note)).toEqual(['- una sola corsia']);
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
  it('l’abbandono resta in `sessioni` come `abbandonata` (statistiche §20)', async () => {
    await startSession(db, null, scelta({ iperfocus: true }), oggi(9), FUSO);
    await abandonSession(db, oggi(9, 5), FUSO);
    expect(await list(db, 'sessioni')).toMatchObject([
      { chiusura: 'abbandonata', iperfocus: true, chiusaIl: oggi(9, 5) },
    ]);
  });
});

describe('Abbandono oltre soglia — SCENARI D7', () => {
  // Routine sul blocco 09:00–10:00 (unità 1.1) avviata alle 09:00; il blocco di studio delle 15:00 dello stesso corso
  // riceve l'unità dal puntatore (§11)
  const avvia = async () => {
    await save(db, 'unita', unita('u11', 1, 1, '1.1', 'non_iniziata'), 1);
    await save(db, 'unita', unita('u12', 1, 2, '1.2', 'non_iniziata'), 1);
    await studio('s1', { inizio: oggi(9), fine: oggi(10), unitaId: 'u11', corsoId: 'c2' });
    await studio('s2', { unitaId: null, corsoId: 'c2' });
    await startSession(db, 's1', scelta(), oggi(9), FUSO);
  };
  it('«Abbandona» alle 09:40 con 39 minuti di focus (65%): terminata prima con esito Continua, blocco parziale con 39 minuti, unità parziale, streak, puntatore', async () => {
    await avvia();
    await editActiveSession(db, (s) => pauseSession(s, oggi(9, 20)), oggi(9, 20));
    await editActiveSession(db, (s) => resumeSession(s, oggi(9, 21)), oggi(9, 21));
    const chiusa = await abandonSession(db, oggi(9, 40), FUSO);
    expect(chiusa).toMatchObject({
      chiusura: 'terminata_prima',
      esito: { esito: 'continua', confidenza: null, nota: '', contaNelPiano: true },
    });
    expect(await get(db, 'blocchi', 's1')).toMatchObject({
      stato: 'parziale',
      minuti: 39,
      confidenza: null,
      notaEsito: null,
    });
    expect((await get(db, 'unita', 'u11'))?.stato).toBe('parziale');
    // Puntatore ricalcolato (D-SESS-2 n. 2): la 1.1 resta la prima pendente e va al blocco delle 15:00
    expect((await get(db, 'blocchi', 's2'))?.unitaId).toBe('u11');
    expect(await readStreak(db, oggi(9, 40))).toBe(1);
    expect(await readActiveSession(db)).toBeNull();
    expect(await list(db, 'sessioni')).toMatchObject([{ chiusura: 'terminata_prima', esito: { esito: 'continua' } }]);
  });
  it('«Abbandona» alle 09:35 con 35 minuti di focus (58%): abbandono, blocco programmato e alle 10:30 perso (D7; audit P3-6)', async () => {
    await avvia();
    expect(await abandonSession(db, oggi(9, 35), FUSO)).toMatchObject({ chiusura: 'abbandonata', esito: null });
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('programmato');
    expect((await get(db, 'unita', 'u11'))?.stato).toBe('non_iniziata');
    expect(await readStreak(db, oggi(9, 35))).toBe(0);
    await runCycle(db, oggi(10, 30) - 1, FUSO);
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('programmato');
    await runCycle(db, oggi(10, 30), FUSO);
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('perso');
  });
});

describe('Persistenza e continuità — SCENARI D4', () => {
  it('la sessione e le sue pause sopravvivono alla chiusura: riaperta 12 minuti dopo ha 12 minuti di focus', async () => {
    await startSession(db, null, scelta(), oggi(9), FUSO);
    await editActiveSession(db, (s) => pauseSession(s, oggi(9, 2)), oggi(9, 2));
    await editActiveSession(db, (s) => resumeSession(s, oggi(9, 4)), oggi(9, 4));
    db.close();
    await db.open();
    const s = await readActiveSession(db);
    expect(s && timerState(s, oggi(9, 14))).toMatchObject({ focus: 12 * MINUTE, inPausa: false });
  });
  it('una sessione salvata prima del timer (T-016) o dei battiti (T-047) si legge con i campi vuoti e il battito all’avvio', async () => {
    const { pause, interruzioni, cambiUnita, salti, ultimoBattito, intervalliNonVerificati, ...vecchia } =
      await startSession(db, null, scelta(), oggi(9), FUSO);
    void [pause, interruzioni, cambiUnita, salti, ultimoBattito, intervalliNonVerificati];
    await save(db, 'preferenze', { id: 'sessioneAttiva', valore: vecchia }, oggi(9));
    expect(await readActiveSession(db)).toMatchObject({
      pause: [],
      interruzioni: [],
      cambiUnita: [],
      salti: [],
      ultimoBattito: oggi(9),
      intervalliNonVerificati: [],
    });
  });
  it('senza sessione attiva la modifica non scrive nulla', async () => {
    expect(await editActiveSession(db, (s) => pauseSession(s, oggi(9)), oggi(9))).toBeNull();
    expect(await list(db, 'preferenze')).toEqual([]);
  });
  it('il battito scrive `ultimoBattito` subito, a ogni minuto e al ritorno in primo piano; senza sessione non scrive (§10.4, D-TIMER-2)', async () => {
    const o = orologioFinto(oggi(9));
    const stop = startHeartbeat(db, o.clock);
    o.avanza(MINUTE);
    await Promise.resolve();
    expect(await list(db, 'preferenze')).toEqual([]);
    await startSession(db, null, scelta(), oggi(9, 1), FUSO);
    o.avanza(MINUTE);
    await vi.waitFor(async () => expect((await readActiveSession(db))?.ultimoBattito).toBe(oggi(9, 2)));
    // App chiusa per 45 minuti: al ritorno l'intervallo è non verificato
    o.salta(45 * MINUTE);
    o.primoPiano();
    await vi.waitFor(async () =>
      expect(await readActiveSession(db)).toMatchObject({
        ultimoBattito: oggi(9, 47),
        intervalliNonVerificati: [{ da: oggi(9, 2), a: oggi(9, 47), contato: false }],
      }),
    );
    stop();
    o.avanza(MINUTE);
    await Promise.resolve();
    expect((await readActiveSession(db))?.ultimoBattito).toBe(oggi(9, 47));
  });
  it('in secondo piano (scheda nascosta) i battiti si fermano: 40 minuti nascosta diventano un intervallo non verificato al ritorno (D-TIMER-2 n. 1)', async () => {
    await startSession(db, null, scelta(), oggi(9), FUSO);
    const o = orologioFinto(oggi(9));
    const stop = startHeartbeat(db, o.clock);
    o.avanza(MINUTE);
    await vi.waitFor(async () => expect((await readActiveSession(db))?.ultimoBattito).toBe(oggi(9, 1)));
    o.nascondi();
    for (let i = 0; i < 40; i++) o.avanza(MINUTE);
    await Promise.resolve();
    expect((await readActiveSession(db))?.ultimoBattito).toBe(oggi(9, 1));
    o.primoPiano();
    await vi.waitFor(async () =>
      expect((await readActiveSession(db))?.intervalliNonVerificati).toEqual([
        { da: oggi(9, 1), a: oggi(9, 41), contato: false },
      ]),
    );
    stop();
  });
  it('avviata a pagina nascosta non scrive; nascosta 10 o 30 minuti esatti il tempo resta focus (§10.4), 31 no', async () => {
    await startSession(db, null, scelta(), oggi(9), FUSO);
    const o = orologioFinto(oggi(9));
    o.nascondi();
    const stop = startHeartbeat(db, o.clock);
    o.avanza(10 * MINUTE);
    await Promise.resolve();
    expect((await readActiveSession(db))?.ultimoBattito).toBe(oggi(9));
    o.primoPiano();
    await vi.waitFor(async () => expect((await readActiveSession(db))?.ultimoBattito).toBe(oggi(9, 10)));
    let s = await readActiveSession(db);
    expect(s?.intervalliNonVerificati).toEqual([]);
    expect(s && timerState(s, oggi(9, 10)).focus).toBe(10 * MINUTE);
    o.nascondi();
    o.salta(30 * MINUTE);
    o.primoPiano();
    await vi.waitFor(async () => expect((await readActiveSession(db))?.ultimoBattito).toBe(oggi(9, 40)));
    expect((await readActiveSession(db))?.intervalliNonVerificati).toEqual([]);
    o.nascondi();
    o.salta(31 * MINUTE);
    o.primoPiano();
    await vi.waitFor(async () => expect((await readActiveSession(db))?.ultimoBattito).toBe(oggi(10, 11)));
    s = await readActiveSession(db);
    expect(s?.intervalliNonVerificati).toEqual([{ da: oggi(9, 40), a: oggi(10, 11), contato: false }]);
    expect(s && timerState(s, oggi(10, 11)).focus).toBe(40 * MINUTE);
    stop();
  });
  it('riaperta 45 minuti dopo l’ultimo battito: la routine è ancora aperta, il focus è fermo, la fine resta quella del blocco', async () => {
    await studio('s1', { inizio: oggi(9), fine: oggi(10) });
    await startSession(db, 's1', scelta(), oggi(9), FUSO);
    db.close();
    await db.open();
    const o = orologioFinto(oggi(9, 45));
    const stop = startHeartbeat(db, o.clock);
    await vi.waitFor(async () => expect((await readActiveSession(db))?.ultimoBattito).toBe(oggi(9, 45)));
    const s = await readActiveSession(db);
    expect(s?.intervalliNonVerificati).toEqual([{ da: oggi(9), a: oggi(9, 45), contato: false }]);
    expect(s && timerState(s, oggi(9, 45))).toMatchObject({ focus: 0, restante: 15 * MINUTE, fine: oggi(10) });
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('in_corso');
    stop();
  });
});

/**
 * Orologio finto della porta `Clock` (come in `scheduler.test.ts`): `avanza` fa scattare i battiti il cui multiplo cade
 * nell'intervallo, `salta` sposta l'ora senza battiti (app chiusa), `nascondi` la manda in secondo piano (scheda
 * nascosta: i battiti scattano ma l'app non è visibile), `primoPiano` la riporta visibile e simula il ritorno.
 */
function orologioFinto(inizio: number) {
  let t = inizio;
  let visibile = true;
  const battiti = new Set<{ ms: number; fn: () => void }>();
  const inPrimoPiano = new Set<() => void>();
  const clock: Clock = {
    now: () => t,
    fuso: () => FUSO,
    every(ms, fn) {
      const b = { ms, fn };
      battiti.add(b);
      return () => void battiti.delete(b);
    },
    onForeground(fn) {
      inPrimoPiano.add(fn);
      return () => void inPrimoPiano.delete(fn);
    },
    inForeground: () => visibile,
  };
  return {
    clock,
    avanza(ms: number) {
      const prima = t;
      t += ms;
      for (const b of battiti) if (Math.floor(t / b.ms) > Math.floor(prima / b.ms)) b.fn();
    },
    salta(ms: number) {
      t += ms;
    },
    nascondi() {
      visibile = false;
    },
    primoPiano() {
      visibile = true;
      for (const fn of inPrimoPiano) fn();
    },
  };
}

describe('Casistica delle chiusure — docs/SESSIONI.md (D-SESS-2 confermata il 02/10/2026; MECC §10.5, §11, §12, §20)', () => {
  // Routine di studio 09:00–10:00 sull'unità 1.1 (`stato` perso per il recupero); `azioni` fra l'avvio e la chiusura.
  // I minuti del blocco sono il focus arrotondato: tempo extra compreso, pause e intervalli non contati esclusi
  interface Caso {
    caso: string;
    stato?: StatoBlocco;
    /** Durata scelta nel setup (conta solo nel recupero); `null` = cronometro. */
    durata?: number | null;
    avvio: number;
    azioni?: () => Promise<unknown>;
    chiudi: (now: number) => Promise<SessioneRegistrata | null>;
    alle: number;
    sessione: { chiusura: TipoChiusura; esito: Esito | null };
    blocco: { stato: StatoBlocco; minuti?: number; minutiRitardo: number };
    unita: StatoUnita;
    streak: number;
  }
  const conEsito =
    (esito: Esito, contaNelPiano = true) =>
    (now: number) =>
      endSession(db, now, FUSO, { ...ESITO, esito, contaNelPiano });
  const abbandona = (now: number) => abandonSession(db, now, FUSO);
  const modifica =
    (...passi: [number, (s: SessioneAttiva) => SessioneAttiva][]) =>
    async () => {
      for (const [now, f] of passi) await editActiveSession(db, f, now);
    };
  const pausa = (da: number, a: number) => modifica([da, (s) => pauseSession(s, da)], [a, (s) => resumeSession(s, a)]);
  const battiti = (...istanti: number[]) =>
    istanti.map((t): [number, (s: SessioneAttiva) => SessioneAttiva] => [t, (s) => beat(s, t)]);
  const CASI: Caso[] = [
    // In orario (ritardo 0): la durata pianificata della sessione è l'ora intera
    {
      caso: '1. in orario, timer a fine, esito Completata: blocco completato con 60 minuti, unità completata, streak',
      avvio: oggi(9),
      chiudi: conEsito('completata'),
      alle: oggi(10),
      sessione: { chiusura: 'completata', esito: 'completata' },
      blocco: { stato: 'completato', minuti: 60, minutiRitardo: 0 },
      unita: 'completata',
      streak: 1,
    },
    {
      caso: '2. in orario, «Registra esito» alle 09:40 con Continua: terminata prima, parziale con 40 minuti',
      avvio: oggi(9),
      chiudi: conEsito('continua'),
      alle: oggi(9, 40),
      sessione: { chiusura: 'terminata_prima', esito: 'continua' },
      blocco: { stato: 'parziale', minuti: 40, minutiRitardo: 0 },
      unita: 'parziale',
      streak: 1,
    },
    {
      caso: '3. in orario, «Abbandona» alle 09:40 (66%): chiusa come Continua, parziale con 40 minuti (D7)',
      avvio: oggi(9),
      chiudi: abbandona,
      alle: oggi(9, 40),
      sessione: { chiusura: 'terminata_prima', esito: 'continua' },
      blocco: { stato: 'parziale', minuti: 40, minutiRitardo: 0 },
      unita: 'parziale',
      streak: 1,
    },
    {
      caso: '4. in orario, «Abbandona» alle 09:35 (58%): abbandonata, blocco programmato senza minuti, niente streak (D7)',
      avvio: oggi(9),
      chiudi: abbandona,
      alle: oggi(9, 35),
      sessione: { chiusura: 'abbandonata', esito: null },
      blocco: { stato: 'programmato', minutiRitardo: 0 },
      unita: 'non_iniziata',
      streak: 0,
    },
    {
      caso: '5. in orario, pausa 09:20–09:35 e «Abbandona» alle 09:50: 35 minuti di focus (58%), abbandonata',
      avvio: oggi(9),
      azioni: pausa(oggi(9, 20), oggi(9, 35)),
      chiudi: abbandona,
      alle: oggi(9, 50),
      sessione: { chiusura: 'abbandonata', esito: null },
      blocco: { stato: 'programmato', minutiRitardo: 0 },
      unita: 'non_iniziata',
      streak: 0,
    },
    {
      caso: '6. in orario, esito Salta alle 09:40: terminata prima, blocco saltato con i minuti fatti, unità saltata, niente streak',
      avvio: oggi(9),
      chiudi: conEsito('salta'),
      alle: oggi(9, 40),
      sessione: { chiusura: 'terminata_prima', esito: 'salta' },
      blocco: { stato: 'saltato', minuti: 40, minutiRitardo: 0 },
      unita: 'saltata',
      streak: 0,
    },
    {
      caso: '7. in orario, esito Indietro a fine: blocco indietro, la 1.1 (prima del percorso) da rivedere, niente streak',
      avvio: oggi(9),
      chiudi: conEsito('indietro'),
      alle: oggi(10),
      sessione: { chiusura: 'completata', esito: 'indietro' },
      blocco: { stato: 'indietro', minuti: 60, minutiRitardo: 0 },
      unita: 'da_rivedere',
      streak: 0,
    },
    {
      caso: '8. in orario, Continua con «conta nel piano» spento: la sessione resta in `sessioni`, il blocco torna programmato, unità e streak intatte',
      avvio: oggi(9),
      chiudi: conEsito('continua', false),
      alle: oggi(9, 40),
      sessione: { chiusura: 'terminata_prima', esito: 'continua' },
      blocco: { stato: 'programmato', minutiRitardo: 0 },
      unita: 'non_iniziata',
      streak: 0,
    },
    // In ritardo (avvio 09:30, ritardo 30): la sessione dura i 30 minuti residui e la soglia del 65% vale su quelli
    {
      caso: '9. in ritardo di 30, timer a fine con Completata: completato con 30 minuti, ritardo 30 per le statistiche',
      avvio: oggi(9, 30),
      chiudi: conEsito('completata'),
      alle: oggi(10),
      sessione: { chiusura: 'completata', esito: 'completata' },
      blocco: { stato: 'completato', minuti: 30, minutiRitardo: 30 },
      unita: 'completata',
      streak: 1,
    },
    {
      caso: '10. in ritardo di 30, «Abbandona» alle 09:50 (20 su 30 = 66%): chiusa come Continua, parziale con 20 minuti, ritardo 30',
      avvio: oggi(9, 30),
      chiudi: abbandona,
      alle: oggi(9, 50),
      sessione: { chiusura: 'terminata_prima', esito: 'continua' },
      blocco: { stato: 'parziale', minuti: 20, minutiRitardo: 30 },
      unita: 'parziale',
      streak: 1,
    },
    {
      caso: '11. in ritardo di 30, «Abbandona» alle 09:45 (50%): abbandonata, programmato, il ritardo resta',
      avvio: oggi(9, 30),
      chiudi: abbandona,
      alle: oggi(9, 45),
      sessione: { chiusura: 'abbandonata', esito: null },
      blocco: { stato: 'programmato', minutiRitardo: 30 },
      unita: 'non_iniziata',
      streak: 0,
    },
    {
      caso: '12. in ritardo di 30, oltre la fine fino alle 10:20 e Continua: completata (traguardo raggiunto), 50 minuti con il tempo extra',
      avvio: oggi(9, 30),
      chiudi: conEsito('continua'),
      alle: oggi(10, 20),
      sessione: { chiusura: 'completata', esito: 'continua' },
      blocco: { stato: 'parziale', minuti: 50, minutiRitardo: 30 },
      unita: 'parziale',
      streak: 1,
    },
    // Recupero di un perso (avvio 10:20, ritardo 80): la durata pianificata è quella scelta
    {
      caso: '13. recupero da 25 minuti, timer a fine con Completata: completato con 25 minuti, ritardo 80',
      stato: 'perso',
      durata: 25,
      avvio: oggi(10, 20),
      chiudi: conEsito('completata'),
      alle: oggi(10, 45),
      sessione: { chiusura: 'completata', esito: 'completata' },
      blocco: { stato: 'completato', minuti: 25, minutiRitardo: 80 },
      unita: 'completata',
      streak: 1,
    },
    {
      caso: '14. recupero da 25 minuti, «Abbandona» dopo 17 (68%): chiusa come Continua, parziale con 17 minuti',
      stato: 'perso',
      durata: 25,
      avvio: oggi(10, 20),
      chiudi: abbandona,
      alle: oggi(10, 37),
      sessione: { chiusura: 'terminata_prima', esito: 'continua' },
      blocco: { stato: 'parziale', minuti: 17, minutiRitardo: 80 },
      unita: 'parziale',
      streak: 1,
    },
    {
      caso: '15. recupero da 25 minuti, «Abbandona» dopo 10 (40%): abbandonata, blocco programmato (il ciclo lo rimarca perso, C8)',
      stato: 'perso',
      durata: 25,
      avvio: oggi(10, 20),
      chiudi: abbandona,
      alle: oggi(10, 30),
      sessione: { chiusura: 'abbandonata', esito: null },
      blocco: { stato: 'programmato', minutiRitardo: 80 },
      unita: 'non_iniziata',
      streak: 0,
    },
    {
      caso: '16. recupero col cronometro, «Abbandona» dopo 40 minuti: nessuna soglia, abbandonata',
      stato: 'perso',
      durata: null,
      avvio: oggi(10, 20),
      chiudi: abbandona,
      alle: oggi(11),
      sessione: { chiusura: 'abbandonata', esito: null },
      blocco: { stato: 'programmato', minutiRitardo: 80 },
      unita: 'non_iniziata',
      streak: 0,
    },
    {
      caso: '17. recupero col cronometro, Continua dopo 40 minuti: completata (il cronometro non ha traguardo), parziale con 40',
      stato: 'perso',
      durata: null,
      avvio: oggi(10, 20),
      chiudi: conEsito('continua'),
      alle: oggi(11),
      sessione: { chiusura: 'completata', esito: 'continua' },
      blocco: { stato: 'parziale', minuti: 40, minutiRitardo: 80 },
      unita: 'parziale',
      streak: 1,
    },
    // Continuità (D4, D-TIMER-2): l'intervallo non verificato non conta finché non lo si attribuisce
    {
      caso: '18. in orario, battito alle 09:10 e riapertura alle 09:50 (40 minuti non verificati); «Abbandona» alle 09:55 con 15 di focus (25%): abbandonata',
      avvio: oggi(9),
      azioni: modifica(...battiti(oggi(9, 10), oggi(9, 50))),
      chiudi: abbandona,
      alle: oggi(9, 55),
      sessione: { chiusura: 'abbandonata', esito: null },
      blocco: { stato: 'programmato', minutiRitardo: 0 },
      unita: 'non_iniziata',
      streak: 0,
    },
    {
      caso: '19. come il 18 ma con «Conta come studio»: 55 minuti (91%), chiusa come Continua con 55 minuti',
      avvio: oggi(9),
      azioni: modifica(...battiti(oggi(9, 10), oggi(9, 50)), [oggi(9, 51), (s) => countInterval(s, oggi(9, 10))]),
      chiudi: abbandona,
      alle: oggi(9, 55),
      sessione: { chiusura: 'terminata_prima', esito: 'continua' },
      blocco: { stato: 'parziale', minuti: 55, minutiRitardo: 0 },
      unita: 'parziale',
      streak: 1,
    },
  ];
  it.each(CASI)('$caso', async (c) => {
    await save(db, 'unita', unita('u11', 1, 1, '1.1', 'non_iniziata'), 1);
    await studio('s1', {
      inizio: oggi(9),
      fine: oggi(10),
      unitaId: 'u11',
      corsoId: 'c2',
      stato: c.stato ?? 'programmato',
    });
    await startSession(db, 's1', scelta({ durata: c.durata === undefined ? 50 : c.durata }), c.avvio, FUSO);
    await c.azioni?.();
    expect(await c.chiudi(c.alle)).toMatchObject({
      chiusura: c.sessione.chiusura,
      esito: c.sessione.esito === null ? null : { esito: c.sessione.esito },
    });
    expect(await get(db, 'blocchi', 's1')).toMatchObject(c.blocco);
    expect((await get(db, 'unita', 'u11'))?.stato).toBe(c.unita);
    expect(await readStreak(db, c.alle)).toBe(c.streak);
    expect(await readActiveSession(db)).toBeNull();
    expect(await list(db, 'sessioni')).toHaveLength(1);
  });
  it('20. libera sull’unità 1.1 con Continua dopo 50 minuti: blocco retroattivo parziale 09:00–09:50 con 50 minuti, unità parziale, streak', async () => {
    await save(db, 'unita', unita('u11', 1, 1, '1.1', 'non_iniziata'), 1);
    await startSession(db, null, scelta({ unitaId: 'u11', corsoId: 'c2' }), oggi(9), FUSO);
    expect(await endSession(db, oggi(9, 50), FUSO, ESITO)).toMatchObject({
      chiusura: 'completata',
      esito: { esito: 'continua' },
    });
    expect(await list(db, 'blocchi')).toMatchObject([
      { tipo: 'studio', stato: 'parziale', inizio: oggi(9), fine: oggi(9, 50), minuti: 50, unitaId: 'u11' },
    ]);
    expect((await get(db, 'unita', 'u11'))?.stato).toBe('parziale');
    expect(await readStreak(db, oggi(9, 50))).toBe(1);
  });
  it('21. libera, «Abbandona» dopo 50 minuti: nessuna soglia senza blocco, abbandonata, nessun blocco scritto', async () => {
    await startSession(db, null, scelta({ unitaId: 'u11', corsoId: 'c2' }), oggi(9), FUSO);
    expect(await abandonSession(db, oggi(9, 50), FUSO)).toMatchObject({ chiusura: 'abbandonata', esito: null });
    expect(await list(db, 'blocchi')).toEqual([]);
    expect(await list(db, 'sessioni')).toMatchObject([{ chiusura: 'abbandonata', bloccoId: null }]);
  });
});

describe('Pomodoro multi-materia — SCENARI D3', () => {
  it('cambiata l’unità, timer e banner mostrano la nuova; l’esito resta sulla pianificata', async () => {
    await save(db, 'unita', unita('u11', 1, 1, '1.1', 'non_iniziata'), 1);
    await save(db, 'unita', unita('u12', 1, 2, '1.2', 'non_iniziata'), 1);
    await studio('s1', { inizio: oggi(9), fine: oggi(10), unitaId: 'u11', corsoId: 'c2' });
    await startSession(db, 's1', scelta({ modalita: 'p25' }), oggi(9), FUSO);
    await editActiveSession(db, (s) => changeUnit(s, oggi(9, 30), 'u12'), oggi(9, 30));
    const vista = await readSessionView(db);
    expect(vista).toMatchObject({ unita: { numero: '1.2' }, orario: '09:00', sessione: { unitaId: 'u11' } });
    const chiusa = await endSession(db, oggi(10), FUSO, ESITO);
    expect(chiusa?.riepilogo.perUnita).toEqual({ u11: 25 * MINUTE, u12: 25 * MINUTE });
  });
});

describe('Iperfocus — SCENARI D5', () => {
  it('«Esci comunque» salva l’interruzione «iperfocus», che arriva nel riepilogo come uscita d’emergenza', async () => {
    await startSession(db, null, scelta({ iperfocus: true }), oggi(9), FUSO);
    await editActiveSession(db, (s) => addInterruption(s, oggi(9, 20), true), oggi(9, 20));
    const chiusa = await endSession(db, oggi(9, 54), FUSO, ESITO);
    expect(chiusa?.riepilogo).toMatchObject({ usciteEmergenza: 1, extra: 4 * MINUTE });
    expect(await list(db, 'sessioni')).toMatchObject([{ chiusura: 'completata', riepilogo: { usciteEmergenza: 1 } }]);
  });
});

describe('Chiusura — MECCANISMI §10.5', () => {
  it('la chiusura salva la sessione con l’esito, scrive il blocco e toglie la sessione attiva, insieme', async () => {
    await studio('s1', { inizio: oggi(9), fine: oggi(10) });
    await startSession(db, 's1', scelta(), oggi(9, 10), FUSO);
    const chiusa = await endSession(db, oggi(9, 40), FUSO, ESITO);
    expect(chiusa).toMatchObject({ chiusura: 'terminata_prima', bloccoId: 's1', riepilogo: { focus: 30 * MINUTE } });
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'parziale', minutiRitardo: 10, minuti: 30 });
    expect(await readActiveSession(db)).toBeNull();
    expect(await endSession(db, oggi(9, 41), FUSO, ESITO)).toBeNull();
    expect(await list(db, 'sessioni')).toMatchObject([{ esito: ESITO }]);
  });
  it('con l’esito il ciclo non marca più persa una routine chiusa dopo 30 minuti dalla sua fine', async () => {
    await studio('s1', { inizio: oggi(9), fine: oggi(10) });
    await startSession(db, 's1', scelta(), oggi(9), FUSO);
    await endSession(db, oggi(10, 40), FUSO, ESITO);
    await runCycle(db, oggi(10, 41), FUSO);
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('parziale');
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

describe('Servizio in primo piano della sessione — MECCANISMI §10.4, D-TIMER-2 (T-021)', () => {
  it('parte con la sessione, col suo avvio, e si ferma quando si chiude; un adapter che lancia non ferma nulla', async () => {
    const avvia = vi.fn();
    const ferma = vi.fn();
    const smetti = followSessionInForeground(db, { avvia, ferma });
    await startSession(db, null, scelta(), oggi(9), FUSO);
    await vi.waitFor(() => expect(avvia).toHaveBeenCalledWith({ titolo: '', avvio: oggi(9) }));
    await abandonSession(db, oggi(9, 5), FUSO);
    await vi.waitFor(() => expect(ferma).toHaveBeenCalledTimes(1));
    smetti();
    const rotto = followSessionInForeground(db, {
      avvia: () => {
        throw new Error('nativo');
      },
      ferma: () => undefined,
    });
    await startSession(db, null, scelta(), oggi(10), FUSO);
    expect(await readActiveSession(db)).not.toBeNull();
    rotto();
  });
});

describe('Non Disturbare dopo un arresto — MECCANISMI §10.4 (audit P1-5)', () => {
  afterEach(() =>
    configureSessionDevice({
      schermo: { keep: () => () => undefined },
      nonDisturbare: { enable: () => Promise.resolve(false), disable: () => undefined },
    }),
  );
  it('all’avvio senza una sessione con l’uscita bloccata si spegne; con l’uscita ancora bloccata resta', async () => {
    const disable = vi.fn();
    configureSessionDevice({
      schermo: { keep: () => () => undefined },
      nonDisturbare: { enable: () => Promise.resolve(true), disable },
    });
    await releaseDoNotDisturb(db, oggi(8));
    expect(disable).toHaveBeenCalledTimes(1);
    // Iperfocus dalle 9:00 per 50': alle 9:10 l'uscita è bloccata, alle 10:00 non più (l'app era morta a metà)
    await startSession(db, null, scelta({ iperfocus: true }), oggi(9), FUSO);
    await releaseDoNotDisturb(db, oggi(9, 10));
    expect(disable).toHaveBeenCalledTimes(1);
    await releaseDoNotDisturb(db, oggi(10));
    expect(disable).toHaveBeenCalledTimes(2);
  });
});

describe('Unità del blocco assente qui — MECCANISMI §10.1, §25 (audit P2-3)', () => {
  it('la scelta del setup vale per la sessione; il blocco tiene la sua unità, che sull’altro dispositivo esiste', async () => {
    await save(db, 'unita', { id: 'u-qui', corsoId: 'c-qui', moduloId: 'm1', stato: 'non_iniziata' } as never, oggi(7));
    // Il blocco è arrivato con l'unità del corso importato sull'altro dispositivo, che qui ha altri id
    await studio('s1', { corsoId: 'c-altrove', unitaId: 'u-altrove' });
    const s = await startSession(db, 's1', scelta({ unitaId: 'u-qui', corsoId: 'c-qui' }), oggi(15, 5), FUSO);
    expect(s).toMatchObject({ contesto: 'routine', bloccoId: 's1', unitaId: 'u-qui', corsoId: 'c-qui' });
    expect(await get(db, 'blocchi', 's1')).toMatchObject({ stato: 'in_corso', unitaId: 'u-altrove' });
  });
});

describe('Chiusura — atomicità, CONTESTO §3 (audit P2-12)', () => {
  it('se l’ultimo passo fallisce non resta nulla a metà: nessuna sessione registrata, sessione attiva e blocco in corso restano', async () => {
    await studio('s1', { inizio: oggi(9), fine: oggi(10) });
    await startSession(db, 's1', scelta(), oggi(9, 10), FUSO);
    // L'ultimo passo della chiusura toglie la sessione attiva: la sua tombstone in `preferenze` non si scrive
    const preferenze = db.table('preferenze');
    const put = preferenze.put.bind(preferenze);
    vi.spyOn(preferenze, 'put').mockImplementation(((r: { id: string; deletedAt: number | null }) =>
      r.id === CHIAVE_SESSIONE_ATTIVA && r.deletedAt !== null
        ? Promise.reject(new Error('spazio esaurito'))
        : put(r as never)) as never);
    await expect(endSession(db, oggi(9, 40), FUSO, ESITO)).rejects.toThrow('spazio esaurito');
    expect(await list(db, 'sessioni')).toEqual([]);
    expect(await readActiveSession(db)).not.toBeNull();
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('in_corso');
  });
});

describe('Streak della chiusura — MECCANISMI §12 (audit P3-17)', () => {
  it('la chiusura restituisce la streak letta nella sua transazione: +1 solo se questa chiusura l’ha fatta crescere', async () => {
    await studio('s1', { inizio: oggi(9), fine: oggi(10) });
    await startSession(db, 's1', scelta(), oggi(9, 10), FUSO);
    expect(await endSession(db, oggi(9, 40), FUSO, ESITO)).toMatchObject({ streak: { giorni: 1, piu: true } });
    await startSession(db, null, scelta(), oggi(11), FUSO);
    expect(await endSession(db, oggi(11, 30), FUSO, ESITO)).toMatchObject({ streak: { giorni: 1, piu: false } });
  });
});
