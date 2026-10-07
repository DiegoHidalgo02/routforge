/**
 * Le pratiche generate dall'AI, la parte pura (MECCANISMI §18 «Generazione» e tabella; T-027, T-028): quantità,
 * richiesta al modello, validazione di ogni elemento, punteggio; la playlist della Trivia con le sbagliate che tornano
 * una volta. Ciò che non supera la validazione non si salva; nessun elemento valido → errore. Criteri: SCENARI H5, I4
 * (I2 e I3 in `practice.ts`). Decisione: D-QUIZ-2 (4 opzioni, almeno 2 con testo; la corretta ha testo; indice 0–3,
 * una stringa «2» o una lettera «C» si normalizzano).
 */
import { scoreBugHunter, scoreBugHunterExercise, scoreDevSwipe, type Verdetto } from './practice';
import type { Valutazione } from './sm2';

/** §18: quantità 5–25 a passi di 5. */
export const QUANTITA = [5, 10, 15, 20, 25] as const;
export type Quantita = (typeof QUANTITA)[number];
export type DifficoltaPratica = 'facile' | 'media' | 'difficile';
/** I tipi di pratica generati dall'unità (§18 tabella; S12 «Pratica»). */
export type TipoPratica = 'quiz' | 'flashcard' | 'devswipe' | 'bughunter' | 'trivia';
/** §18 Trivia: 5 s di silenzio fra la domanda e la spiegazione. */
export const PAUSA_TRIVIA_MS = 5000;

export interface DomandaQuiz {
  domanda: string;
  opzioni: string[];
  corretta: number;
  citazione: string;
  /** La spiegazione dopo la risposta (S19 `quiz-answered`; la tabella di §18 non la chiede: vince il design). */
  spiegazione: string;
}

export interface FlashcardGenerata {
  fronte: string;
  retro: string;
  citazione: string;
}

/** Una carta salvata (§19): il testo generato e le valutazioni date (S20 Pratica: «valutazioni date»). */
export interface CartaGenerata extends FlashcardGenerata {
  valutazioni: { istante: number; valutazione: Valutazione }[];
}

/**
 * Una carta DevSwipe (§18): il contenuto da giudicare, il verdetto, la spiegazione; titolo, categoria, genere e
 * linguaggio per la carta e il riepilogo di S19 (il genere fuori dai tre valori è `null`: nessuna etichetta).
 */
export interface CartaDevSwipe {
  contenuto: string;
  verdetto: Verdetto;
  spiegazione: string;
  citazione: string;
  titolo: string;
  categoria: string;
  genere: 'codice' | 'architettura' | 'affermazione' | null;
  linguaggio: string;
}

/** Un esercizio Bug Hunter (§18): il codice con una riga sbagliata (1 = la prima), categoria, codice corretto, spiegazione. */
export interface EsercizioBugHunter {
  linguaggio: string;
  codice: string;
  riga: number;
  categoria: string;
  corretto: string;
  spiegazione: string;
  citazione: string;
}

/** Un elemento della Trivia (§18): domanda breve e spiegazione da leggere; `riproposto` se torna da una playlist (I4). */
export interface ElementoTrivia {
  domanda: string;
  spiegazione: string;
  riproposto?: boolean;
}

/**
 * Il risultato salvato di una pratica (§18 tabella): giuste su totali (per Bug Hunter i punti sul massimo), percentuale,
 * istante, gli indici sbagliati (Trivia: i saltati; Bug Hunter: gli esercizi a 0 punti).
 */
export interface RisultatoPratica {
  giuste: number;
  totali: number;
  percentuale: number;
  istante: number;
  sbagliate: number[];
}

/** Ciò che una pratica salvata porta oltre a unità, tipo e istante; `lingua` è quella della voce della Trivia. */
export interface DatiPratica {
  parametri: { quantita: number; difficolta: DifficoltaPratica | null };
  elementi: unknown[];
  risultato: RisultatoPratica | null;
  lingua: string | null;
}

const testo = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
/** Il codice come arriva, con le righe e il rientro: solo gli a capo uniformati e gli spazi in fondo tolti. */
const codice = (v: unknown): string => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').replace(/\s+$/, '') : '');
/** Gli elementi della risposta: l'array, o il primo array dentro un oggetto (`{"domande": [...]}`). */
const elenco = (grezzo: unknown): Record<string, unknown>[] => {
  const lista =
    Array.isArray(grezzo) || typeof grezzo !== 'object' || grezzo === null
      ? grezzo
      : Object.values(grezzo).find(Array.isArray);
  return Array.isArray(lista)
    ? lista.filter((x): x is Record<string, unknown> => typeof x === 'object' && x !== null)
    : [];
};

const DIFFICOLTA: Record<DifficoltaPratica, string> = { facile: 'easy', media: 'medium', difficile: 'hard' };

/**
 * La richiesta al modello (§18 «Generazione»): quanti elementi, la difficoltà dove S12 la mostra (quiz, DevSwipe, Bug
 * Hunter) e la forma JSON dell'elemento della tabella; lingua del materiale e codice come fonte primaria li dicono le
 * regole (`generationInstruction`). In inglese come le regole: la lingua degli elementi è quella del materiale (H4).
 */
export function generationPrompt(tipo: TipoPratica, quantita: Quantita, difficolta: DifficoltaPratica | null): string {
  const diff = difficolta ? ` of ${DIFFICOLTA[difficolta]} difficulty` : '';
  const fonte = '"citazione": its source as [TYPE · name]';
  switch (tipo) {
    case 'quiz':
      return `Generate exactly ${quantita} multiple-choice questions${diff} on the material. Return a JSON array of objects {"domanda": the question, "opzioni": [exactly 4 answer texts], "corretta": the letter A, B, C or D of the right answer, "spiegazione": why it is right in one or two sentences, ${fonte}}.`;
    case 'flashcard':
      return `Generate exactly ${quantita} flashcards on the material. Return a JSON array of objects {"fronte": a question or term, "retro": the answer, ${fonte}}.`;
    case 'devswipe':
      return `Generate exactly ${quantita} DevSwipe cards${diff} on the material, about half right and half wrong: each shows a code snippet, an architecture or a statement of at most 12 lines that is either right (clean code, correct architecture, best practice) or wrong (code smell, vulnerability, wrong pattern). Return a JSON array of objects {"genere": "codice", "architettura" or "affermazione", "linguaggio": the language or stack of the code, or "", "contenuto": the snippet or statement, "verdetto": "corretto" if it is right or "errato" if it is wrong, "spiegazione": why, in at most two lines, "titolo": a title of at most 8 words, "categoria": the topic in one to three words, ${fonte}}.`;
    case 'bughunter':
      return `Generate exactly ${quantita} Bug Hunter exercises${diff} on the material: each is a block of 5 to 10 lines of code with exactly one wrong line (for example an SQL injection, async code without error handling, a needless re-render). Return a JSON array of objects {"linguaggio": the programming language, "codice": the code with the bug, lines separated by \\n, "riga": the number of the wrong line, counting from 1, "categoria": the kind of bug in a few words, "corretto": the whole code with that line fixed, "spiegazione": why the line is wrong, in one or two sentences, ${fonte}}.`;
    case 'trivia':
      return `Generate an audio trivia playlist of exactly ${quantita} items on the material, to be read aloud by a speech synthesizer (no code, no markdown, no symbols): a short, direct question and an explanation of about 40 to 60 words that gives the answer. Return a JSON object {"lingua": the BCP 47 code of the language of the material, for example "en", "elementi": [{"domanda": the question, "spiegazione": the explanation}]}.`;
  }
}

/** Un numero intero, anche in stringa («4»). */
function intero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  const s = testo(v);
  return /^\d+$/.test(s) ? Number(s) : null;
}

/** L'indice della risposta corretta: un numero intero, o una stringa «2» o una lettera «A»–«D» (§18 «normalizzato»). */
function indice(v: unknown): number | null {
  const s = testo(v).toUpperCase();
  return intero(v) ?? (/^[A-D]$/.test(s) ? s.charCodeAt(0) - 65 : null);
}

/** Le domande valide di una generazione (§18, H5). */
export function validQuiz(grezzo: unknown): DomandaQuiz[] {
  return elenco(grezzo).flatMap((x) => {
    const domanda = testo(x.domanda);
    // Un'opzione numerica o booleana («true», «2») è testo anche lei
    const opzione = (o: unknown) => (typeof o === 'number' || typeof o === 'boolean' ? String(o) : testo(o));
    const opzioni = Array.isArray(x.opzioni) ? x.opzioni.map(opzione) : [];
    const corretta = indice(x.corretta);
    const valida =
      domanda &&
      opzioni.length === 4 &&
      opzioni.filter(Boolean).length >= 2 &&
      corretta !== null &&
      corretta >= 0 &&
      corretta < 4 &&
      opzioni[corretta];
    return valida
      ? [{ domanda, opzioni, corretta, citazione: testo(x.citazione), spiegazione: testo(x.spiegazione) }]
      : [];
  });
}

/** Le flashcard valide (§18): fronte e retro presenti. */
export function validFlashcards(grezzo: unknown): FlashcardGenerata[] {
  return elenco(grezzo).flatMap((x) => {
    const fronte = testo(x.fronte);
    const retro = testo(x.retro);
    return fronte && retro ? [{ fronte, retro, citazione: testo(x.citazione) }] : [];
  });
}

/** Le carte DevSwipe valide (§18): verdetto fra «corretto» ed «errato», contenuto e spiegazione presenti. */
export function validDevSwipe(grezzo: unknown): CartaDevSwipe[] {
  return elenco(grezzo).flatMap((x) => {
    const contenuto = codice(x.contenuto).replace(/^(\s*\n)+/, '');
    const verdetto = testo(x.verdetto).toLowerCase();
    const spiegazione = testo(x.spiegazione);
    const genere = testo(x.genere).toLowerCase();
    if (!contenuto.trim() || !spiegazione || (verdetto !== 'corretto' && verdetto !== 'errato')) return [];
    return [
      {
        contenuto,
        verdetto,
        spiegazione,
        citazione: testo(x.citazione),
        titolo: testo(x.titolo),
        categoria: testo(x.categoria),
        genere: genere === 'codice' || genere === 'architettura' || genere === 'affermazione' ? genere : null,
        linguaggio: testo(x.linguaggio),
      },
    ];
  });
}

/** Gli esercizi Bug Hunter validi (§18): la riga dentro il codice, il codice corretto diverso dall'originale. */
export function validBugHunter(grezzo: unknown): EsercizioBugHunter[] {
  return elenco(grezzo).flatMap((x) => {
    const sbagliato = codice(x.codice);
    const corretto = codice(x.corretto);
    const riga = intero(x.riga);
    const righe = sbagliato.split('\n').length;
    if (!sbagliato.trim() || !corretto.trim() || corretto === sbagliato || riga === null || riga < 1 || riga > righe)
      return [];
    return [
      {
        linguaggio: testo(x.linguaggio),
        codice: sbagliato,
        riga,
        categoria: testo(x.categoria),
        corretto,
        spiegazione: testo(x.spiegazione),
        citazione: testo(x.citazione),
      },
    ];
  });
}

/** Gli elementi validi della Trivia (§18): domanda e spiegazione presenti; chi torna da una playlist lo ricorda. */
export function validTrivia(grezzo: unknown): ElementoTrivia[] {
  return elenco(grezzo).flatMap((x) => {
    const domanda = testo(x.domanda);
    const spiegazione = testo(x.spiegazione);
    return domanda && spiegazione ? [{ domanda, spiegazione, ...(x.riproposto === true && { riproposto: true }) }] : [];
  });
}

/** La lingua della voce della Trivia (§18 «voce di sistema nella lingua del materiale»): un codice BCP 47, o null. */
export function triviaLanguage(grezzo: unknown): string | null {
  const l =
    typeof grezzo === 'object' && grezzo !== null && !Array.isArray(grezzo)
      ? testo((grezzo as Record<string, unknown>).lingua)
      : '';
  return /^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(l) ? l : null;
}

/**
 * Le sbagliate che tornano una volta nella playlist successiva della stessa unità (§18 Trivia, SCENARI I4): gli elementi
 * saltati della playlist completata per ultima, salvo quelli che erano già tornati. Una playlist lasciata a metà non ha
 * risultato e non conta: le sbagliate tornano finché una playlist non si ascolta fino in fondo (D-PRATICA-1).
 */
export function triviaReturning(
  playlist: readonly {
    elementi: readonly ElementoTrivia[];
    risultato: { istante: number; sbagliate: readonly number[] } | null;
  }[],
): ElementoTrivia[] {
  const ultima = playlist
    .flatMap((p) => (p.risultato ? [{ elementi: p.elementi, r: p.risultato }] : []))
    .sort((x, y) => y.r.istante - x.r.istante)[0];
  return (ultima?.r.sbagliate ?? []).flatMap((i) => {
    const e = ultima?.elementi[i];
    return e && !e.riproposto ? [{ domanda: e.domanda, spiegazione: e.spiegazione, riproposto: true }] : [];
  });
}

/** Giuste su totali con la percentuale arrotondata (§18 «Risultato salvato»). */
export function practiceScore(giuste: number, totali: number): { giuste: number; totali: number; percentuale: number } {
  return { giuste, totali, percentuale: totali ? Math.round((giuste / totali) * 100) : 0 };
}

/** Le risposte date in una pratica: DevSwipe i verdetti del primo passaggio, Bug Hunter le righe toccate, Trivia i saltati. */
export type RispostePratica =
  | { tipo: 'devswipe'; verdetti: readonly Verdetto[] }
  | { tipo: 'bughunter'; tocchi: readonly (readonly number[])[] }
  | { tipo: 'trivia'; saltate: readonly number[] };

/**
 * Il risultato di DevSwipe, Bug Hunter o Trivia (§18 tabella e paragrafi; SCENARI I2, I3, I4): DevSwipe = giuste al
 * primo passaggio su totali, sbagliate quelle riproposte; Bug Hunter = punti su 2 × esercizi, sbagliati quelli a 0 punti
 * (soluzione mostrata); Trivia = non saltati su totali, sbagliati i saltati.
 */
export function practiceResult(elementi: readonly unknown[], r: RispostePratica): Omit<RisultatoPratica, 'istante'> {
  switch (r.tipo) {
    case 'devswipe': {
      const s = scoreDevSwipe(
        validDevSwipe(elementi).map((c) => c.verdetto),
        r.verdetti,
      );
      return { ...practiceScore(s.giuste, s.totali), sbagliate: s.daRiproporre };
    }
    case 'bughunter': {
      const punti = validBugHunter(elementi).map((e, i) => scoreBugHunterExercise(e.riga, r.tocchi[i] ?? []).punti);
      const b = scoreBugHunter(punti);
      return { ...practiceScore(b.punti, b.massimo), sbagliate: punti.flatMap((p, i) => (p ? [] : [i])) };
    }
    case 'trivia': {
      const n = validTrivia(elementi).length;
      const saltate = [...new Set(r.saltate)].filter((i) => i >= 0 && i < n).sort((a, b) => a - b);
      return { ...practiceScore(n - saltate.length, n), sbagliate: saltate };
    }
  }
}

/** Il risultato del quiz (§18): giuste, totali e percentuale arrotondata. */
export function quizScore(esiti: readonly boolean[]): { giuste: number; totali: number; percentuale: number } {
  return practiceScore(esiti.filter(Boolean).length, esiti.length);
}

/**
 * Il criterio che spunta il quiz (FORMATO §2): «Domande socratiche» con la soglia scritta nel testo. Senza soglia
 * nessun quiz lo raggiunge e si spunta a mano come gli altri (D-QUIZ-3).
 */
export const quizCriterion = (c: { auto: boolean; soglia: number | null }): boolean => c.auto && c.soglia !== null;

/**
 * Il criterio Go/No-Go automatico dopo un quiz (§11, FORMATO §2; D-QUIZ-1): un quiz sulle unità del modulo che raggiunge
 * la soglia del criterio lo spunta. Il confronto è sul rapporto esatto (79,5 % non passa l'80 %, che arrotondato sì).
 */
export function criteriaAfterQuiz<T extends { auto: boolean; soglia: number | null; fatto: boolean }>(
  criteri: readonly T[],
  giuste: number,
  totali: number,
): T[] {
  return criteri.map((c) =>
    quizCriterion(c) && !c.fatto && totali > 0 && giuste / totali >= (c.soglia ?? 1) ? { ...c, fatto: true } : c,
  );
}
