/**
 * La pratica generata dall'AI (MECCANISMI §18 «Generazione», §19; T-027): quiz e flashcard dall'unità, validati (H5,
 * D-QUIZ-2) e salvati solo se qualcosa supera il controllo; il risultato del quiz, che spunta il criterio Go/No-Go
 * automatico del modulo (§11, D-QUIZ-1); le valutazioni SM-2 delle carte e il ripasso trasversale (I1); i dati della
 * Pratica di S20 (§20). Gli errori sono quelli di §18, più «vuota»: nessun elemento valido, nulla di salvato.
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, list, listBy, save } from '../data/repository';
import type { ErroreAi } from '../domain/ai';
import {
  criteriaAfterQuiz,
  generationPrompt,
  quizScore,
  validFlashcards,
  validQuiz,
  type DifficoltaPratica,
  type Quantita,
} from '../domain/generation';
import { dueCards, newCard, review, type RisultatoRipasso, type Valutazione } from '../domain/sm2';
import { generateFromScope, unitScope } from './ai';
import { logError } from './diagnostics';
import { recomputePointer } from './pointer';

export type TipoGenerabile = 'quiz' | 'flashcard';
export type EsitoGenerazione = { id: string } | { errore: ErroreAi | 'vuota' };

/** Genera dall'unità (S12 «Genera»): un quiz in `pratiche` o un mazzo di carte nuove; restituisce l'id da aprire. */
export async function generatePractice(
  db: RoutForgeDb,
  unitaId: string,
  tipo: TipoGenerabile,
  quantita: Quantita,
  difficolta: DifficoltaPratica | null,
  now: number,
): Promise<EsitoGenerazione> {
  const ambito = await unitScope(db, unitaId);
  if (!ambito) return { errore: 'generico' };
  const diff = tipo === 'quiz' ? difficolta : null;
  const r = await generateFromScope(db, ambito, generationPrompt(tipo, quantita, diff), new AbortController().signal);
  if ('errore' in r) return r;
  let grezzo: unknown = null;
  try {
    grezzo = JSON.parse(r.testo);
  } catch {
    // Non JSON: nessun elemento valido
  }
  // Al massimo la quantità chiesta (§18: 5–25), anche se il modello ne restituisce di più
  const domande = tipo === 'quiz' ? validQuiz(grezzo).slice(0, quantita) : [];
  const carte = tipo === 'flashcard' ? validFlashcards(grezzo).slice(0, quantita) : [];
  if (!domande.length && !carte.length) return { errore: 'vuota' };
  try {
    return await inTransaction(db, ['unita', 'pratiche', 'mazzi', 'carte'], async (): Promise<EsitoGenerazione> => {
      if (!(await get(db, 'unita', unitaId))) return { errore: 'generico' };
      if (tipo === 'quiz') {
        const parametri = { quantita, difficolta: diff };
        const p = await save(
          db,
          'pratiche',
          { unitaId, tipo, creataIl: now, parametri, elementi: domande, risultato: null },
          now,
        );
        return { id: p.id };
      }
      const m = await save(db, 'mazzi', { unitaId, creatoIl: now }, now);
      for (const c of carte) await save(db, 'carte', { ...c, ...newCard(now), mazzoId: m.id, valutazioni: [] }, now);
      return { id: m.id };
    });
  } catch (e) {
    logError('ai', e);
    return { errore: 'generico' };
  }
}

/** Dove tornare dalla pratica: l'unità col suo numero e il corso (S19 «Torna all'unità»). */
async function unitaDi(db: RoutForgeDb, unitaId: string) {
  const u = await get(db, 'unita', unitaId);
  return { unitaId, corsoId: u?.corsoId ?? null, numero: u?.numero ?? '' };
}

/**
 * Un quiz: l'unità, le domande validate di nuovo (una riga da un backup può essere malformata) e il risultato, se è
 * già stato fatto: allora si riapre sul punteggio (S12 «Recenti», D-QUIZ-4).
 */
export async function readQuiz(db: RoutForgeDb, praticaId: string) {
  const p = await get(db, 'pratiche', praticaId);
  const domande = p?.tipo === 'quiz' ? validQuiz(p.elementi ?? []) : [];
  if (!p || !domande.length) return undefined;
  return { id: p.id, ...(await unitaDi(db, p.unitaId)), domande, risultato: p.risultato ?? null };
}

/** Un mazzo dai Recenti di S12: l'unità e le sue carte scadute (§19: valutare una carta non scaduta falserebbe SM-2). */
export async function readDeckView(db: RoutForgeDb, mazzoId: string, now: number) {
  const m = await get(db, 'mazzi', mazzoId);
  if (!m) return undefined;
  const carte = await listBy(db, 'carte', 'mazzoId', mazzoId);
  return {
    ...(await unitaDi(db, m.unitaId)),
    carte: dueCards(
      carte.map((c) => ({ c, sm2: c })),
      now,
    ).map(({ c }) => carta(c)),
  };
}

/**
 * Il punteggio del quiz (§18 tabella) e, sopra la soglia, il criterio automatico del modulo (D-QUIZ-1): gli stati dei
 * moduli cambiano, quindi si ricalcola il puntatore del corso come per la spunta a mano (`setCriterion`). Conta il
 * primo risultato: rifare lo stesso quiz non lo cambia (D-QUIZ-4). Un errore di scrittura va in Diagnostica.
 */
export function saveQuizResult(
  db: RoutForgeDb,
  praticaId: string,
  esiti: readonly boolean[],
  now: number,
  fuso: string,
): Promise<void> {
  return inTransaction(db, ['pratiche', 'unita', 'moduli', 'blocchi'], async () => {
    const p = await get(db, 'pratiche', praticaId);
    if (!p || p.risultato) return;
    const punteggio = quizScore(esiti);
    const sbagliate = esiti.flatMap((ok, i) => (ok ? [] : [i]));
    await save(db, 'pratiche', { ...p, risultato: { ...punteggio, istante: now, sbagliate } }, now);
    const u = await get(db, 'unita', p.unitaId);
    const m = u ? await get(db, 'moduli', u.moduloId) : undefined;
    if (!m) return;
    const criteri = criteriaAfterQuiz(m.criteri, punteggio.giuste, punteggio.totali);
    if (criteri.every((c, i) => c === m.criteri[i])) return;
    await save(db, 'moduli', { ...m, criteri }, now);
    await recomputePointer(db, m.corsoId, now, fuso);
  }).catch((e: unknown) => logError('ai', e));
}

/** Una valutazione SM-2 (§19, I1): il nuovo stato della carta e la valutazione data, per S20. */
export async function gradeCard(
  db: RoutForgeDb,
  cartaId: string,
  valutazione: Valutazione,
  now: number,
): Promise<RisultatoRipasso | undefined> {
  try {
    return await inTransaction(db, ['carte'], async () => {
      const c = await get(db, 'carte', cartaId);
      if (!c) return undefined;
      const r = review(c, valutazione, now);
      const valutazioni = [...(c.valutazioni ?? []), { istante: now, valutazione }];
      await save(
        db,
        'carte',
        { ...c, facilita: r.facilita, intervalloGiorni: r.intervalloGiorni, scadenza: r.scadenza, valutazioni },
        now,
      );
      return r;
    });
  } catch (e) {
    logError('ai', e);
    return undefined;
  }
}

const carta = (c: Awaited<ReturnType<typeof list<'carte'>>>[number]) => ({
  id: c.id,
  fronte: c.fronte ?? '',
  retro: c.retro ?? '',
  citazione: c.citazione ?? '',
  ripassi: c.valutazioni?.length ?? 0,
  scadenza: c.scadenza,
});
export type CartaDaRipassare = ReturnType<typeof carta>;

/** Il ripasso trasversale (§19): le carte scadute di tutti i mazzi, dalle più scadute. */
export async function readDueCards(db: RoutForgeDb, now: number): Promise<CartaDaRipassare[]> {
  const carte = await list(db, 'carte');
  return dueCards(
    carte.map((c) => ({ c, sm2: c })),
    now,
  ).map(({ c }) => carta(c));
}

export type PraticaRecente =
  | {
      tipo: 'quiz';
      id: string;
      creataIl: number;
      domande: number;
      giuste: number | null;
      totali: number | null;
      percentuale: number | null;
    }
  | { tipo: 'flashcard'; id: string; creataIl: number; carte: number; dovute: number };

/** I «Recenti» della Pratica di S12: quiz col punteggio e mazzi con le carte dovute, dai più recenti. */
export async function readUnitPractice(db: RoutForgeDb, unitaId: string, now: number): Promise<PraticaRecente[]> {
  const quiz = (await listBy(db, 'pratiche', 'unitaId', unitaId))
    .filter((p) => p.tipo === 'quiz')
    .map((p): PraticaRecente => ({
      tipo: 'quiz',
      id: p.id,
      creataIl: p.creataIl,
      domande: p.elementi?.length ?? 0,
      giuste: p.risultato?.giuste ?? null,
      totali: p.risultato?.totali ?? null,
      percentuale: p.risultato?.percentuale ?? null,
    }));
  const mazzi = await Promise.all(
    (await listBy(db, 'mazzi', 'unitaId', unitaId)).map(async (m): Promise<PraticaRecente> => {
      const carte = await listBy(db, 'carte', 'mazzoId', m.id);
      return {
        tipo: 'flashcard',
        id: m.id,
        creataIl: m.creatoIl ?? m.createdAt,
        carte: carte.length,
        dovute: dueCards(
          carte.map((c) => ({ sm2: c })),
          now,
        ).length,
      };
    }),
  );
  return [...quiz, ...mazzi].sort((a, b) => b.creataIl - a.creataIl);
}

/**
 * La Pratica di S20 (§20): quiz = media delle percentuali dei quiz finiti nel periodo; flashcard = valutazioni date nel
 * periodo e carte scadute adesso. DevSwipe, Bug Hunter e Trivia arrivano con T-028.
 */
export async function readPracticeStats(db: RoutForgeDb, da: number, a: number, now: number) {
  const quiz = (await list(db, 'pratiche')).flatMap((p) =>
    p.tipo === 'quiz' && p.risultato && p.risultato.istante >= da && p.risultato.istante < a ? [p.risultato] : [],
  );
  const carte = await list(db, 'carte');
  return {
    quiz: quiz.length ? Math.round(quiz.reduce((x, r) => x + r.percentuale, 0) / quiz.length) : null,
    quizFatti: quiz.length,
    valutazioni: carte.reduce(
      (x, c) => x + (c.valutazioni ?? []).filter((v) => v.istante >= da && v.istante < a).length,
      0,
    ),
    scaduteOggi: dueCards(
      carte.map((c) => ({ sm2: c })),
      now,
    ).length,
  };
}
