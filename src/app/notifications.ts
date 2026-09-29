/**
 * Riconciliazione delle notifiche (MECC §13.3; il `NotificationPlanner` di docs/02_ARCHITETTURA.md §4): legge i blocchi
 * della finestra, le ricorrenze, le impostazioni e la sessione attiva, calcola l'insieme desiderato nel dominio
 * (`desiredSet`, `reconcilePlan`) e chiama la porta solo per la differenza col registro. Innescata da `run()` dello
 * scheduler dopo il ciclo e, con `start()`, da ogni scrittura sui propri ingressi (ogni mutazione di blocco, routine,
 * sessione e impostazioni). Non lancia mai: un errore lascia il registro com'era e la successiva riprova (INV-16).
 * Criteri: SCENARI F1, F2, F4, F6, A3, B6, C4, D1, E3. Decisione: D-NOTIF-1.
 */
import type { RoutForgeDb } from '../data/db';
import { MAX_ANTICIPO_MINUTI } from '../domain/activity';
import { blocksBetween, get, inTransaction, list, purge, save, watch } from '../data/repository';
import {
  desiredSet,
  IMPOSTAZIONI_NOTIFICHE_DEFAULT,
  ORIZZONTE_BLOCCHI_GIORNI,
  reconcilePlan,
  type ImpostazioniNotifiche,
} from '../domain/notifications/desiredSet';
import { addLocalDays, localDayKey } from '../domain/time';
import type { TipoBlocco } from '../domain/types';
import type { Clock } from './ports/clock';
import type { Notifications } from './ports/notifications';
import { readActiveSession } from './session';

/** Riga di `preferenze` delle impostazioni delle notifiche (§13.1); la UI è di T-032. */
export const CHIAVE_IMPOSTAZIONI_NOTIFICHE = 'notifiche';

const TIPI: readonly TipoBlocco[] = ['todo', 'evento', 'routine', 'studio'];

const leggibili = (v: unknown): v is ImpostazioniNotifiche => {
  if (typeof v !== 'object' || v === null || !('generale' in v) || !('perTipo' in v)) return false;
  const { generale, perTipo } = v as { generale: unknown; perTipo: unknown };
  if (typeof generale !== 'boolean' || typeof perTipo !== 'object' || perTipo === null) return false;
  return TIPI.every((t) => {
    const x = (perTipo as Record<string, unknown>)[t] as Record<string, unknown> | undefined;
    return (
      typeof x?.attivo === 'boolean' &&
      typeof x.silenzioso === 'boolean' &&
      Array.isArray(x.anticipi) &&
      x.anticipi.every((m) => Number.isInteger(m) && m >= 0 && m <= MAX_ANTICIPO_MINUTI)
    );
  });
};

/** Le impostazioni delle notifiche; riga assente o illeggibile = default di §13.1 (D-NOTIF-1 n. 11). */
export async function readNotificationSettings(db: RoutForgeDb): Promise<ImpostazioniNotifiche> {
  const v = (await get(db, 'preferenze', CHIAVE_IMPOSTAZIONI_NOTIFICHE))?.valore;
  return leggibili(v) ? v : IMPOSTAZIONI_NOTIFICHE_DEFAULT;
}

/** Gli ingressi dell'insieme desiderato: blocchi da ieri (routine notturne, esito a fine + 10') a oggi + 14 + 31. */
async function readInputs(db: RoutForgeDb, now: number) {
  const sessione = await readActiveSession(db);
  const b = sessione?.bloccoId ? await get(db, 'blocchi', sessione.bloccoId) : undefined;
  return {
    blocchi: await blocksBetween(
      db,
      localDayKey(addLocalDays(now, -1)),
      localDayKey(addLocalDays(now, ORIZZONTE_BLOCCHI_GIORNI)),
    ),
    ricorrenze: await list(db, 'ricorrenze'),
    impostazioni: await readNotificationSettings(db),
    sessione,
    titoloSessione: b?.titolo ?? '',
  };
}

export interface NotificationService {
  /** Riconcilia adesso; le esecuzioni si accodano una alla volta; non rigetta mai. */
  reconcile(now: number): Promise<void>;
  /** Osserva gli ingressi e riconcilia a ogni scrittura; la prima emissione è la riconciliazione d'avvio. Restituisce lo stop. */
  start(): () => void;
}

export function createNotifications(db: RoutForgeDb, porta: Notifications, clock: Clock): NotificationService {
  // Dopo un ricaricamento il web non ha più timer e su Android un permesso revocato cancella le notifiche esatte: la
  // prima riconciliazione del processo riarma tutto (stesso id = sostituzione, D-NOTIF-1 n. 5)
  let prima = true;
  let permessoChiesto = false;
  let coda: Promise<void> = Promise.resolve();

  async function esegui(now: number): Promise<void> {
    try {
      const desiderate = desiredSet(await readInputs(db, now), now);
      const piano = reconcilePlan(desiderate, await list(db, 'registroNotifiche'), prima, now);
      if (piano.daCancellare.length > 0) await porta.cancel(piano.daCancellare);
      if (piano.daTogliere.length > 0) await purge(db, 'registroNotifiche', piano.daTogliere);
      if (piano.daArmare.length > 0) {
        // Senza attendere: il prompt del browser può restare aperto (o non comparire mai senza un gesto) e fermerebbe
        // la coda; l'adapter controlla il permesso allo scatto (D-NOTIF-1 n. 9)
        if (!permessoChiesto) {
          permessoChiesto = true;
          void porta.requestPermission().catch(() => false);
        }
        await porta.schedule(piano.daArmare);
        await inTransaction(db, ['registroNotifiche'], async () => {
          for (const v of piano.daArmare) await save(db, 'registroNotifiche', { ...v, id: v.chiave }, now);
        });
      }
      prima = false;
    } catch {
      // Registro com'era: la prossima riconciliazione riprova; la Diagnostica è di T-032 (D-NOTIF-1 n. 12)
    }
  }

  const reconcile = (now: number): Promise<void> => (coda = coda.then(() => esegui(now)));
  return {
    reconcile,
    start: () =>
      watch(
        () => readInputs(db, clock.now()),
        () => void reconcile(clock.now()),
      ),
  };
}
