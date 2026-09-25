import { describe, expect, it } from 'vitest';
import { dayLoad, isDayKey, monthGrid, monthLegend, shiftPeriod, weekOf } from './calendar';
import type { Blocco } from './types';

const b = (tipo: Blocco['tipo'], conOrario = true): Pick<Blocco, 'tipo' | 'conOrario'> => ({ tipo, conOrario });

describe('Settimana — FUNZ §2 (D-CAL-1)', () => {
  it('sette giorni da lunedì a domenica, anche a cavallo del mese', () => {
    expect(weekOf('2026-10-01')).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
  });

  it('la domenica appartiene alla settimana che finisce quel giorno', () => {
    expect(weekOf('2026-10-04')[0]).toBe('2026-09-28');
  });

  it('attraversa il cambio d’ora di ottobre senza perdere né ripetere giorni', () => {
    expect(weekOf('2026-10-25')).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ]);
  });
});

describe('Griglia del mese — FUNZ §2', () => {
  it('settimane intere da lunedì: settembre 2026 inizia di martedì e finisce di mercoledì', () => {
    const g = monthGrid('2026-09-15');
    expect(g).toHaveLength(35);
    expect(g[0]).toEqual({ giorno: '2026-08-31', delMese: false });
    expect(g[1]).toEqual({ giorno: '2026-09-01', delMese: true });
    expect(g[30]).toEqual({ giorno: '2026-09-30', delMese: true });
    expect(g[34]).toEqual({ giorno: '2026-10-04', delMese: false });
  });

  it('sei righe quando il mese le occupa (agosto 2026: da sabato 1 a lunedì 31)', () => {
    const g = monthGrid('2026-08-01');
    expect(g).toHaveLength(42);
    expect(g.filter((c) => c.delMese)).toHaveLength(31);
  });
});

describe('Scorrere il periodo — FUNZ §2', () => {
  it('giorno ± 1, settimana ± 7 giorni', () => {
    expect(shiftPeriod('2026-09-30', 'giorno', 1)).toBe('2026-10-01');
    expect(shiftPeriod('2026-09-30', 'settimana', -1)).toBe('2026-09-23');
  });

  it('mese ± 1: stesso giorno, al più l’ultimo del mese', () => {
    expect(shiftPeriod('2026-01-31', 'mese', 1)).toBe('2026-02-28');
    expect(shiftPeriod('2026-03-15', 'mese', -1)).toBe('2026-02-15');
    expect(shiftPeriod('2026-12-10', 'mese', 1)).toBe('2027-01-10');
  });

  it('attraverso il cambio d’ora il giorno resta un giorno', () => {
    expect(shiftPeriod('2026-10-25', 'giorno', 1)).toBe('2026-10-26');
    expect(shiftPeriod('2026-03-30', 'giorno', -1)).toBe('2026-03-29');
  });
});

describe('Carico del giorno — MECC §24', () => {
  it('conteggio e tipi presenti, nell’ordine della legenda del mese', () => {
    expect(dayLoad([b('evento'), b('todo'), b('studio'), b('todo', false)])).toEqual({
      n: 4,
      tipi: ['studio', 'todo', 'evento'],
      livello: 'alto',
    });
  });

  it('livello della cella: nessuno, basso fino a 2, alto da 3 (D-CAL-1)', () => {
    expect(dayLoad([]).livello).toBeNull();
    expect(dayLoad([b('todo'), b('todo')]).livello).toBe('basso');
    expect(dayLoad([b('todo'), b('todo'), b('todo')]).livello).toBe('alto');
  });

  it('legenda: per tipo, i giorni con almeno un blocco di quel tipo', () => {
    expect(monthLegend([[b('studio'), b('studio')], [], [b('studio'), b('evento')]])).toEqual([
      { tipo: 'studio', giorni: 2 },
      { tipo: 'routine', giorni: 0 },
      { tipo: 'todo', giorni: 0 },
      { tipo: 'evento', giorni: 1 },
    ]);
  });
});

describe('Giorno dall’indirizzo — D-CAL-1', () => {
  it('accetta solo giorni che esistono', () => {
    expect(isDayKey('2026-02-28')).toBe(true);
    expect(isDayKey('2028-02-29')).toBe(true);
    expect(isDayKey('2026-02-31')).toBe(false);
    expect(isDayKey('2026-9-1')).toBe(false);
    expect(isDayKey('')).toBe(false);
  });
});
