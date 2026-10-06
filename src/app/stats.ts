/**
 * Statistiche (S20; MECC §20, §12; T-029): legge blocchi, sessioni chiuse, log delle fasi, streak, unità e corsi e
 * calcola le schede con le definizioni di `domain/stats.ts` (D-STATS-1). Panoramica: focus col delta sul periodo
 * precedente e le barre per settimana, costanza (streak e record), sessioni e focus medio, disciplina globale col delta e
 * per tipo, giorni con attività con la mappa di calore, avanzamento per corso. Comportamenti, verifica di metà durata
 * (trigger) e Studio come nel dominio; le ultime unità studiate con numero, titolo e stato.
 */
import type { RoutForgeDb } from '../data/db';
import { list } from '../data/repository';
import {
  activityMap,
  behaviourStats,
  discipline,
  focusMinutes,
  longestStreak,
  periodRange,
  previousRange,
  sessionCount,
  statsEmpty,
  studyStats,
  triggerResponse,
  weeklyFocus,
  type Periodo,
} from '../domain/stats';
import { courseCards, type SchedaCorso } from './courses';
import { readStreak } from './outcome';

export interface Panoramica {
  focus: number;
  /** Focus del periodo precedente di pari durata; `null` per «tutto». */
  focusPrima: number | null;
  barre: { settimana: number; minuti: number }[];
  costanza: { attuale: number; record: number };
  sessioni: { numero: number; media: number };
  disciplina: ReturnType<typeof discipline>;
  disciplinaPrima: number | null;
  attivita: ReturnType<typeof activityMap>;
  corsi: SchedaCorso[];
}

/** Le ultime unità studiate nel periodo mostrate in Studio (S20 «Ultime unità»). */
export const ULTIME_UNITA = 6;

export async function readStats(db: RoutForgeDb, periodo: Periodo, now: number) {
  const [blocchi, sessioni, logFasi, ricorrenze, unita, attuale, corsi] = await Promise.all([
    list(db, 'blocchi'),
    list(db, 'sessioni'),
    list(db, 'logFasi'),
    list(db, 'ricorrenze'),
    list(db, 'unita'),
    readStreak(db, now),
    courseCards(db),
  ]);
  const r = periodRange(periodo, now);
  const p = previousRange(periodo, now);
  const studio = studyStats(blocchi, sessioni, r);
  const perId = new Map(unita.map((u) => [u.id, u]));
  const panoramica: Panoramica = {
    focus: focusMinutes(sessioni, blocchi, r),
    focusPrima: p ? focusMinutes(sessioni, blocchi, p) : null,
    barre: weeklyFocus(sessioni, blocchi, r),
    costanza: { attuale, record: longestStreak(blocchi, attuale) },
    sessioni: sessionCount(sessioni, r),
    disciplina: discipline(blocchi, r),
    disciplinaPrima: p ? discipline(blocchi, p).globale : null,
    attivita: activityMap(blocchi, now),
    corsi,
  };
  return {
    /** Ancora nessuna sessione e nessun blocco giudicato, in tutto (S20 `empty`: «dopo la prima sessione…»). */
    vuoto: statsEmpty(sessioni, blocchi),
    panoramica,
    comportamenti: behaviourStats(blocchi, sessioni, logFasi, ricorrenze, periodo, now),
    trigger: triggerResponse(blocchi, r, now),
    studio: {
      ...studio,
      unita: studio.unita
        .flatMap((x) => {
          const u = perId.get(x.unitaId);
          return u ? [{ ...x, numero: u.numero, titolo: u.titolo, completata: u.stato === 'completata' }] : [];
        })
        .slice(0, ULTIME_UNITA),
    },
  };
}

export type Statistiche = Awaited<ReturnType<typeof readStats>>;
