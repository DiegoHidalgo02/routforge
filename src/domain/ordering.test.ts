import { describe, expect, it } from 'vitest';
import { sortDay, sortDayDesktop } from './ordering';
import { local } from './time';
import type { Blocco, Priorita } from './types';

const todo = (id: string, priorita: Priorita): Blocco => ({
  id,
  tipo: 'todo',
  stato: 'programmato',
  inizio: local(2026, 9, 25, 12, 0), // ancora dei todo senza orario (§1)
  fine: local(2026, 9, 25, 23, 59),
  conOrario: false,
  priorita,
});
const timed = (id: string, h: number): Blocco => ({
  id,
  tipo: 'routine',
  stato: 'programmato',
  inizio: local(2026, 9, 25, h, 0),
  fine: local(2026, 9, 25, h + 1, 0),
  conOrario: true,
});

describe('Priorità nella fascia senza orario — SCENARI A5', () => {
  it('bassa, alta, normale → alta, normale, bassa, prima di qualsiasi blocco con orario', () => {
    const giorno = [
      timed('R7', 7),
      todo('bassa', 'bassa'),
      timed('R6', 6),
      todo('alta', 'alta'),
      todo('normale', 'normale'),
    ];
    expect(sortDay(giorno).map((b) => b.id)).toEqual(['alta', 'normale', 'bassa', 'R6', 'R7']);
  });
  it('su desktop in coda, dopo i blocchi con orario, sempre per priorità (D-DESIGN-1 n. 3)', () => {
    const giorno = [
      timed('R7', 7),
      todo('bassa', 'bassa'),
      timed('R6', 6),
      todo('alta', 'alta'),
      todo('normale', 'normale'),
    ];
    expect(sortDayDesktop(giorno).map((b) => b.id)).toEqual(['R6', 'R7', 'alta', 'normale', 'bassa']);
  });
});

describe('Ordinamento del giorno — MECCANISMI §24, §6', () => {
  it('a parità di priorità vale l’inizio; un evento tutto il giorno conta come «normale» (D-CREA-1)', () => {
    const evento: Blocco = { ...timed('E', 0), tipo: 'evento', conOrario: false, fine: local(2026, 9, 25, 23, 59) };
    const giorno = [todo('N', 'normale'), evento, todo('A', 'alta')];
    expect(sortDay(giorno).map((b) => b.id)).toEqual(['A', 'E', 'N']);
  });
});
