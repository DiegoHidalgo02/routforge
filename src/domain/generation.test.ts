import { describe, expect, it } from 'vitest';
import {
  criteriaAfterQuiz,
  generationPrompt,
  practiceResult,
  practiceScore,
  QUANTITA,
  quizCriterion,
  quizScore,
  triviaLanguage,
  triviaReturning,
  validBugHunter,
  validDevSwipe,
  validFlashcards,
  validQuiz,
  validTrivia,
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
    // Bug Hunter: punti sul massimo (7 / 12 · 58 %)
    expect(practiceScore(7, 12)).toEqual({ giuste: 7, totali: 12, percentuale: 58 });
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

describe('Validazione di DevSwipe, Bug Hunter e Trivia — MECCANISMI §18', () => {
  it('DevSwipe: verdetto fra «corretto» ed «errato», contenuto e spiegazione presenti', () => {
    const carta = (over: Record<string, unknown> = {}) => ({
      contenuto: 'await Promise.all(urls.map(fetch))',
      verdetto: 'corretto',
      spiegazione: 'Le richieste partono insieme.',
      citazione: '[TEORIA · 0.7 Event loop]',
      ...over,
    });
    const valide = validDevSwipe([
      carta(),
      carta({ verdetto: ' Errato ' }),
      carta({ verdetto: 'forse' }),
      carta({ contenuto: '' }),
      carta({ spiegazione: ' ' }),
    ]);
    expect(valide.map((c) => c.verdetto)).toEqual(['corretto', 'errato']);
    expect(valide[0]?.citazione).toBe('[TEORIA · 0.7 Event loop]');
    // Il genere fuori dai tre valori resta vuoto: la carta non mostra l'etichetta
    expect(
      validDevSwipe([carta({ genere: 'Codice', linguaggio: 'JavaScript', titolo: 'Fetch in parallelo' })])[0],
    ).toMatchObject({ genere: 'codice', linguaggio: 'JavaScript', titolo: 'Fetch in parallelo' });
    expect(validDevSwipe([carta({ genere: 'poesia' })])[0]?.genere).toBeNull();
  });

  it('Bug Hunter: la riga nell’intervallo (anche in stringa), il codice corretto diverso dall’originale', () => {
    const codice = ['a', 'b', 'c', 'd', 'e', 'f'].join('\n');
    const es = (over: Record<string, unknown> = {}) => ({
      linguaggio: 'js',
      codice,
      riga: 4,
      categoria: 'SQL injection',
      corretto: codice.replace('d', 'D'),
      spiegazione: 'La riga 4 concatena l’input.',
      ...over,
    });
    const valide = validBugHunter([
      es(),
      es({ riga: '6' }),
      es({ riga: 7 }),
      es({ riga: 0 }),
      es({ corretto: `${codice}\n` }),
      es({ corretto: '' }),
    ]);
    expect(valide.map((e) => e.riga)).toEqual([4, 6]);
    expect(valide[0]).toMatchObject({ linguaggio: 'js', categoria: 'SQL injection' });
  });

  it('Trivia: domanda e spiegazione presenti; la lingua del materiale si legge dall’oggetto se è un codice valido', () => {
    const grezzo = {
      lingua: 'en',
      elementi: [{ domanda: 'What drains first?', spiegazione: 'Microtasks.' }, { domanda: 'Only question' }],
    };
    expect(validTrivia(grezzo)).toEqual([{ domanda: 'What drains first?', spiegazione: 'Microtasks.' }]);
    expect(triviaLanguage(grezzo)).toBe('en');
    expect(triviaLanguage({ lingua: 'English please' })).toBeNull();
    expect(triviaLanguage([])).toBeNull();
  });
});

describe('Playlist della Trivia — SCENARI I4', () => {
  it('le 2 saltate tornano una volta nella playlist successiva; una già tornata non torna più', () => {
    const elementi = Array.from({ length: 10 }, (_, i) => ({ domanda: `D${i}`, spiegazione: `S${i}` }));
    const completata = (sbagliate: number[], istante = 1) => ({ elementi, risultato: { istante, sbagliate } });
    const tornano = triviaReturning([completata([3, 8])]);
    expect(tornano).toEqual([
      { domanda: 'D3', spiegazione: 'S3', riproposto: true },
      { domanda: 'D8', spiegazione: 'S8', riproposto: true },
    ]);
    // Conta la playlist completata per ultima; una lasciata a metà (senza risultato) no
    const seconda = { elementi: [...elementi, ...tornano], risultato: { istante: 2, sbagliate: [0, 10] } };
    expect(triviaReturning([completata([3, 8]), seconda, { elementi, risultato: null }])).toEqual([
      { domanda: 'D0', spiegazione: 'S0', riproposto: true },
    ]);
    expect(triviaReturning([{ elementi, risultato: null }])).toEqual([]);
  });
});

describe('Risultato di DevSwipe, Bug Hunter e Trivia — SCENARI I2, I3, I4', () => {
  const swipe = (verdetto: string) => ({ contenuto: 'x', verdetto, spiegazione: 'perché' });
  it('DevSwipe: 10 carte, 3 errori al primo passaggio → 7 / 10 · 70 %, le 3 sbagliate', () => {
    const carte = Array.from({ length: 10 }, (_, i) => swipe(i % 2 ? 'errato' : 'corretto'));
    const verdetti = carte.map((c, i) =>
      [1, 4, 8].includes(i) ? (c.verdetto === 'corretto' ? 'errato' : 'corretto') : (c.verdetto as 'corretto'),
    );
    expect(practiceResult(carte, { tipo: 'devswipe', verdetti })).toEqual({
      giuste: 7,
      totali: 10,
      percentuale: 70,
      sbagliate: [1, 4, 8],
    });
  });

  it('Bug Hunter: riga 4 al primo tocco 2 punti, al secondo 1, con due errori 0 e sbagliato; punti / (2 × esercizi)', () => {
    const codice = ['a', 'b', 'c', 'd', 'e'].join('\n');
    const es = { codice, riga: 4, corretto: codice.replace('d', 'D') };
    expect(practiceResult([es, es, es], { tipo: 'bughunter', tocchi: [[4], [2, 4], [2, 3]] })).toEqual({
      giuste: 3,
      totali: 6,
      percentuale: 50,
      sbagliate: [2],
    });
  });

  it('Trivia: playlist di 10 con 2 saltati → 8 / 10 · 80 %, i 2 saltati sono le sbagliate', () => {
    const playlist = Array.from({ length: 10 }, (_, i) => ({ domanda: `D${i}`, spiegazione: `S${i}` }));
    expect(practiceResult(playlist, { tipo: 'trivia', saltate: [7, 2, 7] })).toEqual({
      giuste: 8,
      totali: 10,
      percentuale: 80,
      sbagliate: [2, 7],
    });
  });
});

describe('Richiesta di DevSwipe, Bug Hunter e Trivia — MECCANISMI §18', () => {
  it('ogni tipo chiede la quantità e la forma del suo elemento; la Trivia anche la lingua', () => {
    expect(generationPrompt('devswipe', 15, null)).toMatch(/exactly 15 .*"verdetto"/s);
    expect(generationPrompt('bughunter', 5, null)).toMatch(/exactly 5 .*"riga".*"corretto"/s);
    // La difficoltà dove S12 la mostra: quiz, DevSwipe e Bug Hunter
    expect(generationPrompt('bughunter', 5, 'difficile')).toMatch(/hard/);
    expect(generationPrompt('devswipe', 10, 'facile')).toMatch(/easy/);
    const t = generationPrompt('trivia', 10, null);
    expect(t).toMatch(/exactly 10 .*"lingua".*"spiegazione"/s);
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
