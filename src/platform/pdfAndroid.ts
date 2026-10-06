// Visore del sistema per i PDF su Android (D-MAT-2, porta `VisorePdf`): il PDF va nella cache dell'app con
// `@capacitor/filesystem` e il plugin locale `VisorePdf` (android/app/src/main/java/com/routforge/app) lo apre con
// l'app dei PDF del dispositivo. Un PDF alla volta nella cache: il precedente si cancella, e all'avvio anche l'ultimo
// (quello di un materiale eliminato non resta oltre). Sul web non c'è (`null`).
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import type { VisorePdf } from '../app/ports/pdf';

const Visore = registerPlugin<{ apri(o: { percorso: string }): Promise<void> }>('VisorePdf');

/** Pezzi da 2 MiB: un PDF da 20 MiB in un solo messaggio del ponte (27 MB di base64) può esaurire la memoria. */
const PEZZO = 2 * 1024 * 1024;

/** Il binario in base64 per il ponte di Capacitor (`writeFile` vuole una stringa). */
const base64 = (dati: Uint8Array) =>
  new Promise<string>((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).slice(String(r.result).indexOf(',') + 1));
    r.onerror = () => ko(r.error);
    r.readAsDataURL(new Blob([dati.slice()]));
  });

/** Il nome che vedrà l'app dei PDF: lettere, cifre, spazi e `._()-` del titolo (niente separatori), con `.pdf`. */
const nomeFile = (titolo: string) =>
  `${
    titolo
      .normalize('NFC')
      .replace(/\.pdf$/i, '')
      .replace(/[^\p{L}\p{N} ._()-]+/gu, '_')
      .slice(0, 80) || 'pdf'
  }.pdf`;

const svuota = () =>
  Filesystem.rmdir({ path: 'pdf', directory: Directory.Cache, recursive: true }).catch(() => undefined);

function creaVisore(): VisorePdf {
  void svuota();
  // Un secondo tocco mentre il primo PDF si scrive non riscrive il file sotto il visore: vale il primo
  let occupato = false;
  return {
    async apri(dati, titolo) {
      if (occupato) return true;
      occupato = true;
      try {
        await svuota();
        const percorso = `pdf/${nomeFile(titolo)}`;
        for (let i = 0; i === 0 || i < dati.byteLength; i += PEZZO) {
          const data = await base64(dati.subarray(i, i + PEZZO));
          const dove = { path: percorso, data, directory: Directory.Cache };
          await (i === 0 ? Filesystem.writeFile({ ...dove, recursive: true }) : Filesystem.appendFile(dove));
        }
        await Visore.apri({ percorso });
        return true;
      } catch {
        return false;
      } finally {
        occupato = false;
      }
    },
  };
}

export const androidPdfViewer: VisorePdf | null = Capacitor.getPlatform() === 'android' ? creaVisore() : null;
