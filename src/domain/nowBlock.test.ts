import { describe, expect, it } from 'vitest';
import { dismissKey, selectNowBlock } from './nowBlock';
import { local } from './time';
import type { Blocco } from './types';

const mk = (id: string, tipo: Blocco['tipo'], h1: number, h2: number, over: Partial<Blocco> = {}): Blocco => ({
  id,
  tipo,
  stato: 'programmato',
  inizio: local(2026, 9, 23, h1, 0),
  fine: local(2026, 9, 23, h2, 0),
  conOrario: true,
  ...over,
});

describe('Adesso — SCENARI G1 (blocchi contigui A 09–10, B 10–11)', () => {
  const A = mk('A', 'routine', 9, 10);
  const B = mk('B', 'routine', 10, 11);

  it('alle 10:00 in punto "Adesso" è B', () => {
    const sel = selectNowBlock([A, B], local(2026, 9, 23, 10, 0));
    expect(sel?.blocco.id).toBe('B');
    expect(sel?.stato).toEqual({ tipo: 'adesso' });
  });

  it('alle 09:30 è A, "adesso"', () => {
    expect(selectNowBlock([A, B], local(2026, 9, 23, 9, 30))?.blocco.id).toBe('A');
  });

  it('alle 08:40 è A con 20 minuti mancanti', () => {
    expect(selectNowBlock([A, B], local(2026, 9, 23, 8, 40))?.stato).toEqual({ tipo: 'tra', minutiAllInizio: 20 });
  });

  it('alle 11:20 B è "recupera" (fine passata, entro 30\')', () => {
    expect(selectNowBlock([A, B], local(2026, 9, 23, 11, 20))?.stato).toEqual({ tipo: 'recupera' });
  });

  it('alle 11:31 nessun candidato', () => {
    expect(selectNowBlock([A, B], local(2026, 9, 23, 11, 31))).toBeNull();
  });

  it('un todo con orario passato mostra "orario passato"', () => {
    const T = mk('T', 'todo', 14, 15);
    expect(selectNowBlock([T], local(2026, 9, 23, 15, 10))?.stato).toEqual({ tipo: 'orario_passato' });
  });
});

describe('Adesso — SCENARI G2 (chiusura)', () => {
  const A = mk('A', 'routine', 9, 10);
  const B = mk('B', 'routine', 10, 11);

  it('chiuso su A: sparisce; quando B è in corso riappare; il giorno dopo riappare comunque', () => {
    const dismissed = new Set([dismissKey(A, local(2026, 9, 23, 9, 30))]);
    expect(selectNowBlock([A, B], local(2026, 9, 23, 9, 30), dismissed)).toBeNull();
    expect(selectNowBlock([A, B], local(2026, 9, 23, 10, 5), dismissed)?.blocco.id).toBe('B');
    const tomorrowA: Blocco = { ...A, id: 'A', inizio: local(2026, 9, 24, 9, 0), fine: local(2026, 9, 24, 10, 0) };
    expect(selectNowBlock([tomorrowA], local(2026, 9, 24, 9, 30), dismissed)?.blocco.id).toBe('A');
  });
});

describe('Adesso — SCENARI E3 (evento tutto il giorno)', () => {
  it('non compare nel blocco Adesso', () => {
    const allDay = mk('E', 'evento', 0, 23, { conOrario: false, fine: local(2026, 9, 23, 23, 59) });
    expect(selectNowBlock([allDay], local(2026, 9, 23, 12, 0))).toBeNull();
  });
});

describe('Adesso — MECCANISMI §14 (blocchi terminali esclusi)', () => {
  it('completati, saltati e persi non sono candidati', () => {
    const done = mk('D', 'routine', 9, 10, { stato: 'completato' });
    const lost = mk('L', 'studio', 9, 10, { stato: 'perso' });
    expect(selectNowBlock([done, lost], local(2026, 9, 23, 9, 30))).toBeNull();
  });
});
