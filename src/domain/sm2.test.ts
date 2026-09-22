import { describe, expect, it } from 'vitest';
import { dueCards, newCard, review, EASE_MIN, NIENTE_DELAY_MS } from './sm2';
import { local } from './time';

const DAY = 24 * 60 * 60 * 1000;

describe('SM-2 — SCENARI I1', () => {
  const now = local(2026, 9, 22, 10, 0);

  it('carta nuova: facilità 2,5, intervallo 0, dovuta subito', () => {
    const c = newCard(now);
    expect(c.ease).toBe(2.5);
    expect(c.intervalDays).toBe(0);
    expect(c.dueAt).toBe(now);
  });

  it('"Bene" → intervallo 1 g, facilità 2,5', () => {
    const r = review(newCard(now), 'bene', now);
    expect(r.intervalDays).toBe(1);
    expect(r.ease).toBe(2.5);
    expect(r.dueAt).toBe(now + DAY);
    expect(r.requeue).toBe(false);
  });

  it('poi "Facile" → intervallo max(1, 1 × 2,65 × 1,3) ≈ 3,4 g, facilità 2,65', () => {
    const afterBene = review(newCard(now), 'bene', now);
    const r = review(afterBene, 'facile', now);
    expect(r.ease).toBeCloseTo(2.65, 4);
    expect(r.intervalDays).toBeCloseTo(3.445, 3);
    expect(r.dueAt).toBeCloseTo(now + 3.445 * DAY, -3);
  });

  it('"Niente" → torna in coda nella stessa sessione, scadenza fra 10\', facilità 2,45', () => {
    const afterFacile = review(review(newCard(now), 'bene', now), 'facile', now);
    const r = review(afterFacile, 'niente', now);
    expect(r.requeue).toBe(true);
    expect(r.dueAt).toBe(now + NIENTE_DELAY_MS);
    expect(r.ease).toBeCloseTo(2.45, 4);
  });

  it('la facilità non scende mai sotto 1,3', () => {
    let c = newCard(now);
    for (let i = 0; i < 20; i++) c = review(c, 'niente', now);
    expect(c.ease).toBe(EASE_MIN);
  });

  it('"Difficile" → max(1 g, intervallo × 1,2)', () => {
    const c = { ease: 2.5, intervalDays: 10, dueAt: now };
    const r = review(c, 'difficile', now);
    expect(r.intervalDays).toBe(12);
    expect(r.ease).toBeCloseTo(2.35, 4);
  });
});

describe('Ripasso trasversale (§19)', () => {
  it('raccoglie le carte con scadenza ≤ adesso, dalle più scadute', () => {
    const now = local(2026, 9, 22, 10, 0);
    const cards = [
      { id: 'a', schedule: { ease: 2.5, intervalDays: 1, dueAt: now + DAY } },
      { id: 'b', schedule: { ease: 2.5, intervalDays: 1, dueAt: now - 2 * DAY } },
      { id: 'c', schedule: { ease: 2.5, intervalDays: 1, dueAt: now } },
      { id: 'd', schedule: { ease: 2.5, intervalDays: 1, dueAt: now - DAY } },
    ];
    expect(dueCards(cards, now).map((c) => c.id)).toEqual(['b', 'd', 'c']);
  });
});
