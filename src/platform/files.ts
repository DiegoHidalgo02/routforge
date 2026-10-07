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
    try {
      await Filesystem.requestPermissions();
      for (let i = 0; i === 0 || i < testo.length;) {
        // Un pezzo non finisce a metà di una coppia surrogata (un'emoji in un titolo): si spezzerebbe in UTF-8
        let fine = Math.min(i + PEZZO, testo.length);
        if (fine < testo.length && /[\uD800-\uDBFF]/.test(testo.charAt(fine - 1))) fine--;
        const dove = {
          path: nome,
          data: testo.slice(i, fine),
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        };
        await (i === 0 ? Filesystem.writeFile({ ...dove, recursive: true }) : Filesystem.appendFile(dove));
        i = fine;
        if (fine === 0) break;
      }
      return 'documenti';
    } catch {
      // Niente file troncati col nome giusto in Documenti
      await Filesystem.deleteFile({ path: nome, directory: Directory.Documents }).catch(() => undefined);
      return null;
    }
  },
};

export const backupFiles: ArchivioFile = Capacitor.getPlatform() === 'android' ? android : web;
