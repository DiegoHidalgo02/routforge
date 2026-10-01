/**
 * Ritorno dopo un'assenza (MECC §9; FUNZ §2; S1 Mobile `absence`): a ogni apertura dell'app — l'avvio e il ritorno in
 * primo piano, dal servizio dello scheduler (`start()`) — si legge l'ultima apertura, la si aggiorna subito e, dopo
 * un'assenza, si scrive l'avviso nella stessa transazione. La vista Giorno di Oggi lo mostra finché non si chiude con
 * ×, e solo nel giorno dell'apertura. La regola (soglia, giorni di calendario, corsi) sta in
 * `domain/scheduler/absence.ts`; le righe di `preferenze` hanno id = chiave (D-DATA-2). Criterio: test con «ultima
 * apertura» (T-014). Decisione: D-ASSENZA-1.
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, list, remove, save } from '../data/repository';
import { absenceNotice, noticeOfDay, type AvvisoAssenza } from '../domain/scheduler/absence';

/** Riga di `preferenze` con l'istante dell'ultima apertura (MECC §1 «ultima apertura»). */
export const CHIAVE_ULTIMA_APERTURA = 'ultimaApertura';
/** Riga di `preferenze` con l'avviso da mostrare, finché non si chiude. */
export const CHIAVE_RITORNO_ASSENZA = 'ritornoAssenza';

// Un valore illeggibile (dato rotto, anche arrivato dalla sync) vale come assente
const avvisoLetto = (v: unknown): AvvisoAssenza | null =>
  typeof v === 'object' &&
  v !== null &&
  'giorni' in v &&
  'giorno' in v &&
  typeof v.giorni === 'number' &&
  typeof v.giorno === 'string'
    ? { giorni: v.giorni, giorno: v.giorno }
    : null;

/** Registra l'apertura all'istante `now`: aggiorna subito l'ultima apertura e, dopo un'assenza, scrive l'avviso (§9). */
export function registerOpening(db: RoutForgeDb, now: number): Promise<void> {
  return inTransaction(db, ['preferenze', 'corsi'], async () => {
    const prima = (await get(db, 'preferenze', CHIAVE_ULTIMA_APERTURA))?.valore;
    const corsi = (await list(db, 'corsi')).length;
    const avviso = absenceNotice(typeof prima === 'number' ? prima : null, now, corsi);
    await save(db, 'preferenze', { id: CHIAVE_ULTIMA_APERTURA, valore: now }, now);
    if (avviso) await save(db, 'preferenze', { id: CHIAVE_RITORNO_ASSENZA, valore: avviso }, now);
  });
}

/** L'avviso da mostrare nel giorno locale `oggi` ("YYYY-MM-DD"), o `null`. */
export const readAbsenceNotice = async (db: RoutForgeDb, oggi: string): Promise<AvvisoAssenza | null> =>
  noticeOfDay(avvisoLetto((await get(db, 'preferenze', CHIAVE_RITORNO_ASSENZA))?.valore), oggi);

/**
 * Chiude l'avviso (× del banner): non torna, perché l'ultima apertura è già aggiornata. Se la scrittura fallisce
 * l'avviso resta e si può richiudere, senza eccezioni verso la UI (CONTESTO §3).
 */
export const dismissAbsenceNotice = (db: RoutForgeDb, now: number): Promise<void> =>
  remove(db, 'preferenze', CHIAVE_RITORNO_ASSENZA, now).catch(() => undefined);
