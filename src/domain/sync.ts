/**
 * La sincronizzazione fra dispositivi, la parte pura (MECCANISMI §1, §25; T-033): che cosa viaggia, la busta di un
 * record, il vincitore fra la riga locale e la remota («ultimo vince» per record), la stessa regola dal lato del servizio
 * (specchio dell'SQL), le occorrenze generate che non sovrascrivono, il campo che resta su questo dispositivo. Gli
 * scenari J1, J2, J4, J5 si verificano nel servizio. Decisioni: D-SYNC-1, D-SYNC-2, D-SYNC-3, D-SYNC-4.
 */
import type { StatoBlocco } from './types';

/** Le tabelle che viaggiano (§25): i corsi si reimportano; sessioni, pratica, materiali e chat restano qui. */
export const TABELLE_SINCRONIZZATE = ['ricorrenze', 'blocchi', 'logFasi', 'preferenze'] as const;
export type TabellaSincronizzata = (typeof TABELLE_SINCRONIZZATE)[number];

/**
 * Le righe di `preferenze` che viaggiano: un elenco chiuso, così una chiave nuova resta sul dispositivo finché non la si
 * aggiunge (il default sicuro per una credenziale: la chiave AI mai, D-SYNC-3).
 */
export const PREFERENZE_SINCRONIZZATE: readonly string[] = ['impostazioni', 'notifiche', 'profilo'];

/**
 * La riga di `preferenze` con lo stato della sync di questo dispositivo (account, cursore, ultima riuscita): mai in sync
 * né nel backup; dopo l'import di un backup manca, e la sync rifà la fusione (T-033).
 */
export const CHIAVE_STATO_SYNC = 'sync';

/** D-SYNC-2: un `updatedAt` oltre 5 minuti dopo l'ora del servizio si ferma lì (un orologio avanti non vince per sempre). */
export const ANTICIPO_MASSIMO_MS = 5 * 60_000;

export function isSynced(tabella: string, id: string): boolean {
  return (
    (TABELLE_SINCRONIZZATE as readonly string[]).includes(tabella) &&
    (tabella !== 'preferenze' || PREFERENZE_SINCRONIZZATE.includes(id))
  );
}

/**
 * Un'occorrenza generata (D-OCC-1): di una ricorrenza e mai toccata dall'utente, programmata o segnata persa dal ciclo.
 * Ogni dispositivo la genera da sé: viaggia solo nella fusione, e lì non sovrascrive. Accetta ogni riga dei blocchi,
 * tombstone comprese (la fusione le porta tutte).
 */
export function isGenerata(riga: object): boolean {
  const b = riga as { ricorrenzaId?: string | null; stato?: StatoBlocco };
  return !!b.ricorrenzaId && (b.stato === 'programmato' || b.stato === 'perso');
}

/** La busta di un record (§25): la riga intera, la tombstone minima se eliminata, e i suoi istanti. */
export interface Busta {
  tabella: TabellaSincronizzata;
  id: string;
  dati: Record<string, unknown>;
  updatedAt: number;
  deletedAt: number | null;
  generata: boolean;
}

/** Una busta ricevuta: il servizio aggiunge il dispositivo che l'ha spedita e il numero d'ordine (il cursore). */
export interface BustaRicevuta extends Busta {
  dispositivo: string;
  seq: number;
}

type RigaSync = { id: string; updatedAt: number; deletedAt: number | null };

/** Una voce della coda: l'istante del gesto dell'utente e se la riga è un'occorrenza generata (fusione). */
export interface VoceCoda {
  updatedAt: number;
  generata: boolean;
}

/**
 * La busta da spedire: la riga letta adesso, con l'istante del gesto della voce (D-SYNC-4 n. 4: una scrittura del ciclo
 * venuta dopo non la fa sembrare più recente).
 */
export function toEnvelope(tabella: TabellaSincronizzata, riga: RigaSync, voce: VoceCoda): Busta {
  return {
    tabella,
    id: riga.id,
    dati: stripLocalFields(tabella, riga),
    updatedAt: voce.updatedAt,
    deletedAt: riga.deletedAt,
    generata: voce.generata,
  };
}

/**
 * Una busta ricevuta si applica solo se è dell'ambito della sync, se i dati sono la riga del suo id (con la stessa
 * eliminazione) e se ha un istante: un servizio compromesso non scrive altrove, né la chiave AI né la coda (T-033).
 */
export function validEnvelope(b: {
  tabella: string;
  id: string;
  dati: unknown;
  deletedAt: number | null;
  updatedAt: number;
}): boolean {
  const dati = typeof b.dati === 'object' && b.dati !== null ? (b.dati as { id?: unknown; deletedAt?: unknown }) : null;
  return (
    isSynced(b.tabella, b.id) &&
    dati !== null &&
    dati.id === b.id &&
    (dati.deletedAt ?? null) === b.deletedAt &&
    Number.isFinite(b.updatedAt)
  );
}

/**
 * Il campo che resta su questo dispositivo: l'interruttore generale delle notifiche (S22: «spegne tutte le notifiche su
 * questo dispositivo»; vince il design su §25, che sincronizza le notifiche).
 */
const RESTA_QUI = { id: 'notifiche', campo: 'generale' } as const;

const valoreDi = (riga: object): Record<string, unknown> | null => {
  const v = (riga as { valore?: unknown }).valore;
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
};

/** La riga da spedire senza i campi di questo dispositivo. */
export function stripLocalFields<T extends RigaSync>(tabella: string, riga: T): T {
  const valore = valoreDi(riga);
  if (tabella !== 'preferenze' || riga.id !== RESTA_QUI.id || !valore) return riga;
  const { [RESTA_QUI.campo]: _qui, ...resto } = valore;
  return { ...riga, valore: resto };
}

/**
 * La riga ricevuta con i campi di questo dispositivo rimessi dalla riga locale; senza riga locale l'interruttore è acceso
 * (il default di §13.1): una riga senza il campo non si leggerebbe e varrebbero i default.
 */
export function mergeLocalFields<T extends RigaSync>(tabella: string, remota: T, locale: RigaSync | undefined): T {
  const valore = valoreDi(remota);
  if (tabella !== 'preferenze' || remota.id !== RESTA_QUI.id || !valore) return remota;
  const qui = locale ? valoreDi(locale) : null;
  const campo = qui && RESTA_QUI.campo in qui ? qui[RESTA_QUI.campo] : true;
  return { ...remota, valore: { ...valore, [RESTA_QUI.campo]: campo } };
}

/**
 * Il vincitore al momento della ricezione (D-SYNC-1, D-SYNC-2, D-SYNC-4): senza riga locale vince la remota; una generata
 * non sovrascrive mai; senza una modifica dell'utente in coda, o con una voce `generata` della fusione (che cede come sul
 * servizio), il servizio è più avanti di noi; altrimenti conta l'istante del gesto della voce contro quello della remota
 * e, a parità, l'id di dispositivo maggiore (gli id dei record coincidono per definizione).
 */
export function decide(
  locale: object | undefined,
  voce: VoceCoda | undefined,
  remota: { updatedAt: number; generata: boolean; dispositivo: string },
  mioDispositivo: string,
): 'remota' | 'locale' {
  if (!locale) return 'remota';
  if (remota.generata) return 'locale';
  if (!voce || voce.generata) return 'remota';
  if (remota.updatedAt !== voce.updatedAt) return remota.updatedAt > voce.updatedAt ? 'remota' : 'locale';
  return remota.dispositivo > mioDispositivo ? 'remota' : 'locale';
}

/**
 * La stessa regola dal lato del servizio (specchio di `push_records` nell'SQL): una riga memorizzata `generata` cede a
 * tutto; una `generata` in arrivo non sovrascrive; altrimenti la più recente e, a parità, il dispositivo maggiore.
 */
export function serverAccepts(
  memorizzata: { updatedAt: number; generata: boolean; dispositivo: string } | undefined,
  arrivata: { updatedAt: number; generata: boolean; dispositivo: string },
): boolean {
  if (!memorizzata || memorizzata.generata) return true;
  if (arrivata.generata) return false;
  return (
    arrivata.updatedAt > memorizzata.updatedAt ||
    (arrivata.updatedAt === memorizzata.updatedAt && arrivata.dispositivo > memorizzata.dispositivo)
  );
}

/** D-SYNC-2: l'istante salvato dal servizio non supera di più di 5 minuti la sua ora. */
export const clampUpdatedAt = (updatedAt: number, oraServizio: number): number =>
  Math.min(updatedAt, oraServizio + ANTICIPO_MASSIMO_MS);
