// =============================================================================
// Corso di esempio (CONTESTO §5, FORMATO_CORSO §0 e §5; decisioni D-SAMPLE-1, D-DESIGN-1, D-DESIGN-2; invariante INV-19)
// -----------------------------------------------------------------------------
// I due moduli in src/data/sample-course/ sono i file di riferimento di FORMATO §0: il parser li legge senza avvisi
// e produce il corso di course-data.js, nella stessa cartella, il risultato atteso (FORMATO §0 e §5, D-DESIGN-1). Il
// fixture viene dal vecchio export del design ed è l'unica copia rimasta (D-DESIGN-2). Il test resta in scripts/:
// course-data.js è JavaScript senza tipi, che il typecheck strict di src non accetta come import.
// =============================================================================
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COURSE } from '../src/data/sample-course/course-data.js';
import { SEGNAPOSTO_ESEMPIO } from '../src/app/courseImport.ts';
import { parseCourse } from '../src/domain/course/parser.ts';
import { local } from '../src/domain/time.ts';

const ROOT = join(import.meta.dirname, '..');
const COPIA = join(ROOT, 'src', 'data', 'sample-course');
const FILE = ['M0-Riattivazione_JavaScript.md', 'M1-Tooling_Moderno.md'];

const risorsa = ({ title, url, host }) => ({ titolo: title, url, host });

/**
 * Forma attesa del corso con i nomi del dominio (D-NAMING-1), confrontata come sottoinsieme dell'output del parser
 * (`toMatchObject`: id, stati, soglie e flag YouTube del parser non contano; `file` e `importedOn` no; `locked` — i
 * segnaposto M2–M4 senza file — si confronta a parte con `SEGNAPOSTO_ESEMPIO`, che l'import passa al parser, T-041). Nessuna differenza annotata: dove il fixture si discostava dalle
 * regole di FORMATO §2–§3 (intestazione, finestra, intro, test di fit) vince il fixture (D-DESIGN-1).
 */
function attesoDalFixture(fixture) {
  return {
    titolo: fixture.title,
    moduli: fixture.modules.map((m) => ({
      numero: m.n,
      nn: m.nn,
      titolo: m.title,
      tipo: m.type,
      prerequisiti: m.prereq,
      finestraIndicativa: m.window,
      trasversali: m.transversal,
      intro: m.intro.join('\n'),
      obiettivi: m.objectives,
      unita: m.units.map((u) => ({
        numero: u.n,
        titolo: u.title,
        concettoCore: { titolo: u.core.title, testo: u.core.text },
        sezioni: u.sections.map((s) => ({
          tipo: s.type,
          etichetta: s.label,
          intestazione: s.heading,
          risorse: s.links.map(risorsa),
          descrizione: s.description,
        })),
      })),
      domande: m.questions,
      esercizi: m.exercises,
      criteri: m.criteria.map(({ text, auto }) => ({ testo: text, auto })),
      noGo: m.noGo,
      riassunto: m.summary,
      progetto: { titolo: m.project.title, descrizione: m.project.description, risorsa: risorsa(m.project.resource) },
      testDiFit: m.fit ? { testo: m.fit.text, risorse: m.fit.links.map(risorsa) } : null,
    })),
  };
}

const files = FILE.map((nome) => ({ nome, contenuto: readFileSync(join(COPIA, nome), 'utf8') }));
// Titolo passato dal chiamante: il corso di esempio non ha il file struttura (FORMATO §5, D-PARSE-1, D-SAMPLE-1).
const opzioni = { corsoId: 'corso-esempio', now: local(2026, 9, 24, 9, 0), titolo: 'Syllabus Software Engineer 2026' };
const { corso, avvisi } = parseCourse(files, opzioni);

describe('Corso di esempio — CONTESTO §5, FORMATO_CORSO §0 e §5 (INV-19, D-SAMPLE-1)', () => {
  it('M0 + M1 si importano senza avvisi: 2 moduli, 9 + 4 unità con 4 sezioni, 7 + 5 criteri, test di fit solo in M0', () => {
    expect(avvisi).toEqual([]);
    expect(corso.titolo).toBe('Syllabus Software Engineer 2026');
    expect(corso.moduli.map((m) => m.numero)).toEqual([0, 1]);
    expect(corso.moduli.map((m) => m.unita.length)).toEqual([9, 4]);
    expect(corso.numeroUnita).toBe(13);
    expect(corso.moduli.flatMap((m) => m.unita).every((u) => u.sezioni.length === 4)).toBe(true);
    expect(corso.moduli.map((m) => m.criteri.length)).toEqual([7, 5]);
    // Un solo criterio auto per modulo («Domande socratiche»), con la soglia scritta nel testo
    expect(corso.moduli.map((m) => m.criteri.filter((c) => c.auto).map((c) => c.soglia))).toEqual([[0.8], [7 / 8]]);
    expect(corso.moduli.map((m) => m.testDiFit !== null)).toEqual([true, false]);
    // Nessuna unità dichiara ore stimate o difficoltà (FORMATO §5: il file non le contiene)
    expect(corso.moduli.flatMap((m) => m.unita).every((u) => u.oreStimate === null && u.difficolta === null)).toBe(
      true,
    );
    // M1 bloccato finché i criteri di M0 non sono tutti sì (FORMATO §4)
    expect(corso.moduli.map((m) => m.stato)).toEqual(['aperto', 'bloccato']);
  });

  it('il corso letto dal parser coincide con course-data.js', () => {
    expect(corso).toMatchObject(attesoDalFixture(COURSE));
  });

  it('i segnaposto dell’import sono `locked` del fixture: moduli bloccati con solo numero e titolo, 5 moduli · 13 unità (T-041)', () => {
    const conSegnaposto = parseCourse(files, { ...opzioni, segnaposto: SEGNAPOSTO_ESEMPIO }).corso;
    expect(conSegnaposto.moduli).toHaveLength(5);
    expect(conSegnaposto.numeroUnita).toBe(13);
    expect(
      conSegnaposto.moduli
        .filter((m) => m.segnaposto)
        .map(({ numero, nn, titolo, stato, unita }) => ({ numero, nn, titolo, stato, unita })),
    ).toEqual(COURSE.locked.map((l) => ({ numero: l.n, nn: l.nn, titolo: l.title, stato: 'bloccato', unita: [] })));
  });
});
