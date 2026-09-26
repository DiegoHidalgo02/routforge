import { describe, expect, it } from 'vitest';
import { shouldMarkLost } from '../lost';
import { endOfLocalDay, local, localDayKey, localTimeKey } from '../time';
import type { BloccoAncorato } from '../types';
import { lateNoticeDue, rollPlan } from './horizon';

/** Un blocco come lo salva il repository: giorno locale e ora di parete dagli istanti (D-TIME-2), salvo override. */
function mk(id: string, over: Partial<BloccoAncorato> & Pick<BloccoAncorato, 'inizio'>): BloccoAncorato {
  const fine = over.fine === undefined ? null : over.fine;
  return {
    id,
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

// Settembre 2026: martedì 22, mercoledì 23, domenica 27, lunedì 28.
const oggi = (h: number, m = 0) => local(2026, 9, 23, h, m);
const spesa = (over: Partial<BloccoAncorato> = {}) =>
  mk('spesa', {
    titolo: 'Spesa',
    orizzonte: 'settimana',
    inizio: local(2026, 9, 22, 18, 0),
    fine: local(2026, 9, 22, 18, 30),
    ...over,
  });
/** Un blocco con orario di mercoledì (oggi nei test), evento se non detto altrimenti. */
const di = (id: string, da: [number, number], a: [number, number], over: Partial<BloccoAncorato> = {}) =>
  mk(id, { tipo: 'evento', inizio: oggi(...da), fine: oggi(...a), ...over });
const istanti = (b: BloccoAncorato | undefined) => b && [b.inizio, b.fine];
/** Il blocco come lo riscrive `saveBlock`: giorno e ora di parete dai nuovi istanti. */
const salvato = (b: BloccoAncorato): BloccoAncorato => ({
  ...b,
  giornoLocale: localDayKey(b.inizio),
  orarioInizio: localTimeKey(b.inizio),
  orarioFine: b.fine === null ? null : localTimeKey(b.fine),
});

describe('Spostamento a oggi — SCENARI A2 (todo «Spesa» di martedì 18:00, 30 minuti, orizzonte settimana)', () => {
  it("mercoledì all'apertura va a mercoledì alle 18:00, se lo slot è libero", () => {
    const { spostati } = rollPlan([spesa()], oggi(9));
    expect(spostati.map((b) => [b.id, b.inizio, b.fine])).toEqual([['spesa', oggi(18), oggi(18, 30)]]);
  });

  it("altrimenti nel primo varco di 30' libero dopo l'ora corrente, entro le 22:00", () => {
    const blocchi = [
      spesa(),
      di('cena', [18, 0], [19, 0]),
      di('r1', [9, 0], [10, 0], { tipo: 'routine' }),
      di('r2', [10, 15], [11, 0], { tipo: 'routine' }),
    ];
    // 10:00–10:15 è un varco di 15': il primo di 30' è alle 11:00
    expect(istanti(rollPlan(blocchi, oggi(9)).spostati[0])).toEqual([oggi(11), oggi(11, 30)]);
  });

  it('rotola ogni giorno fino a domenica; lunedì resta a domenica e diventa «non fatto»', () => {
    const domenica = spesa({ inizio: local(2026, 9, 27, 18, 0), fine: local(2026, 9, 27, 18, 30) });
    expect(rollPlan([spesa()], local(2026, 9, 27, 9, 0)).spostati[0]?.inizio).toBe(local(2026, 9, 27, 18, 0));
    expect(rollPlan([domenica], local(2026, 9, 28, 9, 0)).spostati).toEqual([]);
    expect(shouldMarkLost(domenica, local(2026, 9, 28, 9, 0))).toBe(true);
  });
});

describe('Non fatto — SCENARI A1 (todo «Chiama Marco» di ieri, senza orario, orizzonte giorno)', () => {
  const marco = mk('marco', {
    titolo: 'Chiama Marco',
    conOrario: false,
    orizzonte: 'giorno',
    inizio: local(2026, 9, 22, 12, 0),
    fine: endOfLocalDay(local(2026, 9, 22, 12, 0)),
  });

  it("alle 00:30 del giorno dopo non rotola: resta nel giorno di ieri ed è «non fatto», con l'avviso ancora da dare", () => {
    expect(rollPlan([marco], local(2026, 9, 23, 0, 30))).toEqual({ spostati: [], avvisi: [] });
    expect(shouldMarkLost(marco, local(2026, 9, 23, 0, 30))).toBe(true);
    expect(lateNoticeDue(marco)).toBe(true);
  });
});

describe('Spostamento a oggi — MECCANISMI §6 (chi rotola)', () => {
  it('senza orario va all’ancora di oggi, 12:00–23:59', () => {
    const t = mk('t', {
      conOrario: false,
      orizzonte: 'mese',
      inizio: local(2026, 9, 10, 12, 0),
      fine: endOfLocalDay(local(2026, 9, 10, 12, 0)),
    });
    expect(istanti(rollPlan([t], oggi(7)).spostati[0])).toEqual([oggi(12), endOfLocalDay(oggi(12))]);
  });

  it("orizzonte mese: rotola fino all'ultimo giorno del mese, poi resta com'è", () => {
    const t = mk('t', { orizzonte: 'mese', inizio: local(2026, 9, 1, 9, 0), fine: local(2026, 9, 1, 9, 30) });
    expect(rollPlan([t], local(2026, 9, 30, 7, 0)).spostati).toHaveLength(1);
    expect(rollPlan([t], local(2026, 10, 1, 7, 0)).spostati).toEqual([]);
  });

  it('non rotolano: orizzonte giorno, giorno di oggi o futuro, todo chiusi o persi, blocchi di altro tipo', () => {
    const ieri = { inizio: local(2026, 9, 22, 9, 0), fine: local(2026, 9, 22, 9, 30), orizzonte: 'settimana' as const };
    const blocchi = [
      mk('giorno', { ...ieri, orizzonte: 'giorno' }),
      mk('oggi', { ...ieri, inizio: oggi(9), fine: oggi(9, 30) }),
      mk('domani', { ...ieri, inizio: local(2026, 9, 24, 9, 0), fine: local(2026, 9, 24, 9, 30) }),
      mk('fatto', { ...ieri, stato: 'completato' }),
      mk('perso', { ...ieri, stato: 'perso' }),
      mk('saltato', { ...ieri, stato: 'saltato' }),
      mk('routine', { ...ieri, tipo: 'routine' }),
    ];
    expect(rollPlan(blocchi, oggi(10))).toEqual({ spostati: [], avvisi: [] });
  });

  it("l'orario originale è l'ora di parete del todo, non quella dei suoi istanti nel fuso corrente (D-TIME-2)", () => {
    // Creato alle 18:00 in un altro fuso: gli istanti cadono alle 12:00 locali, l'ora di parete resta 18:00
    const t = spesa({ inizio: local(2026, 9, 22, 12, 0), fine: local(2026, 9, 22, 12, 30), orarioInizio: '18:00' });
    expect(istanti(rollPlan([t], oggi(9)).spostati[0])).toEqual([oggi(18), oggi(18, 30)]);
  });
});

describe('Slot libero — MECCANISMI §6 (finestra 08:00–22:00, stessa durata, ripieghi; D-HOR-1)', () => {
  const occupato = di('cena', [18, 0], [19, 0]);

  it("l'orario originale libero vale anche se è già passato: la ricerca da adesso serve solo se è occupato", () => {
    expect(istanti(rollPlan([spesa()], oggi(19, 10)).spostati[0])).toEqual([oggi(18), oggi(18, 30)]);
  });

  it('la ricerca da adesso parte dal multiplo di 5 minuti successivo', () => {
    expect(rollPlan([spesa(), occupato], oggi(9, 2)).spostati[0]?.inizio).toBe(oggi(9, 5));
  });

  it("prima delle 08:00 la ricerca parte dall'inizio della finestra; un orario fuori finestra non vale", () => {
    const presto = spesa({ inizio: local(2026, 9, 22, 6, 30), fine: local(2026, 9, 22, 7, 0) });
    expect(istanti(rollPlan([presto], oggi(7)).spostati[0])).toEqual([oggi(8), oggi(8, 30)]);
  });

  it("senza varchi entro le 22:00: l'orario originale anche se sovrapposto", () => {
    expect(rollPlan([spesa(), occupato], oggi(21, 40)).spostati[0]?.inizio).toBe(oggi(18));
  });

  it("senza varchi e con l'orario originale fuori finestra: l'inizio della finestra", () => {
    const tardi = spesa({ inizio: local(2026, 9, 22, 21, 45), fine: local(2026, 9, 22, 22, 15) });
    expect(istanti(rollPlan([tardi], oggi(21, 50)).spostati[0])).toEqual([oggi(8), oggi(8, 30)]);
  });

  it('occupano i blocchi con orario e durata programmati o in corso, anche quelli di ieri che sconfinano', () => {
    const blocchi = [
      spesa(),
      di('fatto', [18, 0], [19, 0], { stato: 'completato' }),
      di('senzaOrario', [12, 0], [23, 59], { conOrario: false }),
      di('senzaDurata', [18, 10], [18, 10], { tipo: 'routine', fine: null }),
      mk('notte', { tipo: 'routine', inizio: local(2026, 9, 22, 22, 0), fine: oggi(9, 0) }),
    ];
    // 18:00 resta libero: completati, blocchi senza orario e senza durata non occupano
    expect(rollPlan(blocchi, oggi(7)).spostati[0]?.inizio).toBe(oggi(18));
    const inCorso = di('studio', [17, 45], [18, 45], { tipo: 'studio', stato: 'in_corso' });
    // Con 18:00 occupato si cerca da adesso (07:00 → 08:00), ma la routine della notte occupa fino alle 09:00
    expect(rollPlan([...blocchi, inCorso], oggi(7)).spostati[0]?.inizio).toBe(oggi(9));
  });

  it('due todo che rotolano insieme non si sovrappongono: il secondo trova occupato lo slot del primo', () => {
    const acqua = spesa({ id: 'acqua', inizio: local(2026, 9, 22, 18, 10), fine: local(2026, 9, 22, 18, 40) });
    const { spostati } = rollPlan([acqua, spesa()], oggi(9));
    expect(spostati.map((b) => [b.id, b.inizio])).toEqual([
      ['spesa', oggi(18)],
      ['acqua', oggi(9)],
    ]);
  });
});

describe('Avviso «todo in ritardo» — MECCANISMI §6, §13.6 (una volta per todo)', () => {
  it('al primo spostamento il todo prende `ritardoIl` e il suo avviso parte', () => {
    const piano = rollPlan([spesa()], oggi(9));
    expect(piano.avvisi).toEqual(['spesa']);
    expect(piano.spostati[0]?.ritardoIl).toBe(oggi(9));
  });

  it('agli spostamenti successivi nessun avviso e `ritardoIl` invariato', () => {
    const giaAvvisato = spesa({ ritardoIl: local(2026, 9, 23, 9, 0) });
    const piano = rollPlan([giaAvvisato], local(2026, 9, 24, 9, 0));
    expect(piano.avvisi).toEqual([]);
    expect(piano.spostati[0]?.ritardoIl).toBe(local(2026, 9, 23, 9, 0));
  });

  it("l'avviso spetta ai soli todo mai avvisati", () => {
    expect(lateNoticeDue(spesa())).toBe(true);
    expect(lateNoticeDue(spesa({ ritardoIl: oggi(9) }))).toBe(false);
    expect(lateNoticeDue(di('e', [9, 0], [10, 0]))).toBe(false);
  });

  it('rieseguire dopo aver applicato il piano non sposta nulla (idempotenza, MECCANISMI §9)', () => {
    const { spostati } = rollPlan([spesa()], oggi(9));
    expect(rollPlan(spostati.map(salvato), oggi(9, 1))).toEqual({ spostati: [], avvisi: [] });
  });
});

describe('Orario originale — MECCANISMI §6 (punto 1; D-HOR-1)', () => {
  it('spostato in un varco perché le 18:00 erano occupate, il giorno dopo torna alle 18:00 se sono libere', () => {
    const mercoledi = rollPlan([spesa(), di('cena', [18, 0], [19, 0])], oggi(10)).spostati[0]!;
    expect([mercoledi.inizio, mercoledi.orarioOriginale]).toEqual([oggi(10), '18:00']);
    const giovedi = rollPlan([salvato(mercoledi)], local(2026, 9, 24, 9, 0)).spostati[0]!;
    expect([giovedi.inizio, giovedi.orarioOriginale]).toEqual([local(2026, 9, 24, 18, 0), null]);
  });

  it('al suo orario il todo non ricorda nulla: `orarioOriginale` resta vuoto', () => {
    expect(rollPlan([spesa()], oggi(9)).spostati[0]?.orarioOriginale).toBeNull();
  });
});

describe('Fuso cambiato — D-TIME-2 (il giorno del todo è quello di parete, `giornoLocale`)', () => {
  // Un giorno passato non si riancora: gli istanti restano quelli del vecchio fuso e possono cadere in un altro giorno
  it('martedì 23:30 a Roma cade mercoledì mattina nel fuso nuovo: mercoledì rotola comunque', () => {
    const t = spesa({ inizio: oggi(6, 30), fine: oggi(7, 0), giornoLocale: '2026-09-22', orarioInizio: '23:30' });
    expect(istanti(rollPlan([t], oggi(9)).spostati[0])).toEqual([oggi(9), oggi(9, 30)]);
  });

  it("un todo di lunedì i cui istanti cadono domenica: l'orizzonte è la domenica dopo, martedì rotola e non è «non fatto»", () => {
    const t = spesa({
      inizio: local(2026, 9, 27, 23, 30),
      fine: local(2026, 9, 28, 0, 0),
      giornoLocale: '2026-09-28',
      orarioInizio: '07:30',
    });
    const martedi = local(2026, 9, 29, 9, 0);
    expect(rollPlan([t], martedi).spostati).toHaveLength(1);
    expect(shouldMarkLost(t, martedi)).toBe(false);
  });

  it("un todo di domenica i cui istanti cadono lunedì: l'orizzonte è quella domenica, martedì non rotola ed è «non fatto»", () => {
    const t = spesa({
      inizio: local(2026, 9, 28, 0, 30),
      fine: local(2026, 9, 28, 1, 0),
      giornoLocale: '2026-09-27',
      orarioInizio: '17:30',
    });
    const martedi = local(2026, 9, 29, 9, 0);
    expect(rollPlan([t], martedi).spostati).toEqual([]);
    expect(shouldMarkLost(t, martedi)).toBe(true);
  });
});

describe('Slot libero — MECCANISMI §6 (confini dei varchi)', () => {
  const cena = di('cena', [18, 0], [19, 0]);

  it('un varco esattamente lungo quanto il todo basta', () => {
    const blocchi = [spesa(), cena, di('a', [9, 0], [10, 0]), di('b', [10, 30], [11, 0])];
    expect(rollPlan(blocchi, oggi(9)).spostati[0]?.inizio).toBe(oggi(10));
  });

  it('il varco può finire alle 22:00 in punto, non dopo', () => {
    expect(rollPlan([spesa(), cena, di('a', [20, 0], [21, 30])], oggi(21)).spostati[0]?.inizio).toBe(oggi(21, 30));
    expect(rollPlan([spesa(), cena, di('a', [20, 0], [21, 35])], oggi(21)).spostati[0]?.inizio).toBe(oggi(18));
  });

  it("blocchi adiacenti all'orario originale non lo occupano", () => {
    const blocchi = [spesa(), di('a', [17, 30], [18, 0]), di('b', [18, 30], [19, 0])];
    expect(rollPlan(blocchi, oggi(9)).spostati[0]?.inizio).toBe(oggi(18));
  });

  it('blocchi sovrapposti fra loro chiudono il varco fino alla fine del più lungo', () => {
    const blocchi = [spesa(), cena, di('a', [9, 0], [11, 0]), di('b', [9, 30], [10, 0]), di('c', [10, 45], [11, 30])];
    expect(rollPlan(blocchi, oggi(9)).spostati[0]?.inizio).toBe(oggi(11, 30));
  });

  it('i blocchi persi e saltati di oggi non occupano', () => {
    const blocchi = [
      spesa(),
      di('p', [18, 0], [19, 0], { stato: 'perso' }),
      di('s', [18, 0], [18, 30], { stato: 'saltato' }),
    ];
    expect(rollPlan(blocchi, oggi(9)).spostati[0]?.inizio).toBe(oggi(18));
  });

  it("nel giorno del cambio d'ora (25/10/2026) resta alle 18:00 per 30 minuti", () => {
    const t = spesa({ inizio: local(2026, 10, 24, 18, 0), fine: local(2026, 10, 24, 18, 30) });
    expect(istanti(rollPlan([t], local(2026, 10, 25, 9, 0)).spostati[0])).toEqual([
      local(2026, 10, 25, 18, 0),
      local(2026, 10, 25, 18, 30),
    ]);
  });

  it('un todo con orario senza fine (dati non nati dal form) resta senza fine e non occupa tempo', () => {
    const t = spesa({ id: 'senzaFine', fine: null });
    const { spostati } = rollPlan([t, spesa()], oggi(9));
    expect(spostati.map((b) => [b.id, b.inizio, b.fine])).toEqual([
      ['senzaFine', oggi(18), null],
      ['spesa', oggi(18), oggi(18, 30)],
    ]);
  });
});

describe('Spostamento a oggi — MECCANISMI §6 (orizzonte assente e mezzanotte)', () => {
  it('senza orizzonte vale «giorno»: non rotola', () => {
    const t = spesa();
    delete t.orizzonte;
    expect(rollPlan([t], oggi(9)).spostati).toEqual([]);
  });

  it('a mezzanotte in punto i todo di ieri rotolano; uno di ieri 23:45–00:15 alle 00:05 va nel primo varco dalle 08:00', () => {
    expect(rollPlan([spesa()], oggi(0)).spostati[0]?.inizio).toBe(oggi(18));
    const tardi = spesa({ inizio: local(2026, 9, 22, 23, 45), fine: oggi(0, 15) });
    expect(istanti(rollPlan([tardi], oggi(0, 5)).spostati[0])).toEqual([oggi(8), oggi(8, 30)]);
  });
});
