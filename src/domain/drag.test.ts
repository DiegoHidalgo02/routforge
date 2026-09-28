import { describe, expect, it } from 'vitest';
import { canDrag, dropDays, dropDuration, dropReferences, dropStart, movedBlock, timeOnDay } from './drag';
import { endOfLocalDay, local, localDayKey, localTimeKey, minutes } from './time';
import type { BloccoAncorato } from './types';

/** Un blocco come lo salva il repository: giorno locale e ora di parete dagli istanti (D-TIME-2), salvo override. */
function mk(over: Partial<BloccoAncorato> & Pick<BloccoAncorato, 'inizio'>): BloccoAncorato {
  const fine = over.fine === undefined ? null : over.fine;
  return {
    id: 'b',
    tipo: 'todo',
    stato: 'programmato',
    conOrario: true,
    fuso: 'Europe/Rome',
    giornoLocale: localDayKey(over.inizio),
    orarioInizio: localTimeKey(over.inizio),
    orarioFine: fine === null ? null : localTimeKey(fine),
    ...over,
    fine,
  };
}

// Settembre 2026: lunedì 28 (oggi nei test), martedì 29; il 25 ottobre finisce l'ora legale in Europa.
const oggi = (h: number, m = 0) => local(2026, 9, 28, h, m);
const domani = (h: number, m = 0) => local(2026, 9, 29, h, m);
/** «Leggere 20 pagine»: todo senza orario di oggi, ancora 12:00–23:59 (§1). */
const leggere = (over: Partial<BloccoAncorato> = {}) =>
  mk({ titolo: 'Leggere 20 pagine', conOrario: false, inizio: oggi(12), fine: endOfLocalDay(oggi(12)), ...over });
/** «Palestra»: routine 08:30–09:30 di oggi, persa (fine + 30' passata alle 10:00). */
const palestra = (over: Partial<BloccoAncorato> = {}) =>
  mk({
    id: 'r1:2026-09-28:08:30',
    tipo: 'routine',
    stato: 'perso',
    persoIl: oggi(10, 1),
    titolo: 'Palestra',
    ricorrenzaId: 'r1',
    inizio: oggi(8, 30),
    fine: oggi(9, 30),
    ...over,
  });
const blocco = (da: [number, number], a: [number, number] | null) => ({
  inizio: oggi(...da),
  fine: a && oggi(...a),
});

describe('Chi si trascina — MECCANISMI §15, SCENARI G3', () => {
  it('i todo senza orario ancora da fare e i blocchi persi di ogni tipo (D-DESIGN-1 n. 2)', () => {
    expect(canDrag(leggere())).toBe(true);
    expect(canDrag(palestra())).toBe(true);
    expect(canDrag(palestra({ tipo: 'studio' }))).toBe(true);
    expect(canDrag(leggere({ stato: 'perso' }))).toBe(true);
    expect(canDrag(mk({ stato: 'perso', inizio: oggi(10), fine: oggi(10, 30) }))).toBe(true);
  });

  it('un evento, una routine o un todo con orario non persi non si trascinano; nemmeno un todo già fatto', () => {
    expect(canDrag(mk({ tipo: 'evento', inizio: oggi(15), fine: oggi(16) }))).toBe(false);
    expect(canDrag(mk({ tipo: 'evento', conOrario: false, inizio: oggi(0), fine: endOfLocalDay(oggi(0)) }))).toBe(
      false,
    );
    expect(canDrag(palestra({ stato: 'programmato', persoIl: null }))).toBe(false);
    expect(canDrag(mk({ inizio: oggi(18), fine: oggi(18, 30) }))).toBe(false);
    expect(canDrag(leggere({ stato: 'completato' }))).toBe(false);
    expect(canDrag(palestra({ stato: 'in_corso' }))).toBe(false);
  });
});

describe('Durata del rilascio su un orario — MECCANISMI §15', () => {
  it('quella dichiarata; 30 minuti, il default del form Crea, per il todo senza orario; nessuna se non ce l’ha', () => {
    expect(dropDuration(palestra())).toBe(minutes(60));
    expect(dropDuration(leggere())).toBe(minutes(30));
    expect(dropDuration(palestra({ fine: null }))).toBeNull();
  });
});

describe('Aggancio a passi di 5 minuti — SCENARI G3', () => {
  const trenta = minutes(30);
  const fraDue = [blocco([15, 0], [15, 40]), blocco([16, 0], [17, 0])];

  it('fra 15:00–15:40 e 16:00–17:00 il todo di 30 minuti si aggancia alle 15:40, anche se sfora sul secondo', () => {
    expect(dropStart(fraDue, 1, trenta, '2026-09-28', oggi(9))).toBe(oggi(15, 40));
  });

  it('dopo il blocco che finisce per ultimo fra quelli sopra, per eccesso al multiplo di 5 minuti', () => {
    expect(dropStart([blocco([15, 0], [15, 37])], 1, trenta, '2026-09-28', oggi(9))).toBe(oggi(15, 40));
    const sovrapposti = [blocco([14, 0], [16, 30]), blocco([15, 0], [15, 40])];
    expect(dropStart(sovrapposti, 2, trenta, '2026-09-28', oggi(9))).toBe(oggi(16, 30));
    // Una routine senza durata occupa il suo istante d'inizio
    expect(dropStart([blocco([7, 0], null)], 1, trenta, '2026-09-28', oggi(6))).toBe(oggi(7, 0));
  });

  it('sopra il primo blocco finisce quando quello inizia, per difetto; senza blocchi con orario alle 08:00', () => {
    expect(dropStart(fraDue, 0, trenta, '2026-09-28', oggi(9))).toBe(oggi(14, 30));
    expect(dropStart([blocco([9, 2], [10, 0])], 0, trenta, '2026-09-28', oggi(6))).toBe(oggi(8, 30));
    expect(dropStart([], 0, trenta, '2026-09-29', oggi(9))).toBe(domani(8, 0));
  });

  it('mai prima di adesso: oggi parte dal multiplo di 5 minuti successivo', () => {
    expect(dropStart(fraDue, 1, trenta, '2026-09-28', oggi(15, 52))).toBe(oggi(15, 55));
    expect(dropStart([], 0, trenta, '2026-09-28', oggi(9, 1))).toBe(oggi(9, 5));
  });

  it('fuori dal giorno mostrato non si aggancia: giorno passato, dopo mezzanotte, blocco sopra che finisce domani', () => {
    expect(dropStart(fraDue, 1, trenta, '2026-09-27', oggi(9))).toBeNull();
    expect(dropStart([], 0, trenta, '2026-09-28', oggi(23, 58))).toBeNull();
    expect(dropStart([{ inizio: oggi(23, 0), fine: domani(0, 30) }], 1, trenta, '2026-09-28', oggi(9))).toBeNull();
  });

  it('nessuno spazio libero, nessun aggancio: adesso oltre l’inizio del blocco sotto, blocchi sovrapposti', () => {
    expect(dropStart(fraDue, 1, trenta, '2026-09-28', oggi(16, 2))).toBeNull();
    expect(dropStart(fraDue, 0, trenta, '2026-09-28', oggi(15, 2))).toBeNull();
    const sovrapposti = [blocco([14, 0], [16, 30]), blocco([15, 0], [15, 40])];
    expect(dropStart(sovrapposti, 1, trenta, '2026-09-28', oggi(9))).toBeNull();
  });
});

describe('Riferimenti e giorni del rilascio — MECCANISMI §15 (D-DRAG-1)', () => {
  it('l’aggancio guarda i blocchi con orario della giornata, anche terminali, in ordine d’inizio, senza il trascinato', () => {
    const giornata = [
      leggere({ id: 'l' }),
      mk({ id: 'c', tipo: 'evento', stato: 'completato', inizio: oggi(16), fine: oggi(17) }),
      palestra({ id: 'p' }),
      mk({ id: 't', inizio: oggi(15), fine: oggi(15, 40) }),
    ];
    expect(dropReferences(giornata, 'p').map((b) => b.id)).toEqual(['t', 'c']);
    expect(dropReferences(giornata, 'l').map((b) => b.id)).toEqual(['p', 't', 'c']);
  });

  it('su un giorno il blocco tiene il suo orario di parete; il todo senza orario resta senza', () => {
    expect(timeOnDay(palestra())).toBe('08:30');
    expect(timeOnDay(leggere())).toBeNull();
  });

  it('la striscia offre la settimana mostrata se non è passata, altrimenti i sette giorni da oggi', () => {
    const questa = ['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'];
    const scorsa = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];
    const prossima = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'];
    expect(dropDays(questa, '2026-09-28')).toEqual(questa);
    // Un perso della settimana scorsa raggiunge domani: la striscia passa a questa settimana
    expect(dropDays(scorsa, '2026-09-28')).toEqual(questa);
    // Di mercoledì lunedì e martedì sono passati: da oggi a martedì prossimo
    expect(dropDays(questa, '2026-09-30')).toEqual([...questa.slice(2), '2026-10-05', '2026-10-06']);
    expect(dropDays(prossima, '2026-09-30')).toEqual(prossima);
  });
});

describe('Rilascio — MECCANISMI §15, SCENARI G3', () => {
  it('il todo senza orario rilasciato alle 15:40 diventa un todo con orario 15:40–16:10', () => {
    const b = movedBlock(leggere(), { inizio: oggi(15, 40) }, oggi(9))!;
    expect([b.conOrario, b.inizio, b.fine, b.stato]).toEqual([true, oggi(15, 40), oggi(16, 10), 'programmato']);
  });

  it('il todo senza orario perso trascinato a domani nella striscia torna programmato, senza orario', () => {
    const ieri = local(2026, 9, 27, 12);
    const perso = leggere({ stato: 'perso', persoIl: oggi(0, 30), inizio: ieri, fine: endOfLocalDay(ieri) });
    const b = movedBlock(perso, { giorno: '2026-09-29' }, oggi(9))!;
    expect([b.stato, b.persoIl, b.conOrario, b.inizio, b.fine]).toEqual([
      'programmato',
      null,
      false,
      domani(12),
      endOfLocalDay(domani(12)),
    ]);
  });

  it('la routine persa «Palestra» trascinata a domani torna programmata alle 08:30, con la sua durata e il suo slot', () => {
    const b = movedBlock(palestra(), { giorno: '2026-09-29' }, oggi(10, 30))!;
    expect([b.id, b.stato, b.persoIl, b.inizio, b.fine]).toEqual([
      'r1:2026-09-28:08:30',
      'programmato',
      null,
      domani(8, 30),
      domani(9, 30),
    ]);
  });

  it('rilasciato su un orario cambia orario; senza durata resta senza fine', () => {
    const b = movedBlock(palestra(), { inizio: oggi(18) }, oggi(10, 30))!;
    expect([b.inizio, b.fine, b.stato]).toEqual([oggi(18), oggi(19), 'programmato']);
    const senzaDurata = movedBlock(palestra({ fine: null }), { giorno: '2026-09-29' }, oggi(10, 30))!;
    expect([senzaDurata.inizio, senzaDurata.fine]).toEqual([domani(8, 30), null]);
    expect(movedBlock(palestra({ fine: null }), { inizio: oggi(18) }, oggi(10, 30))!.fine).toBeNull();
  });

  it('su un giorno tiene l’ora di parete anche attraverso il cambio dell’ora legale', () => {
    const sabato = palestra({ inizio: local(2026, 10, 24, 8, 30), fine: local(2026, 10, 24, 9, 30) });
    const b = movedBlock(sabato, { giorno: '2026-10-26' }, local(2026, 10, 24, 11))!;
    expect([b.inizio, b.fine]).toEqual([local(2026, 10, 26, 8, 30), local(2026, 10, 26, 9, 30)]);
    // La notte del 25/10 (in Europa le 02:00–03:00 si ripetono) la fine resta quella di parete, D-TIME-2
    const notte = palestra({ inizio: local(2026, 10, 24, 1, 30), fine: local(2026, 10, 24, 3, 30) });
    const n = movedBlock(notte, { giorno: '2026-10-25' }, local(2026, 10, 24, 11))!;
    expect([localTimeKey(n.inizio), localTimeKey(n.fine!)]).toEqual(['01:30', '03:30']);
    // A cavallo di mezzanotte finisce il giorno dopo quello nuovo
    const tardi = palestra({ inizio: oggi(23), fine: domani(1) });
    expect(movedBlock(tardi, { giorno: '2026-10-01' }, oggi(23, 30))?.fine).toBe(local(2026, 10, 2, 1));
  });

  it('restano l’avviso «in ritardo» già dato, le spunte della checklist e la priorità', () => {
    const ieri = local(2026, 9, 27, 12);
    const checklist = [
      { testo: 'Capitolo 1', fatta: true },
      { testo: 'Capitolo 2', fatta: false },
    ];
    const perso = leggere({
      stato: 'perso',
      ritardoIl: oggi(0, 30),
      priorita: 'alta',
      checklist,
      inizio: ieri,
      fine: endOfLocalDay(ieri),
    });
    const b = movedBlock(perso, { giorno: '2026-09-29' }, oggi(9))!;
    expect([b.ritardoIl, b.priorita, b.checklist]).toEqual([oggi(0, 30), 'alta', checklist]);
  });

  it('il todo spostato perde l’orario originale del rotolamento, e tiene l’orario che mostra (D-HOR-1)', () => {
    const nonFatto = mk({ stato: 'perso', orarioOriginale: '10:00', inizio: oggi(14), fine: oggi(14, 30) });
    const b = movedBlock(nonFatto, { giorno: '2026-09-29' }, oggi(20))!;
    expect([b.inizio, b.orarioOriginale]).toEqual([domani(14), null]);
    expect(movedBlock(leggere(), { inizio: oggi(15, 40) }, oggi(9))!.orarioOriginale).toBeNull();
  });

  it('un todo senza orario va anche a oggi, che non è finito', () => {
    const giovedi = leggere({ inizio: local(2026, 10, 1, 12), fine: endOfLocalDay(local(2026, 10, 1, 12)) });
    expect(movedBlock(giovedi, { giorno: '2026-09-28' }, oggi(20))?.inizio).toBe(oggi(12));
  });

  it('non vale: il suo giorno, un giorno passato, un orario passato, un blocco che non si trascina', () => {
    expect(movedBlock(leggere(), { giorno: '2026-09-28' }, oggi(9))).toBeNull();
    expect(movedBlock(leggere(), { giorno: '2026-09-27' }, oggi(9))).toBeNull();
    // Il giorno di oggi per una routine persa di ieri alle 08:30, quando le 08:30 di oggi sono già passate
    const ieri = palestra({ inizio: local(2026, 9, 27, 8, 30), fine: local(2026, 9, 27, 9, 30) });
    expect(movedBlock(ieri, { giorno: '2026-09-28' }, oggi(10, 30))).toBeNull();
    expect(movedBlock(ieri, { giorno: '2026-09-28' }, oggi(7))?.inizio).toBe(oggi(8, 30));
    expect(movedBlock(palestra(), { inizio: oggi(10) }, oggi(10, 30))).toBeNull();
    expect(movedBlock(mk({ tipo: 'evento', inizio: oggi(15), fine: oggi(16) }), { inizio: oggi(18) }, oggi(9))).toBe(
      null,
    );
  });
});
