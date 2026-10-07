/**
 * Setup della sessione di studio (MECC §10.1; `SessionService` di docs/02_ARCHITETTURA.md §4): una sola sessione attiva,
 * memorizzata in `preferenze.sessioneAttiva` (MECC §1) e scritta nella stessa transazione dello stato del blocco, perché
 * il ciclo tratta da orfano ogni `in_corso` che la sessione attiva non punta (§8, D-SCHED-1). Le regole (contesto,
 * anticipo, ritardo, materia) stanno in `domain/session.ts`; qui si leggono e si scrivono le righe. «Anticipa» qui e
 * all'avvio T-019 riconcilierà le notifiche (ri-armo e verifica cancellata, §10.1). Il timer (§10.2–§10.5, T-017) salva
 * i suoi istanti nella stessa riga e chiude la sessione in `sessioni`; nulla la chiude da solo, nemmeno dopo un crash
 * (D4, D-TIMER-1): i battiti di `startHeartbeat` (§10.4, D-TIMER-2) rendono non verificato il tempo senza continuità.
 * Criteri: SCENARI C4, C5, C9 (setup), D4, D5 (uscita registrata), D6, D7 (abbandono oltre soglia).
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, list, remove, save, saveBlock, watch } from '../data/repository';
import { retroactiveBlock, sessionMinutes, type DatiEsito } from '../domain/outcome';
import { modulePath, sortedUnits } from '../domain/pointer';
import {
  anticipatedBlock,
  courseDefaultUnit,
  startPlan,
  TIMER_VUOTO,
  type SceltaSessione,
  type SessioneAttiva,
} from '../domain/session';
import { MINUTE } from '../domain/time';
import { abandonPlan, beat, closeSession, currentStudyUnit, type SessioneChiusa } from '../domain/timer';
import type { StatoUnita } from '../domain/types';
import type { BloccoCalendario } from './calendar';
import { TABELLE_ESITO, writeOutcome } from './outcome';
import { logError } from './diagnostics';
import type { Clock } from './ports/clock';
import type { SessioneInPrimoPiano } from './ports/device';

/**
 * Riga di `preferenze` della sessione attiva (MECC §1; docs/02_ARCHITETTURA.md §4). Il ciclo ne legge `bloccoId` con
 * `readActiveSession`, la stessa lettura del setup: il blocco che la sessione punta non è orfano (§8, D-SCHED-1).
 */
export const CHIAVE_SESSIONE_ATTIVA = 'sessioneAttiva';

/** La sessione attiva, se c'è. */
export async function readActiveSession(db: RoutForgeDb): Promise<SessioneAttiva | null> {
  const valore = (await get(db, 'preferenze', CHIAVE_SESSIONE_ATTIVA))?.valore;
  // La riga la scrive solo questo servizio; una riga illeggibile (dato rotto) vale come nessuna sessione. Una sessione
  // avviata prima del timer (T-016) o dei battiti (T-047) non ha i loro campi: partono vuoti, l'ultimo battito è l'avvio
  if (typeof valore !== 'object' || valore === null || !('avvio' in valore) || typeof valore.avvio !== 'number')
    return null;
  const v = valore as Omit<SessioneAttiva, 'ultimoBattito'> & { ultimoBattito?: number };
  return { ...TIMER_VUOTO, ...v, ultimoBattito: v.ultimoBattito ?? v.avvio };
}

/**
 * Battiti di continuità (§10.4, D-TIMER-2): l'istante corrente nella sessione attiva subito, a ogni minuto e al ritorno
 * in primo piano, finché l'app è in primo piano (in secondo piano nessun battito: sul web una scheda nascosta); più di
 * 30' dall'ultimo battito restano registrati come intervallo non verificato (`beat`). Fuori dalla transazione del ciclo
 * (INV-15); senza sessione non scrive; un errore resta qui (INV-16). Su Android il servizio in primo piano di T-021
 * terrà vivi i battiti anche con l'app chiusa. Restituisce lo stop.
 */
export function startHeartbeat(db: RoutForgeDb, clock: Clock): () => void {
  const batti = () => {
    if (!clock.inForeground()) return;
    const now = clock.now();
    void editActiveSession(db, (s) => beat(s, now), now).catch(() => null);
  };
  batti();
  const stop = [clock.every(MINUTE, batti), clock.onForeground(batti)];
  return () => stop.forEach((smetti) => smetti());
}

/**
 * Il servizio in primo piano segue la sessione attiva (§10.4, D-TIMER-2; T-021): parte con lei, col titolo dell'unità o
 * del blocco e il cronometro dall'avvio, e si ferma quando la sessione si chiude. Un adapter che fallisce non ferma la
 * sessione (INV-16). Restituisce lo stop.
 */
export function followSessionInForeground(db: RoutForgeDb, porta: SessioneInPrimoPiano): () => void {
  // Avvio e titolo: al cambio d'unità la notifica fissa prende il titolo nuovo
  let corrente: string | null = null;
  return watch(
    () => readSessionView(db),
    (v) => {
      const chiave = v ? `${v.sessione.avvio}|${v.unita?.titolo ?? ''}` : null;
      if (chiave === corrente) return;
      corrente = chiave;
      try {
        if (v) porta.avvia({ titolo: v.unita?.titolo ?? '', avvio: v.sessione.avvio });
        else porta.ferma();
      } catch (e) {
        logError('dispositivo', e);
      }
    },
  );
}

/** Ciò che mostrano il timer e il banner «Sessione in corso» (S15, S1). */
export interface VistaSessione {
  sessione: SessioneAttiva;
  /** L'unità su cui va il tempo adesso, cambi d'unità compresi (§10.3); il codice prodotto va nei suoi «Tuoi» (S15). */
  unita: { id: string; corsoId: string; titolo: string; numero: string; moduloNumero: number } | null;
  /** Orario d'inizio del blocco, per «routine 16:00». */
  orario: string | null;
}

export async function readSessionView(db: RoutForgeDb): Promise<VistaSessione | null> {
  const s = await readActiveSession(db);
  if (!s) return null;
  const unitaId = currentStudyUnit(s);
  const u = unitaId ? await get(db, 'unita', unitaId) : undefined;
  const b = s.bloccoId ? await get(db, 'blocchi', s.bloccoId) : undefined;
  return {
    sessione: s,
    unita: u
      ? { id: u.id, corsoId: u.corsoId, titolo: u.titolo, numero: u.numero, moduloNumero: u.moduloNumero }
      : null,
    orario: b?.orarioInizio ?? null,
  };
}

export interface UnitaSetup {
  id: string;
  moduloNumero: number;
  numero: string;
  titolo: string;
  stato: StatoUnita;
}
export interface CorsoSetup {
  id: string;
  titolo: string;
  /** Unità in ordine di percorso. */
  unita: UnitaSetup[];
  /** L'unità che il corso propone se lo si sceglie (§10.1). */
  proposta: string | null;
}
export interface IngressiSetup {
  /** Con una sessione attiva il setup porta al timer (D6). */
  attiva: SessioneAttiva | null;
  blocco: BloccoCalendario | null;
  /** Corsi in ordine d'import, per la scelta della materia. */
  corsi: CorsoSetup[];
}

/**
 * Gli ingressi del setup: sessione attiva, blocco d'origine (se c'è) e corsi con le loro unità. Un'unità che qui non c'è
 * (una routine ricevuta col corso di un altro dispositivo, non ancora importato: MECC §25, J3) vale come nessuna: il
 * setup è libero.
 */
export async function setupInputs(db: RoutForgeDb, bloccoId: string | null): Promise<IngressiSetup> {
  const [corsi, moduli, unita] = await Promise.all([list(db, 'corsi'), list(db, 'moduli'), list(db, 'unita')]);
  const b = bloccoId ? await get(db, 'blocchi', bloccoId) : undefined;
  return {
    attiva: await readActiveSession(db),
    blocco: b ? (b.unitaId && !unita.some((u) => u.id === b.unitaId) ? { ...b, unitaId: null } : b) : null,
    corsi: corsi
      .sort((a, b) => a.importatoIl - b.importatoIl)
      .map((c) => {
        const sue = sortedUnits(unita.filter((u) => u.corsoId === c.id));
        const percorso = moduli.filter((m) => m.corsoId === c.id).map(modulePath);
        return {
          id: c.id,
          titolo: c.titolo,
          unita: sue.map(({ id, moduloNumero, numero, titolo, stato }) => ({
            id,
            moduloNumero,
            numero,
            titolo,
            stato,
          })),
          proposta: courseDefaultUnit(sue, percorso),
        };
      }),
  };
}

/**
 * Avvia la sessione adesso: il contesto lo decide l'orologio (§10.1). Con una sessione già attiva non avvia nulla e
 * restituisce quella (D6). Blocco e sessione attiva si scrivono nella stessa transazione (D-SCHED-1).
 */
export function startSession(
  db: RoutForgeDb,
  bloccoId: string | null,
  scelta: SceltaSessione,
  now: number,
  fuso: string,
): Promise<SessioneAttiva> {
  return inTransaction(db, ['blocchi', 'preferenze'], async () => {
    const gia = await readActiveSession(db);
    if (gia) return gia;
    const b = bloccoId ? ((await get(db, 'blocchi', bloccoId)) ?? null) : null;
    const piano = startPlan(b, scelta, now);
    if (piano.blocco) await saveBlock(db, piano.blocco, now, fuso);
    await save(db, 'preferenze', { id: CHIAVE_SESSIONE_ATTIVA, valore: piano.sessione }, now);
    return piano.sessione;
  });
}

/**
 * «Anticipa sessione» (§10.1, C4): sposta il blocco ad adesso; `false` senza scrivere se non è più in anticipo o se c'è
 * già una sessione attiva, che il setup riprende (D6).
 */
export function anticipateSession(db: RoutForgeDb, bloccoId: string, now: number, fuso: string): Promise<boolean> {
  return inTransaction(db, ['blocchi', 'preferenze'], async () => {
    if (await readActiveSession(db)) return false;
    const b = await get(db, 'blocchi', bloccoId);
    const spostato = b ? anticipatedBlock(b, now) : null;
    if (spostato) await saveBlock(db, spostato, now, fuso);
    return spostato !== null;
  });
}

/**
 * Modifica la sessione attiva con una funzione del timer (`pauseSession`, `skipSegment`, … di `domain/timer.ts`) e la
 * salva; `null` se non c'è. Una modifica che non cambia nulla non scrive.
 */
export function editActiveSession(
  db: RoutForgeDb,
  change: (s: SessioneAttiva) => SessioneAttiva,
  now: number,
): Promise<SessioneAttiva | null> {
  return inTransaction(db, ['preferenze'], async () => {
    const s = await readActiveSession(db);
    if (!s) return null;
    const nuova = change(s);
    if (nuova !== s) await save(db, 'preferenze', { id: CHIAVE_SESSIONE_ATTIVA, valore: nuova }, now);
    return nuova;
  });
}

/** Una sessione chiusa con l'esito scelto (`null` = abbandonata), come sta in `sessioni`. */
export type SessioneRegistrata = SessioneChiusa & { esito: DatiEsito | null };

/**
 * Chiusura (§10.5, §11): la sessione con tipo, riepilogo ed esito va in `sessioni` (statistiche §20, anche gli
 * abbandoni) e la sessione attiva sparisce, nella stessa transazione dell'esito (§8, D-SCHED-1). Se conta nel piano
 * l'esito va sul blocco della sessione (anche un parziale ripreso, D-SESS-1) o su un blocco retroattivo della libera;
 * altrimenti, e nell'abbandono, il blocco `in_corso` torna `programmato` (un parziale ripreso resta parziale). Il
 * ritardo resta, come nel reset degli orfani (D-SESS-1). Un abbandono dal 65% della durata pianificata è una chiusura
 * con l'esito Continua (`abandonPlan`, §10.5, D-SESS-2). `null` se non c'è.
 */
function close(
  db: RoutForgeDb,
  now: number,
  fuso: string,
  esito: DatiEsito | 'abbandono',
): Promise<SessioneRegistrata | null> {
  return inTransaction(db, ['sessioni', ...TABELLE_ESITO], async () => {
    const s = await readActiveSession(db);
    if (!s) return null;
    const piano = esito === 'abbandono' ? abandonPlan(s, now) : { chiusura: undefined, esito };
    const chiusa = { ...closeSession(s, now, piano.chiusura), esito: piano.esito };
    await save(db, 'sessioni', chiusa, now);
    const b = s.bloccoId ? await get(db, 'blocchi', s.bloccoId) : undefined;
    if (piano.esito?.contaNelPiano) {
      const { minuti, perUnita } = sessionMinutes(chiusa.riepilogo);
      // Il blocco retroattivo solo sull'unità ancora viva: il corso può essere stato eliminato durante la sessione
      // (T-037, D-CASCATA-1), e un blocco su un'unità sparita sarebbe un orfano in calendario e nelle statistiche
      const u = !b && s.unitaId ? await get(db, 'unita', s.unitaId) : undefined;
      const blocco = b ?? retroactiveBlock(s.avvio, now, u?.id ?? null, u?.corsoId ?? null);
      const dati = piano.esito;
      await writeOutcome(
        db,
        { blocco, unitaId: b ? s.unitaId : (u?.id ?? null), minuti, minutiPerUnita: perUnita, dati },
        now,
        fuso,
      );
    } else if (b?.stato === 'in_corso') await saveBlock(db, { ...b, stato: 'programmato' }, now, fuso);
    await remove(db, 'preferenze', CHIAVE_SESSIONE_ATTIVA, now);
    return chiusa;
  });
}

/** «Registra esito» dallo sheet di chiusura (§10.5, §11): `completata` o `terminata prima` secondo il traguardo. */
export const endSession = (
  db: RoutForgeDb,
  now: number,
  fuso: string,
  esito: DatiEsito,
): Promise<SessioneRegistrata | null> => close(db, now, fuso, esito);

/** «Abbandona» (§8, §10.5): nessun esito, oppure Continua dal 65% della durata pianificata (D-SESS-2, D7). */
export const abandonSession = (db: RoutForgeDb, now: number, fuso: string): Promise<SessioneRegistrata | null> =>
  close(db, now, fuso, 'abbandono');
