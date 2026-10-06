/**
 * Lettore PDF web (porta `LettorePdf`, D-MAT-1): pdf.js con il suo worker, caricati solo al primo PDF. Il testo è quello
 * delle pagine come lo dà pdf.js; le pagine si disegnano su un canvas e diventano PNG. Un PDF illeggibile dà `null`
 * (INV-16): il servizio lo tiene passivo. Un PDF dell'utente non è fidato (CLAUDE.md §8): pdf.js 6 non valuta codice dai
 * font (CVE-2024-4367 è chiusa dalla 4.2.67).
 */
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
import type { LettorePdf } from '../app/ports/pdf';

const pdfjs = async () => {
  const lib = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  lib.GlobalWorkerOptions.workerSrc = worker.default;
  return lib;
};

/** Apre i byte (pdf.js li trasferisce al worker e li svuota: ne passa una copia); se l'apertura fallisce, la chiude. */
async function apri(dati: Uint8Array): Promise<{ compito: PDFDocumentLoadingTask; doc: PDFDocumentProxy }> {
  const compito = (await pdfjs()).getDocument({ data: dati.slice() });
  try {
    return { compito, doc: await compito.promise };
  } catch (e) {
    void compito.destroy();
    throw e;
  }
}

/** Esito senza eccezioni (INV-16). */
const esito = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch {
    return null;
  }
};

// Il visualizzatore mostra un PDF alla volta: le pagine riusano il documento aperto per gli stessi byte e si disegnano
// in fila, così scorrere veloce non apre un worker per pagina
let aperto: { dati: Uint8Array; documento: ReturnType<typeof apri> } | null = null;
let fila: Promise<unknown> = Promise.resolve();
const inFila = <T>(fn: () => Promise<T>): Promise<T> => {
  const r = fila.then(fn, fn);
  fila = r.catch(() => undefined);
  return r;
};
function documento(dati: Uint8Array): ReturnType<typeof apri> {
  if (aperto?.dati === dati) return aperto.documento;
  void aperto?.documento.then(
    ({ compito }) => compito.destroy(),
    () => undefined,
  );
  const nuovo = { dati, documento: apri(dati) };
  aperto = nuovo;
  nuovo.documento.catch(() => {
    if (aperto === nuovo) aperto = null;
  });
  return nuovo.documento;
}

export const webPdf: LettorePdf = {
  leggi: (dati, maxPagine) =>
    esito(async () => {
      const { compito, doc } = await apri(dati);
      try {
        const testi: string[] = [];
        for (let n = 1; n <= Math.min(doc.numPages, maxPagine); n++) {
          const contenuto = await (await doc.getPage(n)).getTextContent();
          testi.push(contenuto.items.map((x) => ('str' in x ? x.str : '')).join(' '));
        }
        return { pagine: doc.numPages, testi };
      } finally {
        void compito.destroy();
      }
    }),
  pagina: (dati, numero, larghezza) =>
    esito(() =>
      inFila(async () => {
        const { doc } = await documento(dati);
        const pagina = await doc.getPage(numero);
        const viewport = pagina.getViewport({ scale: larghezza / pagina.getViewport({ scale: 1 }).width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await pagina.render({ canvas, viewport }).promise;
        const png = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'));
        if (!png) throw new Error('pagina non disegnata');
        return new Uint8Array(await png.arrayBuffer());
      }),
    ),
};
