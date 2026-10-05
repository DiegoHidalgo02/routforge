// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { save, saveBlock } from '../data/repository';
import { isNowCandidate, selectNowBlock } from '../domain/nowBlock';
import { local, localDayKey } from '../domain/time';
import type { Blocco } from '../domain/types';
import { nowInputs } from './nowBlock';

const FUSO = 'Europe/Rome';
let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-adesso-${++n}`);
});
afterEach(() => db.delete());

const blocco = (titolo: string, inizio: number, fine: number | null, extra: Partial<Blocco> = {}) =>
  saveBlock(
    db,
    { tipo: 'routine', stato: 'programmato', inizio, fine, conOrario: true, titolo, ...extra },
    inizio,
    FUSO,
  );

/** Ciò che la schermata mostra: gli ingressi letti dal database, la scelta fatta dal dominio con l'orologio corrente. */
const scelto = async (now: number) => {
  const i = await nowInputs(db, localDayKey(now));
  return selectNowBlock(i.blocchi, now);
};

describe('Adesso — SCENARI G1 (blocchi contigui letti dal database)', () => {
  const D = 23;
  beforeEach(async () => {
    await blocco('A', local(2026, 9, D, 9, 0), local(2026, 9, D, 10, 0));
    await blocco('B', local(2026, 9, D, 10, 0), local(2026, 9, D, 11, 0));
  });

  it('alle 10:00 in punto "Adesso" è B, con i suoi orari di parete', async () => {
    const sel = await scelto(local(2026, 9, D, 10, 0));
    expect(sel?.blocco.titolo).toBe('B');
    expect(sel?.stato).toEqual({ tipo: 'adesso', minutiAllaFine: 60 });
    expect(sel?.blocco.orarioInizio).toBe('10:00');
    expect(sel?.blocco.orarioFine).toBe('11:00');
  });

  it('alle 10:20 A resta raggiungibile (candidata fino alle 10:30, fine + 30 minuti) ma "Adesso" è B', async () => {
    const now = local(2026, 9, D, 10, 20);
    const { blocchi } = await nowInputs(db, localDayKey(now));
    const A = blocchi.find((b) => b.titolo === 'A');
    expect(A && isNowCandidate(A, now)).toBe(true);
    expect((await scelto(now))?.blocco.titolo).toBe('B');
  });

  it('alle 08:40 è A tra 20 minuti; alle 11:20 B è da recuperare; alle 11:31 nessuno', async () => {
    expect((await scelto(local(2026, 9, D, 8, 40)))?.stato).toEqual({ tipo: 'tra', minutiAllInizio: 20 });
    expect((await scelto(local(2026, 9, D, 11, 20)))?.stato).toEqual({
      tipo: 'recupera',
      ultimoAvvio: local(2026, 9, D, 11, 30),
    });
    expect(await scelto(local(2026, 9, D, 11, 31))).toBeNull();
  });
});

describe('Card Adesso — SCENARI G2 (nessuna chiusura: cambia con i candidati)', () => {
  it('alle 09:35 è A, alle 10:05 è B; gli ingressi non portano più chiusure', async () => {
    const D = 23;
    await blocco('A', local(2026, 9, D, 9, 0), local(2026, 9, D, 10, 0));
    await blocco('B', local(2026, 9, D, 10, 0), local(2026, 9, D, 11, 0));
    expect((await scelto(local(2026, 9, D, 9, 35)))?.blocco.titolo).toBe('A');
    expect((await scelto(local(2026, 9, D, 10, 5)))?.blocco.titolo).toBe('B');
    expect(Object.keys(await nowInputs(db, `2026-09-${D}`)).sort()).toEqual(['attiva', 'blocchi']);
  });
});

describe('Adesso — SCENARI E3 (evento tutto il giorno)', () => {
  it('non compare nel blocco Adesso, come il todo senza orario (MECC §24)', async () => {
    const D = 23;
    await blocco('Scadenza tasse', local(2026, 9, D), local(2026, 9, D, 23, 59), { tipo: 'evento', conOrario: false });
    await blocco('Chiama Marco', local(2026, 9, D, 12, 0), null, { tipo: 'todo', conOrario: false, priorita: 'alta' });
    expect(await scelto(local(2026, 9, D, 12, 0))).toBeNull();
  });
});

describe('Adesso — MECCANISMI §14 (candidati di ieri e di domani a cavallo di mezzanotte)', () => {
  it('una routine di ieri 23:30–00:30 alle 00:45 è da recuperare (fine + 30 minuti non ancora passata)', async () => {
    await blocco('Notturna', local(2026, 9, 22, 23, 30), local(2026, 9, 23, 0, 30));
    const sel = await scelto(local(2026, 9, 23, 0, 45));
    expect(sel?.blocco.titolo).toBe('Notturna');
    expect(sel?.stato).toEqual({ tipo: 'recupera', ultimoAvvio: local(2026, 9, 23, 1, 0) });
  });

  it('una routine di ieri senza durata finisce alle 23:59 (D-NOW-1): alle 00:20 è da recuperare, alle 00:30 no', async () => {
    await blocco('Senza durata', local(2026, 9, 22, 21, 0), null);
    expect((await scelto(local(2026, 9, 23, 0, 20)))?.stato.tipo).toBe('recupera');
    expect(await scelto(local(2026, 9, 23, 0, 30))).toBeNull();
  });

  it('una routine di domani 00:10–00:40 alle 23:45 è "tra 25 minuti" (inizio − 30 minuti); alle 23:39 nessuno', async () => {
    await blocco('Primo mattino', local(2026, 9, 24, 0, 10), local(2026, 9, 24, 0, 40));
    expect((await scelto(local(2026, 9, 23, 23, 45)))?.stato).toEqual({ tipo: 'tra', minutiAllInizio: 25 });
    expect(await scelto(local(2026, 9, 23, 23, 39))).toBeNull();
  });
});

describe('Adesso — MECCANISMI §14 (dati per S1: corso e unità dello studio)', () => {
  it('un blocco di studio porta il titolo del suo corso e il numero dell’unità puntata; gli altri no', async () => {
    const D = 23;
    const corso = await save(
      db,
      'corsi',
      { titolo: 'Syllabus', sottotitolo: '', importatoIl: local(2026, 9, 1), esempio: false },
      local(2026, 9, 1),
    );
    const unita = await save(
      db,
      'unita',
      {
        corsoId: corso.id,
        moduloId: 'm0',
        moduloNumero: 0,
        numero: '0.7',
        ordine: 7,
        titolo: 'Event loop',
        markdown: '',
        concettoCore: null,
        oreStimate: null,
        difficolta: null,
        stato: 'non_iniziata',
        progresso: 0,
        minuti: 0,
        confidenza: null,
      },
      local(2026, 9, 1),
    );
    await blocco('Studio', local(2026, 9, D, 9, 0), local(2026, 9, D, 10, 0), {
      tipo: 'studio',
      corsoId: corso.id,
      unitaId: unita.id,
    });
    await blocco('Palestra', local(2026, 9, D, 11, 0), local(2026, 9, D, 12, 0));
    const { blocchi } = await nowInputs(db, `2026-09-${D}`);
    expect(blocchi.map((b) => [b.titolo, b.corsoTitolo, b.unitaNumero])).toEqual([
      ['Studio', 'Syllabus', '0.7'],
      ['Palestra', undefined, undefined],
    ]);
  });
});
