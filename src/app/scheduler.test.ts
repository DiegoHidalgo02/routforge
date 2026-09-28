// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type RoutForgeDb, type Tabelle } from '../data/db';
import { get, list, listBy, save, saveBlock, saveCourse, type DatiBlocco } from '../data/repository';
import type { BozzaAttivita } from '../domain/activity';
import { parseCourse } from '../domain/course/parser';
import { endOfLocalDay, local } from '../domain/time';
import { CHIAVE_ULTIMA_APERTURA, readAbsenceNotice } from './absence';
import { createActivity } from './activities';
import { watchCalendar } from './calendar';
import type { Clock } from './ports/clock';
import { CHIAVE_SESSIONE_ATTIVA, createScheduler, runCycle } from './scheduler';

// La lib della radice è ES2022 senza DOM né Node (D-TS-1): si dichiara il solo timer che serve a un test
declare const setTimeout: (fatto: () => void, ms: number) => unknown;

const FUSO = 'Europe/Rome';
let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-scheduler-${++n}`);
});
afterEach(() => db.delete());

// Settembre 2026: lunedì 21, martedì 22, mercoledì 23, venerdì 25, sabato 26, domenica 27, lunedì 28.
const LUNEDI = local(2026, 9, 21, 8, 0);

const blocco = (dati: Partial<DatiBlocco> & Pick<DatiBlocco, 'inizio' | 'fine'>) =>
  saveBlock(db, { tipo: 'routine', stato: 'programmato', conOrario: true, ...dati }, dati.inizio, FUSO);
const letto = async (id: string) => (await get(db, 'blocchi', id))!;

async function crea(bozza: BozzaAttivita, now: number): Promise<string> {
  const r = await createActivity(db, bozza, now, FUSO);
  if (!r.ok) throw new Error(r.errori.join());
  return r.id;
}
const routine = (giorni: number[], inizio: string, fine: string, dataInizio: string): BozzaAttivita => ({
  tipo: 'routine',
  titolo: 'Corsa',
  note: '',
  promemoria: { modo: 'auto' },
  giorni,
  inizio,
  fine,
  dataInizio,
  termine: null,
  fasi: [],
});

/**
 * Il corso di C1 (1.1, 1.2 nel modulo 1; 2.1 nel modulo 2) con una routine di studio 09:00–10:00, di default lun–ven
 * da lunedì 21 settembre, creata quel giorno alle 08:00.
 */
async function studioC1(
  giorni = [1, 2, 3, 4, 5],
  dataInizio = '2026-09-21',
  creataIl = LUNEDI,
): Promise<{ corsoId: string; numero: (unitaId: string | null | undefined) => string | null }> {
  const files = [
    { name: 'M1-Uno.md', content: '# MODULO M1 — Uno\n\n#### Unità 1.1 — A\n\n#### Unità 1.2 — B\n' },
    { name: 'M2-Due.md', content: '# MODULO M2 — Due\n\n#### Unità 2.1 — C\n' },
  ];
  const { corso } = parseCourse(files, { corsoId: 'c1', now: creataIl });
  await saveCourse(db, corso, creataIl);
  await crea(
    {
      tipo: 'studio',
      titolo: 'Studio',
      note: '',
      promemoria: { modo: 'auto' },
      corsoId: corso.id,
      giorni,
      inizio: '09:00',
      fine: '10:00',
      dataInizio,
      termine: null,
    },
    creataIl,
  );
  const numeri = new Map((await listBy(db, 'unita', 'corsoId', corso.id)).map((u) => [u.id, u.numero]));
  return { corsoId: corso.id, numero: (unitaId) => (unitaId ? (numeri.get(unitaId) ?? unitaId) : null) };
}
const studioDel = async (corsoId: string, giorno: string) =>
  (await listBy(db, 'blocchi', 'corsoId', corsoId)).find((b) => b.giornoLocale === giorno)!;

/** Tutte le righe di tutte le tabelle, tombstone incluse (Dexie diretto: solo nei test). */
const copia = () => Promise.all(db.tables.map((t) => t.toArray()));

describe('Ciclo — MECCANISMI §9 (ordine dei passi)', () => {
  it('riancora i blocchi di oggi prima di giudicarli persi (D-TIME-2, INV-18)', async () => {
    // Routine di oggi alle 09:00–10:00 di parete, con gli istanti calcolati in un altro fuso (6 ore prima)
    const riga: Tabelle['blocchi'] = {
      id: 'viaggio',
      tipo: 'routine',
      stato: 'programmato',
      inizio: local(2026, 9, 23, 3, 0),
      fine: local(2026, 9, 23, 4, 0),
      conOrario: true,
      giornoLocale: '2026-09-23',
      orarioInizio: '09:00',
      orarioFine: '10:00',
      fuso: 'America/New_York',
      createdAt: LUNEDI,
      updatedAt: LUNEDI,
      deletedAt: null,
    };
    await db.blocchi.put(riga);
    await runCycle(db, local(2026, 9, 23, 8, 0), FUSO);
    const b = await letto('viaggio');
    expect([b.stato, b.inizio, b.fine, b.fuso]).toEqual([
      'programmato',
      local(2026, 9, 23, 9, 0),
      local(2026, 9, 23, 10, 0),
      FUSO,
    ]);
  });

  it("estende le ricorrenze prima di spostare i todo: l'occorrenza di oggi occupa le 18:00", async () => {
    // «Palestra» ogni giorno 18:00–19:00 dal 1° agosto: le occorrenze arrivano al 29 agosto
    await crea(
      { ...routine([0, 1, 2, 3, 4, 5, 6], '18:00', '19:00', '2026-08-01'), titolo: 'Palestra' },
      local(2026, 8, 1, 8, 0),
    );
    const spesa = await blocco({
      tipo: 'todo',
      orizzonte: 'settimana',
      inizio: local(2026, 9, 22, 18, 0),
      fine: local(2026, 9, 22, 18, 30),
    });
    await runCycle(db, local(2026, 9, 23, 10, 0), FUSO);
    const oggi = (await list(db, 'blocchi')).filter((b) => b.giornoLocale === '2026-09-23');
    expect(oggi.map((b) => [b.tipo, b.orarioInizio, b.orarioFine]).sort()).toEqual([
      ['routine', '18:00', '19:00'],
      ['todo', '10:00', '10:30'],
    ]);
    expect((await letto(spesa.id)).orarioOriginale).toBe('18:00');
  });

  it('ricalcola il puntatore dopo l’estensione: le occorrenze appena generate ricevono subito la loro unità (§11)', async () => {
    // Routine di studio del lunedì dal 3 agosto: le occorrenze arrivano al 24 agosto; l'app si riapre lunedì 21 settembre
    const { corsoId, numero } = await studioC1([1], '2026-08-03', local(2026, 8, 3, 8, 0));
    await runCycle(db, LUNEDI, FUSO);
    const nuove = await Promise.all(['2026-09-21', '2026-09-28', '2026-10-05'].map((g) => studioDel(corsoId, g)));
    expect(nuove.map((b) => numero(b.unitaId))).toEqual(['1.1', '1.2', '2.1']);
  });

  it('ricalcola il puntatore dopo la marcatura persa: il blocco perso tiene la sua unità, i successivi avanzano (§11)', async () => {
    const { corsoId, numero } = await studioC1();
    await runCycle(db, LUNEDI, FUSO);
    expect(numero((await studioDel(corsoId, '2026-09-22')).unitaId)).toBe('1.2');
    await runCycle(db, local(2026, 9, 21, 10, 31), FUSO);
    const lunedi = await studioDel(corsoId, '2026-09-21');
    expect([lunedi.stato, numero(lunedi.unitaId)]).toEqual(['perso', '1.1']);
    const dopo = await Promise.all(['2026-09-22', '2026-09-23', '2026-09-24'].map((g) => studioDel(corsoId, g)));
    expect(dopo.map((b) => numero(b.unitaId))).toEqual(['1.1', '1.2', '2.1']);
  });
});

describe('Orfani — SCENARI C8 (app chiusa a metà sessione, riaperta 40 minuti dopo la fine)', () => {
  const studio = () =>
    blocco({ tipo: 'studio', stato: 'in_corso', inizio: local(2026, 9, 23, 9, 0), fine: local(2026, 9, 23, 10, 0) });

  it('senza una sessione attiva il blocco torna programmato e nello stesso ciclo è giudicato perso', async () => {
    const b = await studio();
    const now = local(2026, 9, 23, 10, 40);
    await runCycle(db, now, FUSO);
    expect([(await letto(b.id)).stato, (await letto(b.id)).persoIl]).toEqual(['perso', now]);
  });

  it('con la sessione attiva che lo punta resta in corso', async () => {
    const b = await studio();
    await save(db, 'preferenze', { id: CHIAVE_SESSIONE_ATTIVA, valore: { bloccoId: b.id } }, local(2026, 9, 23, 9, 5));
    await runCycle(db, local(2026, 9, 23, 10, 40), FUSO);
    expect((await letto(b.id)).stato).toBe('in_corso');
  });
});

describe('Persi — SCENARI B7 (routine 18:00–20:00 non avviata)', () => {
  it('alle 20:29 è ancora programmata; alle 20:31 è persa con un solo avviso «blocco perso»', async () => {
    const r = await blocco({ inizio: local(2026, 9, 23, 18, 0), fine: local(2026, 9, 23, 20, 0) });
    expect(await runCycle(db, local(2026, 9, 23, 20, 29), FUSO)).toEqual({
      avvisiRitardo: [],
      avvisiPerso: [],
      ricorrenzeSaltate: [],
    });
    expect((await letto(r.id)).stato).toBe('programmato');
    expect(await runCycle(db, local(2026, 9, 23, 20, 31), FUSO)).toEqual({
      avvisiRitardo: [],
      avvisiPerso: [r.id],
      ricorrenzeSaltate: [],
    });
    expect((await letto(r.id)).stato).toBe('perso');
    expect(await runCycle(db, local(2026, 9, 23, 20, 32), FUSO)).toEqual({
      avvisiRitardo: [],
      avvisiPerso: [],
      ricorrenzeSaltate: [],
    });
  });
});

describe('Persi — SCENARI B2 (occorrenza di mercoledì 07:00–08:00)', () => {
  it("l'occorrenza generata dalla routine è persa dalle 08:30 di mercoledì, non alle 08:29", async () => {
    await crea(routine([3], '07:00', '08:00', '2026-09-21'), LUNEDI);
    const mercoledi = async () => (await list(db, 'blocchi')).find((b) => b.giornoLocale === '2026-09-23')!;
    await runCycle(db, local(2026, 9, 23, 8, 29), FUSO);
    expect((await mercoledi()).stato).toBe('programmato');
    await runCycle(db, local(2026, 9, 23, 8, 31), FUSO);
    expect((await mercoledi()).stato).toBe('perso');
  });
});

describe('Non fatto — SCENARI A1 (todo «Chiama Marco» senza orario, orizzonte giorno)', () => {
  it('alle 00:30 del giorno dopo è «non fatto» nel giorno di ieri con un avviso «in ritardo»; il giorno dopo nessun altro', async () => {
    const inizio = local(2026, 9, 22, 12, 0);
    const marco = await blocco({
      tipo: 'todo',
      conOrario: false,
      orizzonte: 'giorno',
      inizio,
      fine: endOfLocalDay(inizio),
    });
    const now = local(2026, 9, 23, 0, 30);
    expect(await runCycle(db, now, FUSO)).toEqual({
      avvisiRitardo: [marco.id],
      avvisiPerso: [],
      ricorrenzeSaltate: [],
    });
    const b = await letto(marco.id);
    expect([b.stato, b.giornoLocale, b.ritardoIl]).toEqual(['perso', '2026-09-22', now]);
    expect(await runCycle(db, local(2026, 9, 24, 9, 0), FUSO)).toEqual({
      avvisiRitardo: [],
      avvisiPerso: [],
      ricorrenzeSaltate: [],
    });
  });
});

describe('Spostamento — SCENARI A2 (todo «Spesa» di martedì 18:00, orizzonte settimana, a ogni apertura)', () => {
  it('rotola ogni giorno fino a domenica con un solo avviso; lunedì resta a domenica come «non fatto»', async () => {
    const spesa = await blocco({
      tipo: 'todo',
      orizzonte: 'settimana',
      inizio: local(2026, 9, 22, 18, 0),
      fine: local(2026, 9, 22, 18, 30),
      checklist: [{ testo: 'Latte', fatta: true }],
    });
    const avvisi: string[] = [];
    for (const giorno of [23, 24, 25, 26, 27])
      avvisi.push(...(await runCycle(db, local(2026, 9, giorno, 9, 0), FUSO)).avvisiRitardo);
    expect(avvisi).toEqual([spesa.id]);
    expect((await letto(spesa.id)).giornoLocale).toBe('2026-09-27');
    expect(await runCycle(db, local(2026, 9, 28, 9, 0), FUSO)).toEqual({
      avvisiRitardo: [],
      avvisiPerso: [],
      ricorrenzeSaltate: [],
    });
    const b = await letto(spesa.id);
    expect([b.stato, b.giornoLocale, b.checklist]).toEqual(['perso', '2026-09-27', [{ testo: 'Latte', fatta: true }]]);
  });
});

describe('Estensione — SCENARI B1 («Corsa» lun/mer/ven 07:00–08:00 da mercoledì)', () => {
  it("dieci giorni dopo, all'apertura, le occorrenze arrivano a quel giorno + 28, senza duplicati", async () => {
    const id = await crea(routine([1, 3, 5], '07:00', '08:00', '2026-09-23'), local(2026, 9, 23, 8, 0));
    await runCycle(db, local(2026, 10, 3, 8, 0), FUSO);
    const occorrenze = await listBy(db, 'blocchi', 'ricorrenzaId', id);
    const giorni = occorrenze.map((b) => b.giornoLocale).sort();
    expect(new Set(giorni).size).toBe(giorni.length);
    expect(giorni.at(-1)).toBe('2026-10-30'); // venerdì; sabato 31 = 3 ottobre + 28
    expect(giorni).toContain('2026-10-26');
  });
});

describe('Evento — SCENARI E2 (mai perso)', () => {
  it('un evento di venerdì non completato, sabato resta programmato («concluso») e non riceve avvisi', async () => {
    const e = await blocco({ tipo: 'evento', inizio: local(2026, 9, 25, 15, 0), fine: local(2026, 9, 25, 16, 0) });
    expect(await runCycle(db, local(2026, 9, 26, 12, 0), FUSO)).toEqual({
      avvisiRitardo: [],
      avvisiPerso: [],
      ricorrenzeSaltate: [],
    });
    expect((await letto(e.id)).stato).toBe('programmato');
  });
});

describe('Idempotenza — MECCANISMI §9, INV-15', () => {
  it('rieseguire il ciclo senza cambiamenti non scrive nulla e non avvisa nessuno', async () => {
    await crea(routine([1, 3, 5], '07:00', '08:00', '2026-09-21'), LUNEDI);
    const { corsoId } = await studioC1();
    const martedi = await studioDel(corsoId, '2026-09-22');
    await saveBlock(db, { ...martedi, stato: 'in_corso' }, local(2026, 9, 22, 9, 0), FUSO); // orfano
    await blocco({
      tipo: 'todo',
      orizzonte: 'settimana',
      inizio: local(2026, 9, 22, 18, 0),
      fine: local(2026, 9, 22, 18, 30),
    });
    const mezzogiorno = local(2026, 9, 22, 12, 0);
    await blocco({
      tipo: 'todo',
      conOrario: false,
      orizzonte: 'mese',
      inizio: mezzogiorno,
      fine: endOfLocalDay(mezzogiorno),
    });
    await blocco({ tipo: 'evento', inizio: local(2026, 9, 25, 15, 0), fine: local(2026, 9, 25, 16, 0) });
    await db.blocchi.update(
      (await blocco({ tipo: 'todo', inizio: local(2026, 9, 24, 10, 0), fine: local(2026, 9, 24, 10, 30) })).id,
      { fuso: 'America/New_York' },
    );

    const primo = await runCycle(db, local(2026, 9, 23, 12, 0), FUSO);
    expect(primo.avvisiRitardo).toHaveLength(2);
    const prima = await copia();
    expect(await runCycle(db, local(2026, 9, 23, 12, 5), FUSO)).toEqual({
      avvisiRitardo: [],
      avvisiPerso: [],
      ricorrenzeSaltate: [],
    });
    expect(await copia()).toEqual(prima);
  });
});

describe('Atomicità — CONTESTO §3 (un ciclo che fallisce non lascia scritture a metà)', () => {
  it("se l'ultimo passo fallisce nessun passo scrive", async () => {
    const { corsoId } = await studioC1();
    const modulo = (await listBy(db, 'moduli', 'corsoId', corsoId))[0]!;
    await db.moduli.put({ ...modulo, criteri: null } as unknown as Tabelle['moduli']); // il puntatore fallirà
    await blocco({ inizio: local(2026, 9, 23, 7, 0), fine: local(2026, 9, 23, 8, 0) }); // da marcare perso
    const prima = await copia();
    await expect(runCycle(db, local(2026, 9, 23, 12, 0), FUSO)).rejects.toThrow();
    expect(await copia()).toEqual(prima);
  });
});

describe('Ricorrenza malformata — MECC §9, CONTESTO §3 (una definizione rotta non ferma il ciclo)', () => {
  it('si salta e si riporta; le altre si estendono e gli altri passi scrivono', async () => {
    await crea(routine([3], '07:00', '08:00', '2026-09-21'), LUNEDI);
    const malformata = { ...(await list(db, 'ricorrenze'))[0]!, id: 'rotta', giorni: null };
    await db.ricorrenze.put(malformata as unknown as Tabelle['ricorrenze']);
    const b = await blocco({ inizio: local(2026, 9, 23, 7, 0), fine: local(2026, 9, 23, 8, 0) });

    const esito = await runCycle(db, local(2026, 10, 20, 12, 0), FUSO);
    expect(esito.ricorrenzeSaltate).toEqual(['rotta']);
    expect((await letto(b.id)).stato).toBe('perso');
    const corse = (await listBy(db, 'blocchi', 'tipo', 'routine')).filter((x) => x.ricorrenzaId);
    expect(corse.some((x) => x.giornoLocale === '2026-11-11')).toBe(true); // estesa fino a oggi + 28
    expect(corse.some((x) => x.ricorrenzaId === 'rotta')).toBe(false);
  });
});

/**
 * Orologio finto della porta `Clock`: l'ora si imposta, `avanza` fa scattare i battiti il cui multiplo cade
 * nell'intervallo (come l'adapter web, al cambio di minuto), `salta` sposta l'ora senza battiti (app in background),
 * `primoPiano` simula il ritorno in primo piano.
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

describe('Inneschi — MECCANISMI §9 (avvio, primo piano, ogni 60 s)', () => {
  const routine1820 = () => blocco({ inizio: local(2026, 9, 23, 18, 0), fine: local(2026, 9, 23, 20, 0) });
  const stato = async (id: string) => (await letto(id)).stato;
  const ultimaApertura = async () => (await get(db, 'preferenze', CHIAVE_ULTIMA_APERTURA))?.valore;

  it("all'avvio esegue subito il ciclo", async () => {
    const r = await routine1820();
    const { clock } = orologioFinto(local(2026, 9, 23, 20, 31));
    const stop = createScheduler(db, clock).start();
    await vi.waitFor(async () => expect(await stato(r.id)).toBe('perso'));
    stop();
  });

  it('con l’app aperta il battito di ogni minuto esegue il ciclo: la routine di B7 è persa alle 20:30', async () => {
    const r = await routine1820();
    const o = orologioFinto(local(2026, 9, 23, 20, 29, 30));
    const s = createScheduler(db, o.clock);
    const stop = s.start();
    await s.run();
    expect(await stato(r.id)).toBe('programmato');
    o.avanza(60_000);
    await vi.waitFor(async () => expect(await stato(r.id)).toBe('perso'));
    stop();
  });

  it('al ritorno in primo piano esegue il ciclo', async () => {
    const r = await routine1820();
    const o = orologioFinto(local(2026, 9, 23, 20, 0));
    const s = createScheduler(db, o.clock);
    const stop = s.start();
    await s.run();
    o.salta(60 * 60_000); // un'ora in background, senza battiti
    o.primoPiano();
    await vi.waitFor(async () => expect(await stato(r.id)).toBe('perso'));
    stop();
  });

  it('dopo lo stop nessun innesco esegue il ciclo né registra un’apertura', async () => {
    const r = await routine1820();
    const o = orologioFinto(local(2026, 9, 23, 20, 0));
    const s = createScheduler(db, o.clock);
    s.start()();
    await s.run();
    o.avanza(60 * 60_000);
    o.primoPiano();
    await new Promise<void>((fatto) => setTimeout(fatto, 50));
    expect(await stato(r.id)).toBe('programmato');
    expect(await ultimaApertura()).toBe(local(2026, 9, 23, 20, 0));
  });

  it('l’apertura si registra all’avvio e al ritorno in primo piano, non al battito: tre giorni in background → avviso di ritorno (§9)', async () => {
    await save(db, 'corsi', { id: 'c1', titolo: 'Corso', sottotitolo: '', importatoIl: 0, esempio: false }, 0);
    const lunedi = local(2026, 9, 28, 21, 0);
    const giovedi = local(2026, 10, 1, 8, 0);
    const o = orologioFinto(lunedi);
    const s = createScheduler(db, o.clock);
    const stop = s.start();
    await vi.waitFor(async () => expect(await ultimaApertura()).toBe(lunedi));
    o.avanza(60_000); // il battito esegue solo il ciclo
    await s.run();
    expect(await ultimaApertura()).toBe(lunedi);
    o.salta(giovedi - lunedi - 60_000); // tre giorni in background, senza battiti
    o.primoPiano();
    await vi.waitFor(async () =>
      expect(await readAbsenceNotice(db, '2026-10-01')).toEqual({ giorni: 3, giorno: '2026-10-01' }),
    );
    expect(await ultimaApertura()).toBe(giovedi);
    stop();
  });

  it('una scrittura sulle ricorrenze esegue il ciclo ma non è un’apertura (D-ASSENZA-1)', async () => {
    const o = orologioFinto(local(2026, 9, 23, 20, 0));
    const stop = createScheduler(db, o.clock).start();
    await vi.waitFor(async () => expect(await ultimaApertura()).toBe(local(2026, 9, 23, 20, 0)));
    o.salta(31 * 60_000); // 20:31, senza battiti
    const id = await crea(routine([3], '18:00', '20:00', '2026-09-23'), local(2026, 9, 23, 20, 31));
    await vi.waitFor(async () => expect((await listBy(db, 'blocchi', 'ricorrenzaId', id))[0]?.stato).toBe('perso'));
    expect(await ultimaApertura()).toBe(local(2026, 9, 23, 20, 0));
    stop();
  });

  it('con un ciclo fallito l’apertura non si registra: il messaggio direbbe che il piano si è riallineato (FUNZ §2)', async () => {
    const { corsoId } = await studioC1();
    const modulo = (await listBy(db, 'moduli', 'corsoId', corsoId))[0]!;
    await db.moduli.put({ ...modulo, criteri: null } as unknown as Tabelle['moduli']);
    const o = orologioFinto(local(2026, 9, 23, 20, 31));
    const s = createScheduler(db, o.clock);
    const stop = s.start();
    await s.run();
    await new Promise<void>((fatto) => setTimeout(fatto, 50));
    expect(await ultimaApertura()).toBeUndefined();
    await db.moduli.put(modulo);
    o.salta(60_000);
    o.primoPiano();
    await vi.waitFor(async () => expect(await ultimaApertura()).toBe(local(2026, 9, 23, 20, 32)));
    stop();
  });

  it('un ciclo che fallisce non arriva al chiamante e il successivo lavora (CONTESTO §3)', async () => {
    const r = await routine1820();
    const { corsoId } = await studioC1();
    const modulo = (await listBy(db, 'moduli', 'corsoId', corsoId))[0]!;
    await db.moduli.put({ ...modulo, criteri: null } as unknown as Tabelle['moduli']);
    const s = createScheduler(db, orologioFinto(local(2026, 9, 23, 20, 31)).clock);
    await expect(s.run()).resolves.toBeUndefined();
    await db.moduli.put(modulo);
    expect(await s.run()).toEqual({ avvisiRitardo: [], avvisiPerso: [r.id], ricorrenzeSaltate: [] });
  });

  it('due esecuzioni richieste insieme si serializzano nella transazione: un solo avviso «blocco perso» (§7)', async () => {
    const r = await routine1820();
    const s = createScheduler(db, orologioFinto(local(2026, 9, 23, 20, 31)).clock);
    const [prima, seconda] = await Promise.all([s.run(), s.run()]);
    expect([prima?.avvisiPerso, seconda?.avvisiPerso]).toEqual([[r.id], []]);
  });
});

describe('Inneschi — SCENARI C1 (creare la routine di studio innesca il ciclo, che assegna le unità)', () => {
  it('le occorrenze della routine appena creata puntano a 1.1, 1.2, 2.1 senza altre chiamate', async () => {
    const s = createScheduler(db, orologioFinto(LUNEDI).clock);
    const stop = s.start();
    await s.run();
    const { corsoId, numero } = await studioC1();
    await vi.waitFor(async () => {
      const giorni = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24'];
      const blocchi = await Promise.all(giorni.map((g) => studioDel(corsoId, g)));
      expect(blocchi.map((b) => numero(b.unitaId))).toEqual(['1.1', '1.2', '2.1', null]);
    });
    stop();
  });
});

describe('Cambio giorno — SCENARI G4 (app aperta a mezzanotte fra martedì e mercoledì)', () => {
  it('entro un minuto i todo rotolano, i blocchi di ieri non gestiti sono persi e il calendario si aggiorna', async () => {
    const spesa = await blocco({
      tipo: 'todo',
      orizzonte: 'settimana',
      inizio: local(2026, 9, 22, 18, 0),
      fine: local(2026, 9, 22, 18, 30),
    });
    const sera = await blocco({ inizio: local(2026, 9, 22, 23, 0), fine: local(2026, 9, 22, 23, 30) });
    const mezzogiorno = local(2026, 9, 22, 12, 0);
    const marco = await blocco({
      tipo: 'todo',
      conOrario: false,
      orizzonte: 'giorno',
      inizio: mezzogiorno,
      fine: endOfLocalDay(mezzogiorno),
    });
    const o = orologioFinto(local(2026, 9, 22, 23, 59, 30));
    const s = createScheduler(db, o.clock);
    const stop = s.start();
    await s.run();
    expect([(await letto(spesa.id)).giornoLocale, await (async () => (await letto(sera.id)).stato)()]).toEqual([
      '2026-09-22',
      'programmato',
    ]);
    let mercoledi: string[] = [];
    const smetti = watchCalendar(db, ['2026-09-23'], (p) => (mercoledi = (p.get('2026-09-23') ?? []).map((b) => b.id)));

    o.avanza(60_000); // 00:00:30 di mercoledì
    await vi.waitFor(async () => {
      expect((await letto(spesa.id)).giornoLocale).toBe('2026-09-23');
      expect((await letto(sera.id)).stato).toBe('perso');
      expect(mercoledi).toContain(spesa.id);
    });
    expect((await letto(marco.id)).stato).toBe('programmato'); // finisce alle 23:59: perso dopo le 00:29 (§8)

    o.avanza(30 * 60_000); // 00:30:30
    await vi.waitFor(async () => expect((await letto(marco.id)).stato).toBe('perso'));
    smetti();
    stop();
  });
});
