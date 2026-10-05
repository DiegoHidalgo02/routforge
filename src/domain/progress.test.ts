import { describe, expect, it } from 'vitest';
import { dayClosed, dayProgress, focusDelta, heaviestType, upcomingDays } from './progress';
import type { Blocco, StatoBlocco, TipoBlocco } from './types';

const b = (tipo: TipoBlocco, stato: StatoBlocco = 'programmato'): Pick<Blocco, 'tipo' | 'stato'> => ({ tipo, stato });

describe('Il tuo progresso oggi — FUNZIONALITA §2, SCENARI A7, C10', () => {
  it('«Completate» 3 / 8 · 38 %: una spunta la porta a 4 / 8 · 50 %; «Continua» dello studio conta (C10)', () => {
    const giorno = [
      ...Array.from({ length: 3 }, () => b('routine', 'completato')),
      ...Array.from({ length: 5 }, () => b('todo')),
    ];
    expect(dayProgress(giorno)).toEqual({ fatte: 3, totale: 8, percento: 38 });
    expect(dayProgress([...giorno.slice(0, 7), b('todo', 'completato')])).toEqual({
      fatte: 4,
      totale: 8,
      percento: 50,
    });
    expect(dayProgress([b('studio', 'parziale'), b('studio', 'saltato'), b('routine', 'perso')]).fatte).toBe(1);
    expect(dayProgress([])).toEqual({ fatte: 0, totale: 0, percento: 0 });
  });

  it('focus: il delta su ieri in percentuale intera (MECCANISMI §20); senza focus ieri nessun confronto', () => {
    expect(focusDelta(230, 200)).toBe(15);
    expect(focusDelta(100, 200)).toBe(-50);
    expect(focusDelta(100, 0)).toBeNull();
  });

  it('il colore dei grafici è il tipo che pesa di più; a parità vale l’ordine dei tipi', () => {
    expect(heaviestType([b('todo'), b('routine'), b('todo')])).toBe('todo');
    expect(heaviestType([b('todo'), b('studio')])).toBe('studio');
    expect(heaviestType([])).toBeNull();
  });
});

describe('Giornata chiusa e prossime attività — FUNZIONALITA §2, MECCANISMI §24', () => {
  it('chiusa con almeno un’attività e tutte chiuse; un giorno vuoto non è chiuso', () => {
    expect(dayClosed([b('todo', 'completato'), b('routine', 'saltato'), b('studio', 'perso')])).toBe(true);
    expect(dayClosed([b('todo', 'completato'), b('evento')])).toBe(false);
    expect(dayClosed([])).toBe(false);
  });

  it('i primi due giorni dopo oggi con attività, nell’ordine dei giorni', () => {
    const giorni = new Map([
      ['2026-09-26', [b('todo')]],
      ['2026-09-23', [b('todo')]],
      ['2026-09-24', []],
      ['2026-09-25', [b('studio'), b('evento')]],
      ['2026-09-27', [b('routine')]],
    ]);
    expect(upcomingDays(giorni, '2026-09-23').map(([g, x]) => [g, x.length])).toEqual([
      ['2026-09-25', 2],
      ['2026-09-26', 1],
    ]);
  });
});
