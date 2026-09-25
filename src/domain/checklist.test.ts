import { describe, expect, it } from 'vitest';
import { validateActivity } from './activity';
import { afterToggle, inheritedDay, leftoverDraft, toggleItem } from './checklist';
import { local } from './time';
import type { Blocco, VoceChecklist } from './types';

const voci = (...fatte: boolean[]): VoceChecklist[] => fatte.map((fatta, i) => ({ testo: `Voce ${i + 1}`, fatta }));
/** Todo senza orario di mercoledì 23 settembre, orizzonte settimana, priorità alta. */
const valigia = (checklist: VoceChecklist[]): Blocco => ({
  id: 'todo-1',
  tipo: 'todo',
  stato: 'programmato',
  inizio: local(2026, 9, 23, 12, 0),
  fine: local(2026, 9, 23, 23, 59),
  conOrario: false,
  orizzonte: 'settimana',
  priorita: 'alta',
  titolo: 'Prepara la valigia',
  note: 'Max 8 kg',
  checklist,
  corsoId: null,
});

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

describe('Todo con le voci rimaste — D-DETT-2 (MECC §4, FUNZ §6)', () => {
  it('«Segna come fatto» con 2 voci su 4: la bozza ha titolo, note, priorità, orizzonte e giorno del todo, le voci non fatte come checklist, senza orario', () => {
    const bozza = leftoverDraft(valigia(voci(true, false, true, false)), local(2026, 9, 23, 18, 0));
    expect(bozza).toEqual({
      tipo: 'todo',
      titolo: 'Prepara la valigia',
      note: 'Max 8 kg',
      promemoria: { modo: 'auto' },
      giorno: '2026-09-23',
      orario: null,
      orizzonte: 'settimana',
      priorita: 'alta',
      checklist: ['Voce 2', 'Voce 4'],
      corsoId: null,
    });
    expect(bozza && validateActivity(bozza).ok).toBe(true);
  });
  it('tutte le voci fatte, o nessuna checklist: nessun todo da creare', () => {
    expect(leftoverDraft(valigia(voci(true, true)), local(2026, 9, 23, 18, 0))).toBeNull();
    expect(leftoverDraft(valigia([]), local(2026, 9, 23, 18, 0))).toBeNull();
  });
  it('la scadenza è quella del todo da cui nasce, mai prima di oggi: un todo di ieri segnato fatto oggi dà un todo per oggi', () => {
    expect(inheritedDay(local(2026, 9, 23, 12, 0), local(2026, 9, 23, 18, 0))).toBe('2026-09-23');
    expect(inheritedDay(local(2026, 9, 23, 12, 0), local(2026, 9, 25, 9, 0))).toBe('2026-09-25');
    expect(inheritedDay(local(2026, 9, 27, 0, 0), local(2026, 9, 25, 9, 0))).toBe('2026-09-27');
    const ieri = leftoverDraft(valigia(voci(false)), local(2026, 9, 25, 9, 0));
    expect(ieri?.tipo === 'todo' && ieri.giorno).toBe('2026-09-25');
  });
});
