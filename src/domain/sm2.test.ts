import { describe, expect, it } from 'vitest';
import { dueCards, newCard, review, EASE_MIN, NIENTE_DELAY_MS } from './sm2';
import { local } from './time';

const DAY = 24 * 60 * 60 * 1000;

describe('SM-2 — SCENARI I1', () => {
  const now = local(2026, 9, 22, 10, 0);

  it('carta nuova: facilità 2,5, intervallo 0, dovuta subito', () => {
    const c = newCard(now);
    expect(c.facilita).toBe(2.5);
    expect(c.intervalloGiorni).toBe(0);
    expect(c.scadenza).toBe(now);
  });

  it('"Bene" → intervallo 1 g, facilità 2,5', () => {
    const r = review(newCard(now), 'bene', now);
    expect(r.intervalloGiorni).toBe(1);
    expect(r.facilita).toBe(2.5);
    expect(r.scadenza).toBe(now + DAY);
    expect(r.rimettiInCoda).toBe(false);
  });

  it('poi "Facile" → intervallo max(1, 1 × 2,65 × 1,3) ≈ 3,4 g, facilità 2,65', () => {
    const afterBene = review(newCard(now), 'bene', now);
    const r = review(afterBene, 'facile', now);
    expect(r.facilita).toBeCloseTo(2.65, 4);
    expect(r.intervalloGiorni).toBeCloseTo(3.445, 3);
    expect(r.scadenza).toBeCloseTo(now + 3.445 * DAY, -3);
  });

  it('"Niente" → torna in coda nella stessa sessione, scadenza fra 10\', facilità 2,45', () => {
    const afterFacile = review(review(newCard(now), 'bene', now), 'facile', now);
    const r = review(afterFacile, 'niente', now);
    expect(r.rimettiInCoda).toBe(true);
    expect(r.scadenza).toBe(now + NIENTE_DELAY_MS);
    expect(r.facilita).toBeCloseTo(2.45, 4);
  });

  it('la facilità non scende mai sotto 1,3', () => {
    let c = newCard(now);
    for (let i = 0; i < 20; i++) c = review(c, 'niente', now);
    expect(c.facilita).toBe(EASE_MIN);
  });

  it('"Difficile" → max(1 g, intervallo × 1,2)', () => {
    const c = { facilita: 2.5, intervalloGiorni: 10, scadenza: now };
    const r = review(c, 'difficile', now);
    expect(r.intervalloGiorni).toBe(12);
    expect(r.facilita).toBeCloseTo(2.35, 4);
  });
});

describe('Ripasso trasversale (§19)', () => {
  it('raccoglie le carte con scadenza ≤ adesso, dalle più scadute', () => {
    const now = local(2026, 9, 22, 10, 0);
    const cards = [
      { id: 'a', schedule: { facilita: 2.5, intervalloGiorni: 1, scadenza: now + DAY } },
      { id: 'b', schedule: { facilita: 2.5, intervalloGiorni: 1, scadenza: now - 2 * DAY } },
      { id: 'c', schedule: { facilita: 2.5, intervalloGiorni: 1, scadenza: now } },
      { id: 'd', schedule: { facilita: 2.5, intervalloGiorni: 1, scadenza: now - DAY } },
    ];
    expect(dueCards(cards, now).map((c) => c.id)).toEqual(['b', 'd', 'c']);
  });
});
