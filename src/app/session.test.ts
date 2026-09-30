// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, list, save, saveBlock } from '../data/repository';
import type { DatiEsito } from '../domain/outcome';
import type { SceltaSessione } from '../domain/session';
import { local, MINUTE } from '../domain/time';
import { addInterruption, changeUnit, pauseSession, resumeSession, timerState } from '../domain/timer';
import type { Blocco, StatoUnita } from '../domain/types';
import { readStreak } from './outcome';
import type { Clock } from './ports/clock';
import { runCycle } from './scheduler';
import {
  abandonSession,
  anticipateSession,
  editActiveSession,
  endSession,
  readActiveSession,
  readSessionView,
  setupInputs,
  startHeartbeat,
  startSession,
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
  it('«Abbandona» alle 09:35 con 35 minuti di focus (58%): abbandono, blocco programmato e perso dopo le 10:30 (§8: fine passata da più di 30 minuti)', async () => {
    await avvia();
    expect(await abandonSession(db, oggi(9, 35), FUSO)).toMatchObject({ chiusura: 'abbandonata', esito: null });
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('programmato');
    expect((await get(db, 'unita', 'u11'))?.stato).toBe('non_iniziata');
    expect(await readStreak(db, oggi(9, 35))).toBe(0);
    await runCycle(db, oggi(10, 30), FUSO);
    expect((await get(db, 'blocchi', 's1'))?.stato).toBe('programmato');
    await runCycle(db, oggi(10, 31), FUSO);
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
    // App in secondo piano per 45 minuti: al ritorno l'intervallo è non verificato
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
 * nell'intervallo, `salta` sposta l'ora senza battiti (app in secondo piano), `primoPiano` simula il ritorno.
 */
function orologioFinto(inizio: number) {
  let t = inizio;
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
    primoPiano() {
      for (const fn of inPrimoPiano) fn();
    },
  };
}

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
