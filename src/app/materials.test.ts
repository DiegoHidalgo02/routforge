// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, list } from '../data/repository';
import { isGroundable } from '../domain/materials';
import { local } from '../domain/time';
import { importSampleCourse } from './courseImport';
import {
  addLink,
  addNote,
  addPdf,
  configurePdf,
  deleteMaterial,
  hasSystemPdfViewer,
  materialsSpace,
  openPdfInSystem,
  readMaterials,
  readPdf,
  restoreMaterial,
} from './materials';

const ADESSO = local(2026, 9, 23, 16, 8);
const MB = 1024 * 1024;
let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-materiali-${++n}`);
});
afterEach(() => db.delete());

/** Lettore finto: il primo byte dice che PDF è (1 testuale, 2 scansionato, altro illeggibile). */
const lettore = {
  leggi: (dati: Uint8Array) =>
    Promise.resolve(
      dati[0] === 1
        ? { pagine: 2, testi: ['Event loop', 'Microtask'] }
        : dati[0] === 2
          ? { pagine: 3, testi: ['', '', ''] }
          : null,
    ),
  pagina: () => Promise.resolve(new Uint8Array([137])),
};
configurePdf(lettore);
const file = (nome: string, tipo: number, byte = 3 * MB) => {
  const dati = new Uint8Array(byte);
  dati[0] = tipo;
  return { nome, byte, leggi: () => Promise.resolve(dati) };
};
const posto = { corsoId: 'c', unitaId: 'u' };

describe('Materiali — MECCANISMI §17, SCENARI H2', () => {
  it('PDF testuale da 3 MB groundabile col binario a parte; scansionato e illeggibile passivi ma apribili; 25 MB rifiutato senza leggerlo', async () => {
    const testuale = await addPdf(db, posto, file('Registro.pdf', 1), ADESSO);
    expect(testuale).toMatchObject({ esito: 'aggiunto', materiale: { tipo: 'pdf', pagine: 2, byte: 3 * MB } });
    if (testuale.esito !== 'aggiunto') return;
    expect(isGroundable(testuale.materiale)).toBe(true);
    expect((await readPdf(db, testuale.materiale.id))?.byteLength).toBe(3 * MB);
    const scansionato = await addPdf(db, posto, file('Scansione.pdf', 2), ADESSO);
    const rotto = await addPdf(db, posto, file('Rotto.pdf', 9), ADESSO);
    for (const x of [scansionato, rotto]) {
      if (x.esito !== 'aggiunto') throw new Error('aggiunto');
      expect(isGroundable(x.materiale)).toBe(false);
      // Passivo ma apribile: il binario c'è
      expect(await readPdf(db, x.materiale.id)).not.toBeNull();
    }
    expect(scansionato).toMatchObject({ materiale: { pagine: 3 } });
    const enorme = { nome: 'Slide.pdf', byte: 25 * MB, leggi: () => Promise.reject(new Error('letto')) };
    expect(await addPdf(db, posto, enorme, ADESSO)).toEqual({ esito: 'troppo_grande', byte: 25 * MB });
    expect(await readMaterials(db, 'u')).toHaveLength(3);
  });

  it('link col protocollo (senza indirizzo non si salva), nota markdown; eliminare un PDF elimina il binario; «Annulla»', async () => {
    expect(await addLink(db, posto, 'vuoto', '   ', ADESSO)).toBeNull();
    const link = await addLink(db, posto, '', 'youtube.com/watch?v=cCOL7MC4Pl0', ADESSO);
    expect(link).toMatchObject({
      url: 'https://youtube.com/watch?v=cCOL7MC4Pl0',
      titolo: 'https://youtube.com/watch?v=cCOL7MC4Pl0',
    });
    await addNote(db, posto, 'Appunti', '- i microtask prima dei task', ADESSO + 1);
    const p = await addPdf(db, posto, file('Registro.pdf', 1, 1000), ADESSO);
    if (p.esito !== 'aggiunto') throw new Error('pdf');
    const spazio = await materialsSpace(db);
    expect([spazio.pdf, spazio.righe.length]).toEqual([1000, 3]);
    const copia = await deleteMaterial(db, p.materiale.id, ADESSO);
    expect(await get(db, 'materialiBinari', p.materiale.id)).toBeUndefined();
    await restoreMaterial(db, copia!, ADESSO);
    expect((await readPdf(db, p.materiale.id))?.byteLength).toBe(1000);
    await deleteMaterial(db, p.materiale.id, ADESSO);
    expect((await readMaterials(db, 'u')).map((m) => m.tipo)).toEqual(['link', 'nota']);
  });

  it('reimport di un corso con lo stesso titolo: i materiali passano all’unità con lo stesso numero (FUNZIONALITA §10)', async () => {
    await importSampleCourse(db, ADESSO);
    const [vecchio] = await list(db, 'corsi');
    const u07 = (await list(db, 'unita')).find((u) => u.corsoId === vecchio!.id && u.numero === '0.7')!;
    const nota = await addNote(db, { corsoId: vecchio!.id, unitaId: u07.id }, 'Appunti', 'testo', ADESSO);
    await importSampleCourse(db, ADESSO + 1);
    const nuovo = (await list(db, 'corsi')).find((c) => c.id !== vecchio!.id)!;
    const spostata = await get(db, 'materiali', nota.id);
    const n07 = (await list(db, 'unita')).find((u) => u.corsoId === nuovo.id && u.numero === '0.7')!;
    expect(spostata).toMatchObject({ corsoId: nuovo.id, unitaId: n07.id });
  });
});

describe('PDF col visore del sistema — MECCANISMI §17, D-MAT-2', () => {
  it('su Android il PDF va al visore col suo nome; senza visore, senza binario, se non si apre o se lancia, false (ripiego su S13)', async () => {
    const aperti: [number, string][] = [];
    let riesce: boolean | 'lancia' = true;
    configurePdf(lettore, {
      apri: (dati, nome) => {
        aperti.push([dati.byteLength, nome]);
        return riesce === 'lancia' ? Promise.reject(new Error('ponte')) : Promise.resolve(riesce);
      },
    });
    try {
      expect(hasSystemPdfViewer()).toBe(true);
      const r = await addPdf(db, posto, file('Registro.pdf', 1, 10), ADESSO);
      if (r.esito !== 'aggiunto') throw new Error('aggiunto');
      expect(await openPdfInSystem(db, r.materiale.id)).toBe(true);
      expect(aperti).toEqual([[10, 'Registro.pdf']]);
      riesce = false;
      expect(await openPdfInSystem(db, r.materiale.id)).toBe(false);
      riesce = 'lancia';
      expect(await openPdfInSystem(db, r.materiale.id)).toBe(false);
      expect(await openPdfInSystem(db, 'nessuno')).toBe(false);
    } finally {
      configurePdf(lettore);
    }
    expect(hasSystemPdfViewer()).toBe(false);
    expect(await openPdfInSystem(db, 'nessuno')).toBe(false);
  });
});
