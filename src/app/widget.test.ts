// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { saveBlock } from '../data/repository';
import { local } from '../domain/time';
import type { Clock } from './ports/clock';
import { followWidget } from './widget';

const ROMA = 'Europe/Rome';
const ADESSO = local(2026, 9, 23, 16, 8);
let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-widget-${++n}`);
});
afterEach(() => db.delete());

const scatti: (() => void)[] = [];
const orologio: Clock = {
  now: () => ADESSO,
  fuso: () => ROMA,
  every: (_ms, fn) => (scatti.push(fn), () => undefined),
  onForeground: () => () => undefined,
  inForeground: () => true,
};

describe('Widget aggiornato dai blocchi — MECCANISMI §21 (T-023)', () => {
  it('manda il contenuto all’avvio e a ogni cambiamento dei blocchi, mai due volte lo stesso', async () => {
    const aggiorna = vi.fn();
    const smetti = followWidget(db, orologio, { aggiorna });
    await vi.waitFor(() => expect(aggiorna).toHaveBeenCalledTimes(1));
    expect(aggiorna.mock.calls[0]?.[0]).toMatchObject({ mese: '2026-09', agenda: [], prossima: null });
    scatti.forEach((f) => f());
    await new Promise((r) => setTimeout(r, 50));
    expect(aggiorna).toHaveBeenCalledTimes(1);
    await saveBlock(
      db,
      {
        tipo: 'routine',
        stato: 'programmato',
        titolo: 'Corsa',
        inizio: local(2026, 9, 23, 18),
        fine: local(2026, 9, 23, 19),
        conOrario: true,
      },
      ADESSO,
      ROMA,
    );
    await vi.waitFor(() => expect(aggiorna).toHaveBeenCalledTimes(2));
    expect(aggiorna.mock.calls[1]?.[0]).toMatchObject({ prossima: { titolo: 'Corsa', ora: '18:00' } });
    smetti();
  });

  it('un aggiornamento rifiutato dal plugin si riprova al ricalcolo successivo (revisione di T-023)', async () => {
    scatti.length = 0;
    const aggiorna = vi.fn().mockRejectedValueOnce(new Error('widget non aggiornato')).mockResolvedValue(undefined);
    const smetti = followWidget(db, orologio, { aggiorna });
    await vi.waitFor(() => expect(aggiorna).toHaveBeenCalledTimes(1));
    scatti.forEach((f) => f());
    await vi.waitFor(() => expect(aggiorna).toHaveBeenCalledTimes(2));
    smetti();
  });
});
