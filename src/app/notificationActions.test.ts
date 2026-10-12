// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, saveBlock, type DatiBlocco } from '../data/repository';
import { local } from '../domain/time';
import { backgroundGesture, notificationGesture } from './notificationActions';
import { CHIAVE_POSTICIPI } from './notifications';

const ROMA = 'Europe/Rome';
const ADESSO = local(2026, 9, 23, 16, 8);
let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-gesti-${++n}`);
});
afterEach(() => db.delete());

const blocco = (dati: Partial<DatiBlocco>) =>
  saveBlock(
    db,
    {
      tipo: 'todo',
      stato: 'programmato',
      inizio: local(2026, 9, 23, 9),
      fine: null,
      conOrario: false,
      ...dati,
    } as DatiBlocco,
    ADESSO - 60_000,
    ROMA,
  );
const gesto = (b: { id: string } | null, trigger: string, g: Parameters<typeof notificationGesture>[2]) =>
  notificationGesture(
    db,
    { chiave: `${trigger}:0:${b?.id ?? ''}`, trigger: trigger as never, bloccoId: b?.id ?? null },
    g,
    ADESSO,
    ROMA,
  );

describe('Gesti sulle notifiche — MECCANISMI §13.2 (T-021, T-051)', () => {
  it('Posticipa ricorda il tocco con la stessa chiave; senza blocco il tempo scaduto apre la sessione, il digest Oggi', async () => {
    const t = await blocco({ titolo: 'Spesa' });
    expect(await gesto(t, 'pre', 'posticipa')).toBeNull();
    expect((await get(db, 'preferenze', CHIAVE_POSTICIPI))?.valore).toEqual({ [`pre:0:${t.id}`]: ADESSO });
    expect(await gesto(null, 'tempo_scaduto', 'tocco')).toEqual({ percorso: '/sessione' });
    expect(await gesto(null, 'digest', 'tocco')).toEqual({ percorso: '/' });
    expect(
      await notificationGesture(db, { chiave: 'x', trigger: 'pre', bloccoId: 'sparito' }, 'tocco', ADESSO, ROMA),
    ).toEqual({
      percorso: '/',
    });
  });

  it('studio: il tocco della verifica registra l’istante di risposta e apre l’unità; «esito» apre il foglio; «Inizia» il setup', async () => {
    const s = await blocco({
      tipo: 'studio',
      conOrario: true,
      inizio: local(2026, 9, 23, 15),
      fine: local(2026, 9, 23, 17),
      corsoId: 'c',
      unitaId: 'u',
    });
    expect(await gesto(s, 'verifica', 'tocco')).toEqual({ percorso: '/corsi/c/unita/u' });
    expect((await get(db, 'blocchi', s.id))?.toccoVerificaIl).toBe(ADESSO);
    expect(await gesto(s, 'esito', 'tocco')).toEqual({ percorso: `/attivita/${s.id}`, vista: 'esito' });
    expect(await gesto(s, 'pre', 'inizia')).toEqual({ percorso: `/sessione/setup?blocco=${s.id}` });
    expect(await gesto(s, 'esito', 'registra_esito')).toEqual({ percorso: `/attivita/${s.id}`, vista: 'esito' });
  });
});

describe('«Segna fatto» dalla notifica — SCENARI A6 (T-051)', () => {
  it('con 2 voci su 5 apre il Dettaglio su «Voci rimaste» senza completare; con tutte spuntate completa senza aprire nulla', async () => {
    const voci = (fatte: number) =>
      Array.from({ length: 5 }, (_, k) => ({ testo: `Capitolo ${k + 1}`, fatta: k < fatte }));
    const leggere = await blocco({
      titolo: 'Leggere 20 pagine',
      conOrario: true,
      inizio: local(2026, 9, 23, 19),
      fine: local(2026, 9, 23, 19, 30),
      checklist: voci(2),
    });
    expect(await gesto(leggere, 'pre', 'segna_fatto')).toEqual({
      percorso: `/attivita/${leggere.id}`,
      vista: 'residuo',
    });
    expect((await get(db, 'blocchi', leggere.id))?.stato).toBe('programmato');
    const tutte = await blocco({ titolo: 'Leggere 20 pagine', checklist: voci(5) });
    expect(await gesto(tutte, 'pre', 'segna_fatto')).toBeNull();
    expect((await get(db, 'blocchi', tutte.id))?.stato).toBe('completato');
  });
});

describe('Gesti fatti ad app chiusa — MECCANISMI §13.2, D-NATIVO-3 (audit P2-28)', () => {
  it('«Segna fatto» applicato dice true; un database che non risponde dice false, e il gesto resta da rifare', async () => {
    const t = await blocco({ titolo: 'Spesa' });
    const voce = { chiave: `pre:0:${t.id}`, trigger: 'pre' as const, bloccoId: t.id };
    expect(await backgroundGesture(db, voce, 'segna_fatto', ADESSO, ROMA)).toBe(true);
    expect((await get(db, 'blocchi', t.id))?.stato).toBe('completato');
    // Riapplicarlo è innocuo: il todo resta completato
    expect(await backgroundGesture(db, voce, 'segna_fatto', ADESSO, ROMA)).toBe(true);
    expect((await get(db, 'blocchi', t.id))?.stato).toBe('completato');
    db.close();
    expect(await backgroundGesture(db, voce, 'segna_fatto', ADESSO, ROMA)).toBe(false);
  });
});
