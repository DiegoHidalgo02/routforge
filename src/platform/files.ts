// Salvataggio di un file per l'utente (porta `ArchivioFile`; MECC §22, FUNZ §20; T-030): sul web lo scarica il browser,
// su Android va nella cartella Documenti con `@capacitor/filesystem` (fino ad Android 10 serve il permesso di scrittura
// sull'archivio condiviso, dall'11 l'app scrive i file che crea). Non lancia: `null` se il salvataggio fallisce.
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import type { ArchivioFile } from '../app/ports/files';

/** Caratteri per messaggio del ponte: un backup coi PDF supera di molto la misura di un solo messaggio. */
const PEZZO = 1024 * 1024;

const web: ArchivioFile = {
  salva(nome, testo) {
    try {
      const url = URL.createObjectURL(new Blob([testo], { type: 'application/json' }));
      Object.assign(document.createElement('a'), { href: url, download: nome }).click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      return Promise.resolve('download');
    } catch {
      return Promise.resolve(null);
    }
  },
};

const android: ArchivioFile = {
  async salva(nome, testo) {
    // Si scrive su un nome a parte e si rinomina solo a file completo: un export fallito non tocca il backup che ha
    // già quel nome (lo stesso giorno) e non lascia file troncati col nome giusto (audit P0-1)
    const parziale = `${nome}.parziale`;
    let completo = false;
    try {
      await Filesystem.requestPermissions();
      for (let i = 0; i === 0 || i < testo.length;) {
        // Un pezzo non finisce a metà di una coppia surrogata (un'emoji in un titolo): si spezzerebbe in UTF-8
        let fine = Math.min(i + PEZZO, testo.length);
        if (fine < testo.length && /[\uD800-\uDBFF]/.test(testo.charAt(fine - 1))) fine--;
        const dove = {
          path: parziale,
          data: testo.slice(i, fine),
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        };
        await (i === 0 ? Filesystem.writeFile({ ...dove, recursive: true }) : Filesystem.appendFile(dove));
        i = fine;
        if (fine === 0) break;
      }
      completo = true;
      await Filesystem.rename({ from: parziale, to: nome, directory: Directory.Documents });
      return 'documenti';
    } catch {
      // Il plugin cancella la destinazione prima di rinominare: se poi la rinomina fallisce, il parziale completo è
      // l'unica copia del backup e resta (revisione di sicurezza di P0-1)
      if (!completo)
        await Filesystem.deleteFile({ path: parziale, directory: Directory.Documents }).catch(() => undefined);
      return null;
    }
  },
};

export const backupFiles: ArchivioFile = Capacitor.getPlatform() === 'android' ? android : web;
