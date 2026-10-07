import { describe, expect, it } from 'vitest';
import { local } from './time';
import type { Blocco } from './types';
import { widgetContent } from './widget';

// Mercoledì 23 settembre 2026, 16:08 (lo scenario dei mock)
const ADESSO = local(2026, 9, 23, 16, 8);
let n = 0;
const blocco = (over: Partial<Blocco>): Blocco & { id: string } => ({
  id: `b${++n}`,
  tipo: 'todo',
  stato: 'programmato',
  inizio: local(2026, 9, 23, 9),
  fine: null,
  conOrario: false,
  ...over,
});

describe('Widget — MECCANISMI §21 (T-023)', () => {
  it('mini mese col tipo prevalente (a parità studio), oggi e weekend; agenda di oggi coi fatti; «Prossima» di §14', () => {
    const w = widgetContent(
      [
        // Martedì 22: uno studio e un todo → a parità vince lo studio
        blocco({ tipo: 'studio', inizio: local(2026, 9, 22, 9), fine: local(2026, 9, 22, 10), conOrario: true }),
        blocco({ inizio: local(2026, 9, 22, 11) }),
        // Oggi: un todo alta senza orario, un evento delle 15 fatto, una routine delle 18
        blocco({ titolo: 'Chiama Marco', priorita: 'alta' }),
        blocco({
          tipo: 'evento',
          titolo: 'Dentista',
          inizio: local(2026, 9, 23, 15),
          fine: local(2026, 9, 23, 15, 30),
          conOrario: true,
          stato: 'completato',
        }),
        blocco({
          tipo: 'routine',
          titolo: 'Corsa',
          inizio: local(2026, 9, 23, 18),
          fine: local(2026, 9, 23, 19),
          conOrario: true,
        }),
        // Sabato 26: due routine e un evento
        blocco({ tipo: 'routine', inizio: local(2026, 9, 26, 8), conOrario: true, fine: local(2026, 9, 26, 9) }),
        blocco({ tipo: 'routine', inizio: local(2026, 9, 26, 10), conOrario: true, fine: local(2026, 9, 26, 11) }),
        blocco({ tipo: 'evento', inizio: local(2026, 9, 26, 12), conOrario: true, fine: local(2026, 9, 26, 13) }),
      ],
      ADESSO,
    );
    expect(w.mese).toBe('2026-09');
    const giorno = (g: string) => w.giorni.find((x) => x.giorno === g);
    expect(giorno('2026-09-22')).toMatchObject({ tipo: 'studio', oggi: false, weekend: false });
    // Un todo, un evento e una routine: a parità vince la routine (studio, routine, todo, evento)
    expect(giorno('2026-09-23')).toMatchObject({ oggi: true, tipo: 'routine' });
    expect(giorno('2026-09-26')).toMatchObject({ tipo: 'routine', weekend: true });
    expect(giorno('2026-09-24')).toMatchObject({ tipo: null });
    expect(w.agenda.map((r) => [r.titolo, r.ora, r.fatto])).toEqual([
      ['Chiama Marco', null, false],
      ['Dentista', '15:00', true],
      ['Corsa', '18:00', false],
    ]);
    // Con la fine effettiva: il widget la nasconde quando scade con l'app chiusa (revisione di T-023)
    expect(w.prossima).toMatchObject({ titolo: 'Corsa', ora: '18:00', tipo: 'routine', fine: local(2026, 9, 23, 19) });
  });

  it('senza blocchi di oggi né futuri: agenda vuota e nessuna «Prossima»; la settimana può iniziare di domenica', () => {
    const w = widgetContent([], ADESSO, 0);
    expect([w.agenda, w.prossima]).toEqual([[], null]);
    expect(w.giorni[0]?.giorno).toBe('2026-08-30');
  });
});
