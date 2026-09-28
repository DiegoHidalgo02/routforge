// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, remove, save } from '../data/repository';
import { local, MINUTE } from '../domain/time';
import {
  CHIAVE_RITORNO_ASSENZA,
  CHIAVE_ULTIMA_APERTURA,
  dismissAbsenceNotice,
  readAbsenceNotice,
  registerOpening,
} from './absence';

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-assenza-${++n}`);
});
afterEach(() => db.delete());

// Lunedì 28 settembre 2026 alle 21:00; mercoledì 30 alle 08:00; giovedì 1° ottobre alle 08:00.
const LUNEDI = local(2026, 9, 28, 21, 0);
const MERCOLEDI = local(2026, 9, 30, 8, 0);
const GIOVEDI = local(2026, 10, 1, 8, 0);

const corso = (id = 'c1') =>
  save(db, 'corsi', { id, titolo: 'Corso', sottotitolo: '', importatoIl: LUNEDI, esempio: false }, LUNEDI);
const ultimaApertura = async () => (await get(db, 'preferenze', CHIAVE_ULTIMA_APERTURA))?.valore;

describe('Ritorno dopo assenza — MECCANISMI §9 (ultima apertura)', () => {
  it('alla prima apertura scrive l’istante e non avvisa', async () => {
    await corso();
    await registerOpening(db, LUNEDI);
    expect(await ultimaApertura()).toBe(LUNEDI);
    expect(await readAbsenceNotice(db, '2026-09-28')).toBeNull();
  });

  it('riaperta dopo 2 giorni con un corso: avviso con i giorni e ultima apertura aggiornata subito', async () => {
    await corso();
    await registerOpening(db, LUNEDI);
    await registerOpening(db, MERCOLEDI);
    expect(await ultimaApertura()).toBe(MERCOLEDI);
    expect(await readAbsenceNotice(db, '2026-09-30')).toEqual({ giorni: 2, giorno: '2026-09-30' });
  });

  it('una tantum: riaperta poco dopo non si ripete; l’avviso resta finché non si chiude con ×', async () => {
    await corso();
    await registerOpening(db, LUNEDI);
    await registerOpening(db, MERCOLEDI);
    await registerOpening(db, MERCOLEDI + 5 * MINUTE); // un ricaricamento, un ritorno in primo piano
    expect(await ultimaApertura()).toBe(MERCOLEDI + 5 * MINUTE);
    expect(await readAbsenceNotice(db, '2026-09-30')).toEqual({ giorni: 2, giorno: '2026-09-30' });
    await dismissAbsenceNotice(db, MERCOLEDI + 6 * MINUTE);
    expect(await readAbsenceNotice(db, '2026-09-30')).toBeNull();
    await registerOpening(db, MERCOLEDI + 7 * MINUTE);
    expect(await readAbsenceNotice(db, '2026-09-30')).toBeNull();
  });

  it('l’avviso non chiuso vale solo nel giorno dell’apertura: con l’app aperta oltre mezzanotte sparisce (D-ASSENZA-1)', async () => {
    await corso();
    await registerOpening(db, LUNEDI);
    await registerOpening(db, MERCOLEDI);
    expect(await readAbsenceNotice(db, '2026-10-01')).toBeNull(); // giovedì, senza nuove aperture
    expect(await readAbsenceNotice(db, '2026-09-30')).toEqual({ giorni: 2, giorno: '2026-09-30' });
    await registerOpening(db, GIOVEDI);
    expect(await readAbsenceNotice(db, '2026-10-01')).toBeNull();
  });

  it('senza corsi nessun avviso, ma l’ultima apertura si aggiorna', async () => {
    await registerOpening(db, LUNEDI);
    await registerOpening(db, MERCOLEDI);
    expect(await ultimaApertura()).toBe(MERCOLEDI);
    expect(await readAbsenceNotice(db, '2026-09-30')).toBeNull();
  });

  it('conta solo i corsi vivi: un corso eliminato non basta', async () => {
    await corso();
    await registerOpening(db, LUNEDI);
    await remove(db, 'corsi', 'c1', LUNEDI + MINUTE);
    await registerOpening(db, MERCOLEDI);
    expect(await readAbsenceNotice(db, '2026-09-30')).toBeNull();
  });

  it('una nuova assenza sostituisce l’avviso chiuso con quello nuovo', async () => {
    await corso();
    await registerOpening(db, LUNEDI);
    await registerOpening(db, MERCOLEDI);
    await dismissAbsenceNotice(db, MERCOLEDI + MINUTE);
    const lunediDopo = local(2026, 10, 5, 9, 0);
    await registerOpening(db, lunediDopo);
    expect(await readAbsenceNotice(db, '2026-10-05')).toEqual({ giorni: 5, giorno: '2026-10-05' });
  });

  it('valori illeggibili (dato rotto, anche da sync) valgono come assenti', async () => {
    await corso();
    await save(db, 'preferenze', { id: CHIAVE_ULTIMA_APERTURA, valore: 'ieri' }, LUNEDI);
    await registerOpening(db, MERCOLEDI);
    expect(await readAbsenceNotice(db, '2026-09-30')).toBeNull();
    await save(db, 'preferenze', { id: CHIAVE_RITORNO_ASSENZA, valore: { giorni: '2' } }, MERCOLEDI);
    expect(await readAbsenceNotice(db, '2026-09-30')).toBeNull();
  });
});
