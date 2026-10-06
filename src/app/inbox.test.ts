// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { save, saveBlock } from '../data/repository';
import { local } from '../domain/time';
import { markAllRead, readInbox } from './inbox';

const FUSO = 'Europe/Rome';
// Mercoledì 23 settembre 2026, 16:08 (orologio dei mock).
const ADESSO = local(2026, 9, 23, 16, 8);

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-inbox-${++n}`);
});
afterEach(() => db.delete());

const studio = (
  id: string,
  inizio: number,
  fine: number,
  stato: 'perso' | 'programmato' | 'completato',
  unitaId?: string,
) =>
  saveBlock(
    db,
    {
      id,
      tipo: 'studio',
      stato,
      conOrario: true,
      inizio,
      fine,
      titolo: 'Ripasso Modulo 0',
      corsoId: unitaId ? 'c1' : null,
      ...(unitaId && { unitaId }),
      ...(stato === 'perso' && { persoIl: fine + 31 * 60_000 }),
    },
    inizio,
    FUSO,
  );

describe('Esiti pendenti — SCENARI C6, MECCANISMI §8', () => {
  it('perso ieri e programmato con la fine passata, dal più recente; il contatore si svuota con «Segna tutte lette»', async () => {
    await save(db, 'unita', { id: 'u07', numero: '0.7', corsoId: 'c1' } as never, ADESSO);
    await studio('ieri', local(2026, 9, 22, 16), local(2026, 9, 22, 16, 45), 'perso', 'u07');
    await studio('oggi', local(2026, 9, 23, 9), local(2026, 9, 23, 10), 'programmato');
    await studio('fatto', local(2026, 9, 23, 11), local(2026, 9, 23, 12), 'completato');
    await studio('vecchio', local(2026, 9, 18, 16), local(2026, 9, 18, 16, 45), 'perso');
    const prima = await readInbox(db, ADESSO);
    expect(prima.esiti.map((e) => [e.id, e.stato, e.unita?.numero ?? null])).toEqual([
      ['oggi', 'programmato', null],
      ['ieri', 'perso', '0.7'],
    ]);
    expect(prima.nuove).toBe(2);
    await markAllRead(db, ADESSO);
    const dopo = await readInbox(db, ADESSO);
    expect(dopo.nuove).toBe(0);
    expect(dopo.esiti).toHaveLength(2);
  });

  it('«Ieri · gestite»: le voci del registro scattate ieri, la più recente prima, senza la prova', async () => {
    const voce = (chiave: string, istante: number, trigger: string) =>
      save(
        db,
        'registroNotifiche',
        {
          id: chiave,
          chiave,
          istante,
          trigger,
          anticipo: trigger === 'pre' ? 15 : 0,
          bloccoId: null,
          tipo: 'evento',
          titolo: chiave,
          inizioBlocco: null,
          sveglia: false,
          silenzioso: false,
          azioni: [],
          oneShot: false,
          idNativo: 1,
        } as never,
        ADESSO,
      );
    await voce('Dentista', local(2026, 9, 22, 15, 52), 'inizio');
    await voce('Lezione', local(2026, 9, 22, 8, 45), 'pre');
    await voce('prova', local(2026, 9, 22, 9), 'prova');
    await voce('oggi', local(2026, 9, 23, 8), 'pre');
    await voce('dopo', local(2026, 9, 23, 17), 'pre');
    expect((await readInbox(db, ADESSO)).ieri.map((v) => [v.titolo, v.trigger, v.anticipo])).toEqual([
      ['Dentista', 'inizio', 0],
      ['Lezione', 'pre', 15],
    ]);
    expect((await readInbox(db, ADESSO)).prossimo).toEqual({ istante: local(2026, 9, 23, 17), titolo: 'dopo' });
  });
});
