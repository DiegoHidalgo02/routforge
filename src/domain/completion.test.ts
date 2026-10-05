import { describe, expect, it } from 'vitest';
import {
  canCheckFromCalendar,
  canComplete,
  checkCircle,
  completed,
  directCheckStep,
  reopened,
  shownState,
  skipped,
} from './completion';
import { local } from './time';
import type { Blocco } from './types';

const block = (over: Partial<Blocco>): Blocco => ({
  id: 'x',
  tipo: 'routine',
  stato: 'programmato',
  inizio: local(2026, 9, 23, 7, 0), // mercoledì
  fine: local(2026, 9, 23, 8, 0),
  conOrario: true,
  ...over,
});

describe('Finestra di spunta — SCENARI B2 (routine 07:00–08:00 di mercoledì)', () => {
  const b = block({});
  it('martedì e giovedì non è spuntabile; mercoledì lo è dalle 00:00 alle 23:59', () => {
    expect(canComplete(b, local(2026, 9, 22, 23, 59))).toBe(false);
    expect(canComplete(b, local(2026, 9, 23, 0, 0))).toBe(true);
    expect(canComplete(b, local(2026, 9, 23, 23, 59))).toBe(true);
    expect(canComplete(b, local(2026, 9, 24, 0, 0))).toBe(false);
  });
  it('persa dalle 08:30 resta spuntabile fino alle 23:59 di mercoledì; la spunta azzera la marcatura (§8)', () => {
    const persa = block({ stato: 'perso', persoIl: local(2026, 9, 23, 8, 30) });
    const alle9 = local(2026, 9, 23, 9, 0);
    expect(canComplete(persa, alle9)).toBe(true);
    expect(completed(persa, alle9)).toMatchObject({ stato: 'completato', chiusoIl: alle9, persoIl: null });
    expect(canComplete(persa, local(2026, 9, 24, 9, 0))).toBe(false);
  });
});

describe('Spunta e completamento — MECCANISMI §3', () => {
  it('todo: sempre, anche «non fatto»; evento: sempre («Completa evento»); studio: mai (solo esito)', () => {
    const domani = local(2026, 9, 24, 12, 0);
    expect(canComplete(block({ tipo: 'todo', stato: 'perso' }), domani)).toBe(true);
    expect(canComplete(block({ tipo: 'evento' }), domani)).toBe(true);
    expect(canComplete(block({ tipo: 'studio' }), local(2026, 9, 23, 7, 30))).toBe(false);
  });
  it('completare scrive stato e istante; annullare torna programmato con l’istante azzerato', () => {
    const b = block({});
    const alle730 = local(2026, 9, 23, 7, 30);
    const fatta = completed(b, alle730);
    expect(fatta).toMatchObject({ stato: 'completato', chiusoIl: alle730 });
    expect(reopened(fatta)).toMatchObject({ stato: 'programmato', chiusoIl: null });
    expect(b.stato).toBe('programmato');
  });
  it('saltare un’occorrenza di routine (FUNZ §4.3): stato saltato con l’istante', () => {
    const alle712 = local(2026, 9, 23, 7, 12);
    expect(skipped(block({}), alle712)).toMatchObject({ stato: 'saltato', chiusoIl: alle712 });
  });
  it('stato mostrato: un evento non completato con la fine passata è «concluso», mai perso (SCENARI E2); gli altri restano', () => {
    const evento = block({ tipo: 'evento', inizio: local(2026, 9, 25, 15, 0), fine: local(2026, 9, 25, 16, 0) });
    expect(shownState(evento, local(2026, 9, 25, 15, 30))).toBe('programmato');
    expect(shownState(evento, local(2026, 9, 26, 10, 0))).toBe('concluso');
    expect(shownState({ ...evento, stato: 'completato' }, local(2026, 9, 26, 10, 0))).toBe('completato');
    expect(shownState(block({ stato: 'perso' }), local(2026, 9, 26, 10, 0))).toBe('perso');
  });
  it('evento tutto il giorno (E3): «concluso» solo dopo le 23:59 del suo giorno', () => {
    const tuttoIlGiorno = block({
      tipo: 'evento',
      conOrario: false,
      inizio: local(2026, 9, 25, 0, 0),
      fine: local(2026, 9, 25, 23, 59),
    });
    expect(shownState(tuttoIlGiorno, local(2026, 9, 25, 23, 58))).toBe('programmato');
    expect(shownState(tuttoIlGiorno, local(2026, 9, 26, 0, 0))).toBe('concluso');
  });
});

describe('Spunta diretta dalla card del calendario — MECCANISMI §3 (D-DETT-3)', () => {
  const mercoledi = local(2026, 9, 23, 9, 0);
  it('todo: sempre, da qualsiasi giorno e anche «non fatto»; già completato no', () => {
    expect(canCheckFromCalendar(block({ tipo: 'todo' }), local(2026, 9, 30, 9, 0))).toBe(true);
    expect(canCheckFromCalendar(block({ tipo: 'todo', stato: 'perso' }), mercoledi)).toBe(true);
    expect(canCheckFromCalendar(block({ tipo: 'todo', stato: 'completato' }), mercoledi)).toBe(false);
  });
  it('routine programmata: solo nel giorno previsto, dalle 00:00 alle 23:59', () => {
    expect(canCheckFromCalendar(block({}), local(2026, 9, 22, 23, 59))).toBe(false);
    expect(canCheckFromCalendar(block({}), local(2026, 9, 23, 0, 0))).toBe(true);
    expect(canCheckFromCalendar(block({}), local(2026, 9, 23, 23, 59))).toBe(true);
    expect(canCheckFromCalendar(block({}), local(2026, 9, 24, 0, 0))).toBe(false);
  });
  it('routine a cavallo di mezzanotte (sabato 23:00 – domenica 01:00): domenica dentro [inizio, fine], non dopo', () => {
    const notte = block({ inizio: local(2026, 9, 26, 23, 0), fine: local(2026, 9, 27, 1, 0) });
    expect(canCheckFromCalendar(notte, local(2026, 9, 27, 0, 30))).toBe(true);
    expect(canCheckFromCalendar(notte, local(2026, 9, 27, 1, 1))).toBe(false);
  });
  it('evento: «Completa evento» dal cerchio, senza vincolo di giorno; già completato no (§3)', () => {
    expect(canCheckFromCalendar(block({ tipo: 'evento' }), mercoledi)).toBe(true);
    expect(canCheckFromCalendar(block({ tipo: 'evento' }), local(2026, 9, 30, 9, 0))).toBe(true);
    expect(canCheckFromCalendar(block({ tipo: 'evento', stato: 'completato' }), mercoledi)).toBe(false);
  });
});

describe('Esito dal cerchio — SCENARI C10', () => {
  const studio = block({ tipo: 'studio', inizio: local(2026, 9, 23, 9, 0), fine: local(2026, 9, 23, 10, 0) });
  const alle1020 = local(2026, 9, 23, 10, 20);
  it('occorrenza di oggi 09:00–10:00, nessuna sessione, alle 10:20: il cerchio apre «Registra esito» (§3, §11)', () => {
    expect(canCheckFromCalendar(studio, alle1020)).toBe(true);
    expect(checkCircle(studio, alle1020)).toBe('attivo');
    expect(directCheckStep(studio, false)).toBe('esito');
  });
  it('un’occorrenza di domani ha il cerchio spento; prima della fine e in corso pure; persa niente cerchio (§24)', () => {
    const domani = block({ tipo: 'studio', inizio: local(2026, 9, 24, 9, 0), fine: local(2026, 9, 24, 10, 0) });
    expect(checkCircle(domani, alle1020)).toBe('spento');
    expect(checkCircle(studio, local(2026, 9, 23, 9, 30))).toBe('spento');
    expect(checkCircle({ ...studio, stato: 'in_corso' }, alle1020)).toBe('spento');
    expect(checkCircle({ ...studio, stato: 'perso' }, local(2026, 9, 23, 11, 0))).toBe('assente');
  });
});

describe('Cerchio della card di Oggi — MECCANISMI §3, §24 (S1 «cerchio spento»)', () => {
  const mercoledi = local(2026, 9, 23, 9, 0);
  it('fatto se completato; routine di un altro giorno spenta; persi e saltati senza cerchio, salvo il todo', () => {
    expect(checkCircle(block({ stato: 'completato' }), mercoledi)).toBe('fatto');
    expect(checkCircle(block({}), mercoledi)).toBe('attivo');
    expect(checkCircle(block({}), local(2026, 9, 24, 9, 0))).toBe('spento');
    expect(checkCircle(block({ stato: 'perso' }), mercoledi)).toBe('assente');
    expect(checkCircle(block({ stato: 'saltato' }), mercoledi)).toBe('assente');
    expect(checkCircle(block({ tipo: 'todo', stato: 'perso' }), mercoledi)).toBe('attivo');
    expect(checkCircle(block({ tipo: 'evento' }), local(2026, 9, 30, 9, 0))).toBe('attivo');
  });
});

describe('Persi e saltati dal calendario — MECCANISMI §24 (docs/00_SINTESI.md §6, n. 26)', () => {
  const alle9 = local(2026, 9, 23, 9, 0);
  it('routine persa alle 08:30 nel suo giorno: niente spunta dal cerchio, ma «Fatta» dal dettaglio fino alle 23:59 (B2)', () => {
    const persa = block({ stato: 'perso', persoIl: local(2026, 9, 23, 8, 30) });
    expect(canCheckFromCalendar(persa, alle9)).toBe(false);
    expect(canComplete(persa, alle9)).toBe(true);
  });
  it('saltata e completata neppure; il todo «non fatto» sì', () => {
    expect(canCheckFromCalendar(block({ stato: 'saltato' }), alle9)).toBe(false);
    expect(canCheckFromCalendar(block({ stato: 'completato' }), alle9)).toBe(false);
    expect(canCheckFromCalendar(block({ tipo: 'todo', stato: 'perso' }), alle9)).toBe(true);
  });
});

describe('Passo della spunta diretta — MECCANISMI §3–§5 (D-DETT-2, D-DETT-3)', () => {
  const voci = (...fatte: boolean[]) => fatte.map((fatta, i) => ({ testo: `voce ${i + 1}`, fatta }));
  it('fasi nella definizione: si apre la revisione e si scrive solo al Conferma (§3, §5)', () => {
    expect(directCheckStep(block({}), true)).toBe('revisione');
  });
  it('todo con voci non spuntate: si sceglie se creare il todo con le voci rimaste (§4)', () => {
    expect(directCheckStep(block({ tipo: 'todo', checklist: voci(true, false, false) }), false)).toBe('residuo');
  });
  it('altrimenti completamento immediato, anche con la lista vuota (§4: la lista vuota non è «tutto fatto»)', () => {
    expect(directCheckStep(block({}), false)).toBe('completa');
    expect(directCheckStep(block({ tipo: 'todo' }), false)).toBe('completa');
    expect(directCheckStep(block({ tipo: 'todo', checklist: [] }), false)).toBe('completa');
    expect(directCheckStep(block({ tipo: 'todo', checklist: voci(true, true) }), false)).toBe('completa');
  });
});
