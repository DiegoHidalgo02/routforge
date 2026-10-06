/**
 * Materiali dell'utente (MECC §17, FUNZ §10; T-024; criterio: SCENARI H2; D-MAT-1): link, nota e PDF di un'unità. Il
 * PDF si legge con la porta `LettorePdf`, che il punto di composizione inietta come gli adapter di `sessionDevice.ts`;
 * il binario sta in `materialiBinari` con l'id del materiale. Spazio occupato per Impostazioni; al reimport di un corso
 * con lo stesso titolo i materiali passano al corso nuovo (FUNZ §10).
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, list, listBy, remove, save } from '../data/repository';
import {
  extractedText,
  linkUrl,
  MAX_PAGINE_ESTRATTE,
  moveMaterials,
  pdfTooLarge,
  type Materiale,
} from '../domain/materials';
import type { LettorePdf } from './ports/pdf';

let lettore: LettorePdf = { leggi: () => Promise.resolve(null), pagina: () => Promise.resolve(null) };

export function configurePdf(l: LettorePdf): void {
  lettore = l;
}

/** Dove sta un materiale: il corso e l'unità. */
export interface Posto {
  corsoId: string;
  unitaId: string;
}

/** Un link (§17); `null` senza indirizzo. */
export async function addLink(db: RoutForgeDb, posto: Posto, titolo: string, indirizzo: string, now: number) {
  if (!indirizzo.trim()) return null;
  const url = linkUrl(indirizzo);
  return save(db, 'materiali', { ...posto, tipo: 'link', titolo: titolo.trim() || url, url }, now);
}

export function addNote(db: RoutForgeDb, posto: Posto, titolo: string, testo: string, now: number) {
  return save(db, 'materiali', { ...posto, tipo: 'nota', titolo: titolo.trim(), testo }, now);
}

export type EsitoPdf = { esito: 'aggiunto'; materiale: Materiale } | { esito: 'troppo_grande'; byte: number };

/** Un PDF (§17, H2): oltre 20 MB non si aggiunge; senza testo leggibile resta passivo. */
export async function addPdf(
  db: RoutForgeDb,
  posto: Posto,
  file: { nome: string; byte: number; leggi: () => Promise<Uint8Array> },
  now: number,
): Promise<EsitoPdf> {
  // Il limite si controlla sulla dimensione dichiarata, prima di leggere il file in memoria
  if (pdfTooLarge(file.byte)) return { esito: 'troppo_grande', byte: file.byte };
  const dati = await file.leggi();
  if (pdfTooLarge(dati.byteLength)) return { esito: 'troppo_grande', byte: dati.byteLength };
  const nome = file.nome;
  // Fuori dalla transazione: la lettura del PDF non è un'operazione del database
  const letto = await lettore.leggi(dati, MAX_PAGINE_ESTRATTE);
  return inTransaction(db, ['materiali', 'materialiBinari'], async () => {
    const materiale = await save(
      db,
      'materiali',
      {
        ...posto,
        tipo: 'pdf',
        titolo: nome,
        byte: dati.byteLength,
        pagine: letto?.pagine ?? 0,
        testoEstratto: letto ? extractedText(letto.testi) : null,
      },
      now,
    );
    await save(db, 'materialiBinari', { id: materiale.id, materialeId: materiale.id, dati }, now);
    return { esito: 'aggiunto' as const, materiale };
  });
}

/** I materiali di un'unità, dal più vecchio. */
export const readMaterials = async (db: RoutForgeDb, unitaId: string) =>
  (await listBy(db, 'materiali', 'unitaId', unitaId)).sort((a, b) => a.createdAt - b.createdAt);

/** Un materiale col numero della sua unità («Unità 0.7» del visualizzatore). */
export async function readMaterial(db: RoutForgeDb, id: string) {
  const m = await get(db, 'materiali', id);
  if (!m) return null;
  const unita = m.unitaId ? await get(db, 'unita', m.unitaId) : undefined;
  return { ...m, numeroUnita: unita?.numero ?? null };
}

export const readPdf = async (db: RoutForgeDb, id: string): Promise<Uint8Array | null> =>
  (await get(db, 'materialiBinari', id))?.dati ?? null;

/** Una pagina del PDF come PNG per il visualizzatore (S13); `null` se non si disegna. */
export const renderPdfPage = (dati: Uint8Array, numero: number, larghezza: number) =>
  lettore.pagina(dati, numero, larghezza);

/**
 * Eliminare un PDF elimina il binario (§17). Restituisce ciò che c'era, per «Annulla» (CONTROLLI: le eliminazioni
 * singole offrono l'annullamento per 5 s).
 */
export function deleteMaterial(db: RoutForgeDb, id: string, now: number) {
  return inTransaction(db, ['materiali', 'materialiBinari'], async () => {
    const materiale = await get(db, 'materiali', id);
    const binario = await get(db, 'materialiBinari', id);
    await remove(db, 'materiali', id, now);
    if (binario) await remove(db, 'materialiBinari', id, now);
    return materiale ? { materiale, dati: binario?.dati ?? null } : null;
  });
}

/** «Annulla» dell'eliminazione: materiale e binario tornano com'erano. */
export function restoreMaterial(
  db: RoutForgeDb,
  copia: { materiale: Materiale; dati: Uint8Array | null },
  now: number,
): Promise<void> {
  return inTransaction(db, ['materiali', 'materialiBinari'], async () => {
    await save(db, 'materiali', copia.materiale, now);
    if (copia.dati)
      await save(
        db,
        'materialiBinari',
        { id: copia.materiale.id, materialeId: copia.materiale.id, dati: copia.dati },
        now,
      );
  });
}

/** Lo spazio dei materiali (§17: numero, file, byte) con il numero dell'unità di ognuno, dal più pesante. */
export async function materialsSpace(db: RoutForgeDb) {
  const [materiali, unita] = await Promise.all([list(db, 'materiali'), list(db, 'unita')]);
  const numero = new Map(unita.map((u) => [u.id, u.numero]));
  const righe = materiali
    .map((m) => ({
      ...m,
      numeroUnita: m.unitaId ? (numero.get(m.unitaId) ?? null) : null,
      // Note e link: i caratteri del testo, una misura vicina ai byte
      peso: m.byte ?? (m.testo ?? m.url ?? '').length,
    }))
    .sort((a, b) => b.peso - a.peso);
  return {
    righe,
    pdf: righe.filter((m) => m.tipo === 'pdf').reduce((n, m) => n + m.peso, 0),
    altri: righe.filter((m) => m.tipo !== 'pdf').reduce((n, m) => n + m.peso, 0),
  };
}

/**
 * Reimport (FUNZ §10, D-DESIGN-1 n. 8): i materiali dei corsi con lo stesso titolo passano al corso appena importato,
 * all'unità con lo stesso numero; quelli senza corrispondenza restano sul corso nuovo, senza unità.
 */
export async function moveMaterialsOnImport(db: RoutForgeDb, corso: { id: string; titolo: string }, now: number) {
  return inTransaction(db, ['corsi', 'unita', 'materiali'], async () => {
    const vecchi = (await list(db, 'corsi')).filter((c) => c.id !== corso.id && c.titolo === corso.titolo);
    if (vecchi.length === 0) return;
    const ids = new Set(vecchi.map((c) => c.id));
    const materiali = (await list(db, 'materiali')).filter((m) => ids.has(m.corsoId));
    if (materiali.length === 0) return;
    const unita = await list(db, 'unita');
    const numeroVecchio = new Map(unita.filter((u) => ids.has(u.corsoId)).map((u) => [u.id, u.numero]));
    const unitaNuova = new Map(unita.filter((u) => u.corsoId === corso.id).map((u) => [u.numero, u.id]));
    for (const m of moveMaterials(materiali, numeroVecchio, unitaNuova, corso.id)) await save(db, 'materiali', m, now);
  });
}
