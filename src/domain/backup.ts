/**
 * Formato del file di backup. Fonti: MECCANISMI §22 («Export: tutto tranne il registro notifiche; PDF codificati nel
 * file»; «Backup senza PDF importabili»), FUNZIONALITA §20; T-030. Il file è un JSON con le righe delle tabelle così come
 * sono, tombstone comprese (servono alla sync), e i binari dei PDF in base64. Quali tabelle e righe entrano lo decide il
 * servizio (`app/backup.ts`); qui la forma, la codifica e la validazione del file scelto dall'utente, che è un dato non
 * fidato: un formato sconosciuto o una riga senza identità fermano l'import prima che tocchi i dati.
 */

export const FORMATO_BACKUP = 'routforge-backup';
export const VERSIONE_BACKUP = 1;
/** L'unica tabella con un binario: il campo `dati` (Uint8Array) dei PDF. */
export const TABELLA_BINARI = 'materialiBinari';

export type RigaBackup = {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
} & Record<string, unknown>;

export type EsitoLettura =
  { creatoIl: number; tabelle: Record<string, RigaBackup[]> } | { errore: 'illeggibile' | 'versione' };

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const VALORE = new Int16Array(128).fill(-1);
const CODICI = new Uint8Array(64);
for (let i = 0; i < ALFABETO.length; i++) {
  VALORE[ALFABETO.charCodeAt(i)] = i;
  CODICI[i] = ALFABETO.charCodeAt(i);
}
const UGUALE = 61;

/**
 * base64 standard (RFC 4648) senza API del browser, che il dominio non ha (D-TS-1). I caratteri si scrivono in un
 * buffer e diventano testo a pezzi da 32 K: una stringa ogni 3 byte occuperebbe otto volte il PDF (security review).
 */
export function toBase64(dati: Uint8Array): string {
  const out = new Uint8Array(Math.ceil(dati.length / 3) * 4);
  for (let i = 0, j = 0; i < dati.length; i += 3, j += 4) {
    const b = dati[i + 1];
    const c = dati[i + 2];
    const n = (dati[i]! << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out[j] = CODICI[n >> 18]!;
    out[j + 1] = CODICI[(n >> 12) & 63]!;
    out[j + 2] = b === undefined ? UGUALE : CODICI[(n >> 6) & 63]!;
    out[j + 3] = c === undefined ? UGUALE : CODICI[n & 63]!;
  }
  const pezzi: string[] = [];
  for (let i = 0; i < out.length; i += 0x8000) pezzi.push(String.fromCharCode(...out.subarray(i, i + 0x8000)));
  return pezzi.join('');
}

/** Il binario di un testo base64; lancia su un carattere o una lunghezza che il base64 non ha. */
export function fromBase64(testo: string): Uint8Array {
  const pulito = testo.replace(/={1,2}$/, '');
  if (pulito.length % 4 === 1) throw new Error('base64');
  const out = new Uint8Array(Math.floor((pulito.length * 3) / 4));
  const v = (i: number) => {
    if (i >= pulito.length) return 0;
    const x = VALORE[pulito.charCodeAt(i)] ?? -1;
    if (x < 0) throw new Error('base64');
    return x;
  };
  for (let i = 0, j = 0; i < pulito.length; i += 4) {
    const n = (v(i) << 18) | (v(i + 1) << 12) | (v(i + 2) << 6) | v(i + 3);
    out[j++] = n >> 16;
    if (j < out.length) out[j++] = (n >> 8) & 255;
    if (j < out.length) out[j++] = n & 255;
  }
  return out;
}

/** Il file da salvare: le tabelle date, coi binari dei PDF in base64. */
export function backupFile(tabelle: Record<string, readonly object[]>, now: number) {
  return {
    formato: FORMATO_BACKUP,
    versione: VERSIONE_BACKUP,
    creatoIl: now,
    tabelle: Object.fromEntries(
      Object.entries(tabelle).map(([nome, righe]) => [
        nome,
        nome === TABELLA_BINARI
          ? righe.map((r) => ('dati' in r && r.dati instanceof Uint8Array ? { ...r, dati: toBase64(r.dati) } : r))
          : righe,
      ]),
    ),
  };
}

const oggetto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const rigaValida = (r: unknown): r is RigaBackup =>
  oggetto(r) &&
  typeof r.id === 'string' &&
  typeof r.createdAt === 'number' &&
  typeof r.updatedAt === 'number' &&
  (r.deletedAt === null || typeof r.deletedAt === 'number');

/**
 * Gli indirizzi dei link di un file importato: solo http(s), come quelli che scrivono l'app e il parser. Un `data:` o un
 * `file:` costruito ad arte aprirebbe una pagina dentro l'app o la farebbe chiudere (security review del 07/10).
 */
const urlSicuro = (u: unknown): boolean =>
  u === undefined || u === null || (typeof u === 'string' && /^https?:\/\//i.test(u));
const indirizziSicuri = (nome: string, r: RigaBackup): boolean =>
  nome === 'materiali' || nome === 'risorse'
    ? urlSicuro((r as { url?: unknown }).url)
    : nome === 'moduli'
      ? urlSicuro((r as { progetto?: { risorsa?: { url?: unknown } } | null }).progetto?.risorsa?.url)
      : true;

/**
 * Le righe delle tabelle `nomi` dal testo di un file di backup; una tabella assente è vuota (un backup senza PDF si
 * importa), una che questa versione non conosce si ignora. `versione`: il file viene da una versione più nuova.
 */
export function parseBackup(testo: string, nomi: readonly string[]): EsitoLettura {
  let f: unknown;
  try {
    f = JSON.parse(testo);
  } catch {
    return { errore: 'illeggibile' };
  }
  if (
    !oggetto(f) ||
    f.formato !== FORMATO_BACKUP ||
    typeof f.versione !== 'number' ||
    typeof f.creatoIl !== 'number' ||
    !oggetto(f.tabelle)
  )
    return { errore: 'illeggibile' };
  if (f.versione > VERSIONE_BACKUP) return { errore: 'versione' };
  const sorgente = f.tabelle;
  try {
    const tabelle: Record<string, RigaBackup[]> = {};
    for (const nome of nomi) {
      const righe = Object.hasOwn(sorgente, nome) ? sorgente[nome] : [];
      if (!Array.isArray(righe) || !righe.every(rigaValida) || !righe.every((r) => indirizziSicuri(nome, r)))
        return { errore: 'illeggibile' };
      // Una tombstone resta minima, coi soli campi comuni (INV-14: fuori dagli indici secondari)
      tabelle[nome] = righe.map((r): RigaBackup =>
        r.deletedAt !== null
          ? { id: r.id, createdAt: r.createdAt, updatedAt: r.updatedAt, deletedAt: r.deletedAt }
          : nome === TABELLA_BINARI && typeof r.dati === 'string'
            ? { ...r, dati: fromBase64(r.dati) }
            : r,
      );
    }
    return { creatoIl: f.creatoIl, tabelle };
  } catch {
    return { errore: 'illeggibile' };
  }
}
