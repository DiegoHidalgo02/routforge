import { describe, expect, it } from 'vitest';
import { canReorder, enterGroup, reorder, reorderGroup, sortDay, sortDayDesktop } from './ordering';
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

describe('Riordino — SCENARI G3 (dominio)', () => {
  // «Prepara la valigia» e «Prenota il treno» (alta), «Chiama Marco» (normale), e ciò che non si riordina
  const valigia = { ...todo('valigia', 'alta'), ordine: 1 };
  const treno = { ...todo('treno', 'alta'), ordine: 2 };
  const marco = { ...todo('marco', 'normale'), ordine: 3 };
  const persa: Blocco = { ...todo('persa', 'alta'), stato: 'perso' };
  const giorno = [marco, treno, valigia, persa, timed('R', 9), { ...timed('T', 10), tipo: 'todo' as const }];
  const ordina = (chiavi: Map<string, number> | null) =>
    sortDay(giorno.map((b) => ({ ...b, ordine: chiavi?.get(b.id) ?? b.ordine ?? null })))
      .filter((b) => !b.conOrario)
      .map((b) => b.id);

  it('«Prepara la valigia» sotto «Prenota il treno»: cambia solo la chiave d’ordine nel gruppo alta', () => {
    expect(ordina(null)).toEqual(['valigia', 'treno', 'persa', 'marco']);
    const chiavi = reorder(giorno, 'valigia', 1);
    expect(ordina(chiavi)).toEqual(['treno', 'valigia', 'persa', 'marco']);
    expect([...(chiavi?.keys() ?? [])]).toEqual(['valigia']);
  });

  it('non scende sotto «Chiama Marco»: rilasciata fuori dal gruppo torna al suo posto; ferma al suo posto non scrive nulla', () => {
    expect(reorder(giorno, 'valigia', 9)).toEqual(new Map());
    expect(reorder(giorno, 'treno', -1)).toEqual(new Map());
    expect(reorder(giorno, 'treno', 1)).toEqual(new Map());
    expect(reorderGroup(giorno, 'treno').map((b) => b.id)).toEqual(['valigia', 'treno']);
  });

  it('eventi, routine, todo con orario e persi non si riordinano', () => {
    for (const id of ['R', 'T', 'persa']) expect(reorder(giorno, id, 0)).toBeNull();
    expect(canReorder(valigia)).toBe(true);
  });

  it('chi entra nel gruppo va in fondo (§6): l’istante d’ingresso supera le chiavi riscritte', () => {
    const riordinato = reorder(giorno, 'valigia', 1)!;
    const nuovo = enterGroup(todo('nuovo', 'alta'), local(2026, 9, 25, 9, 0));
    const tutti = [...giorno.map((b) => ({ ...b, ordine: riordinato.get(b.id) ?? b.ordine ?? null })), nuovo];
    expect(reorderGroup(tutti, 'nuovo').map((b) => b.id)).toEqual(['treno', 'valigia', 'nuovo']);
  });
});

describe('Riordino senza comprimere il gruppo — MECCANISMI §15, D-RIORD-1 n. 3 (audit P2-11)', () => {
  const conOrdine = (id: string, ordine: number) => ({ ...todo(id, 'normale'), ordine });

  it('si scrive solo la chiave del todo spostato: l’evento tutto il giorno resta fra i todo che non si sono mossi', () => {
    const evento: Blocco = { ...timed('E', 0), tipo: 'evento', conOrario: false, inizio: local(2026, 10, 9, 0, 0) };
    const giorno = [
      conOrdine('C', local(2026, 10, 9, 9, 0)),
      conOrdine('A', local(2026, 10, 8, 10, 0)),
      evento,
      conOrdine('B', local(2026, 10, 9, 8, 0)),
    ];
    expect(sortDay(giorno).map((b) => b.id)).toEqual(['A', 'E', 'B', 'C']);
    const chiavi = reorder(giorno, 'C', 0)!;
    expect([...chiavi.keys()]).toEqual(['C']);
    const dopo = giorno.map((b) => ({ ...b, ordine: chiavi.get(b.id) ?? b.ordine ?? null }));
    expect(sortDay(dopo).map((b) => b.id)).toEqual(['C', 'A', 'E', 'B']);
  });

  it('in mezzo prende una chiave fra i vicini; senza spazio fra i due il gruppo si riscrive dalla più piccola', () => {
    expect(reorder([conOrdine('a', 10), conOrdine('b', 20), conOrdine('c', 21)], 'c', 1)).toEqual(new Map([['c', 15]]));
    expect(reorder([conOrdine('a', 10), conOrdine('b', 11), conOrdine('c', 12)], 'c', 1)).toEqual(
      new Map([
        ['c', 11],
        ['b', 12],
      ]),
    );
  });
});
