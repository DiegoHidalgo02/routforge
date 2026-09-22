/**
 * Ripetizione dilazionata delle flashcard (SM-2).
 * Fonte: RoutForge_MECCANISMI.md §19 — criterio di accettazione: SCENARI I1.
 *
 * | Valutazione | Facilità | Prossimo intervallo                          |
 * | Niente      | −0,20    | 10 minuti; la carta torna in coda            |
 * | Difficile   | −0,15    | max(1 g, intervallo × 1,2)                   |
 * | Bene        | 0        | max(1 g, intervallo × facilità)              |
 * | Facile      | +0,15    | max(1 g, intervallo × facilità × 1,3)        |
 *
 * Facilità iniziale 2,5, mai sotto 1,3; intervallo iniziale 0 (dovuta subito).
 * Decisione D-SM2-1: per "Facile" si usa la facilità GIÀ aggiornata (I1: 1 × 2,65 × 1,3).
 * Decisione D-SM2-2: "Niente" azzera l'intervallo (SM-2 canonico; la spec non lo dice).
 */
import { MINUTE } from './time';

export type Rating = 'niente' | 'difficile' | 'bene' | 'facile';

export interface CardSchedule {
  /** Fattore di facilità (E-Factor). */
  ease: number;
  /** Intervallo corrente in giorni (può essere frazionario). */
  intervalDays: number;
  /** Scadenza assoluta (epoch ms). */
  dueAt: number;
}

export interface ReviewResult extends CardSchedule {
  /** true = la carta va riproposta nella stessa sessione (solo "Niente"). */
  requeue: boolean;
}

export const EASE_INITIAL = 2.5;
export const EASE_MIN = 1.3;
export const NIENTE_DELAY_MS = 10 * MINUTE;
const DAY_MS = 24 * 60 * MINUTE;

/** Carta appena creata: dovuta subito. */
export function newCard(now: number): CardSchedule {
  return { ease: EASE_INITIAL, intervalDays: 0, dueAt: now };
}

const clampEase = (e: number): number => Math.max(EASE_MIN, Number(e.toFixed(4)));

export function review(card: CardSchedule, rating: Rating, now: number): ReviewResult {
  switch (rating) {
    case 'niente': {
      const ease = clampEase(card.ease - 0.2);
      return { ease, intervalDays: 0, dueAt: now + NIENTE_DELAY_MS, requeue: true };
    }
    case 'difficile': {
      const ease = clampEase(card.ease - 0.15);
      const intervalDays = Math.max(1, card.intervalDays * 1.2);
      return { ease, intervalDays, dueAt: now + intervalDays * DAY_MS, requeue: false };
    }
    case 'bene': {
      const ease = clampEase(card.ease);
      const intervalDays = Math.max(1, card.intervalDays * ease);
      return { ease, intervalDays, dueAt: now + intervalDays * DAY_MS, requeue: false };
    }
    case 'facile': {
      const ease = clampEase(card.ease + 0.15);
      const intervalDays = Math.max(1, card.intervalDays * ease * 1.3);
      return { ease, intervalDays, dueAt: now + intervalDays * DAY_MS, requeue: false };
    }
  }
}

/** Anteprima "prossima scadenza" mostrata accanto a ogni bottone (FUNZIONALITÀ §15). */
export function previewAll(card: CardSchedule, now: number): Record<Rating, number> {
  return {
    niente: review(card, 'niente', now).dueAt,
    difficile: review(card, 'difficile', now).dueAt,
    bene: review(card, 'bene', now).dueAt,
    facile: review(card, 'facile', now).dueAt,
  };
}

/** Ripasso trasversale: carte scadute (dueAt ≤ now), dalle più scadute (§19). */
export function dueCards<T extends { schedule: CardSchedule }>(cards: readonly T[], now: number): T[] {
  return cards
    .filter((c) => c.schedule.dueAt <= now)
    .sort((a, b) => a.schedule.dueAt - b.schedule.dueAt);
}
