import { describe, expect, it } from 'vitest';
import { local } from '../time';
import { absenceNotice, GIORNI_ASSENZA, noticeOfDay } from './absence';

describe('Ritorno dopo assenza — MECCANISMI §9', () => {
  const LUNEDI = local(2026, 9, 28, 21, 0);

  it('dall’ultima apertura sono passati ≥ 2 giorni e c’è almeno un corso: avviso con i giorni (§9)', () => {
    expect(GIORNI_ASSENZA).toBe(2);
    expect(absenceNotice(LUNEDI, local(2026, 9, 30, 8, 0), 1)).toEqual({ giorni: 2, giorno: '2026-09-30' });
    expect(absenceNotice(LUNEDI, local(2026, 10, 1, 8, 0), 3)).toEqual({ giorni: 3, giorno: '2026-10-01' });
  });

  it('i giorni sono di calendario, non 48 ore (D-ASSENZA-1)', () => {
    // Da lunedì mattina a martedì sera: quasi 40 ore, un giorno solo
    expect(absenceNotice(local(2026, 9, 28, 8, 0), local(2026, 9, 29, 23, 59), 1)).toBeNull();
    // Da lunedì 23:00 a mercoledì 00:30: 25 ore e mezza, ma martedì è passato intero senza aprire l'app
    expect(absenceNotice(local(2026, 9, 28, 23, 0), local(2026, 9, 30, 0, 30), 1)).toEqual({
      giorni: 2,
      giorno: '2026-09-30',
    });
  });

  it('senza corsi nessun avviso (§9 «c’è almeno un corso»)', () => {
    expect(absenceNotice(LUNEDI, local(2026, 10, 5, 8, 0), 0)).toBeNull();
  });

  it('alla prima apertura, senza un’ultima apertura, nessun avviso (D-ASSENZA-1)', () => {
    expect(absenceNotice(null, local(2026, 9, 30, 8, 0), 1)).toBeNull();
  });

  it('un’ultima apertura nel futuro (orologio del dispositivo spostato indietro) non dà avvisi', () => {
    expect(absenceNotice(local(2026, 10, 5, 8, 0), local(2026, 9, 30, 8, 0), 1)).toBeNull();
  });

  it('l’avviso vale solo nel giorno dell’apertura (D-ASSENZA-1)', () => {
    const avviso = { giorni: 3, giorno: '2026-10-01' };
    expect(noticeOfDay(avviso, '2026-10-01')).toEqual(avviso);
    expect(noticeOfDay(avviso, '2026-10-02')).toBeNull();
    expect(noticeOfDay(null, '2026-10-01')).toBeNull();
  });
});
