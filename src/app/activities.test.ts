// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { blocksBetween, get, list } from '../data/repository';
import type { BozzaAttivita } from '../domain/activity';
import { sortDay } from '../domain/ordering';
import type { Priorita } from '../domain/types';
import { local } from '../domain/time';
import { createActivity } from './activities';

const NOW = local(2026, 9, 22, 9, 0);
const FUSO = 'Europe/Rome';
const comune = { note: '', promemoria: { modo: 'auto' } } as const;
const todo = (titolo: string, priorita: Priorita, checklist: string[] = []): BozzaAttivita => ({
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
