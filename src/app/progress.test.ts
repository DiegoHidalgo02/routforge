// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { save, saveBlock } from '../data/repository';
import { local, MINUTE } from '../domain/time';
import type { SessioneChiusa } from '../domain/timer';
import { progressInputs } from './progress';

const FUSO = 'Europe/Rome';
let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-progresso-${++n}`);
});
afterEach(() => db.delete());

const blocco = (titolo: string, inizio: number, stato: 'programmato' | 'completato' = 'programmato') =>
  saveBlock(db, { tipo: 'routine', stato, inizio, fine: inizio + 30 * MINUTE, conOrario: true, titolo }, inizio, FUSO);
/** Una sessione chiusa avviata a `avvio` con `minuti` di focus: solo i campi che il progresso legge. */
const sessione = (avvio: number, minuti: number) =>
  save(
    db,
    'sessioni',
    { avvio, bloccoId: null, riepilogo: { focus: minuti * MINUTE } } as unknown as SessioneChiusa,
    avvio,
  );

describe('Il tuo progresso oggi — FUNZIONALITA §2 (servizio)', () => {
  it('settimana di oggi da lunedì, focus delle sessioni avviate oggi e ieri, primi due giorni con attività dopo oggi', async () => {
    // Mercoledì 23 settembre 2026: settimana 21–27
    await blocco('Fatta lunedì', local(2026, 9, 21, 9, 0), 'completato');
    await blocco('Oggi', local(2026, 9, 23, 9, 0));
    await blocco('Venerdì', local(2026, 9, 25, 16, 0));
    await blocco('Martedì dopo', local(2026, 9, 29, 9, 0));
    await blocco('Ottobre', local(2026, 10, 5, 9, 0));
    await sessione(local(2026, 9, 23, 8, 0), 135);
    await sessione(local(2026, 9, 23, 14, 0), 90);
    await sessione(local(2026, 9, 22, 10, 0), 195);

    const p = await progressInputs(db, '2026-09-23');
    expect([...p.settimana.keys()]).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-26',
      '2026-09-27',
    ]);
    expect(p.settimana.get('2026-09-21')?.map((b) => b.titolo)).toEqual(['Fatta lunedì']);
    expect([p.focusOggi, p.focusIeri]).toEqual([225 * MINUTE, 195 * MINUTE]);
    expect(p.prossimi.map(([g, b]) => [g, b.map((x) => x.titolo)])).toEqual([
      ['2026-09-25', ['Venerdì']],
      ['2026-09-29', ['Martedì dopo']],
    ]);
  });
});
