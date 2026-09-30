import { describe, expect, it } from 'vitest';
import { local, localDayKey } from '../time';
import type { Blocco } from '../types';
import { digestContent, nextDigestInstant, TITOLI_DIGEST } from './digest';

// Lunedì 28 settembre 2026.
const oggi = (h: number, m = 0) => local(2026, 9, 28, h, m);
const ieri = (h: number, m = 0) => local(2026, 9, 27, h, m);

const todo = (over: Partial<Blocco> & Pick<Blocco, 'id' | 'titolo'>): Blocco & { giornoLocale: string } => {
  const inizio = over.inizio ?? oggi(12);
  return {
    tipo: 'todo',
    stato: 'programmato',
    conOrario: false,
    fine: null,
    orizzonte: 'giorno',
    ...over,
    inizio,
    giornoLocale: localDayKey(inizio),
  };
};

describe('Digest — MECCANISMI §13.5, SCENARI A4', () => {
  it('la prossima occorrenza dell’orario: oggi alle 08:00 se non è passata, altrimenti domani', () => {
    expect(nextDigestInstant(oggi(7, 59), '08:00')).toBe(oggi(8));
    expect(nextDigestInstant(oggi(8), '08:00')).toBe(oggi(8));
    expect(nextDigestInstant(oggi(8) + 1000, '08:00')).toBe(local(2026, 9, 29, 8, 0));
    expect(nextDigestInstant(oggi(20), '06:30')).toBe(local(2026, 9, 29, 6, 30));
  });

  it('A4: due todo senza orario di oggi e uno di ieri con orizzonte mese: 3 da fare, 1 arretrato, i tre titoli', () => {
    const blocchi = [
      todo({ id: 'a', titolo: 'Chiama Marco' }),
      todo({ id: 'b', titolo: 'Spesa' }),
      todo({ id: 'c', titolo: 'Bolletta', inizio: ieri(12), orizzonte: 'mese' }),
    ];
    expect(digestContent(blocchi, oggi(8))).toEqual({
      totale: 3,
      arretrati: 1,
      titoli: ['Bolletta', 'Chiama Marco', 'Spesa'],
    });
  });

  it('lo stesso todo già rotolato a oggi dal ciclo (`ritardoIl`) resta un arretrato', () => {
    const blocchi = [
      todo({ id: 'a', titolo: 'Chiama Marco' }),
      todo({ id: 'c', titolo: 'Bolletta', orizzonte: 'mese', ritardoIl: oggi(0, 1) }),
    ];
    expect(digestContent(blocchi, oggi(8))).toMatchObject({ totale: 2, arretrati: 1 });
  });

  it('non contano: il todo di ieri con orizzonte giorno (diventa «non fatto»), i todo con orario, quelli chiusi o persi', () => {
    const blocchi = [
      todo({ id: 'g', titolo: 'Ieri', inizio: ieri(12) }),
      todo({ id: 'o', titolo: 'Con orario', conOrario: true, inizio: oggi(18), fine: oggi(18, 30) }),
      todo({ id: 'f', titolo: 'Fatto', stato: 'completato' }),
      todo({ id: 'p', titolo: 'Non fatto', stato: 'perso', ritardoIl: oggi(0, 30) }),
    ];
    expect(digestContent(blocchi, oggi(8))).toBeNull();
  });

  it('vuoto → nessun digest; al massimo 3 titoli nell’ordine della fascia senza orario (alta → normale → bassa)', () => {
    expect(digestContent([], oggi(8))).toBeNull();
    const blocchi = [
      todo({ id: 'b', titolo: 'Bassa', priorita: 'bassa' }),
      todo({ id: 'n', titolo: 'Normale' }),
      todo({ id: 'a', titolo: 'Alta', priorita: 'alta' }),
      todo({ id: 'n2', titolo: 'Normale 2' }),
    ];
    const d = digestContent(blocchi, oggi(8));
    expect(d?.titoli).toHaveLength(TITOLI_DIGEST);
    expect(d).toEqual({ totale: 4, arretrati: 0, titoli: ['Alta', 'Normale', 'Normale 2'] });
  });

  it('il digest di domani, calcolato stasera, conta fra gli arretrati il todo di oggi (settimana) che rotolerà', () => {
    const domani = local(2026, 9, 29, 8, 0);
    const blocchi = [
      todo({ id: 's', titolo: 'Spesa', orizzonte: 'settimana' }),
      todo({ id: 'd', titolo: 'Domani', inizio: local(2026, 9, 29, 12, 0) }),
    ];
    expect(digestContent(blocchi, domani)).toEqual({ totale: 2, arretrati: 1, titoli: ['Spesa', 'Domani'] });
  });
});
