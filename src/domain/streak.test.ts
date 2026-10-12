import { describe, expect, it } from 'vitest';
import { currentStreak, studyDays } from './streak';
import { local } from './time';
import type { Blocco } from './types';

/** Un blocco di studio chiuso all'istante dato (l'esito), nello stato dato. */
const studio = (chiusoIl: number, stato: Blocco['stato'] = 'completato') =>
  ({ tipo: 'studio', stato, inizio: chiusoIl, chiusoIl }) as const;

describe('Streak — MECCANISMI §12, §25 / SCENARI C2', () => {
  it('la prima sessione che conta porta la streak a 1', () => {
    expect(currentStreak(studyDays([studio(local(2026, 9, 22, 9, 30))]), local(2026, 9, 22, 10, 0))).toBe(1);
  });

  it('C2: +1 una sola volta anche con due sessioni oggi', () => {
    const giorni = studyDays([studio(local(2026, 9, 22, 9, 30)), studio(local(2026, 9, 22, 21, 0), 'parziale')]);
    expect(giorni).toEqual(['2026-09-22']);
    expect(currentStreak(giorni, local(2026, 9, 22, 22, 0))).toBe(1);
  });

  it('giorni consecutivi: ieri → oggi = +1', () => {
    const giorni = studyDays([studio(local(2026, 9, 21, 9, 30)), studio(local(2026, 9, 22, 9, 30))]);
    expect(currentStreak(giorni, local(2026, 9, 22, 10, 0))).toBe(2);
  });

  it('si spezza se passa un giorno intero senza: riparte da 1', () => {
    const giorni = studyDays([studio(local(2026, 9, 20, 9, 30)), studio(local(2026, 9, 22, 9, 30))]);
    expect(currentStreak(giorni, local(2026, 9, 22, 10, 0))).toBe(1);
  });

  it("valore mostrato: 0 se l'ultimo giorno contato non è oggi né ieri", () => {
    const giorni = studyDays([studio(local(2026, 9, 19, 9, 30)), studio(local(2026, 9, 20, 9, 30))]);
    expect(currentStreak(giorni, local(2026, 9, 21, 8, 0))).toBe(2); // ieri: la serie vale ancora
    expect(currentStreak(giorni, local(2026, 9, 22, 8, 0))).toBe(0); // due giorni dopo
  });

  it('solo Completata e Continua contano: Indietro, Salta, persi e altri tipi no', () => {
    const giorno = local(2026, 9, 22, 9, 30);
    expect(
      studyDays([
        studio(giorno, 'indietro'),
        studio(giorno, 'saltato'),
        studio(giorno, 'perso'),
        { tipo: 'routine', stato: 'completato', inizio: giorno, chiusoIl: giorno },
      ]),
    ).toEqual([]);
  });

  it('il giorno è quello dell’esito, anche per un blocco pianificato il giorno prima (D-ESITO-1 n. 4)', () => {
    expect(
      studyDays([
        { tipo: 'studio', stato: 'completato', inizio: local(2026, 9, 21, 23, 0), chiusoIl: local(2026, 9, 22, 0, 30) },
      ]),
    ).toEqual(['2026-09-22']);
  });
});
