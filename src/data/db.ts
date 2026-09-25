/**
 * Schema della persistenza locale: Dexie su IndexedDB (D-DATA-1). Fonti: MECC §1 (entità), §25 (identità e
 * cancellazioni); tabelle e indici di docs/02_ARCHITETTURA.md §3. Decisioni: D-DATA-1, D-DATA-2, D-TIME-2.
 *
 * Ogni record ha i campi comuni (INV-14). Un record eliminato resta come tombstone minima (solo identità e istanti):
 * senza gli altri campi non entra negli indici secondari, così gli indici vedono solo i record vivi.
 * Dove l'identità è logica l'id è deterministico e lo dà il chiamante (occorrenza = slot della ricorrenza, log fasi =
 * blocco, preferenze e registro notifiche = chiave): nessun indice univoco, un doppione è impossibile per costruzione.
 * Dexie salva anche i campi non indicizzati: un campo nuovo non richiede migrazioni, un indice nuovo sì (versione
 * successiva, sempre additiva).
 */
import Dexie, { type Table } from 'dexie';
import type {
  CorsoImportato,
  ModuloImportato,
  RisorsaImportata,
  SezioneImportata,
  UnitaImportata,
} from '../domain/course/parser';
import type { StatoCarta } from '../domain/sm2';
import type { Blocco, OraDiParete, Ricorrenza } from '../domain/types';

/** Campi comuni di un record vivo (D-DATA-1, INV-14). */
export interface CampiComuni {
  /** UUID v4, oppure deterministico dove l'identità è logica (D-DATA-2). */
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: null;
}

/** Record eliminato: registrato, non sparito, perché la cancellazione si propaghi (MECC §25). */
export interface Tombstone {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number;
}

type Riga<T> = T & CampiComuni;

/** Record vivi per tabella. Ciò che il dominio calcola (stato dei moduli, conteggi, unità corrente) non si salva. */
export interface Tabelle {
  /** `esempio`: il corso di esempio incluso (badge «Esempio» di S10, D-SAMPLE-1); booleano, quindi senza indice. */
  corsi: Riga<Pick<CorsoImportato, 'id' | 'titolo' | 'sottotitolo' | 'importatoIl'> & { esempio: boolean }>;
  moduli: Riga<Omit<ModuloImportato, 'unita' | 'stato'> & { corsoId: string }>;
  unita: Riga<Omit<UnitaImportata, 'sezioni'> & { corsoId: string; moduloId: string }>;
  sezioni: Riga<Omit<SezioneImportata, 'risorse'> & { corsoId: string; unitaId: string; ordine: number }>;
  risorse: Riga<RisorsaImportata & { corsoId: string; sezioneId: string; ordine: number }>;
  ricorrenze: Riga<Ricorrenza>;
  /**
   * Giorno locale e ora di parete li deriva il repository dagli istanti (`saveBlock`). Un'occorrenza di routine ha id
   * deterministico = slot della ricorrenza (ricorrenza + giorno locale + orario della ricorrenza, D-DATA-2, T-011):
   * resta lo stesso se l'utente la sposta (C4) e la generazione la ritrova con `get`, senza indici univoci.
   */
  blocchi: Riga<Blocco & OraDiParete & { giornoLocale: string }>;
  // Tabelle dei passi successivi: per ora solo i campi indicizzati; il task che le usa aggiunge il resto.
  sessioni: Riga<{ avvio: number; bloccoId: string | null }>;
  /** id = id del blocco dell'occorrenza (MECC §5: un log per occorrenza, ricompletare sovrascrive; D-DATA-2). */
  logFasi: Riga<{ ricorrenzaId: string | null }>;
  mazzi: Riga<{ unitaId: string }>;
  carte: Riga<StatoCarta & { mazzoId: string }>;
  pratiche: Riga<{ unitaId: string; tipo: string; creataIl: number }>;
  conversazioni: Riga<{ ambito: string; ultimoMessaggio: number }>;
  messaggi: Riga<{ conversazioneId: string }>;
  materiali: Riga<{ unitaId: string }>;
  materialiBinari: Riga<{ materialeId: string }>;
  fileCodice: Riga<{ unitaId: string | null; sessioneId: string | null }>;
  /** Una riga per impostazione, id = chiave (D-DATA-2). */
  preferenze: Riga<{ valore: unknown }>;
  /** Derivato, escluso da backup e sync (MECC §1): id = chiave logica della notifica (T-019). */
  registroNotifiche: Riga<{ idNativo: number }>;
}

/** Versione 1: chiave primaria `id`, poi gli indici (sintassi Dexie: `[a+b]` composto). */
export const SCHEMA_V1: { [K in keyof Tabelle]: string } = {
  corsi: 'id',
  moduli: 'id, corsoId',
  unita: 'id, corsoId, moduloId',
  sezioni: 'id, corsoId, unitaId',
  risorse: 'id, corsoId, sezioneId',
  ricorrenze: 'id, corsoId',
  // `ricorrenzaId` serve a modifica ed eliminazione della routine (MECC §7); l'idempotenza della generazione sta nell'id.
  blocchi: 'id, [giornoLocale+inizio], ricorrenzaId, stato, tipo, corsoId',
  sessioni: 'id, avvio, bloccoId',
  // `ricorrenzaId` per eliminare i log con la routine e aggregare le fasi (MECC §5, §7).
  logFasi: 'id, ricorrenzaId',
  mazzi: 'id, unitaId',
  carte: 'id, mazzoId, scadenza',
  pratiche: 'id, unitaId, tipo, creataIl',
  conversazioni: 'id, ambito, ultimoMessaggio',
  messaggi: 'id, conversazioneId',
  materiali: 'id, unitaId',
  materialiBinari: 'id, materialeId',
  fileCodice: 'id, unitaId, sessioneId',
  preferenze: 'id',
  registroNotifiche: 'id',
};

export type RoutForgeDb = Dexie & { [K in keyof Tabelle]: Table<Tabelle[K] | Tombstone, string> };

/** Apre (o crea) il database locale. Le versioni successive si aggiungono qui, senza toccare la 1. */
export function openDb(nome = 'routforge'): RoutForgeDb {
  const db = new Dexie(nome) as RoutForgeDb;
  db.version(1).stores(SCHEMA_V1);
  return db;
}
