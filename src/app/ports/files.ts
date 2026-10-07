/**
 * Dove l'app salva un file per l'utente (MECC §22, FUNZ §20; T-030): sul web lo scarica il browser, su Android va nella
 * cartella Documenti del dispositivo. Adapter in `src/platform/files.ts`. Non lancia: `null` se il salvataggio fallisce.
 */
export interface ArchivioFile {
  salva(nome: string, testo: string): Promise<'documenti' | 'download' | null>;
}
