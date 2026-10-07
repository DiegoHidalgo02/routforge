// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, list, listBy, remove } from '../data/repository';
import { addLocalDays, local, MINUTE } from '../domain/time';
import { configureAi, removeAiKey, saveAiKey } from './ai';
import { importSampleCourse } from './courseImport';
import { readModule } from './courses';
import {
  generatePractice,
  gradeCard,
  readDeckView,
  readDueCards,
  readPracticeStats,
  readQuiz,
  readUnitPractice,
  saveQuizResult,
} from './practice';
import type { AiClient } from './ports/ai';

const ADESSO = local(2026, 9, 23, 16, 8);
const FUSO = 'Europe/Rome';
let db: RoutForgeDb;
let n = 0;
let json = '[]';
// Ciò che accade mentre il modello lavora (un corso eliminato nel frattempo)
let intanto = (): Promise<unknown> => Promise.resolve();

const finto: AiClient = {
  // eslint-disable-next-line require-yield
  async *stream() {
    throw new Error('non serve');
  },
  generate: () => intanto().then(() => json),
  verify: () => Promise.resolve(),
};

const domanda = (i: number, over: Record<string, unknown> = {}) => ({
  domanda: `Domanda ${i}?`,
  opzioni: ['A', 'B', 'C', 'D'],
  corretta: 1,
  citazione: '[TEORIA · 0.1 Valori]',
  ...over,
});

beforeEach(async () => {
  db = openDb(`test-pratica-${++n}`);
  intanto = () => Promise.resolve();
  configureAi(finto);
  await importSampleCourse(db, ADESSO);
  await saveAiKey(db, 'AIza-buona', ADESSO);
});
afterEach(() => db.delete());

const unita = async (numero: string) => (await list(db, 'unita')).find((u) => u.numero === numero)!;

describe('Generazione — SCENARI H5, MECCANISMI §18 (T-027)', () => {
  it('10 domande, 2 con 3 opzioni e 1 con l’indice fuori intervallo: il quiz salvato ne ha 7', async () => {
    json = JSON.stringify(
      Array.from({ length: 10 }, (_, i) =>
        i < 2 ? domanda(i, { opzioni: ['A', 'B', 'C'] }) : i === 2 ? domanda(i, { corretta: 7 }) : domanda(i),
      ),
    );
    const u = await unita('0.1');
    const r = await generatePractice(db, u.id, 'quiz', 10, 'media', ADESSO);
    expect('id' in r).toBe(true);
    const p = 'id' in r ? await get(db, 'pratiche', r.id) : undefined;
    expect(p).toMatchObject({ unitaId: u.id, tipo: 'quiz', parametri: { quantita: 10, difficolta: 'media' } });
    expect(p?.elementi).toHaveLength(7);
  });

  it('0 elementi validi: errore e nulla di salvato; senza chiave l’errore è «chiave»', async () => {
    json = JSON.stringify([domanda(0, { domanda: '' })]);
    const u = await unita('0.1');
    expect(await generatePractice(db, u.id, 'quiz', 5, 'facile', ADESSO)).toEqual({ errore: 'vuota' });
    json = 'non è JSON';
    expect(await generatePractice(db, u.id, 'flashcard', 5, null, ADESSO)).toEqual({ errore: 'vuota' });
    expect(await list(db, 'pratiche')).toEqual([]);
    expect(await list(db, 'mazzi')).toEqual([]);
    await removeAiKey(db, ADESSO);
    expect(await generatePractice(db, u.id, 'quiz', 5, 'facile', ADESSO)).toEqual({ errore: 'chiave' });
  });

  it('al massimo la quantità chiesta; un corso eliminato mentre il modello lavora non lascia orfani (H3)', async () => {
    json = JSON.stringify(Array.from({ length: 12 }, (_, i) => domanda(i)));
    const u = await unita('0.1');
    const r = await generatePractice(db, u.id, 'quiz', 10, 'media', ADESSO);
    expect('id' in r && (await get(db, 'pratiche', r.id))?.elementi).toHaveLength(10);
    json = JSON.stringify([{ fronte: 'a', retro: 'A' }]);
    intanto = () => remove(db, 'unita', u.id, ADESSO);
    expect(await generatePractice(db, u.id, 'flashcard', 5, null, ADESSO)).toEqual({ errore: 'generico' });
    expect(await list(db, 'mazzi')).toEqual([]);
    expect(await list(db, 'carte')).toEqual([]);
  });

  it('flashcard: un mazzo sull’unità con le carte nuove, dovute subito', async () => {
    json = JSON.stringify({ carte: [{ fronte: 'Microtask?', retro: 'Prima del task', citazione: 'x' }] });
    const u = await unita('0.1');
    const r = await generatePractice(db, u.id, 'flashcard', 5, null, ADESSO);
    const mazzo = 'id' in r ? r.id : '';
    const carte = await listBy(db, 'carte', 'mazzoId', mazzo);
    expect(carte).toMatchObject([{ fronte: 'Microtask?', retro: 'Prima del task', scadenza: ADESSO, valutazioni: [] }]);
    expect(await readUnitPractice(db, u.id, ADESSO)).toMatchObject([
      { tipo: 'flashcard', id: mazzo, carte: 1, dovute: 1 },
    ]);
  });
});

describe('Quiz e criterio Go/No-Go automatico — MECCANISMI §11, §18 (D-QUIZ-1, D-QUIZ-4)', () => {
  it('il punteggio si salva una volta; sopra la soglia del criterio auto del modulo il criterio si spunta', async () => {
    json = JSON.stringify(Array.from({ length: 10 }, (_, i) => domanda(i)));
    const u = await unita('0.1');
    const genera = async () => {
      const r = await generatePractice(db, u.id, 'quiz', 10, 'media', ADESSO);
      return 'id' in r ? r.id : '';
    };
    const id = await genera();
    const auto = async () => (await get(db, 'moduli', u.moduloId))?.criteri.find((c) => c.auto);
    await saveQuizResult(db, id, [true, true, true, true, true, true, true, false, false, false], ADESSO, FUSO);
    expect((await get(db, 'pratiche', id))?.risultato).toEqual({
      giuste: 7,
      totali: 10,
      percentuale: 70,
      istante: ADESSO,
      sbagliate: [7, 8, 9],
    });
    expect((await auto())?.fatto).toBe(false);
    // Rifare lo stesso quiz non cambia il punteggio salvato: si riapre su quello (D-QUIZ-4)
    await saveQuizResult(db, id, Array<boolean>(10).fill(true), ADESSO + 1, FUSO);
    expect((await readQuiz(db, id))?.risultato).toMatchObject({ giuste: 7, sbagliate: [7, 8, 9] });
    expect((await auto())?.fatto).toBe(false);
    // ≥8/10 (M0): con 8 giuste su un quiz nuovo il criterio si spunta; S11 mostra l'ultimo quiz del modulo
    const nuovo = await genera();
    await saveQuizResult(db, nuovo, [true, true, true, true, true, true, true, true, false, false], ADESSO + 2, FUSO);
    expect((await auto())?.fatto).toBe(true);
    const m = await get(db, 'moduli', u.moduloId);
    expect((await readModule(db, u.corsoId, m!.numero))?.ultimoQuiz).toEqual({ giuste: 8, totali: 10 });
    expect((await readUnitPractice(db, u.id, ADESSO)).find((p) => p.id === nuovo)).toMatchObject({
      tipo: 'quiz',
      domande: 10,
      giuste: 8,
      percentuale: 80,
    });
  });
});

describe('Flashcard e ripasso — SCENARI I1, MECCANISMI §19', () => {
  it('«Bene» porta a 1 giorno, «Niente» ripropone fra 10′; il ripasso prende le scadute dalle più scadute', async () => {
    json = JSON.stringify([
      { fronte: 'a', retro: 'A' },
      { fronte: 'b', retro: 'B' },
    ]);
    const u = await unita('0.1');
    const r = await generatePractice(db, u.id, 'flashcard', 5, null, ADESSO);
    // Le carte per testo: l'ordine di listBy segue gli id, che sono casuali
    const carte = await listBy(db, 'carte', 'mazzoId', 'id' in r ? r.id : '');
    const prima = carte.find((c) => c.fronte === 'a');
    const seconda = carte.find((c) => c.fronte === 'b');
    expect(await gradeCard(db, prima!.id, 'bene', ADESSO)).toMatchObject({ intervalloGiorni: 1, rimettiInCoda: false });
    expect(await gradeCard(db, seconda!.id, 'niente', ADESSO)).toMatchObject({ rimettiInCoda: true });
    expect((await get(db, 'carte', seconda!.id))?.scadenza).toBe(ADESSO + 10 * MINUTE);
    expect(await readDueCards(db, ADESSO)).toEqual([]);
    // Dai Recenti il mazzo mostra solo le carte scadute: una carta non scaduta non si valuta (§19)
    expect((await readDeckView(db, 'id' in r ? r.id : '', ADESSO))?.carte).toEqual([]);
    const dopo = addLocalDays(ADESSO, 2);
    expect((await readDueCards(db, dopo)).map((c) => c.fronte)).toEqual(['b', 'a']);
    // S20 Pratica: valutazioni date e carte scadute oggi
    expect(await readPracticeStats(db, ADESSO - 1, ADESSO + 1, dopo)).toMatchObject({ valutazioni: 2, scaduteOggi: 2 });
  });
});
