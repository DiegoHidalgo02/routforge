/**
 * Lettura ZIP del corso — layer applicativo (MECC §16, FORMATO_CORSO §1). Criterio: SCENARI H1.
 *
 * Estrae i file dallo ZIP con `fflate` (D-STACK-1) e li passa a `parseCourse` (dominio), che fa tutto
 * il lavoro di interpretazione: filtro `.md`, percorsi appiattiti, avvisi, titolo di ripiego (D-PARSE-1)
 * e duplicati (D-PARSE-3). Il titolo chiesto all'utente quando manca `00_struttura` (FORMATO §1) è
 * responsabilità della UI: questo livello si limita a inoltrare `opts.titolo` a `parseCourse`.
 */
import { unzipSync, strFromU8 } from 'fflate';
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
