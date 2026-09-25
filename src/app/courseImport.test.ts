// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { openDb, type RoutForgeDb } from '../data/db';
import { list } from '../data/repository';
import { local } from '../domain/time';
import { ErroreImportCorso, importCourseFromZip, importSampleCourse } from './courseImport';

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

  it('si importa senza avvisi e si salva: «Syllabus Software Engineer 2026», 2 moduli · 13 unità, marcato come esempio', async () => {
    const { corso, avvisi } = await importSampleCourse(db, T0);
    expect(avvisi).toEqual([]);
    expect(await list(db, 'corsi')).toMatchObject([
      { id: corso.id, titolo: 'Syllabus Software Engineer 2026', importatoIl: T0, esempio: true },
    ]);
    // La card «Esempio» conta le righe salvate: 2 moduli · 13 unità, non i numeri dei mock (2 · 2)
    expect((await delCorso('moduli', corso.id)).map((m) => m.numero).sort()).toEqual([0, 1]);
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
});
