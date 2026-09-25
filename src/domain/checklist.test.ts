import { describe, expect, it } from 'vitest';
import { afterToggle, toggleItem } from './checklist';
import type { VoceChecklist } from './types';

const voci = (...fatte: boolean[]): VoceChecklist[] => fatte.map((fatta, i) => ({ testo: `Voce ${i + 1}`, fatta }));

describe('Checklist che completa il todo — SCENARI A3', () => {
  it('spuntare le prime due non completa il todo (2/3); la terza lo completa', () => {
    const due = toggleItem(toggleItem(voci(false, false, false), 0), 1);
    expect(due.map((v) => v.fatta)).toEqual([true, true, false]);
    expect(afterToggle(due, 1, 'programmato')).toBeNull();
    const tre = toggleItem(due, 2);
    expect(afterToggle(tre, 2, 'programmato')).toBe('completa');
  });
  it('togliere la spunta a una voce riapre il todo completato', () => {
    const una = toggleItem(voci(true, true, true), 1);
    expect(una.map((v) => v.fatta)).toEqual([true, false, true]);
    expect(afterToggle(una, 1, 'completato')).toBe('riapri');
  });
});

describe('Checklist — MECCANISMI §4', () => {
  it('la spunta inverte solo quella voce e non muta la lista di partenza', () => {
    const prima = voci(false, true);
    const dopo = toggleItem(prima, 0);
    expect(dopo).toEqual(voci(true, true));
    expect(prima).toEqual(voci(false, true));
  });
  it('lista vuota non è «tutto fatto»; una spunta in più su un todo già completato non lo tocca', () => {
    expect(afterToggle([], 0, 'programmato')).toBeNull();
    expect(afterToggle(voci(true, true), 1, 'completato')).toBeNull();
    expect(afterToggle(voci(true, false, true), 0, 'completato')).toBeNull();
  });
});
