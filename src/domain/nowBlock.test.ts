import { describe, expect, it } from 'vitest';
import { dismissKey, isLiveBlock, selectNowBlock, statusOf } from './nowBlock';
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

  it('alle 10:00 in punto "Adesso" è B, con 60 minuti alla fine', () => {
    const sel = selectNowBlock([A, B], local(2026, 9, 23, 10, 0));
    expect(sel?.blocco.id).toBe('B');
    expect(sel?.stato).toEqual({ tipo: 'adesso', minutiAllaFine: 60 });
  });

  it('alle 09:30 è A, "adesso"', () => {
    expect(selectNowBlock([A, B], local(2026, 9, 23, 9, 30))?.blocco.id).toBe('A');
  });

  it('alle 08:40 è A con 20 minuti mancanti', () => {
    expect(selectNowBlock([A, B], local(2026, 9, 23, 8, 40))?.stato).toEqual({ tipo: 'tra', minutiAllInizio: 20 });
  });

  it("alle 11:20 B è \"recupera\" (fine passata, entro 30'), con l'ultimo avvio alle 11:30 = fine + 30'", () => {
    expect(selectNowBlock([A, B], local(2026, 9, 23, 11, 20))?.stato).toEqual({
      tipo: 'recupera',
      ultimoAvvio: local(2026, 9, 23, 11, 30),
    });
  });

  it('alle 11:31 nessun candidato', () => {
    expect(selectNowBlock([A, B], local(2026, 9, 23, 11, 31))).toBeNull();
  });

  it('A resta raggiungibile fino alle 10:30 incluse: con B completata è "recupera" alle 10:20 e alle 10:30, sparisce alle 10:31', () => {
    const fatta: Blocco = { ...B, stato: 'completato' };
    expect(selectNowBlock([A, fatta], local(2026, 9, 23, 10, 20))?.stato.tipo).toBe('recupera');
    expect(selectNowBlock([A, fatta], local(2026, 9, 23, 10, 30))?.blocco.id).toBe('A');
    expect(selectNowBlock([A, fatta], local(2026, 9, 23, 10, 31))).toBeNull();
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

  it('la chiusura vale per il blocco scelto: il candidato successivo non affiora finché la scelta non cambia (D-NOW-2)', () => {
    const C = mk('C', 'routine', 10, 11, { inizio: local(2026, 9, 23, 10, 45), fine: local(2026, 9, 23, 11, 15) });
    const dismissed = new Set([dismissKey(A, local(2026, 9, 23, 9, 30))]);
    expect(selectNowBlock([A, C], local(2026, 9, 23, 10, 20), dismissed)).toBeNull();
    expect(selectNowBlock([A, C], local(2026, 9, 23, 10, 31), dismissed)?.blocco.id).toBe('C');
  });

  it('chiuso mentre è "tra poco" resta chiuso anche quando diventa in corso: stessa chiave giorno|blocco', () => {
    const dismissed = new Set([dismissKey(A, local(2026, 9, 23, 8, 40))]);
    expect(selectNowBlock([A], local(2026, 9, 23, 9, 30), dismissed)).toBeNull();
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

  it('parziale e indietro (esiti di una sessione chiusa, §1 e §11) non sono candidati (D-NOW-2)', () => {
    const parziale = mk('P', 'studio', 9, 10, { stato: 'parziale' });
    const indietro = mk('I', 'studio', 9, 10, { stato: 'indietro' });
    expect(selectNowBlock([parziale, indietro], local(2026, 9, 23, 9, 30))).toBeNull();
  });
});

describe('Adesso — MECCANISMI §14 (in corso e stato)', () => {
  it('un blocco `in_corso` è "adesso" anche a fine passata (sessione aperta), fino al limite della finestra', () => {
    const S = mk('S', 'studio', 9, 10, { stato: 'in_corso' });
    expect(selectNowBlock([S], local(2026, 9, 23, 10, 20))?.stato).toEqual({ tipo: 'adesso', minutiAllaFine: 0 });
    expect(selectNowBlock([S], local(2026, 9, 23, 10, 31))).toBeNull();
  });

  it('un blocco `in_corso` avviato in anticipo è "adesso", non "tra N min"', () => {
    const S = mk('S', 'studio', 9, 10, { stato: 'in_corso' });
    expect(statusOf(S, local(2026, 9, 23, 8, 55))).toEqual({ tipo: 'adesso', minutiAllaFine: 65 });
  });

  it('fra due blocchi in corso vince quello iniziato più di recente (D-NOW-2)', () => {
    const A = mk('A', 'routine', 9, 11);
    const B = mk('B', 'routine', 10, 10, { fine: local(2026, 9, 23, 10, 30) });
    expect(selectNowBlock([A, B], local(2026, 9, 23, 10, 15))?.blocco.id).toBe('B');
    expect(selectNowBlock([A, B], local(2026, 9, 23, 10, 45))?.blocco.id).toBe('A');
  });

  it('i numeri del mock: 16:00–16:45 "recupera" ha l\'ultimo avvio alle 17:15; senza durata "adesso" non ha minuti alla fine', () => {
    const R = mk('R', 'studio', 16, 17, { fine: local(2026, 9, 23, 16, 45) });
    expect(statusOf(R, local(2026, 9, 23, 17, 0))).toEqual({
      tipo: 'recupera',
      ultimoAvvio: local(2026, 9, 23, 17, 15),
    });
    const N = mk('N', 'routine', 9, 10, { fine: null });
    expect(statusOf(N, local(2026, 9, 23, 9, 30))).toEqual({ tipo: 'adesso', minutiAllaFine: null });
  });
});

describe('Card in corso nel calendario — MECCANISMI §14 (D-CAL-2)', () => {
  it('con orario e aperta: in corso da inizio a fine esclusa, oppure `in_corso`', () => {
    const A = mk('A', 'routine', 9, 10);
    expect(isLiveBlock(A, local(2026, 9, 23, 8, 59))).toBe(false);
    expect(isLiveBlock(A, local(2026, 9, 23, 9, 0))).toBe(true);
    expect(isLiveBlock(A, local(2026, 9, 23, 10, 0))).toBe(false);
    expect(isLiveBlock(mk('S', 'studio', 9, 10, { stato: 'in_corso' }), local(2026, 9, 23, 8, 55))).toBe(true);
  });
  it('`in_corso` resta in corso anche oltre fine + 30′ (sessione che sfora), a differenza del blocco Adesso', () => {
    const S = mk('S', 'studio', 9, 10, { stato: 'in_corso' });
    const alle1110 = local(2026, 9, 23, 11, 10);
    expect(isLiveBlock(S, alle1110)).toBe(true);
    expect(selectNowBlock([S], alle1110)).toBeNull();
  });
  it('senza durata la fine è 23:59 (D-NOW-1): in corso a mezzogiorno', () => {
    expect(isLiveBlock(mk('N', 'routine', 9, 10, { fine: null }), local(2026, 9, 23, 12, 0))).toBe(true);
  });
  it('mai i terminali né i blocchi senza orario, anche dentro la loro fascia', () => {
    const alle930 = local(2026, 9, 23, 9, 30);
    for (const stato of ['completato', 'perso', 'saltato', 'parziale', 'indietro'] as const)
      expect(isLiveBlock(mk('X', 'routine', 9, 10, { stato }), alle930)).toBe(false);
    expect(isLiveBlock(mk('T', 'todo', 0, 23, { conOrario: false }), alle930)).toBe(false);
  });
});
