import { describe, expect, it } from 'vitest';
import {
  applyOutcome,
  assignPointer,
  courseProgress,
  currentUnit,
  partialProgress,
  previousUnitInPath,
  statiModuli,
  type UnitaPercorso,
} from './pointer';
import { local } from './time';

const unit = (id: string, moduloNumero: number, ordine: number): UnitaPercorso => ({
  id,
  moduloNumero,
  ordine,
  stato: 'non_iniziata',
  minuti: 0,
  progresso: 0,
});

/** Corso di C1: unità 1.1, 1.2, 2.1. */
const course = () => [unit('1.1', 1, 1), unit('1.2', 1, 2), unit('2.1', 2, 1)];

/** Routine lun–ven 09:00: quattro occorrenze future. */
const blocks = [
  { id: 'b1', inizio: local(2026, 9, 23, 9) },
  { id: 'b2', inizio: local(2026, 9, 24, 9) },
  { id: 'b3', inizio: local(2026, 9, 25, 9) },
  { id: 'b4', inizio: local(2026, 9, 28, 9) },
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
    const r = applyOutcome({ unita: course(), unitaPianificataId: '1.1', esito: 'completata', minuti: 60 });
    expect(r.statoBlocco).toBe('completato');
    expect(r.unita.find((u) => u.id === '1.1')?.stato).toBe('completata');
    expect(currentUnit(r.unita)?.id).toBe('1.2');
    expect(courseProgress(r.unita)).toEqual({ completate: 1, totali: 3, rapporto: 1 / 3 });
  });

  it('poi Indietro su 1.2 → 1.1 torna da rivedere ed è di nuovo la prossima; 1.2 resta non iniziata', () => {
    const step1 = applyOutcome({ unita: course(), unitaPianificataId: '1.1', esito: 'completata', minuti: 60 });
    const prev = previousUnitInPath(step1.unita, '1.2');
    expect(prev?.id).toBe('1.1');
    const step2 = applyOutcome({
      unita: step1.unita,
      unitaPianificataId: '1.2',
      esito: 'indietro',
      minuti: 30,
      unitaPrecedenteId: prev?.id,
    });
    expect(step2.statoBlocco).toBe('indietro');
    expect(step2.unita.find((u) => u.id === '1.1')?.stato).toBe('da_rivedere');
    expect(step2.unita.find((u) => u.id === '1.2')?.stato).toBe('non_iniziata');
    expect(currentUnit(step2.unita)?.id).toBe('1.1');
  });

  it('poi Salta su 1.1 → 1.1 saltata, esce dal percorso; prossima = 1.2', () => {
    let unita = applyOutcome({ unita: course(), unitaPianificataId: '1.1', esito: 'completata', minuti: 60 }).unita;
    unita = applyOutcome({ unita, unitaPianificataId: '1.2', esito: 'indietro', minuti: 30, unitaPrecedenteId: '1.1' }).unita;
    const r = applyOutcome({ unita, unitaPianificataId: '1.1', esito: 'salta', minuti: 0 });
    expect(r.statoBlocco).toBe('saltato');
    expect(r.unita.find((u) => u.id === '1.1')?.stato).toBe('saltata');
    expect(currentUnit(r.unita)?.id).toBe('1.2');
  });
});

describe('Continua — SCENARI C2', () => {
  it('45 minuti senza ore stimate → parziale, progresso = min(0,95; 45/180)', () => {
    const r = applyOutcome({ unita: course(), unitaPianificataId: '1.1', esito: 'continua', minuti: 45 });
    const u = r.unita.find((x) => x.id === '1.1')!;
    expect(r.statoBlocco).toBe('parziale');
    expect(u.stato).toBe('parziale');
    expect(u.minuti).toBe(45);
    expect(u.progresso).toBeCloseTo(45 / 180, 6);
    expect(currentUnit(r.unita)?.id).toBe('1.1'); // domani punta ancora a 1.1
  });

  it('il progresso parziale non supera 0,95 e usa le ore stimate quando ci sono', () => {
    expect(partialProgress(1000)).toBe(0.95);
    expect(partialProgress(60, 2)).toBe(0.5);
  });
});

describe('Moduli bloccati — FORMATO_CORSO §4 (decisione D-PTR-1)', () => {
  it('statiModuli: senza criteri è passato e apre il successivo; la chiusura si propaga', () => {
    const s = statiModuli([
      { numero: 1, criteriSoddisfatti: true },
      { numero: 2, criteriSoddisfatti: false },
      { numero: 3, criteriSoddisfatti: true },
    ]);
    expect([...s.values()]).toEqual(['passato', 'aperto', 'bloccato']);
  });

  it('il puntatore non entra in un modulo bloccato', () => {
    const modules = [
      { numero: 1, criteriSoddisfatti: false },
      { numero: 2, criteriSoddisfatti: true },
    ];
    const map = assignPointer(course(), blocks, modules);
    expect([...map.values()]).toEqual(['1.1', '1.2', null, null]);
  });

  it('con i criteri del modulo 1 tutti a sì, il modulo 2 si apre', () => {
    const modules = [
      { numero: 1, criteriSoddisfatti: true },
      { numero: 2, criteriSoddisfatti: false },
    ];
    const map = assignPointer(course(), blocks, modules);
    expect([...map.values()]).toEqual(['1.1', '1.2', '2.1', null]);
  });
});
