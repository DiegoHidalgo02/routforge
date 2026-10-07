/**
 * La pratica generata dall'AI (MECCANISMI §18 «Generazione», §19; T-027, T-028): quiz, flashcard, DevSwipe, Bug Hunter
 * e Audio Flash-Trivia dall'unità, validati (H5, D-QUIZ-2) e salvati solo se qualcosa supera il controllo; il risultato,
 * che per il quiz spunta il criterio Go/No-Go automatico del modulo (§11, D-QUIZ-1); le valutazioni SM-2 delle carte e
 * il ripasso trasversale (I1); la voce della Trivia; i dati della Pratica di S20 (§20). Gli errori sono quelli di §18,
 * più «vuota»: nessun elemento valido, nulla di salvato.
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, list, listBy, save } from '../data/repository';
import type { ErroreAi } from '../domain/ai';
import {
  criteriaAfterQuiz,
  generationPrompt,
  PAUSA_TRIVIA_MS,
  practiceResult,
  QUANTITA,
  quizScore,
  triviaLanguage,
  triviaReturning,
  validBugHunter,
  validDevSwipe,
  validFlashcards,
  validQuiz,
  validTrivia,
  type DifficoltaPratica,
  type ElementoTrivia,
  type Quantita,
  type RispostePratica,
  type RisultatoPratica,
  type TipoPratica,
} from '../domain/generation';
import { dueCards, newCard, review, type RisultatoRipasso, type Valutazione } from '../domain/sm2';
import { generateFromScope, unitScope } from './ai';
import { logError } from './diagnostics';
import { recomputePointer } from './pointer';
import type { EventiVoce, Voce } from './ports/voice';

export type EsitoGenerazione = { id: string } | { errore: ErroreAi | 'vuota' };

const VALIDA: Record<Exclude<TipoPratica, 'flashcard'>, (grezzo: unknown) => unknown[]> = {
  quiz: validQuiz,
  devswipe: validDevSwipe,
  bughunter: validBugHunter,
  trivia: validTrivia,
};

/** Le playlist della Trivia sull'unità, coi risultati: il dominio sceglie da quale tornano le sbagliate (I4). */
const playlistOf = async (db: RoutForgeDb, unitaId: string) =>
  (await listBy(db, 'pratiche', 'unitaId', unitaId)).flatMap((p) =>
    p.tipo === 'trivia' ? [{ elementi: validTrivia(p.elementi ?? []), risultato: p.risultato ?? null }] : [],
  );

/**
 * Genera dall'unità (S12 «Genera»): una pratica in `pratiche` o un mazzo di carte nuove; restituisce l'id da aprire. La
 * difficoltà vale dove S12 la mostra (non per flashcard e Trivia); la Trivia aggiunge in coda le sbagliate della playlist
 * completata prima, una volta (I4), e la lingua della voce.
 */
export async function generatePractice(
  db: RoutForgeDb,
  unitaId: string,
  tipo: TipoPratica,
  quantita: Quantita,
  difficolta: DifficoltaPratica | null,
  now: number,
): Promise<EsitoGenerazione> {
  const ambito = await unitScope(db, unitaId);
  if (!ambito) return { errore: 'generico' };
  const diff = tipo === 'flashcard' || tipo === 'trivia' ? null : difficolta;
  const r = await generateFromScope(db, ambito, generationPrompt(tipo, quantita, diff), new AbortController().signal);
  if ('errore' in r) return r;
  let grezzo: unknown = null;
  try {
    grezzo = JSON.parse(r.testo);
  } catch {
    // Non JSON: nessun elemento valido
  }
  // Al massimo la quantità chiesta (§18: 5–25), anche se il modello ne restituisce di più
  const carte = tipo === 'flashcard' ? validFlashcards(grezzo).slice(0, quantita) : [];
  const elementi = tipo === 'flashcard' ? carte : VALIDA[tipo](grezzo).slice(0, quantita);
  if (!elementi.length) return { errore: 'vuota' };
  try {
    return await inTransaction(db, ['unita', 'pratiche', 'mazzi', 'carte'], async (): Promise<EsitoGenerazione> => {
      if (!(await get(db, 'unita', unitaId))) return { errore: 'generico' };
      if (tipo === 'flashcard') {
        const m = await save(db, 'mazzi', { unitaId, creatoIl: now }, now);
        for (const c of carte) await save(db, 'carte', { ...c, ...newCard(now), mazzoId: m.id, valutazioni: [] }, now);
        return { id: m.id };
      }
      const tornano = tipo === 'trivia' ? triviaReturning(await playlistOf(db, unitaId)) : [];
      const p = await save(
        db,
        'pratiche',
        {
          unitaId,
          tipo,
          creataIl: now,
          parametri: { quantita, difficolta: diff },
          elementi: [...elementi, ...tornano],
          risultato: null,
          lingua: tipo === 'trivia' ? triviaLanguage(grezzo) : null,
        },
        now,
      );
      return { id: p.id };
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
 * Una pratica da fare o da rivedere (S19): l'unità, gli elementi validati di nuovo (una riga da un backup può essere
 * malformata), i parametri per «Rifai la pratica» e il risultato, se è già stata fatta: allora si riapre sul riepilogo
 * (S12 «Recenti», D-QUIZ-4). Senza elementi validi: `undefined`.
 */
export async function readPractice(db: RoutForgeDb, praticaId: string) {
  const p = await get(db, 'pratiche', praticaId);
  if (!p) return undefined;
  const n = p.parametri?.quantita ?? 10;
  const base = {
    id: p.id,
    ...(await unitaDi(db, p.unitaId)),
    parametri: {
      quantita: (QUANTITA as readonly number[]).includes(n) ? (n as Quantita) : 10,
      difficolta: p.parametri?.difficolta ?? null,
    },
    risultato: p.risultato ?? null,
  };
  const g = p.elementi ?? [];
  const aperta =
    p.tipo === 'quiz'
      ? { ...base, tipo: 'quiz' as const, elementi: validQuiz(g) }
      : p.tipo === 'devswipe'
        ? { ...base, tipo: 'devswipe' as const, elementi: validDevSwipe(g) }
        : p.tipo === 'bughunter'
          ? { ...base, tipo: 'bughunter' as const, elementi: validBugHunter(g) }
          : p.tipo === 'trivia'
            ? { ...base, tipo: 'trivia' as const, elementi: validTrivia(g), lingua: p.lingua ?? null }
            : undefined;
  return aperta?.elementi.length ? aperta : undefined;
}
export type PraticaAperta = NonNullable<Awaited<ReturnType<typeof readPractice>>>;

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

/**
 * Il risultato di DevSwipe, Bug Hunter o Trivia alla fine della pratica (§18; I2–I4): punteggio e sbagliate li calcola
 * il dominio (`practiceResult`); conta il primo, come per il quiz (D-QUIZ-4). Restituisce il risultato salvato, per il
 * riepilogo; un errore di scrittura va in Diagnostica.
 */
export async function savePracticeResult(
  db: RoutForgeDb,
  praticaId: string,
  risposte: RispostePratica,
  now: number,
): Promise<RisultatoPratica | null> {
  try {
    return await inTransaction(db, ['pratiche'], async () => {
      const p = await get(db, 'pratiche', praticaId);
      if (!p || p.tipo !== risposte.tipo) return null;
      if (p.risultato) return p.risultato;
      const risultato = { ...practiceResult(p.elementi ?? [], risposte), istante: now };
      await save(db, 'pratiche', { ...p, risultato }, now);
      return risultato;
    });
  } catch (e) {
    logError('ai', e);
    return null;
  }
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
      tipo: Exclude<TipoPratica, 'flashcard'>;
      id: string;
      creataIl: number;
      elementi: number;
      giuste: number | null;
      totali: number | null;
      percentuale: number | null;
    }
  | { tipo: 'flashcard'; id: string; creataIl: number; carte: number; dovute: number };

/** I «Recenti» della Pratica di S12: le pratiche col punteggio e i mazzi con le carte dovute, dai più recenti. */
export async function readUnitPractice(db: RoutForgeDb, unitaId: string, now: number): Promise<PraticaRecente[]> {
  const pratiche = (await listBy(db, 'pratiche', 'unitaId', unitaId)).flatMap((p): PraticaRecente[] =>
    p.tipo === 'quiz' || p.tipo === 'devswipe' || p.tipo === 'bughunter' || p.tipo === 'trivia'
      ? [
          {
            tipo: p.tipo,
            id: p.id,
            creataIl: p.creataIl,
            elementi: p.elementi?.length ?? 0,
            giuste: p.risultato?.giuste ?? null,
            totali: p.risultato?.totali ?? null,
            percentuale: p.risultato?.percentuale ?? null,
          },
        ]
      : [],
  );
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
  return [...pratiche, ...mazzi].sort((a, b) => b.creataIl - a.creataIl);
}

/**
 * La Pratica di S20 (§20): quiz = media delle percentuali dei quiz finiti nel periodo; DevSwipe e Bug Hunter = media dei
 * punteggi; Trivia = playlist completate; flashcard = valutazioni date nel periodo e carte scadute adesso.
 */
export async function readPracticeStats(db: RoutForgeDb, da: number, a: number, now: number) {
  const pratiche = await list(db, 'pratiche');
  const finite = (tipo: TipoPratica) =>
    pratiche.flatMap((p) =>
      p.tipo === tipo && p.risultato && p.risultato.istante >= da && p.risultato.istante < a ? [p.risultato] : [],
    );
  const media = (r: RisultatoPratica[]) =>
    r.length ? Math.round(r.reduce((x, y) => x + y.percentuale, 0) / r.length) : null;
  const [quiz, devswipe, bughunter] = [finite('quiz'), finite('devswipe'), finite('bughunter')];
  const carte = await list(db, 'carte');
  return {
    quiz: media(quiz),
    quizFatti: quiz.length,
    devswipe: media(devswipe),
    devswipeFatti: devswipe.length,
    bughunter: media(bughunter),
    bughunterFatti: bughunter.length,
    trivia: finite('trivia').length,
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

let voce: Voce | null = null;
/** La voce del dispositivo per la Trivia (main.tsx; porta `Voce`): null dove manca, e la Trivia lo dice. */
export const configureVoice = (v: Voce | null): void => {
  voce = v;
};
export const hasVoice = (): boolean => voce !== null;

/**
 * Legge la playlist da un elemento in poi (§18 Trivia): domanda, 5 s di silenzio, spiegazione, il successivo, senza
 * tocchi. Una voce che manca o non parla arriva come `errore`, registrato in Diagnostica; la lettura si ferma, così la
 * coda del motore non va avanti da sola fino a salvare una playlist non ascoltata.
 */
export function readAloud(
  elementi: readonly ElementoTrivia[],
  da: number,
  lingua: string | null,
  eventi: EventiVoce,
): void {
  const errore = () => {
    logError('dispositivo', new Error('lettura vocale non riuscita'));
    void voce?.ferma();
    eventi.errore();
  };
  if (!voce) return errore();
  void voce.leggi(elementi, da, lingua, PAUSA_TRIVIA_MS, { ...eventi, errore });
}

/** Ferma la lettura (pausa, salta, stop, uscita): dopo, nessun evento. */
export const stopReading = (): void => void voce?.ferma();
