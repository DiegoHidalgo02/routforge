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

export type Valutazione = 'niente' | 'difficile' | 'bene' | 'facile';

export interface StatoCarta {
  /** Fattore di facilità (E-Factor). */
  facilita: number;
  /** Intervallo corrente in giorni (può essere frazionario). */
  intervalloGiorni: number;
  /** Scadenza assoluta (epoch ms). */
  scadenza: number;
}

export interface RisultatoRipasso extends StatoCarta {
  /** true = la carta va riproposta nella stessa sessione (solo "Niente"). */
  rimettiInCoda: boolean;
}

export const FACILITA_INIZIALE = 2.5;
export const FACILITA_MINIMA = 1.3;
export const INTERVALLO_NIENTE_MS = 10 * MINUTE;
const DAY_MS = 24 * 60 * MINUTE;

/** Carta appena creata: dovuta subito. */
export function newCard(now: number): StatoCarta {
  return { facilita: FACILITA_INIZIALE, intervalloGiorni: 0, scadenza: now };
}

const clampFacilita = (e: number): number => Math.max(FACILITA_MINIMA, Number(e.toFixed(4)));

export function review(card: StatoCarta, rating: Valutazione, now: number): RisultatoRipasso {
  switch (rating) {
    case 'niente': {
      const facilita = clampFacilita(card.facilita - 0.2);
      return { facilita, intervalloGiorni: 0, scadenza: now + INTERVALLO_NIENTE_MS, rimettiInCoda: true };
    }
    case 'difficile': {
      const facilita = clampFacilita(card.facilita - 0.15);
      const intervalloGiorni = Math.max(1, card.intervalloGiorni * 1.2);
      return { facilita, intervalloGiorni, scadenza: now + intervalloGiorni * DAY_MS, rimettiInCoda: false };
    }
    case 'bene': {
      const facilita = clampFacilita(card.facilita);
      const intervalloGiorni = Math.max(1, card.intervalloGiorni * facilita);
      return { facilita, intervalloGiorni, scadenza: now + intervalloGiorni * DAY_MS, rimettiInCoda: false };
    }
    case 'facile': {
      const facilita = clampFacilita(card.facilita + 0.15);
      const intervalloGiorni = Math.max(1, card.intervalloGiorni * facilita * 1.3);
      return { facilita, intervalloGiorni, scadenza: now + intervalloGiorni * DAY_MS, rimettiInCoda: false };
    }
  }
}

/** Ripasso trasversale: carte con scadenza ≤ adesso, dalle più scadute (§19). */
export function dueCards<T extends { sm2: StatoCarta }>(cards: readonly T[], now: number): T[] {
  return cards.filter((c) => c.sm2.scadenza <= now).sort((a, b) => a.sm2.scadenza - b.sm2.scadenza);
}
