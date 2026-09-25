import { describe, expect, it } from 'vitest';
import { canComplete, completed, reopened, shownState, skipped } from './completion';
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
