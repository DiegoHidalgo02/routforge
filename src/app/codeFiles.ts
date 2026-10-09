/**
 * File di codice dell'utente (MECC §17, FUNZ §10; T-025; D-CODE-1): file sciolti o uno ZIP di progetto, da un'unità.
 * Un file escluso non si legge (decide nome e dimensione); lo ZIP si legge con `fflate` entro 100 MB e una voce esclusa
 * non si decomprime; i file ammessi di un caricamento sono al più 5 000 e 20 MB; un percorso già caricato nella stessa
 * unità si sostituisce. Il contenuto serve solo all'AI (T-026).
 */
import { strFromU8, unzipSync } from 'fflate';
import type { RoutForgeDb } from '../data/db';
import { inTransaction, list, listBy, newId, remove, save } from '../data/repository';
import {
  codeTree,
  collapseUpload,
  excludedCount,
  exclusionReason,
  MAX_BYTE_AMMESSI,
  MAX_BYTE_ZIP,
  MAX_FILE_AMMESSI,
  normalizePath,
  type FileCodice,
} from '../domain/codeFiles';

/** Un file scelto dall'utente: nome, dimensione dichiarata e lettura pigra dei byte. */
export interface FileScelto {
  nome: string;
  byte: number;
  leggi: () => Promise<Uint8Array>;
}

type Voce = Pick<FileCodice, 'percorso' | 'byte' | 'contenuto' | 'motivo' | 'file'>;

/** I file ammessi finora e i loro byte: i tetti valgono per tutto il caricamento, ZIP e file sciolti (audit P1-7). */
type Conto = { ammessi: number; byte: number };
/** `troppo_grande` se il file non entra nei tetti del caricamento, altrimenti lo conta. */
function conta(conto: Conto, byte: number): 'troppo_grande' | null {
  if (conto.ammessi >= MAX_FILE_AMMESSI || conto.byte + byte > MAX_BYTE_AMMESSI) return 'troppo_grande';
  conto.ammessi += 1;
  conto.byte += byte;
  return null;
}

/** I file di uno ZIP: gli esclusi si decidono dalla directory dello ZIP, senza decomprimerli. */
function fromZip(nome: string, dati: Uint8Array, conto: Conto): Voce[] {
  const voci: Voce[] = [];
  try {
    const dentro = unzipSync(dati, {
      filter: (x) => {
        if (x.name.endsWith('/') || x.name.endsWith('\\')) return false;
        const percorso = normalizePath(x.name);
        // La dimensione più grande fra dichiarata e compressa: un'intestazione falsa non aggira i 500 KB
        const byte = Math.max(x.size, x.originalSize);
        let motivo = exclusionReason(percorso, byte);
        // Una voce con una compressione che fflate non legge (Deflate64, LZMA, AES) è illeggibile da sola
        if (!motivo && x.compression !== 0 && x.compression !== 8) motivo = 'illeggibile';
        motivo ??= conta(conto, byte);
        if (motivo) {
          voci.push({ percorso, byte, contenuto: null, motivo });
          return false;
        }
        return true;
      },
    });
    for (const [percorso, contenuto] of Object.entries(dentro))
      voci.push({
        percorso: normalizePath(percorso),
        byte: contenuto.byteLength,
        contenuto: strFromU8(contenuto),
        motivo: null,
      });
  } catch {
    voci.length = 0;
    voci.push({ percorso: nome, byte: dati.byteLength, contenuto: null, motivo: 'illeggibile' });
  }
  return voci;
}

async function voci(f: FileScelto, conto: Conto): Promise<Voce[]> {
  if (/\.zip$/i.test(f.nome))
    return f.byte > MAX_BYTE_ZIP
      ? [{ percorso: f.nome, byte: f.byte, contenuto: null, motivo: 'troppo_grande' }]
      : fromZip(f.nome, await f.leggi(), conto);
  const percorso = normalizePath(f.nome);
  const motivo = exclusionReason(percorso, f.byte) ?? conta(conto, f.byte);
  // Un escluso (un `.env`, un video) non si legge nemmeno
  if (motivo) return [{ percorso, byte: f.byte, contenuto: null, motivo }];
  const dati = await f.leggi();
  return [{ percorso, byte: dati.byteLength, contenuto: strFromU8(dati), motivo: null }];
}

/** Carica file o ZIP in un'unità: quanti entrano e quanti sono esclusi. */
export async function uploadCode(
  db: RoutForgeDb,
  posto: { corsoId: string; unitaId: string },
  scelti: readonly FileScelto[],
  now: number,
) {
  const tutte: Voce[] = [];
  const conto: Conto = { ammessi: 0, byte: 0 };
  for (const f of scelti) tutte.push(...(await voci(f, conto)));
  const righe = collapseUpload(tutte, (percorso, file, byte) => ({
    percorso,
    byte,
    contenuto: null,
    motivo: 'cartella_tecnica',
    file,
  }));
  const caricamento = newId();
  const nomeCaricamento = scelti.length === 1 ? scelti[0]!.nome : '';
  await inTransaction(db, ['fileCodice'], async () => {
    // Lo stesso percorso caricato di nuovo nella stessa unità prende il posto del vecchio
    const percorsi = new Set(righe.map((v) => v.percorso));
    for (const vecchio of await listBy(db, 'fileCodice', 'unitaId', posto.unitaId))
      if (percorsi.has(vecchio.percorso)) await remove(db, 'fileCodice', vecchio.id, now);
    for (const v of righe)
      await save(db, 'fileCodice', { ...posto, sessioneId: null, caricamento, nomeCaricamento, ...v }, now);
  });
  return { file: righe.filter((v) => !v.motivo).length, esclusi: excludedCount(righe) };
}

/** Il codice di un'unità: albero, file ammessi, esclusi contati per file (una cartella tecnica vale i suoi file). */
export async function readCode(db: RoutForgeDb, unitaId: string) {
  const file = await listBy(db, 'fileCodice', 'unitaId', unitaId);
  return { righe: codeTree(file), file: file.filter((f) => !f.motivo).length, esclusi: excludedCount(file) };
}

/**
 * I caricamenti per lo spazio dei materiali (S22): nome, unità, numero di file e byte dei file ammessi.
 * ponytail: legge tutte le righe coi contenuti; con molti caricamenti grandi servirà un indice o i contenuti a parte.
 */
export async function codeUploads(db: RoutForgeDb) {
  const [file, unita] = await Promise.all([list(db, 'fileCodice'), list(db, 'unita')]);
  const numero = new Map(unita.map((u) => [u.id, u.numero]));
  const gruppi = new Map<string, FileCodice[]>();
  for (const f of file) {
    const g = gruppi.get(f.caricamento);
    if (g) g.push(f);
    else gruppi.set(f.caricamento, [f]);
  }
  return [...gruppi].map(([caricamento, xs]) => {
    const ammessi = xs.filter((f) => !f.motivo);
    const primo = xs[0]!;
    return {
      caricamento,
      nome: primo.nomeCaricamento,
      numeroUnita: primo.unitaId ? (numero.get(primo.unitaId) ?? null) : null,
      file: ammessi.length,
      byte: ammessi.reduce((n, f) => n + f.byte, 0),
    };
  });
}

/** Elimina un caricamento intero; restituisce le righe per «Annulla». */
export function deleteUpload(db: RoutForgeDb, caricamento: string, now: number) {
  return inTransaction(db, ['fileCodice'], async () => {
    const righe = (await list(db, 'fileCodice')).filter((f) => f.caricamento === caricamento);
    for (const f of righe) await remove(db, 'fileCodice', f.id, now);
    return righe;
  });
}

/** «Annulla»: le righe tornano, tranne un percorso caricato di nuovo nel frattempo nella stessa unità. */
export function restoreUpload(db: RoutForgeDb, righe: readonly FileCodice[], now: number): Promise<void> {
  return inTransaction(db, ['fileCodice'], async () => {
    const vivi = new Set((await list(db, 'fileCodice')).map((f) => `${f.unitaId}\n${f.percorso}`));
    for (const f of righe) if (!vivi.has(`${f.unitaId}\n${f.percorso}`)) await save(db, 'fileCodice', f, now);
  });
}
