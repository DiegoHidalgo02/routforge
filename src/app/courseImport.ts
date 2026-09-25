/**
 * Import del corso — layer applicativo (MECC §16, FORMATO_CORSO §1 e §5). Criterio: SCENARI H1.
 *
 * Estrae i file dallo ZIP con `fflate` (D-STACK-1) e li passa a `parseCourse` (dominio), che fa tutto
 * il lavoro di interpretazione: filtro `.md`, percorsi appiattiti, avvisi, titolo di ripiego (D-PARSE-1)
 * e duplicati (D-PARSE-3). Il titolo chiesto all'utente quando manca `00_struttura` (FORMATO §1) è
 * responsabilità della UI: questo livello si limita a inoltrare `opts.titolo` a `parseCourse`.
 * Il corso di esempio incluso (T-005, D-SAMPLE-1) si legge e si salva qui: ogni import crea un corso nuovo.
 */
import { unzipSync, strFromU8 } from 'fflate';
import { newId, saveCourse } from '../data/repository';
import type { RoutForgeDb } from '../data/db';
import m0 from '../data/sample-course/M0-Riattivazione_JavaScript.md?raw';
import m1 from '../data/sample-course/M1-Tooling_Moderno.md?raw';
import {
  ErroreImportCorso,
  parseCourse,
  type FileCorso,
  type OpzioniImport,
  type RisultatoImportCorso,
} from '../domain/course/parser';

export { ErroreImportCorso };
export type { OpzioniImport, RisultatoImportCorso };

/** Importa un corso da uno ZIP grezzo. `ErroreImportCorso` se lo ZIP è illeggibile o senza moduli. */
export function importCourseFromZip(zip: Uint8Array, opts: OpzioniImport): RisultatoImportCorso {
  let entries: Record<string, Uint8Array>;
  try {
    // Si decomprimono solo i `.md` (FORMATO §1): un PDF o una cartella estranea nello ZIP non occupano memoria.
    // La regola su quali file leggere resta nel parser; questo è solo un filtro sull'inflazione.
    entries = unzipSync(zip, { filter: (f) => /\.md$/i.test(f.name) });
  } catch {
    throw new ErroreImportCorso('ZIP non leggibile o corrotto');
  }
  const files: FileCorso[] = Object.entries(entries).map(([name, data]) => ({
    name,
    content: strFromU8(data),
  }));
  return parseCourse(files, opts);
}

/** Corso di esempio incluso: M0 + M1 dell'export del design, senza file struttura (FORMATO §5, D-SAMPLE-1). */
const ESEMPIO: FileCorso[] = [
  { name: 'M0-Riattivazione_JavaScript.md', content: m0 },
  { name: 'M1-Tooling_Moderno.md', content: m1 },
];

/** Carica il corso di esempio: come ogni import crea un corso nuovo (MECC §16), marcato come esempio. */
export async function importSampleCourse(db: RoutForgeDb, now: number): Promise<RisultatoImportCorso> {
  // Il titolo lo fissa FORMATO §5: non si chiede all'utente (D-SAMPLE-1).
  const r = parseCourse(ESEMPIO, { corsoId: newId(), now, titolo: 'Syllabus Software Engineer 2026' });
  await saveCourse(db, r.corso, now, true);
  return r;
}
