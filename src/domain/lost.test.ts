import { describe, expect, it } from 'vitest';
import {
  canCheckRoutine,
  horizonLastDay,
  lostAtInstant,
  pendingOutcomes,
  recoveryDeadline,
  shouldMarkLost,
} from './lost';
import { local, localDayKey } from './time';
import type { Block } from './types';

const block = (over: Partial<Block>): Block => ({
  id: 'x',
  kind: 'routine',
  state: 'programmato',
  start: local(2026, 9, 23, 7, 0), // mercoledì
  end: local(2026, 9, 23, 8, 0),
  hasTime: true,
  ...over,
});

describe('Persi — SCENARI B2 (routine 07:00–08:00 di mercoledì)', () => {
  const b = block({});
  it('non è persa alle 08:29, lo è dalle 08:30 (fine + 30\')', () => {
    expect(shouldMarkLost(b, local(2026, 9, 23, 8, 29))).toBe(false);
    expect(shouldMarkLost(b, local(2026, 9, 23, 8, 31))).toBe(true);
    expect(lostAtInstant(b)).toBe(local(2026, 9, 23, 8, 30));
  });
  it('spuntabile solo mercoledì (né martedì né giovedì)', () => {
    expect(canCheckRoutine(b, local(2026, 9, 22, 12, 0))).toBe(false);
    expect(canCheckRoutine(b, local(2026, 9, 23, 0, 0))).toBe(true);
    expect(canCheckRoutine(b, local(2026, 9, 23, 23, 59))).toBe(true);
    expect(canCheckRoutine(b, local(2026, 9, 24, 12, 0))).toBe(false);
  });
});

describe('Routine notturna — SCENARI B3 (sabato 23:00 → domenica 01:00)', () => {
  const b = block({ start: local(2026, 9, 26, 23, 0), end: local(2026, 9, 27, 1, 0) });
  it('domenica alle 00:30 è ancora spuntabile; persa da domenica 01:30', () => {
    expect(canCheckRoutine(b, local(2026, 9, 27, 0, 30))).toBe(true);
    expect(shouldMarkLost(b, local(2026, 9, 27, 1, 29))).toBe(false);
    expect(shouldMarkLost(b, local(2026, 9, 27, 1, 31))).toBe(true);
  });
});

describe('Routine senza durata — SCENARI B4 (07:00, senza fine)', () => {
  const b = block({ end: null });
  it('verifica a inizio + 30\'; persa alle 00:29 del giorno dopo', () => {
    expect(recoveryDeadline(b)).toBe(local(2026, 9, 23, 7, 30));
    expect(lostAtInstant(b)).toBe(local(2026, 9, 24, 0, 29));
    expect(shouldMarkLost(b, local(2026, 9, 23, 23, 0))).toBe(false);
    expect(shouldMarkLost(b, local(2026, 9, 24, 0, 30))).toBe(true);
  });
  it('spuntabile tutto il giorno previsto', () => {
    expect(canCheckRoutine(b, local(2026, 9, 23, 22, 0))).toBe(true);
  });
});

describe('Verifica e recupero — SCENARI B7 (18:00–20:00)', () => {
  const b = block({ start: local(2026, 9, 23, 18, 0), end: local(2026, 9, 23, 20, 0) });
  it('la scadenza di recupero è a metà durata (19:00) e la marcatura persa alle 20:30', () => {
    expect(recoveryDeadline(b)).toBe(local(2026, 9, 23, 19, 0));
    expect(lostAtInstant(b)).toBe(local(2026, 9, 23, 20, 30));
  });
});

describe('Todo — SCENARI A1 / A2 (orizzonte)', () => {
  it('A1: todo senza orario, orizzonte giorno → "non fatto" dalle 00:30 del giorno dopo', () => {
    const t = block({
      kind: 'todo',
      hasTime: false,
      horizon: 'giorno',
      start: local(2026, 9, 23, 12, 0),
      end: null,
    });
    expect(shouldMarkLost(t, local(2026, 9, 23, 23, 50))).toBe(false);
    expect(shouldMarkLost(t, local(2026, 9, 24, 0, 30))).toBe(true);
  });

  it('A2: todo con orizzonte settimana ancora in corso NON diventa perso (rotola)', () => {
    const t = block({
      kind: 'todo',
      horizon: 'settimana',
      start: local(2026, 9, 22, 18, 0), // martedì
      end: local(2026, 9, 22, 18, 30),
    });
    expect(shouldMarkLost(t, local(2026, 9, 23, 9, 0))).toBe(false); // mercoledì: rotola
    expect(shouldMarkLost(t, local(2026, 9, 28, 9, 0))).toBe(true); // lunedì dopo: orizzonte scaduto
  });

  it('orizzonte: settimana → domenica; mese → ultimo giorno del mese', () => {
    const tue = local(2026, 9, 22, 10, 0);
    expect(localDayKey(horizonLastDay(tue, 'giorno'))).toBe('2026-09-22');
    expect(localDayKey(horizonLastDay(tue, 'settimana'))).toBe('2026-09-27');
    expect(localDayKey(horizonLastDay(tue, 'mese'))).toBe('2026-09-30');
    expect(localDayKey(horizonLastDay(local(2026, 9, 27, 10, 0), 'settimana'))).toBe('2026-09-27'); // domenica resta domenica
  });
});

describe('Eventi — SCENARI E2', () => {
  it('un evento non viene mai marcato perso', () => {
    const e = block({ kind: 'evento', start: local(2026, 9, 25, 15, 0), end: local(2026, 9, 25, 16, 0) });
    expect(shouldMarkLost(e, local(2026, 9, 26, 12, 0))).toBe(false);
  });
});

describe('Esiti pendenti — SCENARI C6 / §8', () => {
  it('blocchi di studio persi negli ultimi 3 giorni, dal più recente, massimo 5', () => {
    const now = local(2026, 9, 25, 12, 0);
    const mk = (id: string, day: number, over: Partial<Block> = {}): Block =>
      block({
        id,
        kind: 'studio',
        state: 'perso',
        start: local(2026, 9, day, 9, 0),
        end: local(2026, 9, day, 10, 0),
        lostAt: local(2026, 9, day, 10, 30),
        ...over,
      });
    const list = [
      mk('old', 20), // > 3 giorni: escluso
      mk('a', 24),
      mk('b', 23),
      mk('c', 22),
      mk('r', 25, { state: 'programmato', lostAt: null }), // programmato con fine passata: incluso
      mk('done', 24, { state: 'completato' }), // escluso
      mk('rt', 24, { kind: 'routine' }), // non studio: escluso
    ];
    expect(pendingOutcomes(list, now).map((b) => b.id)).toEqual(['r', 'a', 'b', 'c']);
  });
});
