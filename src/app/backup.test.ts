// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, SCHEMA_V1, type RoutForgeDb } from '../data/db';
import { allRows, remove, save, saveBlock } from '../data/repository';
import { local } from '../domain/time';
import { backupText, CHIAVE_AI, eraseAllData, importBackup, lastBackup, readBackup } from './backup';
import { importSampleCourse } from './courseImport';
import { addPdf, configurePdf } from './materials';
import { registerNotificationService } from './notifications';
import { CHIAVE_SESSIONE_ATTIVA } from './session';

const ADESSO = local(2026, 9, 23, 16, 8);
const ROMA = 'Europe/Rome';
let db: RoutForgeDb;
let altro: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-backup-${++n}`);
  altro = openDb(`test-backup-altro-${n}`);
});
afterEach(async () => {
  await db.delete();
  await altro.delete();
});

const cancelAll = vi.fn(() => Promise.resolve());
registerNotificationService({
  reconcile: () => Promise.resolve(),
  start: () => () => {},
  test: () => Promise.resolve(),
  cancelAll,
});
configurePdf({
  leggi: () => Promise.resolve({ pagine: 1, testi: ['Event loop'] }),
  pagina: () => Promise.resolve(null),
});

/** Le righe di una tabella in ordine d'id, per confrontarle. */
const righe = async (d: RoutForgeDb, nome: keyof typeof SCHEMA_V1) =>
  (await allRows(d, nome)).sort((a, b) => a.id.localeCompare(b.id));

describe('Backup — MECCANISMI §22, FUNZIONALITA §20 (T-030)', () => {
  it('export → import identico: PDF e tombstone compresi, senza registro notifiche, sessione attiva e chiave AI', async () => {
    await importSampleCourse(db, ADESSO);
    await saveBlock(
      db,
      { tipo: 'todo', stato: 'programmato', inizio: ADESSO, fine: null, conOrario: false, titolo: 'Spesa' },
      ADESSO,
      ROMA,
    );
    const via = await saveBlock(
      db,
      { tipo: 'todo', stato: 'programmato', inizio: ADESSO, fine: null, conOrario: false, titolo: 'Via' },
      ADESSO,
      ROMA,
    );
    await remove(db, 'blocchi', via.id, ADESSO + 1);
    const dati = Uint8Array.from({ length: 1000 }, (_, i) => i % 256);
    await addPdf(
      db,
      { corsoId: 'c', unitaId: 'u' },
      { nome: 'Registro.pdf', byte: 1000, leggi: () => Promise.resolve(dati) },
      ADESSO,
    );
    await save(db, 'preferenze', { id: CHIAVE_SESSIONE_ATTIVA, valore: { bloccoId: null } }, ADESSO);
    await save(db, 'preferenze', { id: CHIAVE_AI, valore: 'chiave-segreta-di-prova' }, ADESSO);
    await save(db, 'registroNotifiche', { id: 'k', chiave: 'k', idNativo: 1 } as never, ADESSO);

    const { nome, testo } = await backupText(db, ADESSO);
    expect(nome).toBe('routforge-2026-09-23.rfbackup');
    expect(testo).not.toContain('chiave-segreta-di-prova');

    // L'altro dispositivo ha i suoi dati e la sua chiave: i dati spariscono, la chiave resta
    await saveBlock(
      altro,
      { tipo: 'todo', stato: 'programmato', inizio: ADESSO, fine: null, conOrario: false, titolo: 'Locale' },
      ADESSO,
      ROMA,
    );
    await save(altro, 'preferenze', { id: CHIAVE_AI, valore: 'chiave-di-questo-dispositivo' }, ADESSO);
    await save(altro, 'registroNotifiche', { id: 'z', chiave: 'z', idNativo: 9 } as never, ADESSO);
    const letto = readBackup(altro, testo);
    if ('errore' in letto) throw new Error(letto.errore);
    expect([letto.corsi, letto.pdf]).toEqual([1, 1]);
    await importBackup(altro, letto);

    // Le notifiche si tolgono dopo la scrittura riuscita (D-BACKUP-2); il registro lo svuota il servizio (qui finto)
    expect(cancelAll).toHaveBeenCalled();
    expect(await allRows(altro, 'registroNotifiche')).toHaveLength(1);
    for (const tabella of Object.keys(SCHEMA_V1) as (keyof typeof SCHEMA_V1)[]) {
      if (tabella === 'preferenze' || tabella === 'registroNotifiche') continue;
      expect(await righe(altro, tabella), tabella).toEqual(await righe(db, tabella));
    }
    const preferenze = await righe(altro, 'preferenze');
    expect(preferenze.find((p) => p.id === CHIAVE_SESSIONE_ATTIVA)).toBeUndefined();
    expect(preferenze.find((p) => p.id === CHIAVE_AI)).toMatchObject({ valore: 'chiave-di-questo-dispositivo' });
    expect(await lastBackup(altro)).toBe(ADESSO);
  });

  it('un file che non è un backup non tocca nulla; «Elimina tutti i dati» azzera il dispositivo', async () => {
    await importSampleCourse(db, ADESSO);
    expect(readBackup(db, '{"ciao":1}')).toEqual({ errore: 'illeggibile' });
    expect((await allRows(db, 'corsi')).length).toBe(1);
    await eraseAllData(db);
    for (const tabella of Object.keys(SCHEMA_V1) as (keyof typeof SCHEMA_V1)[])
      if (tabella !== 'registroNotifiche') expect(await allRows(db, tabella), tabella).toEqual([]);
  });

  it('un file con dentro la chiave dell’AI o la sessione attiva non le scrive: restano quelle del dispositivo', async () => {
    await save(altro, 'preferenze', { id: CHIAVE_AI, valore: 'chiave-di-questo-dispositivo' }, ADESSO);
    const pref = (id: string, valore: unknown) => ({ id, valore, createdAt: 1, updatedAt: 1, deletedAt: null });
    const file = {
      formato: 'routforge-backup',
      versione: 1,
      creatoIl: ADESSO,
      tabelle: {
        preferenze: [pref(CHIAVE_AI, 'chiave-di-un-altro'), pref(CHIAVE_SESSIONE_ATTIVA, { bloccoId: null })],
      },
    };
    const letto = readBackup(altro, JSON.stringify(file));
    if ('errore' in letto) throw new Error(letto.errore);
    await importBackup(altro, letto);
    const preferenze = await allRows(altro, 'preferenze');
    expect(preferenze.find((p) => p.id === CHIAVE_AI)).toMatchObject({ valore: 'chiave-di-questo-dispositivo' });
    expect(preferenze.find((p) => p.id === CHIAVE_SESSIONE_ATTIVA)).toBeUndefined();
  });
});
