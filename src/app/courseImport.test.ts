// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strToU8, unzipSync, zipSync } from 'fflate';

// `unzipSync` vero, contato: lo ZIP di un corso si decomprime una volta sola (audit P3-25)
vi.mock('fflate', async (originale) => {
  const m = await originale<typeof import('fflate')>();
  return { ...m, unzipSync: vi.fn(m.unzipSync) };
});
import { openDb, type RoutForgeDb } from '../data/db';
import { list, save } from '../data/repository';
import { local } from '../domain/time';
import { ErroreImportCorso } from '../domain/course/parser';
import { importCourseFromZip, importSampleCourse, importZip, zipNeedsTitle } from './courseImport';
import { courseCards } from './courses';

/** Un modulo minimo conforme a FORMATO_CORSO §2 (basta per superare MODULE_HEADER + un'unità leggibile). */
const M1 = `# MODULO M1 — Tooling Moderno

**Tipo:** NUOVO CONTENUTO
**Prerequisiti:** —

#### Unità 1.1 — Node e npm
**🎯 Concetto Core: il runtime**
Node esegue JavaScript fuori dal browser.
`;

const M3 = `## MODULO 3 - Backend

**Tipo:** NUOVO CONTENUTO
**Prerequisiti:** M1

#### Unità 3.1 — Node server
**🎯 Concetto Core: HTTP**
Testo.
`;

const M2_BROKEN = `# Modulo senza intestazione valida

**Tipo:** NUOVO CONTENUTO
#### Unità 2.1 — Orfana
`;

const STRUTTURA = `# Syllabus Software Engineer 2026
## Percorso autodidatta in 5 moduli
`;

const opts = { corsoId: 'corso-1', now: local(2026, 9, 22, 10, 0) };

describe('Import corso da ZIP — SCENARI H1', () => {
  const zip = zipSync({
    'sub/00_struttura.md': strToU8(STRUTTURA),
    'M3-Backend.md': strToU8(M3),
    'sub2/M1-Tooling_Moderno.md': strToU8(M1),
    'note.txt': strToU8('# MODULO M9 — non deve essere letto'),
    'M2-Rotto.md': strToU8(M2_BROKEN),
  });

  it('end-to-end da uno ZIP reale: 2 moduli in ordine 1, 3; il .txt è ignorato; M2 genera un avviso ed è saltato', () => {
    const { corso, avvisi } = importCourseFromZip(zip, opts);
    expect(corso.moduli.map((m) => m.numero)).toEqual([1, 3]);
    expect(corso.titolo).toBe('Syllabus Software Engineer 2026');
    expect(avvisi.some((w) => w.file === 'M2-Rotto.md' && /intestazione di modulo mancante/.test(w.messaggio))).toBe(
      true,
    );
    expect(avvisi.some((w) => /M9/.test(w.messaggio))).toBe(false);
  });

  it('un secondo import dello stesso ZIP crea un secondo corso identico (id diverso)', () => {
    const a = importCourseFromZip(zip, opts);
    const b = importCourseFromZip(zip, { ...opts, corsoId: 'corso-2' });
    expect(b.corso.id).not.toBe(a.corso.id);
    const strip = (o: unknown) => JSON.parse(JSON.stringify(o).replaceAll('corso-2', 'corso-1'));
    expect(strip(b.corso)).toEqual(a.corso);
    expect(b.avvisi).toEqual(a.avvisi);
  });

  it('ZIP senza moduli → errore leggibile', () => {
    const senzaModuli = zipSync({ 'README.md': strToU8('# ciao') });
    expect(() => importCourseFromZip(senzaModuli, opts)).toThrow(ErroreImportCorso);
  });
});

describe('Tetti dell’import — MECCANISMI §16, D-IMPORT-2 (audit P1-7)', () => {
  const testo = (byte: number) => new Uint8Array(byte).fill(97);
  it('un .md oltre 5 MB, o più di 20 MB di .md in tutto, ferma l’import prima di decomprimere; sotto i tetti nulla cambia', () => {
    const appunti = zipSync({ 'M1-Tooling.md': strToU8(M1), 'appunti.md': [testo(5 * 1024 * 1024 + 1), { level: 0 }] });
    expect(() => importCourseFromZip(appunti, opts)).toThrow(ErroreImportCorso);
    const parti = Object.fromEntries(
      [0, 1, 2, 3, 4].map((i) => [`parte${i}.md`, [testo(4.5 * 1024 * 1024), { level: 0 }] as const]),
    );
    expect(() => importCourseFromZip(zipSync({ 'M1-Tooling.md': strToU8(M1), ...parti }), opts)).toThrow(
      ErroreImportCorso,
    );
    const piccolo = zipSync({ 'M1-Tooling.md': strToU8(M1), 'appunti.md': testo(1024) });
    expect(importCourseFromZip(piccolo, opts).corso.moduli).toHaveLength(1);
  });
});

// ------------------------------------------------------------------ corso di esempio salvato (T-005)

const T0 = local(2026, 9, 25, 9, 0);
const T1 = local(2026, 9, 25, 9, 5);

let n = 0;
let db: RoutForgeDb;

/** Righe vive di una tabella dell'albero che appartengono al corso. */
const delCorso = async <K extends 'moduli' | 'unita' | 'sezioni' | 'risorse'>(nome: K, corsoId: string) =>
  (await list(db, nome)).filter((r) => r.corsoId === corsoId);

describe('Corso di esempio — FUNZ §1, §9.1; FORMATO_CORSO §5 (D-SAMPLE-1)', () => {
  beforeEach(() => {
    db = openDb(`test-import-${++n}`);
  });
  afterEach(() => db.delete());

  it('si importa senza avvisi e si salva: «Syllabus Software Engineer 2026», 5 moduli (M2–M4 segnaposto bloccati) · 13 unità, marcato come esempio', async () => {
    const { corso, avvisi } = await importSampleCourse(db, T0);
    expect(avvisi).toEqual([]);
    expect(await list(db, 'corsi')).toMatchObject([
      { id: corso.id, titolo: 'Syllabus Software Engineer 2026', importatoIl: T0, esempio: true },
    ]);
    // La card «Esempio» conta le righe salvate: 5 moduli · 13 unità (FORMATO §5); i segnaposto senza unità e bloccati
    const moduli = (await delCorso('moduli', corso.id)).sort((a, b) => a.numero - b.numero);
    expect(moduli.map((m) => [m.numero, m.titolo, m.segnaposto === true])).toEqual([
      [0, corso.moduli[0]!.titolo, false],
      [1, corso.moduli[1]!.titolo, false],
      [2, 'Testing con Vitest', true],
      [3, 'Fondamenti di Computer Science', true],
      [4, 'TypeScript', true],
    ]);
    expect(corso.moduli.map((m) => m.stato)).toEqual(['aperto', 'bloccato', 'bloccato', 'bloccato', 'bloccato']);
    expect(await delCorso('unita', corso.id)).toHaveLength(13);
  });

  it('ogni import crea un corso nuovo (MECC §16): id nuovo, stesso contenuto, il primo resta intatto', async () => {
    const a = await importSampleCourse(db, T0);
    const b = await importSampleCourse(db, T1);
    expect(b.corso.id).not.toBe(a.corso.id);
    expect((await list(db, 'corsi')).map((c) => c.id).sort()).toEqual([a.corso.id, b.corso.id].sort());
    const conIdDelPrimo = (o: unknown) => JSON.parse(JSON.stringify(o).replaceAll(b.corso.id, a.corso.id));
    expect(conIdDelPrimo(b.corso)).toEqual({ ...a.corso, importatoIl: T1 });
    for (const nome of ['moduli', 'unita', 'sezioni', 'risorse'] as const) {
      const primo = await delCorso(nome, a.corso.id);
      expect(primo.length).toBeGreaterThan(0);
      expect(await delCorso(nome, b.corso.id)).toHaveLength(primo.length);
      expect(primo.every((r) => r.updatedAt === T0)).toBe(true); // il secondo import non riscrive il primo
    }
  });

  it('la scheda del corso di esempio (S10): badge «Esempio», 5 moduli · 13 unità contati dalle righe salvate', async () => {
    await importSampleCourse(db, T0);
    expect(await courseCards(db)).toMatchObject([
      {
        titolo: 'Syllabus Software Engineer 2026',
        esempio: true,
        moduli: 5,
        unita: 13,
        completate: 0,
        pct: 0,
        minuti: 0,
      },
    ]);
  });

  it('avanzamento e tempo dedicato (FUNZ §9.3): unità completate, percentuale intera, somma dei minuti', async () => {
    const { corso } = await importSampleCourse(db, T0);
    const [u1, u2, u3] = await delCorso('unita', corso.id);
    for (const u of [u1!, u2!]) await save(db, 'unita', { ...u, stato: 'completata', minuti: 45 }, T1);
    await save(db, 'unita', { ...u3!, stato: 'parziale', minuti: 20 }, T1);
    expect(await courseCards(db)).toMatchObject([{ unita: 13, completate: 2, pct: 15, minuti: 110 }]);
  });
});

// ------------------------------------------------------------------ import ZIP salvato (T-038)

describe('Import ZIP salvato — SCENARI H1; MECC §16', () => {
  beforeEach(() => {
    db = openDb(`test-import-${++n}`);
  });
  afterEach(() => db.delete());

  const conStruttura = zipSync({ '00_struttura.md': strToU8(STRUTTURA), 'M1-Tooling.md': strToU8(M1) });
  const senzaStruttura = zipSync({ 'M1-Tooling.md': strToU8(M1) });

  it('due import dello stesso ZIP → due corsi nel database, con le loro righe', async () => {
    const a = await importZip(db, conStruttura, T0);
    const b = await importZip(db, conStruttura, T1);
    expect(b.corso.id).not.toBe(a.corso.id);
    const schede = await courseCards(db);
    expect(schede.map((c) => [c.id, c.titolo, c.esempio, c.moduli, c.unita])).toEqual([
      [a.corso.id, 'Syllabus Software Engineer 2026', false, 1, 1],
      [b.corso.id, 'Syllabus Software Engineer 2026', false, 1, 1],
    ]);
  });

  it('il titolo si chiede solo se manca 00_struttura (FORMATO §1, D-PARSE-1)', async () => {
    expect(zipNeedsTitle(conStruttura)).toBe(false);
    expect(zipNeedsTitle(senzaStruttura)).toBe(true);
    await importZip(db, senzaStruttura, T0, 'Il mio corso');
    expect((await courseCards(db))[0]?.titolo).toBe('Il mio corso');
    await importZip(db, senzaStruttura, T1, '  ');
    expect((await courseCards(db))[1]?.titolo).toBe('Corso importato'); // campo lasciato vuoto (D-PARSE-1)
  });

  it('avvisi mostrati al massimo 5, con il totale (MECC §16)', async () => {
    const rotti = Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map((k) => [`M${k}-Rotto.md`, strToU8(M2_BROKEN)] as const));
    const zip = zipSync({ ...rotti, 'M1-Tooling.md': strToU8(M1) });
    const r = await importZip(db, zip, T0);
    const tutti = importCourseFromZip(zip, opts).avvisi;
    expect(tutti.length).toBeGreaterThanOrEqual(7); // almeno uno per file rotto
    expect(r.totaleAvvisi).toBe(tutti.length);
    expect(r.avvisi).toEqual(tutti.slice(0, 5)); // i primi 5, nell'ordine del parser
  });

  it('ZIP illeggibile o senza moduli → errore leggibile e nessun corso salvato', async () => {
    await expect(importZip(db, strToU8('non è uno zip'), T0)).rejects.toThrow(ErroreImportCorso);
    const soloReadme = zipSync({ 'README.md': strToU8('# ciao') });
    await expect(importZip(db, soloReadme, T0)).rejects.toThrow(ErroreImportCorso);
    expect(() => zipNeedsTitle(strToU8('non è uno zip'))).toThrow(ErroreImportCorso);
    expect(await courseCards(db)).toEqual([]);
  });
});

describe('Una lettura dello ZIP — MECCANISMI §16 (audit P3-25)', () => {
  it('chiedere se serve il titolo e poi importare lo stesso file lo decomprime una volta', () => {
    const zip = zipSync({ 'M1-Tooling.md': strToU8(M1) });
    vi.mocked(unzipSync).mockClear();
    expect(zipNeedsTitle(zip)).toBe(true);
    importCourseFromZip(zip, { corsoId: 'c1', now: 0, titolo: 'Corso' });
    expect(unzipSync).toHaveBeenCalledTimes(1);
  });
});
