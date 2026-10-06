/**
 * Materiali dell'utente. Fonti: FUNZIONALITA §10, MECCANISMI §17; criterio: SCENARI H2 (PDF groundabile e passivo,
 * rifiuto oltre 20 MB). Decisione: D-MAT-1.
 *
 * Link col protocollo aggiunto se manca (solo http e https: un altro schema non diventa un collegamento eseguibile);
 * nota markdown; PDF ≤ 20 MB col testo delle prime 40 pagine, al più 60.000 caratteri: con testo è groundabile, senza
 * (scansionato o estrazione fallita) resta consultabile ma passivo. Al reimport di un corso con lo stesso titolo i
 * materiali passano alle unità con lo stesso numero; quelli senza corrispondenza restano sul corso nuovo.
 */

export type TipoMateriale = 'link' | 'nota' | 'pdf';

export interface Materiale {
  id: string;
  corsoId: string;
  /** `null` = materiale del corso, senza unità (dopo un reimport senza corrispondenza). */
  unitaId: string | null;
  tipo: TipoMateriale;
  titolo: string;
  /** Link: l'indirizzo con il protocollo. */
  url?: string;
  /** Nota: il testo markdown. */
  testo?: string;
  /** PDF: dimensione del binario, numero di pagine, testo estratto (`null` = passivo). */
  byte?: number;
  pagine?: number;
  testoEstratto?: string | null;
}

/** Limite del PDF (§17): 20 MB. */
export const MAX_PDF_BYTE = 20 * 1024 * 1024;
/** Estrazione del testo (§17): le prime 40 pagine, al più 60.000 caratteri. */
export const MAX_PAGINE_ESTRATTE = 40;
export const MAX_CARATTERI_ESTRATTI = 60_000;

/** L'indirizzo di un link (§17): `https://` se manca il protocollo; uno schema diverso da http/https si scarta. */
export function linkUrl(indirizzo: string): string {
  const u = indirizzo.trim();
  // «host:porta» non è uno schema: lo schema si riconosce dai due punti non seguiti da una cifra
  return /^https?:\/\//i.test(u) ? u : `https://${u.replace(/^[a-z][a-z\d+.-]*:(?!\d)\/*/i, '')}`;
}

export const pdfTooLarge = (byte: number): boolean => byte > MAX_PDF_BYTE;

/** Il testo del PDF per l'AI (§17, H2): `null` se non c'è testo (PDF scansionato: passivo). */
export function extractedText(pagine: readonly string[]): string | null {
  const testo = pagine
    .slice(0, MAX_PAGINE_ESTRATTE)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n\n');
  return testo ? testo.slice(0, MAX_CARATTERI_ESTRATTI) : null;
}

/** Entra nel contesto dell'AI (§17, §18): tutto tranne il PDF senza testo. */
export const isGroundable = (m: Pick<Materiale, 'tipo' | 'testoEstratto'>): boolean =>
  m.tipo !== 'pdf' || m.testoEstratto != null;

/**
 * Reimport (FUNZ §10): i materiali del corso vecchio passano al corso nuovo, all'unità con lo stesso numero; senza
 * corrispondenza restano sul corso nuovo, senza unità.
 */
export function moveMaterials(
  materiali: readonly Materiale[],
  numeroVecchio: ReadonlyMap<string, string>,
  unitaNuova: ReadonlyMap<string, string>,
  corsoId: string,
): Materiale[] {
  return materiali.map((m) => {
    const numero = m.unitaId ? numeroVecchio.get(m.unitaId) : undefined;
    return { ...m, corsoId, unitaId: (numero && unitaNuova.get(numero)) || null };
  });
}
