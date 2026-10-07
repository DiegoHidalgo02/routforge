import { describe, expect, it } from 'vitest';
import {
  criteriaAfterQuiz,
  generationPrompt,
  QUANTITA,
  quizCriterion,
  quizScore,
  validFlashcards,
  validQuiz,
} from './generation';

const domanda = (i: number, over: Record<string, unknown> = {}) => ({
  domanda: `Domanda ${i}?`,
  opzioni: ['A', 'B', 'C', 'D'],
  corretta: 1,
  citazione: 'TEORIA · Unità 0.7',
  ...over,
});

describe('Validazione del quiz — SCENARI H5, MECCANISMI §18', () => {
  it('10 domande, 2 con 3 opzioni e 1 con l’indice fuori intervallo: ne restano 7', () => {
    const generate = Array.from({ length: 10 }, (_, i) =>
      i < 2 ? domanda(i, { opzioni: ['A', 'B', 'C'] }) : i === 2 ? domanda(i, { corretta: 4 }) : domanda(i),
    );
    expect(validQuiz(generate)).toHaveLength(7);
  });

  it('nessun elemento valido: nulla da salvare (la generazione è un errore); il formato sbagliato pure', () => {
    expect(validQuiz([domanda(0, { domanda: ' ' }), domanda(1, { corretta: -1 })])).toEqual([]);
    expect(validQuiz({ domande: 'x' })).toEqual([]);
  });

  it('4 opzioni con almeno 2 testuali; l’indice in stringa si normalizza («2», «C»); la corretta ha testo (D-QUIZ-2)', () => {
    expect(validQuiz([domanda(0, { opzioni: ['A', '', '', 'D'], corretta: 3 })])).toHaveLength(1);
    expect(validQuiz([domanda(0, { opzioni: ['A', '', '', ''], corretta: 0 })])).toEqual([]);
    expect(validQuiz([domanda(0, { opzioni: ['A', 'B', '', 'D'], corretta: 2 })])).toEqual([]);
    expect(validQuiz([domanda(0, { corretta: '2' }), domanda(1, { corretta: 'C' })]).map((d) => d.corretta)).toEqual([
      2, 2,
    ]);
  });

  it('opzioni numeriche o booleane sono testo («true», «2»)', () => {
    expect(validQuiz([domanda(0, { opzioni: [true, false, 'TypeError', 2], corretta: 'A' })])[0]?.opzioni).toEqual([
      'true',
      'false',
      'TypeError',
      '2',
    ]);
  });
});

describe('Validazione delle flashcard — MECCANISMI §18', () => {
  it('fronte e retro presenti; la citazione si tiene se c’è', () => {
    expect(
      validFlashcards([
        { fronte: 'Microtask?', retro: 'Coda svuotata dopo lo stack', citazione: 'TEORIA · Unità 0.7' },
        { fronte: 'Solo fronte', retro: '' },
        { retro: 'Solo retro' },
      ]),
    ).toEqual([{ fronte: 'Microtask?', retro: 'Coda svuotata dopo lo stack', citazione: 'TEORIA · Unità 0.7' }]);
  });
});

describe('Quantità e punteggio — MECCANISMI §18', () => {
  it('quantità 5–25 a passi di 5; punteggio giuste su totali con la percentuale arrotondata', () => {
    expect(QUANTITA).toEqual([5, 10, 15, 20, 25]);
    expect(quizScore([true, true, false, true, false, true, true])).toEqual({ giuste: 5, totali: 7, percentuale: 71 });
    expect(quizScore([])).toEqual({ giuste: 0, totali: 0, percentuale: 0 });
  });
});

describe('Richiesta di generazione — MECCANISMI §18, SCENARI H4', () => {
  it('quantità, difficoltà del quiz, forma JSON dell’elemento; le flashcard senza difficoltà', () => {
    const q = generationPrompt('quiz', 10, 'difficile');
    expect(q).toMatch(/exactly 10 multiple-choice questions/);
    expect(q).toMatch(/hard/);
    expect(q).toMatch(/"opzioni"/);
    expect(q).toMatch(/letter A, B, C or D/);
    const f = generationPrompt('flashcard', 5, null);
    expect(f).toMatch(/exactly 5 flashcards/);
    expect(f).toMatch(/"fronte"/);
  });

  it('una risposta col JSON dentro un oggetto si legge lo stesso', () => {
    expect(validFlashcards({ carte: [{ fronte: 'a', retro: 'b' }] })).toHaveLength(1);
  });
});

describe('Criterio automatico del modulo — MECCANISMI §11 (D-QUIZ-1)', () => {
  it('soglia raggiunta sul rapporto esatto: 8/10 spunta «≥8/10», 7/8 spunta «≥7/8», 79,5 % no; gli altri restano', () => {
    const criteri = [
      { testo: 'Domande socratiche', auto: true, soglia: 0.8, fatto: false },
      { testo: 'Esercizi', auto: false, soglia: null, fatto: false },
    ];
    expect(criteriaAfterQuiz(criteri, 8, 10).map((c) => c.fatto)).toEqual([true, false]);
    expect(criteriaAfterQuiz(criteri, 159, 200).map((c) => c.fatto)).toEqual([false, false]);
    expect(criteriaAfterQuiz([{ auto: true, soglia: 7 / 8, fatto: false }], 7, 8)[0]?.fatto).toBe(true);
  });

  it('«Domande socratiche» senza soglia: nessun quiz lo spunta, si spunta a mano (D-QUIZ-3)', () => {
    const senzaSoglia = { auto: true, soglia: null, fatto: false };
    expect(quizCriterion(senzaSoglia)).toBe(false);
    expect(quizCriterion({ auto: true, soglia: 0.8 })).toBe(true);
    expect(criteriaAfterQuiz([senzaSoglia], 10, 10)[0]?.fatto).toBe(false);
  });
});
