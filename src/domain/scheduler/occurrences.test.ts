import { describe, expect, it } from 'vitest';
import { canCheckRoutine, lostAtInstant, recoveryDeadline, shouldMarkLost } from '../lost';
import { statusOf } from '../nowBlock';
import { HOUR, local, localDayKey, localTimeKey } from '../time';
import type { Blocco, BloccoAncorato, Ricorrenza } from '../types';
import {
  editPlan,
  horizonSlotRange,
  isMovedOccurrence,
  missingOccurrences,
  occurrenceDay,
  occurrenceId,
  ORIZZONTE_OCCORRENZE_GIORNI,
  reanchor,
  removableOccurrences,
} from './occurrences';

/** Martedì 22 settembre 2026, ore 09:00. */
const NOW = local(2026, 9, 22, 9, 0);
const OGGI = '2026-09-22';

/** «Corsa», lunedì/mercoledì/venerdì 07:00–08:00 a partire da oggi (B1). */
const ricorrenza = (over: Partial<Ricorrenza> = {}): Ricorrenza => ({
  id: 'r-corsa',
  tipo: 'routine',
  titolo: 'Corsa',
  note: '',
  giorni: [1, 3, 5],
  dataInizio: OGGI,
  dataFine: null,
  dateSaltate: [],
  corsoId: null,
  fasi: [],
  promemoria: { modo: 'auto' },
  orarioInizio: '07:00',
  orarioFine: '08:00',
  fuso: 'Europe/Rome',
  ...over,
});

const giorni = (blocchi: readonly Blocco[]): string[] => blocchi.map((b) => localDayKey(b.inizio));
const ids = (blocchi: readonly Pick<Blocco, 'id'>[]): string[] => blocchi.map((b) => b.id);

describe('Generazione e orizzonte — SCENARI B1', () => {
  const r = ricorrenza();

  it('occorrenze da oggi a oggi + 28 giorni (§7) sui tre giorni scelti, nessuna oltre, una per data', () => {
    expect(ORIZZONTE_OCCORRENZE_GIORNI).toBe(28);
    const occ = missingOccurrences(r, [], NOW);
    expect(giorni(occ)).toEqual([
      '2026-09-23',
      '2026-09-25',
      '2026-09-28',
      '2026-09-30',
      '2026-10-02',
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
      '2026-10-12',
      '2026-10-14',
      '2026-10-16',
      '2026-10-19',
    ]);
    expect(new Set(ids(occ)).size).toBe(occ.length);
    expect(occ[0]).toMatchObject({
      tipo: 'routine',
      stato: 'programmato',
      titolo: 'Corsa',
      ricorrenzaId: 'r-corsa',
      conOrario: true,
      inizio: local(2026, 9, 23, 7, 0),
      fine: local(2026, 9, 23, 8, 0),
    });
  });

  it('idempotente: con le occorrenze già create non ne manca nessuna', () => {
    const occ = missingOccurrences(r, [], NOW);
    expect(missingOccurrences(r, occ, NOW)).toEqual([]);
  });

  it("tra 10 giorni l'orizzonte arriva a quel giorno + 28: si aggiungono solo le nuove, senza duplicati", () => {
    const prime = missingOccurrences(r, [], NOW);
    const nuove = missingOccurrences(r, prime, local(2026, 10, 2, 9, 0));
    expect(giorni(nuove)).toEqual(['2026-10-21', '2026-10-23', '2026-10-26', '2026-10-28', '2026-10-30']);
    expect(new Set(ids([...prime, ...nuove])).size).toBe(prime.length + nuove.length);
  });

  it("l'ultimo giorno, oggi + 28, è incluso e oggi conta anche se l'orario è passato (D-OCC-1)", () => {
    const occ = missingOccurrences(ricorrenza({ giorni: [0, 1, 2, 3, 4, 5, 6] }), [], NOW);
    expect(occ).toHaveLength(29);
    expect([giorni(occ)[0], giorni(occ).at(-1)]).toEqual([OGGI, '2026-10-20']);
  });
});

describe('Routine notturna — SCENARI B3 (sabato 23:00 → domenica 01:00)', () => {
  const [b] = missingOccurrences(ricorrenza({ giorni: [6], orarioInizio: '23:00', orarioFine: '01:00' }), [], NOW);

  it('inizia sabato 23:00 e finisce domenica 01:00 (fine ≤ inizio → il giorno dopo, §7)', () => {
    expect(b).toMatchObject({ inizio: local(2026, 9, 26, 23, 0), fine: local(2026, 9, 27, 1, 0) });
  });

  it('domenica alle 00:30 è ancora spuntabile e risulta «adesso»; persa da domenica 01:30', () => {
    expect(canCheckRoutine(b!, local(2026, 9, 27, 0, 30))).toBe(true);
    expect(statusOf(b!, local(2026, 9, 27, 0, 30))).toEqual({ tipo: 'adesso', minutiAllaFine: 30 });
    expect(shouldMarkLost(b!, local(2026, 9, 27, 1, 29))).toBe(false);
    expect(shouldMarkLost(b!, local(2026, 9, 27, 1, 31))).toBe(true);
  });
});

describe('Routine senza durata — SCENARI B4 («Meditazione» alle 07:00)', () => {
  const [b] = missingOccurrences(
    ricorrenza({ id: 'r-med', titolo: 'Meditazione', giorni: [2], orarioFine: null }),
    [],
    NOW,
  );

  it('occorrenza con orario ma senza fine: spuntabile tutto il giorno, verifica a 07:30, persa alle 00:29 del giorno dopo', () => {
    expect(b).toMatchObject({ inizio: local(2026, 9, 22, 7, 0), fine: null, conOrario: true });
    expect(canCheckRoutine(b!, local(2026, 9, 22, 22, 0))).toBe(true);
    expect(recoveryDeadline(b!)).toBe(local(2026, 9, 22, 7, 30));
    expect(lostAtInstant(b!)).toBe(local(2026, 9, 23, 0, 29));
  });
});

describe('Modifica della routine — SCENARI B6 (alle 15:00 «Corsa» passa da 07:00 a 18:00)', () => {
  // Oggi è mercoledì 23: l'occorrenza delle 07:00 è stata completata alle 07:45, le altre sono programmate.
  const mattina = local(2026, 9, 23, 8, 0);
  const alle15 = local(2026, 9, 23, 15, 0);
  const stamattina = occurrenceId('r-corsa', '2026-09-23', '07:00');
  const esistenti = missingOccurrences(ricorrenza(), [], mattina).map((b) =>
    b.id === stamattina ? { ...b, stato: 'completato' as const } : b,
  );
  const future = esistenti.filter((b) => b.stato === 'programmato');
  const piano = editPlan(ricorrenza({ orarioInizio: '18:00', orarioFine: '19:00' }), esistenti, alle15);

  it("l'occorrenza di stamattina resta com'era: né eliminata né riscritta", () => {
    expect(piano.daEliminare).not.toContain(stamattina);
    expect(ids(piano.daScrivere)).not.toContain(stamattina);
  });

  it('le future programmate delle 07:00 si eliminano; le nuove sono alle 18:00, compresa quella di oggi', () => {
    expect(piano.daEliminare).toEqual(ids(future));
    expect(piano.daScrivere.every((b) => localTimeKey(b.inizio) === '18:00' && b.stato === 'programmato')).toBe(true);
    expect(giorni(piano.daScrivere)[0]).toBe('2026-09-23');
    expect(piano.daScrivere.at(-1)?.inizio).toBe(local(2026, 10, 21, 18, 0));
  });

  it('cambiare solo il titolo riscrive le future programmate con la definizione nuova e non elimina nulla', () => {
    const p = editPlan(ricorrenza({ titolo: 'Corsa lenta' }), esistenti, alle15);
    expect(p.daEliminare).toEqual([]);
    expect(ids(p.daScrivere)).toEqual(ids(future));
    expect(p.daScrivere.every((b) => b.titolo === 'Corsa lenta')).toBe(true);
  });
});

describe('Modifica: la differenza da applicare — MECCANISMI §7 (solo future programmate; giorni tolti e aggiunti; date saltate)', () => {
  // Mercoledì 23: occorrenze generate alle 06:00; alle 07:30 quella di oggi (07:00) è iniziata ma ancora programmata.
  const esistenti = missingOccurrences(ricorrenza(), [], local(2026, 9, 23, 6, 0));
  const alle730 = local(2026, 9, 23, 7, 30);
  const oggi = occurrenceId('r-corsa', '2026-09-23', '07:00');

  it("l'occorrenza di oggi già iniziata (inizio ≤ adesso) non è futura: né eliminata né riscritta", () => {
    const p = editPlan(ricorrenza({ titolo: 'Corsa lenta' }), esistenti, alle730);
    expect(p.daEliminare).not.toContain(oggi);
    expect(ids(p.daScrivere)).not.toContain(oggi);
    expect(p.daScrivere).toHaveLength(esistenti.length - 1);
  });

  it('via il venerdì, dentro il martedì, saltato il 30/9: eliminate le future del venerdì e del 30, riscritte le altre, create quelle del martedì', () => {
    const p = editPlan(ricorrenza({ giorni: [1, 2, 3], dateSaltate: ['2026-09-30'] }), esistenti, alle730);
    expect(p.daEliminare).toEqual(
      ['2026-09-25', '2026-09-30', '2026-10-02', '2026-10-09', '2026-10-16'].map((g) =>
        occurrenceId('r-corsa', g, '07:00'),
      ),
    );
    expect(giorni(p.daScrivere)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
    ]);
  });
});

describe('Filtri ed ereditati — MECCANISMI §7 (data inizio, data fine, date saltate; titolo, note, promemoria)', () => {
  it('data inizio futura, data fine inclusa, date saltate per giorno locale', () => {
    const r = ricorrenza({ dataInizio: '2026-09-28', dataFine: '2026-10-07', dateSaltate: ['2026-10-02'] });
    expect(giorni(missingOccurrences(r, [], NOW))).toEqual(['2026-09-28', '2026-09-30', '2026-10-05', '2026-10-07']);
  });

  it('una ricorrenza finita (fine < oggi) non genera nulla', () => {
    expect(missingOccurrences(ricorrenza({ dataInizio: '2026-09-01', dataFine: '2026-09-21' }), [], NOW)).toEqual([]);
  });

  it("data inizio nel passato: si parte da oggi, nessun riempimento all'indietro", () => {
    const occ = missingOccurrences(ricorrenza({ dataInizio: '2026-09-01' }), [], NOW);
    expect(giorni(occ)[0]).toBe('2026-09-23');
    expect(occ).toHaveLength(12);
  });

  it('routine di studio: eredita titolo, note, promemoria e corso; nessuna unità (puntatore in T-013); le fasi restano sulla definizione', () => {
    const r = ricorrenza({
      tipo: 'studio',
      titolo: 'Studio',
      note: 'ripasso',
      corsoId: 'c-1',
      promemoria: { modo: 'off' },
    });
    const [b] = missingOccurrences(r, [], NOW);
    expect(b).toMatchObject({
      tipo: 'studio',
      titolo: 'Studio',
      note: 'ripasso',
      corsoId: 'c-1',
      unitaId: null,
      promemoria: { modo: 'off' },
    });
    expect(b).not.toHaveProperty('fasi');
  });
});

describe('Eliminazione della routine — MECCANISMI §7 (restano completate e perse)', () => {
  it('si eliminano tutte le programmate, anche passate', () => {
    const [a, b, c, d] = missingOccurrences(ricorrenza(), [], NOW) as [Blocco, Blocco, Blocco, Blocco];
    const esistenti = [a, { ...b, stato: 'completato' as const }, { ...c, stato: 'perso' as const }, d];
    expect(removableOccurrences(esistenti)).toEqual([a.id, d.id]);
  });
});

describe("Cambio d'ora del 25 ottobre 2026 — CONTESTO §3, D-TIME-1 (l'ora di parete non si sposta)", () => {
  const il20 = local(2026, 10, 20, 9, 0);

  it("routine quotidiana 07:00–08:00 generata il 20/10: ogni occorrenza è alle 07:00 e dura un'ora, 25 e 26 compresi", () => {
    const occ = missingOccurrences(ricorrenza({ giorni: [0, 1, 2, 3, 4, 5, 6] }), [], il20);
    expect(giorni(occ)).toEqual(expect.arrayContaining(['2026-10-25', '2026-10-26']));
    for (const b of occ) {
      expect(localTimeKey(b.inizio)).toBe('07:00');
      expect(b.fine! - b.inizio).toBe(HOUR);
    }
  });

  it('routine notturna di sabato 24/10 (23:00 → 01:00): finisce domenica 25 alle 01:00 di parete', () => {
    const [b] = missingOccurrences(ricorrenza({ giorni: [6], orarioInizio: '23:00', orarioFine: '01:00' }), [], il20);
    expect([b!.inizio, b!.fine]).toEqual([local(2026, 10, 24, 23, 0), local(2026, 10, 25, 1, 0)]);
  });
});

describe("Id dell'occorrenza = slot della ricorrenza — D-DATA-2", () => {
  it('ricorrenza, giorno locale e orario di parete della definizione', () => {
    expect(occurrenceId('r-corsa', '2026-09-23', '07:00')).toBe('r-corsa:2026-09-23:07:00');
    expect(missingOccurrences(ricorrenza(), [], NOW)[0]?.id).toBe('r-corsa:2026-09-23:07:00');
  });

  it("un'occorrenza spostata dall'utente (anticipata alle 06:40) è riconosciuta dall'id e non si rigenera", () => {
    const occ = missingOccurrences(ricorrenza(), [], NOW);
    const spostata = { ...occ[0]!, inizio: local(2026, 9, 23, 6, 40), fine: local(2026, 9, 23, 7, 40) };
    expect(missingOccurrences(ricorrenza(), [spostata, ...occ.slice(1)], NOW)).toEqual([]);
  });

  it('spostata = giorno o orario di parete diversi dallo slot del suo id; una ricorrenza che cambia orario non sposta le sue (D-SYNC-6)', () => {
    const slot = { id: 'r-corsa:2026-09-23:07:00', giornoLocale: '2026-09-23', orarioInizio: '07:00' };
    expect(isMovedOccurrence(slot, 'r-corsa')).toBe(false);
    expect(isMovedOccurrence({ ...slot, orarioInizio: '06:40' }, 'r-corsa')).toBe(true);
    expect(isMovedOccurrence({ ...slot, giornoLocale: '2026-09-24' }, 'r-corsa')).toBe(true);
  });

  it("il giorno dello slot si legge dall'id, anche con un id di ricorrenza qualsiasi (T-009: eliminare un'occorrenza spostata)", () => {
    expect(occurrenceDay('r-corsa:2026-09-23:07:00', 'r-corsa')).toBe('2026-09-23');
    const uuid = '10000000-1000-4000-8000-100000000000';
    expect(occurrenceDay(occurrenceId(uuid, '2026-10-05', '18:00'), uuid)).toBe('2026-10-05');
  });

  it("gli slot dell'orizzonte stanno in un intervallo di chiavi: da oggi a oggi + 28 inclusi, a ogni orario (D-SCHED-1)", () => {
    const [da, a] = horizonSlotRange('r-corsa', NOW);
    const dentro = (id: string) => id >= da && id <= a;
    expect(dentro(occurrenceId('r-corsa', '2026-09-22', '00:00'))).toBe(true);
    expect(dentro(occurrenceId('r-corsa', '2026-10-20', '23:59'))).toBe(true); // oggi + 28 (§7)
    expect(dentro(occurrenceId('r-corsa', '2026-09-21', '23:59'))).toBe(false);
    expect(dentro(occurrenceId('r-corsa', '2026-10-21', '00:00'))).toBe(false);
    expect(dentro(occurrenceId('r-altra', '2026-09-23', '07:00'))).toBe(false);
    expect(missingOccurrences(ricorrenza(), [], NOW).every((b) => dentro(b.id))).toBe(true);
  });
});

describe('Riancoraggio al cambio di fuso — D-TIME-2 (INV-18)', () => {
  /** Blocco calcolato altrove: istanti 3 ore dopo l'ora di parete di questo processo. */
  const ancorato = (over: Partial<BloccoAncorato> = {}): BloccoAncorato => ({
    id: 'b',
    tipo: 'routine',
    stato: 'programmato',
    conOrario: true,
    giornoLocale: '2026-09-30',
    orarioInizio: '07:00',
    orarioFine: '08:00',
    fuso: 'America/New_York',
    inizio: local(2026, 9, 30, 7, 0) + 3 * HOUR,
    fine: local(2026, 9, 30, 8, 0) + 3 * HOUR,
    ...over,
  });

  it('stessa ora di parete, istanti ricalcolati nel fuso corrente, fuso aggiornato', () => {
    const [b] = reanchor([ancorato()], 'Europe/Rome', NOW);
    expect(b).toMatchObject({
      inizio: local(2026, 9, 30, 7, 0),
      fine: local(2026, 9, 30, 8, 0),
      fuso: 'Europe/Rome',
      orarioInizio: '07:00',
    });
    expect(localTimeKey(b!.inizio)).toBe('07:00');
    expect(b!.inizio).not.toBe(ancorato().inizio);
  });

  it('converge: dopo il riancoraggio una seconda passata non cambia nulla', () => {
    expect(reanchor(reanchor([ancorato()], 'Europe/Rome', NOW), 'Europe/Rome', NOW)).toEqual([]);
  });

  it('stesso fuso, blocco chiuso o giorno passato: gli istanti restano', () => {
    expect(reanchor([ancorato({ fuso: 'Europe/Rome' })], 'Europe/Rome', NOW)).toEqual([]);
    expect(reanchor([ancorato({ stato: 'completato' })], 'Europe/Rome', NOW)).toEqual([]);
    expect(reanchor([ancorato({ giornoLocale: '2026-09-21' })], 'Europe/Rome', NOW)).toEqual([]);
  });

  it("oggi conta come futuro anche se l'orario è passato: si riancora prima del giudizio (D-OCC-1)", () => {
    const [b] = reanchor([ancorato({ giornoLocale: OGGI })], 'Europe/Rome', NOW);
    expect(b?.inizio).toBe(local(2026, 9, 22, 7, 0));
  });

  it('routine notturna e senza durata: fine il giorno dopo, o assente', () => {
    const [notte] = reanchor([ancorato({ orarioInizio: '23:00', orarioFine: '01:00' })], 'Europe/Rome', NOW);
    expect([notte!.inizio, notte!.fine]).toEqual([local(2026, 9, 30, 23, 0), local(2026, 10, 1, 1, 0)]);
    const [senza] = reanchor([ancorato({ orarioFine: null, fine: null })], 'Europe/Rome', NOW);
    expect(senza!.fine).toBeNull();
  });

  it("un'occorrenza spostata dall'utente (14:40 memorizzato) resta alle 14:40 nel fuso nuovo", () => {
    const [b] = reanchor([ancorato({ orarioInizio: '14:40', orarioFine: '15:40' })], 'Europe/Rome', NOW);
    expect([b!.inizio, b!.fine]).toEqual([local(2026, 9, 30, 14, 40), local(2026, 9, 30, 15, 40)]);
  });
});
