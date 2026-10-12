// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCourse } from '../domain/course/parser';
import type { Blocco } from '../domain/types';
import { local } from '../domain/time';
import { openDb, type RoutForgeDb } from './db';
import {
  allRows,
  allTables,
  blocksBetween,
  dequeue,
  enqueueAll,
  get,
  inTransaction,
  list,
  listBy,
  listKeyRange,
  newId,
  purge,
  putRemote,
  queueSize,
  remove,
  replaceAll,
  save,
  saveBlock,
  saveCourse,
  watch,
} from './repository';

const ROMA = 'Europe/Rome';
const T0 = local(2026, 9, 24, 8, 0);
const T1 = local(2026, 9, 24, 9, 0);

let n = 0;
let db: RoutForgeDb;
beforeEach(() => {
  db = openDb(`test-repo-${++n}`);
});
afterEach(() => db.delete());

/** Id deterministico dell'occorrenza = slot della ricorrenza (D-DATA-2; il formato lo fissa T-011). */
const slot = (giorno: number, h: number): string => `r-corsa:2026-09-${giorno}:${String(h).padStart(2, '0')}:00`;
/** Occorrenza della routine "Corsa" (MECC §7) il giorno indicato, per default 07:00–08:00, con l'id del suo slot. */
const occorrenza = (giorno: number, h = 7, extra: Partial<Blocco> = {}): Blocco => ({
  id: slot(giorno, h),
  tipo: 'routine',
  stato: 'programmato',
  inizio: local(2026, 9, giorno, h, 0),
  fine: local(2026, 9, giorno, h + 1, 0),
  conOrario: true,
  ricorrenzaId: 'r-corsa',
  ...extra,
});

const PRATICA = { unitaId: 'u1', tipo: 'quiz', creataIl: T0 };

describe('Identità e tombstone — MECC §25, D-DATA-1, D-DATA-2', () => {
  it('senza id assegna un UUID v4; aggiornando conserva createdAt e aggiorna updatedAt', async () => {
    const a = await save(db, 'pratiche', PRATICA, T0);
    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const b = await save(db, 'pratiche', { id: a.id, unitaId: 'u1', tipo: 'trivia', creataIl: T0 }, T1);
    expect(b).toEqual({
      id: a.id,
      unitaId: 'u1',
      tipo: 'trivia',
      creataIl: T0,
      createdAt: T0,
      updatedAt: T1,
      deletedAt: null,
    });
    expect(await list(db, 'pratiche')).toEqual([b]);
  });

  it('una tombstone non si legge né si elenca; risalvare lo stesso id la rianima conservando createdAt', async () => {
    const a = await save(db, 'pratiche', PRATICA, T0);
    await remove(db, 'pratiche', a.id, T1);
    expect(await get(db, 'pratiche', a.id)).toBeUndefined();
    expect(await list(db, 'pratiche')).toEqual([]);
    const t2 = local(2026, 9, 24, 10, 0);
    const b = await save(db, 'pratiche', { id: a.id, ...PRATICA }, t2);
    expect([b.createdAt, b.updatedAt, b.deletedAt]).toEqual([T0, t2, null]);
  });

  it('eliminare un record assente o già eliminato non scrive nulla', async () => {
    const a = await save(db, 'pratiche', PRATICA, T0);
    await remove(db, 'pratiche', a.id, T1);
    await remove(db, 'pratiche', a.id, local(2026, 9, 25, 9, 0));
    await remove(db, 'pratiche', 'inesistente', T1);
    expect(await db.pratiche.toArray()).toEqual([{ id: a.id, createdAt: T0, updatedAt: T1, deletedAt: T1 }]);
  });

  it('accetta un id deterministico: una preferenza per chiave (id = chiave)', async () => {
    await save(db, 'preferenze', { id: 'digest', valore: '08:00' }, T0);
    await save(db, 'preferenze', { id: 'digest', valore: '07:30' }, T1);
    expect(await list(db, 'preferenze')).toEqual([
      { id: 'digest', valore: '07:30', createdAt: T0, updatedAt: T1, deletedAt: null },
    ]);
  });
});

describe('Blocchi: giorno locale e ora di parete — MECC §1, D-TIME-2', () => {
  it('deriva giorno locale, orari di parete e fuso dagli istanti (routine 23:00–01:00: fine il giorno dopo)', async () => {
    const b = await saveBlock(
      db,
      { ...occorrenza(26), inizio: local(2026, 9, 26, 23, 0), fine: local(2026, 9, 27, 1, 0) },
      T0,
      ROMA,
    );
    expect(b).toMatchObject({ giornoLocale: '2026-09-26', orarioInizio: '23:00', orarioFine: '01:00', fuso: ROMA });
  });

  it('senza durata (§7): orarioFine null', async () => {
    const b = await saveBlock(db, { ...occorrenza(26), fine: null }, T0, ROMA);
    expect([b.orarioInizio, b.orarioFine]).toEqual(['07:00', null]);
  });

  it('aggiornare senza cambiare gli istanti conserva giorno, orari e fuso memorizzati (il passato non si sposta)', async () => {
    // Blocco scritto in un altro fuso: ancoraggio diverso da quello che darebbe il fuso di questo processo.
    const altrove = { giornoLocale: '2026-09-23', orarioInizio: '23:30', orarioFine: '00:30', fuso: 'Asia/Tokyo' };
    const base = { ...occorrenza(24), id: 'b-1', ...altrove, createdAt: T0, updatedAt: T0, deletedAt: null };
    await db.blocchi.put(base);
    const b = await saveBlock(db, { ...occorrenza(24), id: 'b-1', stato: 'perso', persoIl: T1 }, T1, ROMA);
    expect(b).toMatchObject({ ...altrove, stato: 'perso', updatedAt: T1 });
  });

  it('istanti invariati e ancoraggio uguale nel fuso corrente: registra il fuso corrente (stesso offset, es. Roma → Berlino), così il riancoraggio converge (INV-15)', async () => {
    const a = await saveBlock(db, occorrenza(24), T0, ROMA);
    const b = await saveBlock(db, { ...occorrenza(24), stato: 'completato' }, T1, 'Europe/Berlin');
    expect(b).toMatchObject({
      giornoLocale: a.giornoLocale,
      orarioInizio: a.orarioInizio,
      orarioFine: a.orarioFine,
      fuso: 'Europe/Berlin',
      stato: 'completato',
    });
  });

  it('cambiare gli istanti ricalcola giorno, orari e fuso', async () => {
    const a = await saveBlock(db, occorrenza(24), T0, 'Europe/Berlin');
    const b = await saveBlock(db, { ...occorrenza(25, 18), id: a.id }, T1, ROMA);
    expect(b).toMatchObject({ giornoLocale: '2026-09-25', orarioInizio: '18:00', orarioFine: '19:00', fuso: ROMA });
  });

  it("blocksBetween su un giorno: solo i blocchi vivi, in ordine d'inizio (indice [giornoLocale+inizio])", async () => {
    const nove = await saveBlock(db, occorrenza(26, 9, { ricorrenzaId: null }), T0, ROMA);
    const sette = await saveBlock(db, occorrenza(26, 7, { ricorrenzaId: null }), T0, ROMA);
    const eliminato = await saveBlock(db, occorrenza(26, 8, { ricorrenzaId: null }), T0, ROMA);
    await saveBlock(db, occorrenza(27, 8, { ricorrenzaId: null }), T0, ROMA);
    await remove(db, 'blocchi', eliminato.id, T1);
    expect((await blocksBetween(db, '2026-09-26', '2026-09-26')).map((b) => b.id)).toEqual([sette.id, nove.id]);
  });

  it('blocksBetween: i giorni dal primo all’ultimo inclusi, per giorno e poi per inizio', async () => {
    await saveBlock(db, occorrenza(24, 7, { ricorrenzaId: null }), T0, ROMA);
    const a = await saveBlock(db, occorrenza(25, 9, { ricorrenzaId: null }), T0, ROMA);
    const b = await saveBlock(db, occorrenza(26, 7, { ricorrenzaId: null }), T0, ROMA);
    const c = await saveBlock(db, occorrenza(26, 23, { ricorrenzaId: null }), T0, ROMA);
    await saveBlock(db, occorrenza(27, 7, { ricorrenzaId: null }), T0, ROMA);
    expect((await blocksBetween(db, '2026-09-25', '2026-09-26')).map((r) => r.id)).toEqual([a.id, b.id, c.id]);
  });
});

describe('Occorrenze: id deterministico dello slot — MECC §7, D-DATA-2', () => {
  it("la stessa occorrenza salvata due volte è un solo record, anche se l'utente l'ha spostata (C4: anticipata da 15:00 a 14:40)", async () => {
    const a = await saveBlock(db, occorrenza(24, 15), T0, ROMA);
    const b = await saveBlock(
      db,
      { ...occorrenza(24, 15), inizio: local(2026, 9, 24, 14, 40), fine: local(2026, 9, 24, 15, 40) },
      T1,
      ROMA,
    );
    expect(b).toMatchObject({ id: a.id, orarioInizio: '14:40', orarioFine: '15:40', createdAt: T0, updatedAt: T1 });
    expect(await list(db, 'blocchi')).toEqual([b]);
  });

  it('slot diversi nello stesso giorno sono occorrenze diverse (B6: la routine passa da 07:00 a 18:00, quella di stamattina resta)', async () => {
    await saveBlock(db, occorrenza(24, 7, { stato: 'completato' }), T0, ROMA);
    await saveBlock(db, occorrenza(24, 18), T0, ROMA);
    expect((await blocksBetween(db, '2026-09-24', '2026-09-24')).map((b) => b.orarioInizio)).toEqual([
      '07:00',
      '18:00',
    ]);
  });

  it("dopo l'eliminazione (tombstone) la rigenerazione con lo stesso id la rianima conservando createdAt", async () => {
    const a = await saveBlock(db, occorrenza(28), T0, ROMA);
    await remove(db, 'blocchi', a.id, T1);
    const b = await saveBlock(db, occorrenza(28), local(2026, 9, 24, 10, 0), ROMA);
    expect(await list(db, 'blocchi')).toEqual([b]);
    expect([b.id, b.createdAt, b.deletedAt]).toEqual([a.id, T0, null]);
  });

  it('listBy: le occorrenze vive di una ricorrenza dall’indice `ricorrenzaId` (le eliminate e le altre routine no)', async () => {
    const a = await saveBlock(db, occorrenza(24), T0, ROMA);
    const b = await saveBlock(db, occorrenza(25), T0, ROMA);
    await saveBlock(db, occorrenza(26, 7, { id: 'altra', ricorrenzaId: 'r-altra' }), T0, ROMA);
    await remove(db, 'blocchi', b.id, T1);
    expect((await listBy(db, 'blocchi', 'ricorrenzaId', 'r-corsa')).map((r) => r.id)).toEqual([a.id]);
  });

  it('listKeyRange: i record vivi con la chiave fra due estremi inclusi, in ordine di chiave (eliminati e fuori intervallo no)', async () => {
    await saveBlock(db, occorrenza(24), T0, ROMA);
    const b = await saveBlock(db, occorrenza(25), T0, ROMA);
    const c = await saveBlock(db, occorrenza(26, 18), T0, ROMA);
    const eliminata = await saveBlock(db, occorrenza(26, 7), T0, ROMA);
    await saveBlock(db, occorrenza(27), T0, ROMA);
    await remove(db, 'blocchi', eliminata.id, T1);
    const trovati = await listKeyRange(db, 'blocchi', 'r-corsa:2026-09-25', 'r-corsa:2026-09-26:~');
    expect(trovati.map((r) => r.id)).toEqual([b.id, c.id]);
  });
});

describe('Transazioni dei servizi — MECC §7 (generazioni serializzate), D-IMPORT-1 (tutto o niente)', () => {
  it('inTransaction: un errore a metà annulla le scritture già fatte', async () => {
    await expect(
      inTransaction(db, ['preferenze'], async () => {
        await save(db, 'preferenze', { id: 'lingua', valore: 'it' }, T0);
        throw new Error('a metà');
      }),
    ).rejects.toThrow('a metà');
    expect(await list(db, 'preferenze')).toEqual([]);
  });
});

describe("Log fasi: id = blocco dell'occorrenza — MECC §5, D-DATA-2", () => {
  it('ricompletare sovrascrive lo stesso log; annullare la spunta lo elimina e ricompletare lo rianima', async () => {
    const primo = await save(db, 'logFasi', { id: 'b-1', ricorrenzaId: 'r-1', fasi: [] }, T0);
    await save(db, 'logFasi', { id: 'b-1', ricorrenzaId: 'r-1', fasi: [] }, T1);
    expect(await list(db, 'logFasi')).toEqual([{ ...primo, updatedAt: T1 }]);
    await remove(db, 'logFasi', 'b-1', local(2026, 9, 24, 9, 1));
    expect(await get(db, 'logFasi', 'b-1')).toBeUndefined();
    const terzo = await save(db, 'logFasi', { id: 'b-1', ricorrenzaId: 'r-1', fasi: [] }, local(2026, 9, 24, 9, 2));
    expect([terzo.createdAt, terzo.deletedAt]).toEqual([T0, null]);
  });
});

describe('Registro notifiche — MECCANISMI §1, INV-14', () => {
  it('id = chiave; purge cancella fisicamente, senza tombstone', async () => {
    const voce = {
      id: 'pre:5:b1',
      chiave: 'pre:5:b1',
      istante: T1,
      trigger: 'pre' as const,
      anticipo: 5,
      bloccoId: 'b1',
      tipo: 'studio' as const,
      titolo: 'Studio',
      inizioBlocco: T1,
      sveglia: false,
      silenzioso: false,
      azioni: [],
      vociAperte: false,
      oneShot: false,
      idNativo: 42,
    };
    await save(db, 'registroNotifiche', voce, T0);
    expect((await list(db, 'registroNotifiche')).map((r) => [r.id, r.idNativo])).toEqual([['pre:5:b1', 42]]);
    await purge(db, 'registroNotifiche', ['pre:5:b1']);
    expect(await db.registroNotifiche.get('pre:5:b1')).toBeUndefined();
  });
});

describe('Query live — D-STACK-1 (stato della UI)', () => {
  it('riesegue la query dopo una scrittura; dopo lo stop non notifica più', async () => {
    const visti: number[] = [];
    let avvisa = (): void => {};
    const stop = watch(
      () => list(db, 'preferenze').then((r) => r.length),
      (v) => {
        visti.push(v);
        avvisa();
      },
    );
    const prossimo = () => new Promise<void>((r) => (avvisa = r));
    await prossimo();
    const dopoLaScrittura = prossimo();
    await save(db, 'preferenze', { id: 'lingua', valore: 'it' }, T0);
    await dopoLaScrittura;
    stop();
    await save(db, 'preferenze', { id: 'tema', valore: 'scuro' }, T1);
    await list(db, 'preferenze');
    expect(visti).toEqual([0, 1]);
  });
});

/** Un modulo con due unità, tre sezioni e quattro risorse: basta a vedere la forma di ogni riga (FORMATO_CORSO §2–§3). */
const MODULO = `# MODULO M1 — Tooling

#### Unità 1.1 — Node
**📖 Teoria**
- [Guida](https://esempio.org/guida)
- [API](https://esempio.org/api)

**🛠 Pratica**
- [Esercizi](https://esempio.org/esercizi)

#### Unità 1.2 — npm
**📖 Teoria**
- [npm](https://esempio.org/npm)
`;
const corsoDi = (corsoId: string) =>
  parseCourse([{ nome: 'M1-Tooling.md', contenuto: MODULO }], { corsoId, now: T0 }).corso;

describe('Albero del corso — MECC §16, D-DATA-2 (D-IMPORT-1)', () => {
  it('una riga per nodo, senza i campi che il dominio calcola; risorsa = sezione + posizione', async () => {
    const corso = corsoDi('c-1');
    await saveCourse(db, corso, T0);
    const corsoId = 'c-1';
    const comuni = { createdAt: T0, updatedAt: T0, deletedAt: null };
    expect(await list(db, 'corsi')).toEqual([
      { id: corsoId, titolo: corso.titolo, sottotitolo: corso.sottotitolo, importatoIl: T0, esempio: false, ...comuni },
    ]);
    // Lo stato del modulo si calcola dai criteri (FORMATO §4) e i figli hanno righe proprie: nessuno dei due nella riga
    const { unita, stato, ...modulo } = corso.moduli[0]!;
    expect(await list(db, 'moduli')).toEqual([{ ...modulo, corsoId, ...comuni }]);
    for (const { sezioni, ...u } of unita) {
      expect(await get(db, 'unita', u.id)).toEqual({ ...u, corsoId, moduloId: modulo.id, ...comuni });
      for (const [i, { risorse, ...s }] of sezioni.entries()) {
        expect(await get(db, 'sezioni', s.id)).toEqual({ ...s, corsoId, unitaId: u.id, ordine: i + 1, ...comuni });
        for (const [j, r] of risorse.entries()) {
          const id = `${s.id}:R${j + 1}`;
          expect(await get(db, 'risorse', id)).toEqual({
            ...r,
            id,
            corsoId,
            sezioneId: s.id,
            ordine: j + 1,
            ...comuni,
          });
        }
      }
    }
    // Nessuna riga oltre all'albero: 2 unità, 3 sezioni, 4 risorse; l'ordine dei link resta quello del file
    const quante = async (nome: 'unita' | 'sezioni' | 'risorse') => (await list(db, nome)).length;
    expect([await quante('unita'), await quante('sezioni'), await quante('risorse')]).toEqual([2, 3, 4]);
    expect(await get(db, 'risorse', 'c-1:M1:U1.1:teoria:R2')).toMatchObject({ titolo: 'API', ordine: 2 });
  });

  it('tutto o niente: un errore a metà non lascia un corso a metà', async () => {
    const corso = corsoDi('c-rotto');
    // Una funzione non si può salvare in IndexedDB (DataCloneError): l'errore arriva all'ultima unità
    corso.moduli[0]!.unita[1]!.titolo = (() => 'npm') as unknown as string;
    await expect(saveCourse(db, corso, T0)).rejects.toThrow();
    for (const nome of ['corsi', 'moduli', 'unita', 'sezioni', 'risorse'] as const) {
      expect(await list(db, nome)).toEqual([]);
    }
  });
});

describe('newId fuori dal contesto sicuro (http su IP di rete, D-DATA-1)', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('senza randomUUID genera comunque UUID v4 distinti', () => {
    let x = 7; // generatore finto: basta che i byte cambino
    vi.stubGlobal('crypto', {
      getRandomValues: (a: Uint8Array) => a.map(() => (x = (x * 1103515245 + 12345) % 2 ** 31) >> 16),
    });
    const ids = Array.from({ length: 50 }, newId);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(new Set(ids).size).toBe(50);
  });
});

describe('Azzeramento del backup — MECCANISMI §22, INV-14 (T-030)', () => {
  it('allRows porta anche le tombstone; replaceAll svuota ogni tabella tranne il registro delle notifiche e scrive solo le righe date', async () => {
    await save(db, 'pratiche', PRATICA, T0);
    const via = await save(db, 'pratiche', PRATICA, T0);
    await remove(db, 'pratiche', via.id, T1);
    await save(db, 'registroNotifiche', { id: 'k', chiave: 'k', idNativo: 1, quando: T1 } as never, T0);
    const righe = await allRows(db, 'pratiche');
    expect(righe.map((r) => r.deletedAt)).toEqual(expect.arrayContaining([null, T1]));
    await replaceAll(db, { pratiche: [righe[0]!] });
    expect(await allRows(db, 'pratiche')).toEqual([righe[0]]);
    // Il registro lo svuota il servizio delle notifiche dopo l'azzeramento, togliendo anche le notifiche armate (D-BACKUP-2)
    expect(await allRows(db, 'registroNotifiche')).toHaveLength(1);
  });

  it('una scrittura che fallisce lascia tutto com’era (una sola transazione)', async () => {
    const p = await save(db, 'pratiche', PRATICA, T0);
    // Una riga senza chiave primaria fa fallire bulkPut dopo gli svuotamenti
    await expect(replaceAll(db, { blocchi: [{ titolo: 'senza id' }] })).rejects.toThrow();
    expect(await list(db, 'pratiche')).toEqual([p]);
  });
});

describe('Coda della sync — MECCANISMI §25, INV-14 (T-033)', () => {
  const evento = { tipo: 'evento' as const, stato: 'programmato' as const, inizio: T0, fine: T1, conOrario: true };
  const coda = () => list(db, 'syncCoda');
  const voci = async () => (await coda()).map((v) => [v.id, v.updatedAt, v.generata]);

  it('le modifiche dell’utente nell’ambito si accodano con il loro istante; i blocchi scritti dal ciclo no', async () => {
    const b = await saveBlock(db, { ...evento, id: 'b1' }, T0, ROMA);
    await saveBlock(db, { ...evento, id: 'b2' }, T0, ROMA, 'ciclo');
    await save(db, 'ricorrenze', { id: 'r1' } as never, T0);
    // Il collegamento di una routine al corso di qui lo scrive il ciclo (T-034)
    await save(db, 'ricorrenze', { id: 'r2' } as never, T0, 'ciclo');
    await save(db, 'logFasi', { id: 'b1', ricorrenzaId: null, fasi: [] }, T0);
    expect(await voci()).toEqual([
      ['blocchi:b1', T0, false],
      ['logFasi:b1', T0, false],
      ['ricorrenze:r1', T0, false],
    ]);
    // Un'eliminazione si accoda con la sua tombstone; una modifica successiva aggiorna la stessa voce
    await remove(db, 'blocchi', b.id, T1);
    expect((await coda()).find((v) => v.id === 'blocchi:b1')?.updatedAt).toBe(T1);
  });

  it('cambiare solo l’interruttore generale delle notifiche (resta qui) non accoda la riga; gli altri campi sì (D-SYNC-6)', async () => {
    await save(db, 'preferenze', { id: 'notifiche', valore: { generale: true, x: 1 } }, T0);
    await purge(db, 'syncCoda', ['preferenze:notifiche']);
    await save(db, 'preferenze', { id: 'notifiche', valore: { generale: false, x: 1 } }, T1);
    expect(await voci()).toEqual([]);
    await save(db, 'preferenze', { id: 'notifiche', valore: { generale: false, x: 2 } }, T1);
    expect(await voci()).toEqual([['preferenze:notifiche', T1, false]]);
  });

  it('la fusione usa l’istante dell’ultimo gesto, non quello del ciclo né dell’interruttore generale (audit P0-2)', async () => {
    const [T2, T3, T4] = [local(2026, 9, 25, 9, 0), local(2026, 9, 25, 10, 0), local(2026, 9, 26, 9, 0)];
    const b1 = async () => (await get(db, 'blocchi', 'b1'))!;
    // Coda vuota, come dopo un push o un import, poi la fusione
    const fondi = async () => {
      await purge(db, 'syncCoda', ['blocchi:b1', 'preferenze:notifiche']);
      await enqueueAll(db);
      return voci();
    };
    await saveBlock(db, { ...evento, id: 'b1' }, T0, ROMA);
    // Il giorno dopo il ciclo lo segna perso: l'ultimo gesto resta quello delle 8:00
    await saveBlock(db, { ...(await b1()), stato: 'perso' }, T2, ROMA, 'ciclo');
    await save(db, 'preferenze', { id: 'notifiche', valore: { generale: true, x: 1 } }, T0);
    await save(db, 'preferenze', { id: 'notifiche', valore: { generale: false, x: 1 } }, T2);
    expect(await fondi()).toEqual([
      ['blocchi:b1', T0, false],
      ['preferenze:notifiche', T0, false],
    ]);
    // Un gesto vero lo porta avanti; una scrittura del ciclo dopo, o il solo interruttore, non lo toccano
    await saveBlock(db, { ...(await b1()), stato: 'completato' }, T3, ROMA);
    await saveBlock(db, await b1(), T4, ROMA, 'ciclo');
    await save(db, 'preferenze', { id: 'notifiche', valore: { generale: false, x: 2 } }, T3);
    await save(db, 'preferenze', { id: 'notifiche', valore: { generale: true, x: 2 } }, T4);
    expect(await fondi()).toEqual([
      ['blocchi:b1', T3, false],
      ['preferenze:notifiche', T3, false],
    ]);
    // Un istante che non è un numero intero (backup modificato a mano) non entra in coda: vale `updatedAt`
    await putRemote(db, 'blocchi', [{ ...(await b1()), gestoIl: 'x' } as never]);
    expect((await fondi())[0]).toEqual(['blocchi:b1', T4, false]);
  });

  it('fuori dall’ambito niente coda: preferenze fuori elenco (chiave AI, stato della sync), corsi, pratica', async () => {
    await save(db, 'preferenze', { id: 'chiaveAi', valore: 'x' }, T0);
    await save(db, 'preferenze', { id: 'sync', valore: {} }, T0);
    await save(db, 'pratiche', PRATICA, T0);
    await save(db, 'preferenze', { id: 'impostazioni', valore: {} }, T0);
    expect(await voci()).toEqual([['preferenze:impostazioni', T0, false]]);
  });

  it('le righe ricevute si scrivono così come sono, tombstone comprese, senza tornare in coda', async () => {
    const tomba = { id: 'b9', createdAt: 1, updatedAt: T1, deletedAt: T1 };
    await putRemote(db, 'blocchi', [tomba]);
    expect(await db.table('blocchi').get('b9')).toEqual(tomba);
    expect(await coda()).toEqual([]);
  });

  it('dopo il push si tolgono le voci spedite, non quelle cambiate nel frattempo', async () => {
    await saveBlock(db, { ...evento, id: 'b1' }, T0, ROMA);
    await saveBlock(db, { ...evento, id: 'b2' }, T0, ROMA);
    await saveBlock(db, { ...evento, id: 'b2', titolo: 'dopo' }, T1, ROMA);
    await dequeue(db, [
      { id: 'blocchi:b1', updatedAt: T0 },
      { id: 'blocchi:b2', updatedAt: T0 },
    ]);
    expect(await voci()).toEqual([['blocchi:b2', T1, false]]);
  });

  it('la fusione accoda tutto l’ambito, tombstone comprese, con le occorrenze generate marcate; l’azzeramento svuota', async () => {
    const slot = (giorno: string) => ({
      ...evento,
      id: `r1:${giorno}:08:00`,
      tipo: 'routine' as const,
      ricorrenzaId: 'r1',
    });
    await saveBlock(db, slot('2026-09-24'), T0, ROMA, 'ciclo');
    await saveBlock(db, { ...evento, id: 'b3' }, T0, ROMA, 'ciclo');
    await putRemote(db, 'blocchi', [{ id: 'b4', createdAt: T0, updatedAt: T1, deletedAt: T1 }]);
    await save(db, 'preferenze', { id: 'chiaveAi', valore: 'x' }, T0);
    // Una modifica dell'utente già in coda resta com'è, anche se la riga sembra generata
    await saveBlock(db, slot('2026-09-25'), T1, ROMA);
    await enqueueAll(db);
    expect(await voci()).toEqual([
      ['blocchi:b3', T0, false],
      ['blocchi:b4', T1, false],
      ['blocchi:r1:2026-09-24:08:00', T0, true],
      ['blocchi:r1:2026-09-25:08:00', T1, false],
    ]);
    await replaceAll(db, {});
    expect(await coda()).toEqual([]);
  });

  it('la coda si svuota fisicamente (derivata del dispositivo, come il registro delle notifiche)', async () => {
    await saveBlock(db, { ...evento, id: 'b1' }, T0, ROMA);
    await purge(db, 'syncCoda', ['blocchi:b1']);
    expect(await db.syncCoda.count()).toBe(0);
  });
});

describe('Fotografia delle tabelle per il backup — MECCANISMI §22 (audit P2-8)', () => {
  it('una scrittura arrivata mentre si leggono non ci finisce a metà: corso e modulo insieme o nessuno dei due', async () => {
    // Dopo la lettura dei corsi, prima di quella dei moduli, un'altra transazione scrive un corso col suo modulo
    const corsi = db.table('corsi');
    const leggi = corsi.toArray.bind(corsi);
    let scrittura: Promise<unknown> | undefined;
    vi.spyOn(corsi, 'toArray').mockImplementationOnce(() =>
      leggi().then((letti) => {
        scrittura = Dexie.ignoreTransaction(() =>
          db.transaction('rw', ['corsi', 'moduli'], async () => {
            await db.table('corsi').put({ id: 'c-nuovo', deletedAt: null });
            await db.table('moduli').put({ id: 'm-nuovo', corsoId: 'c-nuovo', deletedAt: null });
          }),
        );
        return letti;
      }),
    );
    const righe = await allTables(db, ['corsi', 'moduli']);
    await scrittura;
    const ha = (tabella: string, id: string) =>
      (righe[tabella] as { id: string }[] | undefined)?.some((r) => r.id === id);
    expect(ha('corsi', 'c-nuovo')).toBe(ha('moduli', 'm-nuovo'));
  });
});

describe('Istanti delle voci della fusione — MECCANISMI §25 (audit N-4)', () => {
  const coda = () => list(db, 'syncCoda');
  it('un istante con la virgola si arrotonda; uno fuori dagli interi sicuri non entra in coda (fermerebbe il push)', async () => {
    await putRemote(db, 'blocchi', [
      { id: 'virgola', createdAt: 1, updatedAt: 1000.5, deletedAt: 1000.5 },
      { id: 'enorme', createdAt: 1, updatedAt: 1e20, deletedAt: 1e20 },
    ]);
    await enqueueAll(db);
    expect((await coda()).map((v) => [v.id, v.updatedAt])).toEqual([['blocchi:virgola', 1001]]);
  });
});

describe('Lunghezza della coda — MECCANISMI §25 (audit P3-10)', () => {
  it('si conta senza leggere le voci, ed è il numero delle voci', async () => {
    const evento = { tipo: 'evento' as const, stato: 'programmato' as const, inizio: T0, fine: T1, conOrario: true };
    for (const id of ['b1', 'b2', 'b3']) await saveBlock(db, { ...evento, id }, T0, ROMA);
    expect(await queueSize(db)).toBe((await list(db, 'syncCoda')).length);
    expect(await queueSize(db)).toBe(3);
  });
});
