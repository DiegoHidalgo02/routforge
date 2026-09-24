import { describe, expect, it } from 'vitest';
import { lostAtInstant } from './lost';
import { addLocalDays, endOfLocalDay, local, localDayKey, startOfLocalDay } from './time';

// I test usano solo i getter locali di Date, quindi valgono in qualsiasi fuso.
// Eseguiti con TZ=Europe/Rome attraversano il cambio d'ora del 25 ottobre 2026.
describe('Tempo locale — CONTESTO §3 (fuso e ora legale non spostano i blocchi di giorno)', () => {
  it('localDayKey / startOfLocalDay / endOfLocalDay', () => {
    const t = local(2026, 10, 25, 15, 30);
    expect(localDayKey(t)).toBe('2026-10-25');
    expect(new Date(startOfLocalDay(t)).getHours()).toBe(0);
    const end = new Date(endOfLocalDay(t));
    expect([end.getHours(), end.getMinutes()]).toEqual([23, 59]);
  });

  it('addLocalDays conserva l\'ora di parete attraverso il cambio d\'ora', () => {
    const sat = local(2026, 10, 24, 7, 0); // sabato, ora legale
    const sun = new Date(addLocalDays(sat, 1)); // domenica: le lancette tornano indietro
    const mon = new Date(addLocalDays(sat, 2));
    expect([sun.getDate(), sun.getHours()]).toEqual([25, 7]);
    expect([mon.getDate(), mon.getHours()]).toEqual([26, 7]);
  });

  it('routine senza durata il giorno del cambio d\'ora → persa alle 00:29 del giorno dopo', () => {
    const lostAt = new Date(lostAtInstant({ inizio: local(2026, 10, 25, 7, 0), fine: null, conOrario: true }));
    expect([lostAt.getDate(), lostAt.getHours(), lostAt.getMinutes()]).toEqual([26, 0, 29]);
  });
});
