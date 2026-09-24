// =============================================================================
// Corso di esempio (CONTESTO §5, FORMATO_CORSO §0 e §5; decisioni D-SAMPLE-1, D-PARSE-2; invariante INV-19)
// -----------------------------------------------------------------------------
// I due moduli in src/data/sample-course/ sono la copia esatta dell'export di Claude Design; il parser li legge
// senza avvisi e produce lo stesso corso già letto dal design (claude-design/design/course-data.js), a meno delle
// differenze annotate in `attesoDalFixture` e `dalParser`. Il test vive in scripts/ perché il fixture sta fuori da
// src/ e INV-1 vieta gli import fuori da src (scripts/architettura.test.mjs).
// =============================================================================
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCourse } from '../src/domain/course/parser.ts';
import { local } from '../src/domain/time.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = join(ROOT, 'claude-design', 'spec');
const COPIA = join(ROOT, 'src', 'data', 'sample-course');
const FILE = ['M0-Riattivazione_JavaScript.md', 'M1-Tooling_Moderno.md'];

/** Il fixture è un modulo ES `export const COURSE = {...};`: si legge come JSON senza importarlo. */
function leggiFixture() {
  const testo = readFileSync(join(ROOT, 'claude-design', 'design', 'course-data.js'), 'utf8');
  return JSON.parse(testo.slice(testo.indexOf('{'), testo.lastIndexOf('}') + 1));
}

const stripBold = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1');
const senzaLink = (s) => s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '$1');
const risorsa = ({ title, url, host }) => ({ title, url, host });

/**
 * Forma confrontabile del fixture. FORMATO §0 dichiara course-data.js «risultato atteso», ma in quattro campi il
 * fixture si discosta dalle regole di FORMATO §2–§3: vincono le regole (D-PARSE-2 estesa, 00_SINTESI §6 riga 24):
 * - `heading`: il fixture tiene «Teoria (Fondamenta)», «Studio (Visualizzazione)», «Pratica (Testing & Debugging)»,
 *   il parser il contenuto della parentesi (FORMATO §3, D-PARSE-2);
 * - `window`: il fixture tiene «· mini-modulo» preso dalla parentesi di M1, FORMATO §2 rimuove la parentesi;
 * - `intro`: il fixture tiene solo il primo paragrafo senza grassetto e aggiunge la riga guida degli obiettivi;
 *   FORMATO §2 conserva tutti i paragrafi introduttivi: si confronta il primo paragrafo;
 * - `fit.text`: il fixture riduce i link markdown al solo titolo;
 * - `criteria`: senza soglia e stato; `links`: senza flag YouTube; `file`, `importedOn`, `locked` (segnaposto
 *   M2–M4 senza file): solo nel fixture.
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
      finestraIndicativa: m.window.split(' · ')[0],
      trasversali: m.transversal,
      intro: m.intro[0],
      obiettivi: m.objectives,
      unita: m.units.map((u) => ({
        numero: u.n,
        titolo: u.title,
        concettoCore: { titolo: u.core.title, testo: u.core.text },
        sezioni: u.sections.map((s) => ({
          tipo: s.type,
          etichetta: s.label,
          intestazione: s.heading.replace(/^(?:Teoria|Studio|Pratica)\s*\((.+)\)$/, '$1'),
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

const daRisorsa = ({ titolo, url, host }) => ({ title: titolo, url, host });

function dalParser(corso) {
  return {
    titolo: corso.titolo,
    moduli: corso.moduli.map((m) => ({
      numero: m.numero,
      nn: m.nn,
      titolo: m.titolo,
      tipo: m.tipo,
      prerequisiti: m.prerequisiti,
      finestraIndicativa: m.finestraIndicativa,
      trasversali: m.trasversali,
      intro: stripBold(m.intro.split('\n')[0]),
      obiettivi: m.obiettivi,
      unita: m.unita.map((u) => ({
        numero: u.numero,
        titolo: u.titolo,
        concettoCore: u.concettoCore,
        sezioni: u.sezioni.map((s) => ({
          tipo: s.tipo,
          etichetta: s.etichetta,
          intestazione: s.intestazione,
          risorse: s.risorse.map(daRisorsa),
          descrizione: s.descrizione,
        })),
      })),
      domande: m.domande,
      esercizi: m.esercizi,
      criteri: m.criteri.map(({ testo, auto }) => ({ testo, auto })),
      noGo: m.noGo,
      riassunto: m.riassunto,
      progetto: m.progetto && {
        titolo: m.progetto.titolo,
        descrizione: m.progetto.descrizione,
        risorsa: m.progetto.risorsa && daRisorsa(m.progetto.risorsa),
      },
      testDiFit: m.testDiFit
        ? { testo: senzaLink(m.testDiFit.testo), risorse: m.testDiFit.risorse.map(daRisorsa) }
        : null,
    })),
  };
}

const files = FILE.map((name) => ({ name, content: readFileSync(join(COPIA, name), 'utf8') }));
// Titolo passato dal chiamante: l'export non ha il file struttura (FORMATO §5, D-PARSE-1, D-SAMPLE-1).
const opzioni = { corsoId: 'corso-esempio', now: local(2026, 9, 24, 9, 0), titolo: 'Syllabus Software Engineer 2026' };

describe('Corso di esempio — CONTESTO §5, FORMATO_CORSO §0 e §5 (INV-19, D-SAMPLE-1)', () => {
  it("src/data/sample-course/ è la copia esatta dei moduli dell'export del design", () => {
    for (const name of FILE) {
      expect(readFileSync(join(COPIA, name), 'utf8')).toBe(readFileSync(join(EXPORT, name), 'utf8'));
    }
  });

  it('M0 + M1 si importano senza avvisi: 2 moduli, 9 + 4 unità con 4 sezioni, 7 + 5 criteri, test di fit solo in M0', () => {
    const { corso, avvisi } = parseCourse(files, opzioni);
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
    // Puntatore sulla prima unità; M1 bloccato finché i criteri di M0 non sono tutti sì (FORMATO §4)
    expect(corso.unitaCorrenteId).toBe('corso-esempio:M0:U0.1');
    expect(corso.moduli.map((m) => m.stato)).toEqual(['aperto', 'bloccato']);
  });

  it('il corso letto dal parser coincide con course-data.js (differenze annotate in attesoDalFixture)', () => {
    const { corso } = parseCourse(files, opzioni);
    expect(dalParser(corso)).toEqual(attesoDalFixture(leggiFixture()));
  });

  it('il confronto riconosce davvero una differenza (autotest)', () => {
    const { corso } = parseCourse(files, opzioni);
    const fixture = leggiFixture();
    fixture.modules[0].units[6].title += ' (modificato)';
    expect(dalParser(corso)).not.toEqual(attesoDalFixture(fixture));
  });
});
