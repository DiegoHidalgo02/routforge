// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { strToU8, zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { list } from '../data/repository';
import { local } from '../domain/time';
import { codeUploads, deleteUpload, readCode, restoreUpload, uploadCode } from './codeFiles';
import { importSampleCourse } from './courseImport';

const ADESSO = local(2026, 9, 23, 16, 8);
let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-codice-${++n}`);
});
afterEach(() => db.delete());

/** Un file scelto: la lettura fallisce se non serviva leggerlo. */
const scelto = (nome: string, dati: Uint8Array) => ({
  nome,
  byte: dati.byteLength,
  leggi: () => Promise.resolve(dati),
});
const zip = zipSync({
  'task-tracker/app.js': strToU8('console.log("ciao")'),
  'task-tracker/index.html': strToU8('<p>ciao</p>'),
  'task-tracker/node_modules/a/index.js': strToU8('x'),
  'task-tracker/node_modules/b/index.js': strToU8('y'),
  'task-tracker/.env': strToU8('CHIAVE=segreta'),
  'task-tracker/package-lock.json': strToU8('{}'),
  'task-tracker/server.log': strToU8('log'),
  'task-tracker/dati.json': new Uint8Array(500 * 1024 + 1),
  'task-tracker/foto.png': new Uint8Array(10),
  // ZIP di Windows: i separatori `\`
  'task-tracker\\vendor\\lib.js': strToU8('z'),
});
const posto = { corsoId: 'c', unitaId: 'u' };

describe('Tetti del caricamento — MECCANISMI §17, D-CODE-1 (audit P1-7)', () => {
  it('5 000 file e 20 MB valgono per tutto il caricamento, non per ogni ZIP: 2 ZIP da 15 MB → 40 file da 500 KB', async () => {
    const pieno = (cartella: string) =>
      zipSync(
        Object.fromEntries(
          [...Array(30).keys()].map((i) => [
            `${cartella}/f${i}.js`,
            [new Uint8Array(500 * 1024), { level: 0 }] as const,
          ]),
        ),
      );
    const r = await uploadCode(db, posto, [scelto('a.zip', pieno('a')), scelto('b.zip', pieno('b'))], ADESSO);
    expect(r).toEqual({ file: 40, esclusi: 20 });
  });
});

describe('File di codice — MECCANISMI §17 (T-025)', () => {
  it('uno ZIP: entrano i file di codice; esclusi node_modules e vendor (contati per file), .env senza contenuto, lock, log, oltre 500 KB, estensioni non di codice', async () => {
    expect(await uploadCode(db, posto, [scelto('task-tracker.zip', zip)], ADESSO)).toEqual({ file: 2, esclusi: 8 });
    const salvati = await list(db, 'fileCodice');
    expect(salvati.find((f) => f.percorso.endsWith('.env'))).toMatchObject({ contenuto: null, motivo: 'segreto' });
    expect(salvati.find((f) => f.percorso.endsWith('app.js'))?.contenuto).toBe('console.log("ciao")');
    expect(salvati.find((f) => f.percorso === 'task-tracker/node_modules/')).toMatchObject({
      motivo: 'cartella_tecnica',
      file: 2,
    });
    expect(salvati.find((f) => f.percorso === 'task-tracker/vendor/')).toMatchObject({ motivo: 'cartella_tecnica' });
    const codice = await readCode(db, 'u');
    expect([codice.file, codice.esclusi]).toEqual([2, 8]);
    expect(codice.righe[0]).toMatchObject({ nome: 'task-tracker/', livello: 0, cartella: true });
  });

  it('un .env sciolto non si legge; due ZIP con lo stesso file danno una riga; uno ZIP illeggibile è un escluso', async () => {
    const env = { nome: '.env', byte: 14, leggi: () => Promise.reject(new Error('letto')) };
    expect(await uploadCode(db, posto, [env], ADESSO)).toEqual({ file: 0, esclusi: 1 });
    const uno = zipSync({ 'index.html': strToU8('v1') });
    const due = zipSync({ 'index.html': strToU8('v2') });
    await uploadCode(db, posto, [scelto('a.zip', uno), scelto('b.zip', due)], ADESSO);
    expect((await list(db, 'fileCodice')).filter((f) => f.percorso === 'index.html').map((f) => f.contenuto)).toEqual([
      'v2',
    ]);
    expect(await uploadCode(db, posto, [scelto('rotto.zip', new Uint8Array([1, 2, 3]))], ADESSO)).toEqual({
      file: 0,
      esclusi: 1,
    });
  });

  it('lo stesso file caricato di nuovo sostituisce il vecchio; un caricamento si elimina intero e torna con «Annulla»', async () => {
    await uploadCode(db, posto, [scelto('app.js', strToU8('v1'))], ADESSO);
    await uploadCode(db, posto, [scelto('app.js', strToU8('v2'))], ADESSO + 1);
    expect((await list(db, 'fileCodice')).map((f) => f.contenuto)).toEqual(['v2']);
    const [caricamento] = await codeUploads(db);
    expect(caricamento).toMatchObject({ nome: 'app.js', file: 1, byte: 2 });
    const righe = await deleteUpload(db, caricamento!.caricamento, ADESSO);
    expect(await list(db, 'fileCodice')).toEqual([]);
    await restoreUpload(db, righe, ADESSO);
    expect(await list(db, 'fileCodice')).toHaveLength(1);
  });

  it('reimport di un corso con lo stesso titolo: i file di codice passano all’unità con lo stesso numero (FUNZIONALITA §10)', async () => {
    await importSampleCourse(db, ADESSO);
    const [vecchio] = await list(db, 'corsi');
    const u07 = (await list(db, 'unita')).find((u) => u.corsoId === vecchio!.id && u.numero === '0.7')!;
    await uploadCode(db, { corsoId: vecchio!.id, unitaId: u07.id }, [scelto('lab.js', strToU8('x'))], ADESSO);
    await importSampleCourse(db, ADESSO + 1);
    const nuovo = (await list(db, 'corsi')).find((c) => c.id !== vecchio!.id)!;
    const n07 = (await list(db, 'unita')).find((u) => u.corsoId === nuovo.id && u.numero === '0.7')!;
    expect((await list(db, 'fileCodice'))[0]).toMatchObject({ corsoId: nuovo.id, unitaId: n07.id });
  });
});
