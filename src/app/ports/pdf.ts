/**
 * Porta del lettore PDF (MECC §17; T-024; D-MAT-1): il testo delle prime pagine per l'AI e le pagine come immagini per
 * il visualizzatore (S13), anche dove il browser o la WebView non mostrano i PDF. Adapter web in `src/platform/pdf.ts`
 * (pdf.js). L'adapter non lancia (INV-16): un PDF illeggibile dà `null` e il servizio lo tiene passivo.
 */
export interface LettorePdf {
  /** Numero di pagine e testo delle prime `maxPagine` (una stringa per pagina). */
  leggi(dati: Uint8Array, maxPagine: number): Promise<{ pagine: number; testi: string[] } | null>;
  /** La pagina `numero` (da 1) come immagine PNG larga `larghezza` pixel. */
  pagina(dati: Uint8Array, numero: number, larghezza: number): Promise<Uint8Array | null>;
}
