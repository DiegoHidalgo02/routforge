/**
 * La sincronizzazione fra dispositivi, la parte pura (MECCANISMI §1, §25; T-033, T-034): che cosa viaggia, la busta di
 * un record, il vincitore fra la riga locale e la remota («ultimo vince» per record), la stessa regola dal lato del
 * servizio (specchio dell'SQL), le occorrenze generate che non sovrascrivono, il campo che resta su questo dispositivo,
 * l'impronta del corso e il collegamento delle routine di studio ai corsi di qui. Gli scenari J1–J5 si verificano nel
 * servizio. Decisioni: D-SYNC-1, D-SYNC-2, D-SYNC-3, D-SYNC-4, D-SYNC-5.
 */
import { nativeId } from './notifications/desiredSet';
import type { Blocco, Ricorrenza, StatoBlocco } from './types';

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

/**
 * La riga di `preferenze` coi blocchi arrivati `in_corso` da un altro dispositivo (id → istante della ricezione): resta
 * qui (non è fra le preferenze che viaggiano) e il ciclo non li tratta da orfani per 12 ore (audit P3-4, D-SYNC-7).
 */
export const CHIAVE_IN_CORSO_ALTROVE = 'inCorsoAltrove';

/** La riga letta, con le sole voci valide (id → istante). */
export function receivedInProgress(valore: unknown): Record<string, number> {
  if (typeof valore !== 'object' || valore === null) return {};
  return Object.fromEntries(Object.entries(valore).filter(([, v]) => Number.isFinite(v))) as Record<string, number>;
}

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

type Campi = Record<string, unknown>;
const oggetto = (v: unknown): v is Campi => typeof v === 'object' && v !== null && !Array.isArray(v);
const testo = (v: unknown) => v === undefined || typeof v === 'string';
const testoONull = (v: unknown) => v === null || testo(v);
const istante = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
/** Un elenco facoltativo di oggetti che rispettano `voce`. */
const elenco = (v: unknown, voce: (x: Campi) => boolean) =>
  v === undefined || (Array.isArray(v) && v.every((x) => oggetto(x) && voce(x)));
const promemoria = (v: unknown) =>
  v === undefined || (oggetto(v) && (v.modo !== 'personalizzato' || Array.isArray(v.anticipi)));
const conEtichetta = (f: Campi) => typeof f.etichetta === 'string';
const TIPI: ReadonlySet<unknown> = new Set(['todo', 'evento', 'routine', 'studio']);
const STATI: ReadonlySet<unknown> = new Set([
  'programmato',
  'in_corso',
  'completato',
  'parziale',
  'indietro',
  'saltato',
  'perso',
]);

/**
 * La forma dei campi che le schermate mostrano o scorrono, per tabella (T-059, security review del 07/10): una riga viva
 * ricevuta che non la rispetta si scarta, invece di far cadere il disegno di Oggi o del Dettaglio.
 */
const FORMA: Record<TabellaSincronizzata, (d: Campi) => boolean> = {
  blocchi: (d) =>
    TIPI.has(d.tipo) &&
    STATI.has(d.stato) &&
    istante(d.inizio) &&
    (d.fine === null || istante(d.fine)) &&
    typeof d.conOrario === 'boolean' &&
    typeof d.giornoLocale === 'string' &&
    typeof d.orarioInizio === 'string' &&
    testoONull(d.orarioFine) &&
    testo(d.titolo) &&
    testo(d.note) &&
    testo(d.luogo) &&
    testoONull(d.notaEsito) &&
    elenco(d.checklist, (v) => typeof v.testo === 'string' && typeof v.fatta === 'boolean') &&
    elenco(d.fasi, conEtichetta) &&
    promemoria(d.promemoria),
  ricorrenze: (d) =>
    (d.tipo === 'routine' || d.tipo === 'studio') &&
    typeof d.titolo === 'string' &&
    testo(d.note) &&
    Array.isArray(d.giorni) &&
    d.giorni.every(istante) &&
    typeof d.dataInizio === 'string' &&
    testoONull(d.dataFine) &&
    Array.isArray(d.dateSaltate) &&
    d.dateSaltate.every((g) => typeof g === 'string') &&
    typeof d.orarioInizio === 'string' &&
    testoONull(d.orarioFine) &&
    testoONull(d.corsoId) &&
    testoONull(d.impronta) &&
    elenco(d.fasi, conEtichetta) &&
    promemoria(d.promemoria),
  logFasi: (d) => Array.isArray(d.fasi) && elenco(d.fasi, conEtichetta),
  preferenze: (d) => oggetto(d.valore),
};

/**
 * La forma dei campi mostrati di una riga viva (`FORMA`) per le righe dell'ambito della sync; le altre (preferenze che
 * restano qui, tabelle che non viaggiano) non la hanno. La usa anche l'import del backup (audit P1-3).
 */
export const hasShape = (tabella: string, dati: Campi): boolean =>
  !isSynced(tabella, String(dati.id)) || FORMA[tabella as TabellaSincronizzata](dati);

/**
 * Una busta ricevuta si applica solo se è dell'ambito della sync, se i dati sono la riga del suo id (con la stessa
 * eliminazione), se ha un istante e, viva, se i campi mostrati hanno la loro forma: un servizio compromesso non scrive
 * altrove, né la chiave AI né la coda (T-033), e non lascia l'app a schermo vuoto (T-059).
 */
export function validEnvelope(b: {
  tabella: string;
  id: string;
  dati: unknown;
  deletedAt: number | null;
  updatedAt: number;
}): boolean {
  const dati = oggetto(b.dati) ? b.dati : null;
  return (
    isSynced(b.tabella, b.id) &&
    dati !== null &&
    dati.id === b.id &&
    (dati.deletedAt ?? null) === b.deletedAt &&
    Number.isFinite(b.updatedAt) &&
    (b.deletedAt !== null || FORMA[b.tabella as TabellaSincronizzata](dati))
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

/**
 * Il tetto di una riga sul servizio (audit P1-11): il `check` di `records` in `supabase/schema.sql` rifiuta l'intero
 * lotto se una riga supera 1 MiB del suo testo `jsonb`, e `jsonb` rifiuta il carattere nullo e i surrogati UTF-16 soli:
 * ogni giro rispedirebbe lo stesso lotto e la coda si fermerebbe lì.
 */
export const MAX_BYTE_RIGA = 1024 * 1024;
/** Un escape `\u0000` o di un surrogato solo vero, cioè non preceduto da un backslash a sua volta scritto come `\\`. */
const ESCAPE_RIFIUTATO = /(?:^|[^\\])(?:\\\\)*\\u(?:0000|d[89a-f][0-9a-f]{2})/;

/**
 * `false` per una riga che il servizio rifiuterebbe sempre. I byte si misurano sul JSON indentato di uno spazio, mai
 * più corto del testo `jsonb` (uno spazio dopo ogni `:` e `,`), salvo i numeri con esponente che i dati dell'app non hanno.
 */
export function sendable(dati: unknown): boolean {
  const testo = JSON.stringify(dati, null, 1);
  if (ESCAPE_RIFIUTATO.test(testo)) return false;
  let byte = 0;
  for (const c of testo) {
    const punto = c.codePointAt(0) ?? 0;
    byte += punto < 0x80 ? 1 : punto < 0x800 ? 2 : punto < 0x10000 ? 3 : 4;
    if (byte > MAX_BYTE_RIGA) return false;
  }
  return true;
}

/** D-SYNC-2: l'istante salvato dal servizio non supera di più di 5 minuti la sua ora. */
export const clampUpdatedAt = (updatedAt: number, oraServizio: number): number =>
  Math.min(updatedAt, oraServizio + ANTICIPO_MASSIMO_MS);

/**
 * L'impronta del corso (§25 «Corsi e routine di studio»: titolo + contenuto, D-SYNC-5): il titolo e il testo dei file
 * dei moduli in ordine di numero. Lo stesso ZIP dà la stessa impronta su ogni dispositivo, mentre l'id del corso è nuovo
 * a ogni import (MECC §16); il contenuto di un corso importato non cambia. Lo stesso FNV-1a degli id nativi (§13.3), con
 * la lunghezza del testo: basta a distinguere i corsi di un utente.
 */
export function courseFingerprint(titolo: string, moduli: readonly { numero: number; markdown: string }[]): string {
  const testo = [titolo, ...[...moduli].sort((a, b) => a.numero - b.numero).map((m) => m.markdown)].join('\u0000');
  return `${(nativeId(testo) >>> 0).toString(16)}-${testo.length.toString(16)}`;
}

/** Le impronte dei corsi di qui servono solo se una routine di studio ha il corso altrove e porta la sua (§25). */
export const needsFingerprints = (
  ricorrenze: readonly Pick<Ricorrenza, 'corsoId' | 'impronta'>[],
  qui: ReadonlySet<string>,
): boolean => ricorrenze.some((r) => !!r.corsoId && !!r.impronta && !qui.has(r.corsoId));

/**
 * Il collegamento delle routine di studio ai corsi di questo dispositivo (§25, J3; D-SYNC-5): una ricorrenza col corso
 * di un altro dispositivo (qui non c'è) passa al corso di qui con la stessa impronta, il primo importato se sono più
 * d'uno. Un blocco programmato futuro col corso altrove (generato qui prima del collegamento, o toccato sull'altro
 * dispositivo e ricevuto) passa al corso di qui della sua ricorrenza, o a quello con l'impronta del suo corso, senza
 * unità: il puntatore assegna le future. Se un corso di qui non c'è resta senza unità, perché quella dell'altro
 * dispositivo qui non esiste (setup libero). Passato e storia restano come sono. `qui` sono i corsi di questo
 * dispositivo; `impronte` le loro, in ordine d'import (vuote se non servono, `needsFingerprints`).
 */
export function relinkPlan<
  R extends Pick<Ricorrenza, 'id' | 'corsoId' | 'impronta'>,
  B extends Pick<Blocco, 'stato' | 'inizio' | 'corsoId' | 'unitaId' | 'ricorrenzaId'>,
>(
  ricorrenze: readonly R[],
  qui: ReadonlySet<string>,
  impronte: readonly { id: string; impronta: string }[],
  blocchi: readonly B[],
  now: number,
): { ricorrenze: R[]; blocchi: B[] } {
  const altrove = (corsoId: string | null | undefined): corsoId is string => !!corsoId && !qui.has(corsoId);
  const verso = new Map<string, string>();
  for (const r of ricorrenze) {
    const c = altrove(r.corsoId) && r.impronta ? impronte.find((x) => x.impronta === r.impronta) : undefined;
    if (c) verso.set(r.corsoId!, c.id);
  }
  // Il corso di qui di ogni ricorrenza, dopo il collegamento
  const diQui = (corsoId: string | null | undefined) =>
    altrove(corsoId) ? verso.get(corsoId) : (corsoId ?? undefined);
  const corsoRicorrenza = new Map(ricorrenze.map((r) => [r.id, diQui(r.corsoId)]));
  return {
    ricorrenze: ricorrenze.flatMap((r) => {
      const corsoId = altrove(r.corsoId) ? verso.get(r.corsoId) : undefined;
      return corsoId ? [{ ...r, corsoId }] : [];
    }),
    blocchi: blocchi.flatMap((b) => {
      if (b.stato !== 'programmato' || b.inizio <= now || !altrove(b.corsoId)) return [];
      const corsoId =
        (b.ricorrenzaId ? corsoRicorrenza.get(b.ricorrenzaId) : undefined) ?? verso.get(b.corsoId) ?? b.corsoId;
      return corsoId !== b.corsoId || b.unitaId ? [{ ...b, corsoId, unitaId: null }] : [];
    }),
  };
}
