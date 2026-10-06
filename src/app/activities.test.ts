// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { blocksBetween, get, list, saveBlock } from '../data/repository';
import type { BozzaAttivita, VoceBozza } from '../domain/activity';
import { sortDay } from '../domain/ordering';
import type { Priorita } from '../domain/types';
import { local } from '../domain/time';
import { createActivity, editActivity } from './activities';
import { completeBlock } from './completion';

const NOW = local(2026, 9, 22, 9, 0);
const FUSO = 'Europe/Rome';
const comune = { note: '', promemoria: { modo: 'auto' } } as const;
const todo = (
  titolo: string,
  priorita: Priorita,
  checklist: VoceBozza[] = [],
): Extract<BozzaAttivita, { tipo: 'todo' }> => ({
  ...comune,
  tipo: 'todo',
  titolo,
  giorno: '2026-09-22',
  orario: null,
  orizzonte: 'giorno',
  priorita,
  checklist,
  corsoId: null,
});

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-crea-${++n}`);
});
afterEach(() => db.delete());
const saveBlockCon = async (id: string, campi: Record<string, unknown>) =>
  saveBlock(db, { ...(await get(db, 'blocchi', id))!, ...campi }, NOW, FUSO);
const saveBlockSpuntato = async (id: string, i: number) => {
  const b = (await get(db, 'blocchi', id))!;
  await saveBlockCon(id, { checklist: b.checklist?.map((v, j) => (j === i ? { ...v, fatta: true } : v)) });
};

describe('Crea — MECCANISMI §2', () => {
  it('una bozza non valida non scrive nulla', async () => {
    expect(await createActivity(db, todo('', 'normale'), NOW, FUSO)).toEqual({ ok: false, errori: ['titolo'] });
    expect(await list(db, 'blocchi')).toEqual([]);
  });

  it('evento con fasi: blocco nel giorno locale, fasi con id stabile e ordine', async () => {
    const r = await createActivity(
      db,
      {
        ...comune,
        tipo: 'evento',
        titolo: 'Dentista',
        giorno: '2026-09-22',
        orario: { inizio: '15:00', fine: '16:00' },
        luogo: '',
        fasi: ['Stampare le analisi', 'Portare i documenti'],
      },
      NOW,
      FUSO,
    );
    const b = r.ok ? await get(db, 'blocchi', r.id) : undefined;
    expect(b).toMatchObject({ tipo: 'evento', giornoLocale: '2026-09-22', orarioInizio: '15:00', fuso: FUSO });
    expect(b?.fasi?.map((f) => [f.etichetta, f.ordine])).toEqual([
      ['Stampare le analisi', 1],
      ['Portare i documenti', 2],
    ]);
    expect(new Set(b?.fasi?.map((f) => f.id)).size).toBe(2);
  });

  it('routine: si salvano la definizione e le sue occorrenze da oggi a oggi + 28 (§7)', async () => {
    const r = await createActivity(
      db,
      {
        ...comune,
        tipo: 'routine',
        titolo: 'Mattina',
        giorni: [0, 1, 2, 3, 4, 5, 6],
        inizio: '07:00',
        fine: null,
        dataInizio: '2026-09-22',
        termine: null,
        fasi: ['Sveglia'],
      },
      NOW,
      FUSO,
    );
    const def = r.ok ? await get(db, 'ricorrenze', r.id) : undefined;
    expect(def).toMatchObject({ tipo: 'routine', titolo: 'Mattina', orarioFine: null, fuso: FUSO });
    expect(def?.fasi).toHaveLength(1);
    const occorrenze = await list(db, 'blocchi');
    expect(occorrenze).toHaveLength(29);
    expect(occorrenze.every((b) => b.ricorrenzaId === def?.id && b.fine === null && b.titolo === 'Mattina')).toBe(true);
  });
});

describe('Crea: campi salvati e riletti — MECCANISMI §2, §4', () => {
  it('todo con checklist e priorità; routine di studio con corso', async () => {
    const t = await createActivity(db, todo('Valigia', 'alta', ['Passaporto', '']), NOW, FUSO);
    expect(t.ok ? await get(db, 'blocchi', t.id) : undefined).toMatchObject({
      priorita: 'alta',
      checklist: [{ testo: 'Passaporto', fatta: false }],
      orizzonte: 'giorno',
    });
    const s = await createActivity(
      db,
      {
        ...comune,
        tipo: 'studio',
        titolo: '',
        corsoId: 'corso-1',
        giorni: [1, 2, 3, 4, 5],
        inizio: '09:00',
        fine: '10:00',
        dataInizio: '2026-09-22',
        termine: null,
      },
      NOW,
      FUSO,
    );
    expect(s.ok ? await get(db, 'ricorrenze', s.id) : undefined).toMatchObject({
      tipo: 'studio',
      titolo: 'Studio',
      corsoId: 'corso-1',
      fasi: [],
    });
  });
});

describe('Priorità nella fascia senza orario — SCENARI A5', () => {
  it('tre todo senza orario creati bassa, alta, normale → nel giorno alta, normale, bassa', async () => {
    for (const [titolo, p] of [
      ['B', 'bassa'],
      ['A', 'alta'],
      ['N', 'normale'],
    ] as const)
      await createActivity(db, todo(titolo, p), NOW, FUSO);
    expect(sortDay(await blocksBetween(db, '2026-09-22', '2026-09-22')).map((b) => b.titolo)).toEqual(['A', 'N', 'B']);
  });
});

describe('Modifica — MECCANISMI §2, §4, §5, §7, SCENARI A3, B5, B6 (servizio)', () => {
  const evento = (fasi: VoceBozza[]): BozzaAttivita => ({
    ...comune,
    tipo: 'evento',
    titolo: 'Dentista',
    giorno: '2026-09-22',
    orario: { inizio: '15:00', fine: '16:00' },
    luogo: '',
    fasi,
  });
  const crea = async (b: BozzaAttivita) => {
    const r = await createActivity(db, b, NOW, FUSO);
    if (!r.ok) throw new Error(r.errori.join());
    return r.id;
  };

  it('A3: togliere tutte le voci dall’editor non cambia lo stato; le voci tengono la spunta del form; il corso resta', async () => {
    const id = await crea(todo('Valigia', 'normale', ['Passaporto', 'Medicine']));
    await saveBlockSpuntato(id, 0);
    await saveBlockCon(id, { corsoId: 'c1' });
    const prima = (await get(db, 'blocchi', id))!;
    const voci = [{ ...prima.checklist![0]!, testo: 'Passaporto valido' }, 'Cuffie'];
    expect((await editActivity(db, id, todo('Valigia', 'normale', voci), NOW, FUSO)).ok).toBe(true);
    expect(await get(db, 'blocchi', id)).toMatchObject({
      corsoId: 'c1',
      checklist: [
        { testo: 'Passaporto valido', fatta: true },
        { testo: 'Cuffie', fatta: false },
      ],
    });
    await editActivity(db, id, todo('Valigia', 'normale', []), NOW, FUSO);
    expect((await get(db, 'blocchi', id))?.stato).toBe(prima.stato);
  });

  it('cambiare l’orario di un todo azzera l’orario originale; cambiare priorità lo manda in fondo al nuovo gruppo', async () => {
    const id = await crea({ ...todo('Spesa', 'normale'), orario: { inizio: '18:00', durata: 30 } });
    await saveBlockCon(id, { orarioOriginale: '17:00' });
    await editActivity(db, id, { ...todo('Spesa', 'normale'), orario: { inizio: '19:00', durata: 30 } }, NOW, FUSO);
    expect((await get(db, 'blocchi', id))?.orarioOriginale).toBeNull();

    const alta = await crea(todo('Alta', 'alta'));
    const altro = await crea(todo('Altro', 'normale'));
    await editActivity(db, altro, todo('Altro', 'alta'), local(2026, 9, 22, 10, 0), FUSO);
    const ordine = sortDay(await blocksBetween(db, '2026-09-22', '2026-09-22'))
      .filter((b) => !b.conOrario)
      .map((b) => b.id);
    expect(ordine.indexOf(altro)).toBeGreaterThan(ordine.indexOf(alta));
  });

  it('B5: rinominare una fase tiene il suo id; il log fasi già scritto non cambia', async () => {
    const id = await crea(evento(['Analisi', 'Documenti']));
    const prima = (await get(db, 'blocchi', id))!.fasi!;
    const [a, b] = prima.map((f) => f.id) as [string, string];
    expect(await completeBlock(db, id, local(2026, 9, 22, 16, 30), FUSO, [b])).toBe(true);
    const log = await get(db, 'logFasi', id);
    // Rinomina e spostamento nello stesso «Salva»: gli id seguono le righe
    await editActivity(
      db,
      id,
      evento([
        { testo: 'Documenti', id: b },
        { testo: 'Analisi del sangue', id: a },
      ]),
      NOW,
      FUSO,
    );
    expect((await get(db, 'blocchi', id))!.fasi).toEqual([
      { id: b, etichetta: 'Documenti', ordine: 1 },
      { id: a, etichetta: 'Analisi del sangue', ordine: 2 },
    ]);
    expect(await get(db, 'logFasi', id)).toEqual(log);
    // Una fase tolta e una nuova al suo posto: la nuova ha un id nuovo
    await editActivity(db, id, evento([{ testo: 'Documenti', id: b }, 'Ricetta']), NOW, FUSO);
    const dopo = (await get(db, 'blocchi', id))!.fasi!.map((f) => f.id);
    expect(dopo[0]).toBe(b);
    expect([a, b]).not.toContain(dopo[1]);
  });

  it('B6: una routine 07:00 → 18:00 riscrive le occorrenze future; la definizione tiene le date saltate', async () => {
    const rid = await crea({
      ...comune,
      tipo: 'routine',
      titolo: 'Corsa',
      giorni: [0, 1, 2, 3, 4, 5, 6],
      inizio: '07:00',
      fine: '08:00',
      dataInizio: '2026-09-22',
      termine: null,
      fasi: [],
    });
    const occorrenza = (await list(db, 'blocchi')).find(
      (b) => b.ricorrenzaId === rid && b.giornoLocale === '2026-09-23',
    )!;
    const esito = await editActivity(
      db,
      occorrenza.id,
      {
        ...comune,
        tipo: 'routine',
        titolo: 'Corsa',
        giorni: [0, 1, 2, 3, 4, 5, 6],
        inizio: '18:00',
        fine: '19:00',
        dataInizio: '2026-09-22',
        termine: null,
        fasi: [],
      },
      NOW,
      FUSO,
    );
    expect(esito.ok).toBe(true);
    const domani = (await list(db, 'blocchi')).filter((b) => b.ricorrenzaId === rid && b.giornoLocale === '2026-09-23');
    expect(domani.map((b) => b.orarioInizio)).toEqual(['18:00']);
    expect((await get(db, 'ricorrenze', rid))?.orarioInizio).toBe('18:00');
  });
});
