// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { openDb } from '../data/db';
import { save } from '../data/repository';
import { testNotification } from '../domain/notifications/desiredSet';
import { local } from '../domain/time';
import { watch } from './db';
import {
  catchUnhandled,
  configureDiagnostics,
  logError,
  logReconcile,
  MAX_EVENTI,
  readDiagnostics,
} from './diagnostics';

const ADESSO = local(2026, 9, 23, 16, 8);

describe('Diagnostica — FUNZIONALITA §24, MECCANISMI §23 (INV-16)', () => {
  it('lo stesso errore ripetuto resta una riga; al più 20 eventi; la riconciliazione e la coda delle notifiche future', async () => {
    let t = ADESSO;
    configureDiagnostics({ now: () => t });
    logError('ciclo', new Error('rotto'));
    t += 60_000;
    logError('ciclo', new Error('rotto'));
    const db = openDb('test-diagnostica');
    let d = await readDiagnostics(db, ADESSO);
    expect(d.eventi).toEqual([{ istante: ADESSO + 60_000, sorgente: 'ciclo', messaggio: 'rotto' }]);
    for (let i = 0; i < 30; i++) logError('dispositivo', `errore ${i}`);
    logReconcile(ADESSO, new Error('porta'));
    await save(db, 'registroNotifiche', { ...testNotification(ADESSO), idNativo: 1, id: 'futura' }, ADESSO);
    await save(
      db,
      'registroNotifiche',
      { ...testNotification(ADESSO - 3_600_000), idNativo: 2, id: 'passata' },
      ADESSO,
    );
    d = await readDiagnostics(db, ADESSO);
    expect(d.eventi).toHaveLength(MAX_EVENTI);
    expect(d.eventi[0]).toMatchObject({ sorgente: 'notifiche', messaggio: 'porta' });
    expect(d.riconciliazione).toEqual({ istante: ADESSO, errore: 'porta' });
    expect([d.armate, d.prossima]).toEqual([1, ADESSO + 6_000]);
    await db.delete();
  });
});

describe('Diagnostica, errori ripetuti — MECCANISMI §23 (INV-16)', () => {
  it('due errori alternati restano due righe; un errore che non diventa testo non fa lanciare nulla', async () => {
    configureDiagnostics({ now: () => ADESSO });
    for (let i = 0; i < 6; i++) logError(i % 2 ? 'notifiche' : 'ciclo', i % 2 ? 'B' : 'A');
    expect(() => logError('dispositivo', Object.create(null))).not.toThrow();
    const db = openDb('test-diagnostica-2');
    const { eventi } = await readDiagnostics(db, ADESSO);
    expect(eventi.slice(0, 3).map((e) => e.messaggio)).toEqual(['?', 'B', 'A']);
    expect(eventi.filter((e) => e.messaggio === 'A' || e.messaggio === 'B')).toHaveLength(2);
    await db.delete();
  });
});

describe('Errori delle letture — MECCANISMI §23, INV-16 (audit P1-13)', () => {
  it('una query live che fallisce va in Diagnostica; col registro illeggibile la Diagnostica mostra comunque gli eventi', async () => {
    configureDiagnostics({ now: () => ADESSO });
    const smetti = watch(
      () => Promise.reject(new Error('lettura rotta')),
      () => undefined,
    );
    const db = openDb('test-diagnostica-letture');
    await vi.waitFor(async () =>
      expect((await readDiagnostics(db, ADESSO)).eventi[0]).toMatchObject({
        sorgente: 'interfaccia',
        messaggio: 'lettura rotta',
      }),
    );
    smetti();
    // Un database che non risponde: il registro delle notifiche non si legge, gli eventi in memoria sì
    vi.spyOn(db.table('registroNotifiche'), 'toArray').mockRejectedValue(new Error('database chiuso'));
    const d = await readDiagnostics(db, ADESSO);
    expect(d.eventi[0]?.messaggio).toBe('lettura rotta');
    expect(d.armate).toBe(0);
  });
});

describe('Errori che nessuno raccoglie — MECCANISMI §23, INV-16 (audit P2-5)', () => {
  it('una promessa rifiutata senza catch e un errore di un gestore vanno in Diagnostica, non solo nella console', async () => {
    configureDiagnostics({ now: () => ADESSO });
    const ascolti = new Map<string, (e: { reason?: unknown; error?: unknown; message?: string }) => void>();
    catchUnhandled({ addEventListener: (tipo, f) => void ascolti.set(tipo, f) });
    ascolti.get('unhandledrejection')?.({ reason: new Error('salvataggio rifiutato') });
    ascolti.get('error')?.({ error: new Error('gestore rotto'), message: 'gestore rotto' });
    const { eventi } = await readDiagnostics(openDb('test-diagnostica-globale'), ADESSO);
    expect(eventi.slice(0, 2).map((e) => [e.sorgente, e.messaggio])).toEqual([
      ['interfaccia', 'gestore rotto'],
      ['interfaccia', 'salvataggio rifiutato'],
    ]);
  });
});
