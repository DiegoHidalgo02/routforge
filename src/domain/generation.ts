/**
 * Le pratiche generate dall'AI, la parte pura (MECCANISMI §18 «Generazione» e tabella; T-027): quantità, validazione
 * di ogni elemento, punteggio del quiz. Ciò che non supera la validazione non si salva; nessun elemento valido → errore.
 * Criteri: SCENARI H5. Decisione: D-QUIZ-2 (4 opzioni, almeno 2 con testo; la corretta ha testo; indice 0–3, una stringa
 * «2» o una lettera «C» si normalizzano).
 */
import type { Valutazione } from './sm2';

/** §18: quantità 5–25 a passi di 5. */
export const QUANTITA = [5, 10, 15, 20, 25] as const;
export type Quantita = (typeof QUANTITA)[number];
export type DifficoltaPratica = 'facile' | 'media' | 'difficile';

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

/** Il risultato salvato di una pratica (§18 tabella): giuste su totali, percentuale, istante, gli indici sbagliati. */
export interface RisultatoPratica {
  giuste: number;
  totali: number;
  percentuale: number;
  istante: number;
  sbagliate: number[];
}

/** Ciò che una pratica salvata porta oltre a unità, tipo e istante (T-027; T-028 aggiunge gli altri tipi). */
export interface DatiPratica {
  parametri: { quantita: number; difficolta: DifficoltaPratica | null };
  elementi: unknown[];
  risultato: RisultatoPratica | null;
}

const testo = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
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
 * La richiesta al modello (§18 «Generazione»): quanti elementi, la difficoltà dove prevista (il quiz) e la forma JSON
 * dell'elemento della tabella; lingua del materiale e codice come fonte primaria li dicono le regole
 * (`generationInstruction`). In inglese come le regole: la lingua degli elementi è quella del materiale (H4).
 */
export function generationPrompt(
  tipo: 'quiz' | 'flashcard',
  quantita: Quantita,
  difficolta: DifficoltaPratica | null,
): string {
  return tipo === 'quiz'
    ? `Generate exactly ${quantita} multiple-choice questions${difficolta ? ` of ${DIFFICOLTA[difficolta]} difficulty` : ''} on the material. Return a JSON array of objects {"domanda": the question, "opzioni": [exactly 4 answer texts], "corretta": the letter A, B, C or D of the right answer, "spiegazione": why it is right in one or two sentences, "citazione": its source as [TYPE · name]}.`
    : `Generate exactly ${quantita} flashcards on the material. Return a JSON array of objects {"fronte": a question or term, "retro": the answer, "citazione": its source as [TYPE · name]}.`;
}

/** L'indice della risposta corretta: un numero intero, o una stringa «2» o una lettera «A»–«D» (§18 «normalizzato»). */
function indice(v: unknown): number | null {
  if (typeof v === 'number') return Number.isInteger(v) ? v : null;
  const s = testo(v).toUpperCase();
  if (/^\d+$/.test(s)) return Number(s);
  return /^[A-D]$/.test(s) ? s.charCodeAt(0) - 65 : null;
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

/** Il risultato del quiz (§18): giuste, totali e percentuale arrotondata. */
export function quizScore(esiti: readonly boolean[]): { giuste: number; totali: number; percentuale: number } {
  const giuste = esiti.filter(Boolean).length;
  const totali = esiti.length;
  return { giuste, totali, percentuale: totali ? Math.round((giuste / totali) * 100) : 0 };
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
