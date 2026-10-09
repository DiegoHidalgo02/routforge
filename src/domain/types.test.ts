import { describe, expect, it } from 'vitest';
import { isOpen, STATI_TERMINALI, type StatoBlocco } from './types';

describe('Stati del blocco aperti e terminali — MECCANISMI §1 (audit P3-13)', () => {
  it('aperti solo programmato e in corso; gli altri cinque sono terminali, in una sola regola', () => {
    const stati: StatoBlocco[] = ['programmato', 'in_corso', 'completato', 'parziale', 'indietro', 'saltato', 'perso'];
    expect(stati.filter(isOpen)).toEqual(['programmato', 'in_corso']);
    expect([...STATI_TERMINALI].sort()).toEqual(stati.filter((s) => !isOpen(s)).sort());
  });
});
