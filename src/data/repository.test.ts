// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseCourse } from '../domain/course/parser';
import type { Blocco } from '../domain/types';
import { local } from '../domain/time';
import { openDb, type RoutForgeDb } from './db';
import {
  blocksBetween,
  blocksOfDay,
  get,
  inTransaction,
  list,
  listBy,
  newId,
  remove,
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

describe('Identità e tombstone — MECC §25, D-DATA-1, D-DATA-2', () => {
  it('senza id assegna un UUID v4; aggiornando conserva createdAt e aggiorna updatedAt', async () => {
    const a = await save(db, 'sessioni', { avvio: T0, bloccoId: null }, T0);
    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    const b = await save(db, 'sessioni', { id: a.id, avvio: T0, bloccoId: 'b-1' }, T1);
    expect(b).toEqual({ id: a.id, avvio: T0, bloccoId: 'b-1', createdAt: T0, updatedAt: T1, deletedAt: null });
    expect(await list(db, 'sessioni')).toEqual([b]);
  });

  it('una tombstone non si legge né si elenca; risalvare lo stesso id la rianima conservando createdAt', async () => {
    const a = await save(db, 'sessioni', { avvio: T0, bloccoId: null }, T0);
    await remove(db, 'sessioni', a.id, T1);
    expect(await get(db, 'sessioni', a.id)).toBeUndefined();
    expect(await list(db, 'sessioni')).toEqual([]);
    const t2 = local(2026, 9, 24, 10, 0);
    const b = await save(db, 'sessioni', { id: a.id, avvio: T0, bloccoId: null }, t2);
    expect([b.createdAt, b.updatedAt, b.deletedAt]).toEqual([T0, t2, null]);
  });

  it('eliminare un record assente o già eliminato non scrive nulla', async () => {
    const a = await save(db, 'sessioni', { avvio: T0, bloccoId: null }, T0);
    await remove(db, 'sessioni', a.id, T1);
    await remove(db, 'sessioni', a.id, local(2026, 9, 25, 9, 0));
    await remove(db, 'sessioni', 'inesistente', T1);
    expect(await db.sessioni.toArray()).toEqual([{ id: a.id, createdAt: T0, updatedAt: T1, deletedAt: T1 }]);
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

  it("blocksOfDay: solo i blocchi vivi del giorno, in ordine d'inizio (indice [giornoLocale+inizio])", async () => {
    const nove = await saveBlock(db, occorrenza(26, 9, { ricorrenzaId: null }), T0, ROMA);
    const sette = await saveBlock(db, occorrenza(26, 7, { ricorrenzaId: null }), T0, ROMA);
    const eliminato = await saveBlock(db, occorrenza(26, 8, { ricorrenzaId: null }), T0, ROMA);
    await saveBlock(db, occorrenza(27, 8, { ricorrenzaId: null }), T0, ROMA);
    await remove(db, 'blocchi', eliminato.id, T1);
    expect((await blocksOfDay(db, '2026-09-26')).map((b) => b.id)).toEqual([sette.id, nove.id]);
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
    expect((await blocksOfDay(db, '2026-09-24')).map((b) => b.orarioInizio)).toEqual(['07:00', '18:00']);
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
    const primo = await save(db, 'logFasi', { id: 'b-1', ricorrenzaId: 'r-1' }, T0);
    await save(db, 'logFasi', { id: 'b-1', ricorrenzaId: 'r-1' }, T1);
    expect(await list(db, 'logFasi')).toEqual([{ ...primo, updatedAt: T1 }]);
    await remove(db, 'logFasi', 'b-1', local(2026, 9, 24, 9, 1));
    expect(await get(db, 'logFasi', 'b-1')).toBeUndefined();
    const terzo = await save(db, 'logFasi', { id: 'b-1', ricorrenzaId: 'r-1' }, local(2026, 9, 24, 9, 2));
    expect([terzo.createdAt, terzo.deletedAt]).toEqual([T0, null]);
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
  parseCourse([{ name: 'M1-Tooling.md', content: MODULO }], { corsoId, now: T0 }).corso;

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
