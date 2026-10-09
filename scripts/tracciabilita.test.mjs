// =============================================================================
// Tracciabilità scenari ↔ task ↔ test, verificata dal gate — invarianti INV-6, INV-7 (decisione D-TRACC-1)
// -----------------------------------------------------------------------------
// Fonte: CONTESTO §3 (gli scenari sono i criteri di accettazione); CLAUDE.md §4 (ogni `describe`
// cita il paragrafo o lo scenario). La matrice è docs/TRACCIABILITA.md: una riga per scenario.
// 1. Ogni scenario di docs/spec/RoutForge_SCENARI.md ha esattamente una riga, con almeno un task esistente
//    in docs/TASKS.md e uno stato fra `nessuno`, `parziale`, `coperto`.
// 2. Una riga `parziale`/`coperto` cita file di test esistenti che nominano lo scenario.
// 3. Un test che nomina uno scenario ("SCENARI B2") compare nella riga di quello scenario, mai `nessuno`.
// 4. Ogni `describe` (in src/**/*.test.ts(x) e scripts/**/*.test.mjs) cita un paragrafo (§), un file di spec,
//    uno scenario, una decisione, un invariante o un documento di docs/.
// =============================================================================
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { senzaCommenti } from './codice.mjs';

const QUESTO = import.meta.filename;
const RADICE = join(import.meta.dirname, '..');
const leggi = (p) => readFileSync(join(RADICE, p), 'utf8');
const posix = (p) => p.split(sep).join('/');

export const STATI = ['nessuno', 'parziale', 'coperto'];

/** Titoli di describe/it/test, anche con .skip/.only/.todo e .each(...): [tipo, modificatore, virgolette, titolo]. */
const TITOLI =
  /\b(describe|it|test)(?:\.(skip|only|todo|concurrent|sequential))?(?:\.each\([^)]*\))?\(\s*(['"`])(.*?)\3/g;

/** ID degli scenari dichiarati nella spec: righe `**A1 — …`. */
export const scenariSpec = (testo) => [...testo.matchAll(/^\*\*([A-J]\d+) —/gm)].map((m) => m[1]);

/** ID dei task dichiarati nel backlog: righe `| T-000 …`. */
export const taskBacklog = (testo) => [...testo.matchAll(/^\|\s*(T-\d{3})/gm)].map((m) => m[1]);

/** Righe della matrice: | Scenario | Regole | Dove | Task | Test | Stato |. */
export function righeMatrice(testo) {
  const out = [];
  for (const riga of testo.split('\n')) {
    if (!/^\|\s*[A-J]\d+\s*\|/.test(riga)) continue;
    const c = riga
      .split('|')
      .slice(1, -1)
      .map((x) => x.trim());
    if (c.length !== 6) continue;
    const [id, , , task, test, stato] = c;
    out.push({
      id,
      task: task.match(/T-\d{3}/g) ?? [],
      test: test.match(/[\w./-]+\.test\.(?:tsx?|mjs)/g) ?? [],
      stato,
    });
  }
  return out;
}

/**
 * Scenari nominati nei titoli che contengono la parola SCENARI. Un test saltato, da fare o commentato non verifica nulla:
 * non conta (audit P2-15).
 */
export function scenariCitati(codice) {
  const ids = new Set();
  for (const m of senzaCommenti(codice).matchAll(TITOLI)) {
    if (m[2] === 'skip' || m[2] === 'todo' || !/SCENARI/.test(m[4])) continue;
    for (const id of m[4].match(/\b[A-J]\d+\b/g) ?? []) ids.add(id);
  }
  return [...ids];
}

/** I test saltati, isolati o da fare (`.skip`, `.only`, `.todo`): nel repository non ne restano (.claude/rules/test.md). */
export const modificatoriVietati = (codice) =>
  [...senzaCommenti(codice).matchAll(/\b(?:describe|it|test)\.(?:skip|only|todo)\b/g)].map((m) => m[0]);

/** Titoli dei `describe` senza riferimento a spec, scenario, decisione, invariante o documento. */
export const describeSenzaFonte = (codice) =>
  [...codice.matchAll(TITOLI)]
    .filter((m) => m[1] === 'describe')
    .map((m) => m[4])
    .filter((t) => !/§|SCENARI|MECC|FORMATO|CONTESTO|FUNZ|D-[A-Z]+-\d+|INV-\d+|docs\/|CLAUDE\.md/.test(t));

const fileTest = (dir, re) =>
  existsSync(dir)
    ? readdirSync(dir, { recursive: true })
        .filter((n) => re.test(n))
        .map((n) => join(dir, n))
    : [];

const spec = scenariSpec(leggi('docs/spec/RoutForge_SCENARI.md'));
const matrice = righeMatrice(leggi('docs/TRACCIABILITA.md'));
const task = new Set(taskBacklog(leggi('docs/TASKS.md')));
// Questo file contiene titoli d'esempio nell'autotest: non è un test di scenario e resta fuori dalla scansione.
const testTutti = [
  ...fileTest(join(RADICE, 'src'), /\.test\.tsx?$/),
  ...fileTest(join(RADICE, 'scripts'), /\.test\.mjs$/),
].filter((p) => p !== QUESTO);

describe('Tracciabilità — CONTESTO §3, docs/TRACCIABILITA.md (INV-6, INV-7)', () => {
  it('ogni scenario della spec ha esattamente una riga nella matrice, e nessuna riga è senza scenario', () => {
    expect(spec.length).toBeGreaterThan(0);
    expect(matrice.map((r) => r.id).sort()).toEqual([...spec].sort());
  });

  it('ogni riga ha almeno un task esistente e uno stato ammesso', () => {
    const problemi = matrice.flatMap((r) => {
      const out = [];
      if (r.task.length === 0) out.push(`${r.id}: nessun task`);
      for (const t of r.task) if (!task.has(t)) out.push(`${r.id}: task ${t} non esiste in docs/TASKS.md`);
      if (!STATI.includes(r.stato)) out.push(`${r.id}: stato "${r.stato}" non ammesso`);
      return out;
    });
    expect(problemi).toEqual([]);
  });

  it('le righe parziale/coperto citano file di test esistenti che nominano lo scenario', () => {
    const problemi = matrice
      .filter((r) => r.stato !== 'nessuno')
      .flatMap((r) => {
        if (r.test.length === 0) return [`${r.id}: stato ${r.stato} senza test citati`];
        return r.test.flatMap((f) => {
          if (!existsSync(join(RADICE, f))) return [`${r.id}: il test ${f} non esiste`];
          return scenariCitati(leggi(f)).includes(r.id) ? [] : [`${r.id}: ${f} non nomina lo scenario`];
        });
      });
    expect(problemi).toEqual([]);
  });

  it('ogni test che nomina uno scenario compare nella riga di quello scenario', () => {
    const perId = new Map(matrice.map((r) => [r.id, r]));
    const problemi = testTutti.flatMap((p) => {
      const rel = posix(relative(RADICE, p));
      return scenariCitati(readFileSync(p, 'utf8')).flatMap((id) => {
        const riga = perId.get(id);
        if (!riga) return [`${rel}: scenario ${id} sconosciuto`];
        if (riga.stato === 'nessuno' || !riga.test.includes(rel)) return [`${rel}: aggiungilo alla riga ${id}`];
        return [];
      });
    });
    expect(problemi).toEqual([]);
  });

  it('ogni describe cita un paragrafo, una spec, uno scenario, una decisione, un invariante o un documento', () => {
    const problemi = testTutti.flatMap((p) =>
      describeSenzaFonte(readFileSync(p, 'utf8')).map((t) => `${posix(relative(RADICE, p))}: "${t}"`),
    );
    expect(problemi).toEqual([]);
  });

  it('nessun test saltato, isolato o da fare (.skip, .only, .todo) resta nel repository (.claude/rules/test.md)', () => {
    const problemi = testTutti.flatMap((p) =>
      modificatoriVietati(readFileSync(p, 'utf8')).map((m) => `${posix(relative(RADICE, p))}: ${m}`),
    );
    expect(problemi).toEqual([]);
  });

  it('i lettori riconoscono davvero il formato (autotest)', () => {
    expect(scenariSpec('**A1 — Uno**\n**J5 — Due**\n*A9 no*')).toEqual(['A1', 'J5']);
    expect(taskBacklog('| T-001 | x |\n| T-037 **R** | y |\n| ID |')).toEqual(['T-001', 'T-037']);
    const righe = righeMatrice('| A1 | §6 | domain/lost | T-001, T-012 | src/domain/lost.test.ts | parziale |');
    expect(righe).toEqual([
      { id: 'A1', task: ['T-001', 'T-012'], test: ['src/domain/lost.test.ts'], stato: 'parziale' },
    ]);
    // I test della UI sono .test.tsx (G3): il nome non va troncato in .test.ts
    expect(righeMatrice('| G3 | §15 | ui | T-015 | src/ui/Oggi.test.tsx | parziale |')[0]?.test).toEqual([
      'src/ui/Oggi.test.tsx',
    ]);
    const codice = [
      "describe('Persi — SCENARI B2 / B3', () => {});",
      "it('D3: pomodoro', () => {});",
      "test('Timer — SCENARI D1', () => {});",
      "it.each([[1, 2]])('Streak — SCENARI C2', () => {});",
      // Saltati, da fare o commentati non contano (audit P2-15)
      "describe.skip('Adesso — SCENARI G1', () => {});",
      "it.todo('Da fare — SCENARI A2');",
      "// it('Vecchio — SCENARI A1', () => {});",
      "/* test('Spento — SCENARI A3', () => {}); */",
    ].join('\n');
    expect(scenariCitati(codice)).toEqual(['B2', 'B3', 'D1', 'C2']);
    expect(
      modificatoriVietati(
        "it.only('a', f);\ndescribe.skip('b', f);\n// it.todo('c');\nit.skipIf(x)('d', f);\nit('e', f);",
      ),
    ).toEqual(['it.only', 'describe.skip']);
    expect(describeSenzaFonte("describe('Adesso — MECCANISMI §14', f); describe('Senza fonte', f);")).toEqual([
      'Senza fonte',
    ]);
    expect(describeSenzaFonte("describe('Selettore (docs/TASKS.md)', f); describe.only('X — INV-8', f);")).toEqual([]);
  });
});
