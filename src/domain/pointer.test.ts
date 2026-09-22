import { describe, expect, it } from 'vitest';
import {
  applyOutcome,
  assignPointer,
  courseProgress,
  currentUnit,
  partialProgress,
  previousUnitInPath,
  type UnitRef,
} from './pointer';
import { local } from './time';

const unit = (id: string, moduleOrder: number, order: number): UnitRef => ({
  id,
  moduleOrder,
  order,
  state: 'non_iniziata',
  minutes: 0,
  progress: 0,
});

/** Corso di C1: unità 1.1, 1.2, 2.1. */
const course = () => [unit('1.1', 1, 1), unit('1.2', 1, 2), unit('2.1', 2, 1)];

/** Routine lun–ven 09:00: quattro occorrenze future. */
const blocks = [
  { id: 'b1', start: local(2026, 9, 23, 9) },
  { id: 'b2', start: local(2026, 9, 24, 9) },
  { id: 'b3', start: local(2026, 9, 25, 9) },
  { id: 'b4', start: local(2026, 9, 28, 9) },
];

describe('Puntatore — SCENARI C1', () => {
  it('le occorrenze future puntano, in ordine, a 1.1, 1.2, 2.1, poi a nessuna unità', () => {
    const map = assignPointer(course(), blocks);
    expect([...map.values()]).toEqual(['1.1', '1.2', '2.1', null]);
    expect(currentUnit(course())?.id).toBe('1.1');
  });

  it('i blocchi sono ordinati cronologicamente anche se passati in disordine', () => {
    const map = assignPointer(course(), [blocks[2]!, blocks[0]!, blocks[1]!]);
    expect(map.get('b1')).toBe('1.1');
    expect(map.get('b2')).toBe('1.2');
    expect(map.get('b3')).toBe('2.1');
  });
});

describe('Esiti — SCENARI C3', () => {
  it('Completata su 1.1 → 1.1 completata, domani punta a 1.2, progresso corso 1/3', () => {
    const r = applyOutcome({ units: course(), plannedUnitId: '1.1', outcome: 'completata', minutes: 60 });
    expect(r.blockState).toBe('completato');
    expect(r.units.find((u) => u.id === '1.1')?.state).toBe('completata');
    expect(currentUnit(r.units)?.id).toBe('1.2');
    expect(courseProgress(r.units)).toEqual({ completed: 1, total: 3, ratio: 1 / 3 });
  });

  it('poi Indietro su 1.2 → 1.1 torna da rivedere ed è di nuovo la prossima; 1.2 resta non iniziata', () => {
    const step1 = applyOutcome({ units: course(), plannedUnitId: '1.1', outcome: 'completata', minutes: 60 });
    const prev = previousUnitInPath(step1.units, '1.2');
    expect(prev?.id).toBe('1.1');
    const step2 = applyOutcome({
      units: step1.units,
      plannedUnitId: '1.2',
      outcome: 'indietro',
      minutes: 30,
      previousUnitId: prev?.id,
    });
    expect(step2.blockState).toBe('indietro');
    expect(step2.units.find((u) => u.id === '1.1')?.state).toBe('da_rivedere');
    expect(step2.units.find((u) => u.id === '1.2')?.state).toBe('non_iniziata');
    expect(currentUnit(step2.units)?.id).toBe('1.1');
  });

  it('poi Salta su 1.1 → 1.1 saltata, esce dal percorso; prossima = 1.2', () => {
    let units = applyOutcome({ units: course(), plannedUnitId: '1.1', outcome: 'completata', minutes: 60 }).units;
    units = applyOutcome({ units, plannedUnitId: '1.2', outcome: 'indietro', minutes: 30, previousUnitId: '1.1' }).units;
    const r = applyOutcome({ units, plannedUnitId: '1.1', outcome: 'salta', minutes: 0 });
    expect(r.blockState).toBe('saltato');
    expect(r.units.find((u) => u.id === '1.1')?.state).toBe('saltata');
    expect(currentUnit(r.units)?.id).toBe('1.2');
  });
});

describe('Continua — SCENARI C2', () => {
  it('45 minuti senza ore stimate → parziale, progresso = min(0,95; 45/180)', () => {
    const r = applyOutcome({ units: course(), plannedUnitId: '1.1', outcome: 'continua', minutes: 45 });
    const u = r.units.find((x) => x.id === '1.1')!;
    expect(r.blockState).toBe('parziale');
    expect(u.state).toBe('parziale');
    expect(u.minutes).toBe(45);
    expect(u.progress).toBeCloseTo(45 / 180, 6);
    expect(currentUnit(r.units)?.id).toBe('1.1'); // domani punta ancora a 1.1
  });

  it('il progresso parziale non supera 0,95 e usa le ore stimate quando ci sono', () => {
    expect(partialProgress(1000)).toBe(0.95);
    expect(partialProgress(60, 2)).toBe(0.5);
  });
});

describe('Moduli bloccati — FORMATO_CORSO §4 (decisione D-PTR-1)', () => {
  it('il puntatore non entra in un modulo bloccato', () => {
    const modules = [
      { order: 1, criteriaAllMet: false },
      { order: 2, criteriaAllMet: true },
    ];
    const map = assignPointer(course(), blocks, modules);
    expect([...map.values()]).toEqual(['1.1', '1.2', null, null]);
  });

  it('con i criteri del modulo 1 tutti a sì, il modulo 2 si apre', () => {
    const modules = [
      { order: 1, criteriaAllMet: true },
      { order: 2, criteriaAllMet: false },
    ];
    const map = assignPointer(course(), blocks, modules);
    expect([...map.values()]).toEqual(['1.1', '1.2', '2.1', null]);
  });
});
