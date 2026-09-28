import { describe, expect, it } from 'vitest';
import { lostAtInstant } from './lost';
import {
  addLocalDays,
  endOfLocalDay,
  local,
  localDayKey,
  localDaysBetween,
  localInstant,
  localTimeKey,
  startOfLocalDay,
} from './time';

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

  it("addLocalDays conserva l'ora di parete attraverso il cambio d'ora", () => {
    const sat = local(2026, 10, 24, 7, 0); // sabato, ora legale
    const sun = new Date(addLocalDays(sat, 1)); // domenica: le lancette tornano indietro
    const mon = new Date(addLocalDays(sat, 2));
    expect([sun.getDate(), sun.getHours()]).toEqual([25, 7]);
    expect([mon.getDate(), mon.getHours()]).toEqual([26, 7]);
  });

  it("localDaysBetween conta i giorni di calendario, non le 24 ore, anche attraverso il cambio d'ora", () => {
    expect(localDaysBetween(local(2026, 9, 28, 23, 59), local(2026, 9, 30, 0, 1))).toBe(2); // poco più di 24 ore
    expect(localDaysBetween(local(2026, 9, 28, 0, 1), local(2026, 9, 29, 23, 59))).toBe(1); // quasi 48 ore
    expect(localDaysBetween(local(2026, 9, 28, 8, 0), local(2026, 9, 28, 23, 0))).toBe(0);
    expect(localDaysBetween(local(2026, 9, 30, 8, 0), local(2026, 9, 28, 8, 0))).toBe(-2);
    expect(localDaysBetween(local(2026, 10, 24, 12, 0), local(2026, 10, 26, 12, 0))).toBe(2); // domenica di 25 ore a Roma
    // Giorni di 23 ore: Roma il 29 marzo, Los Angeles l'8 marzo, Auckland il 27 settembre (ognuno nel suo fuso di CI)
    expect(localDaysBetween(local(2026, 3, 28, 12, 0), local(2026, 3, 30, 12, 0))).toBe(2);
    expect(localDaysBetween(local(2026, 3, 7, 12, 0), local(2026, 3, 9, 12, 0))).toBe(2);
    expect(localDaysBetween(local(2026, 9, 26, 12, 0), local(2026, 9, 28, 12, 0))).toBe(2);
    // Dal 1° marzo al 30 novembre cadono i due cambi d'ora di Roma, Los Angeles e Auckland
    expect(localDaysBetween(local(2026, 3, 1), local(2026, 11, 30, 23, 59))).toBe(274);
  });

  it("routine senza durata il giorno del cambio d'ora → persa alle 00:29 del giorno dopo", () => {
    const lostAt = new Date(lostAtInstant({ inizio: local(2026, 10, 25, 7, 0), fine: null, conOrario: true }));
    expect([lostAt.getDate(), lostAt.getHours(), lostAt.getMinutes()]).toEqual([26, 0, 29]);
  });
});

describe('Ora di parete — D-TIME-2', () => {
  it('localTimeKey dà l\'orario locale "HH:MM", anche il giorno del cambio d\'ora', () => {
    expect(localTimeKey(local(2026, 9, 24, 7, 5))).toBe('07:05');
    expect(localTimeKey(local(2026, 9, 26, 23, 0))).toBe('23:00');
    expect(localTimeKey(local(2026, 10, 25, 18, 45))).toBe('18:45');
  });

  it('localInstant: giorno "YYYY-MM-DD" e orario "HH:MM" → istante locale, anche il giorno del cambio d\'ora', () => {
    expect(localInstant('2026-09-26', '23:00')).toBe(local(2026, 9, 26, 23, 0));
    expect(localInstant('2026-10-25', '07:05')).toBe(local(2026, 10, 25, 7, 5));
  });
});
