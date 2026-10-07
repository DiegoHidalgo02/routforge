/**
 * Riconciliazione delle notifiche (MECC §13.3; il `NotificationPlanner` di docs/02_ARCHITETTURA.md §4): legge i blocchi
 * della finestra, le ricorrenze, le impostazioni, la sessione attiva e i posticipi, calcola l'insieme desiderato nel
 * dominio (`desiredSet`, `reconcilePlan`) e chiama la porta solo per la differenza col registro. Innescata da `run()`
 * dello scheduler dopo il ciclo e, con `start()`, da ogni scrittura sui propri ingressi (ogni mutazione di blocco,
 * routine, sessione, impostazioni e posticipi). Gli avvisi «perso» e «in ritardo» partono da qui, dalle marcature che il
 * ciclo scrive sui blocchi (T-020, D-NOTIF-2). Non lancia mai: un errore lascia il registro com'era e la successiva
 * riprova (INV-16). Criteri: SCENARI F1, F2, F3, F4, F5, F6, A1, A3, A4, B6, B7, C4, C8, D1, E3. Decisioni: D-NOTIF-1,
 * D-NOTIF-2.
 */
import type { RoutForgeDb } from '../data/db';
import { MAX_ANTICIPO_MINUTI } from '../domain/activity';
import { blocksBetween, get, inTransaction, list, purge, save, watch } from '../data/repository';
import {
  CHIAVE_PROVA,
  desiredSet,
  IMPOSTAZIONI_NOTIFICHE_DEFAULT,
  nativeId,
  ORIZZONTE_BLOCCHI_GIORNI,
  reconcilePlan,
  testNotification,
  type ImpostazioniNotifiche,
} from '../domain/notifications/desiredSet';
import { GIORNI_INDIETRO } from '../domain/scheduler/horizon';
import { addLocalDays, localDayKey } from '../domain/time';
import type { TipoBlocco } from '../domain/types';
import type { Clock } from './ports/clock';
import type { Notifications, PermessiNotifiche, SchermoSveglia } from './ports/notifications';
import { logError, logReconcile } from './diagnostics';
import { readActiveSession } from './session';
import { readSettings } from './settings';

/** Riga di `preferenze` delle impostazioni delle notifiche (§13.1, §13.5); la UI è di T-032. */
export const CHIAVE_IMPOSTAZIONI_NOTIFICHE = 'notifiche';
/** Riga di `preferenze` dei tocchi «Posticipa» (§13.2, D-NOTIF-2): chiave della notifica → istante del tocco. */
export const CHIAVE_POSTICIPI = 'posticipi';

const TIPI: readonly TipoBlocco[] = ['todo', 'evento', 'routine', 'studio'];
const ORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const oraLeggibile = (v: unknown): v is string => typeof v === 'string' && ORA.test(v);

const leggibili = (v: unknown): v is ImpostazioniNotifiche => {
  if (typeof v !== 'object' || v === null || !('generale' in v) || !('perTipo' in v)) return false;
  const { generale, perTipo, digest } = v as Record<string, unknown>;
  if (typeof generale !== 'boolean' || typeof perTipo !== 'object' || perTipo === null) return false;
  if (!oraLeggibile((digest as Record<string, unknown> | undefined)?.orario)) return false;
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

/** Cambia le impostazioni delle notifiche a partire da quelle salvate (o dai default di §13.1; Impostazioni, T-032). */
export function editNotificationSettings(
  db: RoutForgeDb,
  modifica: (v: ImpostazioniNotifiche) => ImpostazioniNotifiche,
  now: number,
): Promise<void> {
  return inTransaction(db, ['preferenze'], async () => {
    const valore = modifica(await readNotificationSettings(db));
    // Un valore illeggibile riporterebbe tutto ai default alla lettura: non si salva
    if (leggibili(valore)) await save(db, 'preferenze', { id: CHIAVE_IMPOSTAZIONI_NOTIFICHE, valore }, now);
  });
}

const posticipiLeggibili = (v: unknown): v is Record<string, number> =>
  typeof v === 'object' && v !== null && Object.values(v).every((t) => typeof t === 'number');

async function readSnoozes(db: RoutForgeDb): Promise<Record<string, number>> {
  const v = (await get(db, 'preferenze', CHIAVE_POSTICIPI))?.valore;
  return posticipiLeggibili(v) ? v : {};
}

/**
 * «Posticipa» (§13.2, F5): ricorda l'istante del tocco; è l'insieme desiderato a spostare la voce di 10' se esiste
 * ancora con lo stato coerente, e la riconciliazione segue dal `watch` di `preferenze`. I tocchi più vecchi di un
 * giorno escono. La chiama l'azione della notifica (adapter nativo, T-021).
 */
export async function snoozeNotification(db: RoutForgeDb, chiave: string, now: number): Promise<void> {
  await inTransaction(db, ['preferenze'], async () => {
    const vivi = Object.entries(await readSnoozes(db)).filter(([, t]) => t > addLocalDays(now, -1));
    await save(db, 'preferenze', { id: CHIAVE_POSTICIPI, valore: Object.fromEntries([...vivi, [chiave, now]]) }, now);
  });
}

/**
 * Gli ingressi dell'insieme desiderato: blocchi da 30 giorni fa (i todo che rotolano nel digest, §13.5, D-HOR-1;
 * ieri per le routine notturne e l'esito a fine + 10') a oggi + 14 + 31.
 */
async function readInputs(db: RoutForgeDb, now: number) {
  const sessione = await readActiveSession(db);
  const b = sessione?.bloccoId ? await get(db, 'blocchi', sessione.bloccoId) : undefined;
  return {
    blocchi: await blocksBetween(
      db,
      localDayKey(addLocalDays(now, -GIORNI_INDIETRO)),
      localDayKey(addLocalDays(now, ORIZZONTE_BLOCCHI_GIORNI)),
    ),
    ricorrenze: await list(db, 'ricorrenze'),
    impostazioni: await readNotificationSettings(db),
    sessione,
    titoloSessione: b?.titolo ?? '',
    posticipi: await readSnoozes(db),
  };
}

export interface NotificationService {
  /** Riconcilia adesso; le esecuzioni si accodano una alla volta; non rigetta mai. */
  reconcile(now: number): Promise<void>;
  /** Osserva gli ingressi e riconcilia a ogni scrittura; la prima emissione è la riconciliazione d'avvio. Restituisce lo stop. */
  start(): () => void;
  /** La notifica di prova (§13.6): chiede il permesso (qui c'è il gesto dell'utente, D-NOTIF-1 n. 9) e la arma a +6 s. */
  test(now: number): Promise<void>;
  /** I permessi della piattaforma (Impostazioni, Diagnostica); mai un rifiuto. */
  permissions(): Promise<PermessiNotifiche>;
  /** Toglie tutte le notifiche armate e svuota il registro: prima dell'azzeramento di MECC §22 (import, «Elimina tutti i dati»). */
  cancelAll(): Promise<void>;
  /** La schermata della sveglia della piattaforma (S8; T-057), se c'è. */
  sveglia?: SchermoSveglia;
}

let registrato: NotificationService | null = null;
/** Il servizio dell'app, registrato dal punto di composizione per la «Notifica di prova» di Impostazioni (§13.6, T-032). */
export const registerNotificationService = (s: NotificationService): void => {
  registrato = s;
};
export const sendTestNotification = (now: number): Promise<void> => registrato?.test(now) ?? Promise.resolve();
export const cancelAllNotifications = (): Promise<void> => registrato?.cancelAll() ?? Promise.resolve();
const SENZA_PERMESSI: PermessiNotifiche = { notifiche: null, allarmiEsatti: null };
export const readNotificationPermissions = (): Promise<PermessiNotifiche> =>
  registrato?.permissions() ?? Promise.resolve(SENZA_PERMESSI);
/** S8 (T-057): disegnata, si mostra sopra il blocco schermo. */
export const showAlarm = (): Promise<void> => registrato?.sveglia?.mostra().catch(() => undefined) ?? Promise.resolve();
/** S8 (T-057): lo sblocco del telefono prima di aprire l'app; senza schermata della sveglia non serve. */
export const unlockForAlarm = (): Promise<boolean> =>
  registrato?.sveglia?.sblocca().catch(() => false) ?? Promise.resolve(true);
/** S8 (T-057): via la sveglia; `inSfondo` rimette il telefono al blocco schermo. */
export const closeAlarm = (idNativo: number | null, inSfondo: boolean): Promise<void> =>
  registrato?.sveglia?.chiudi(idNativo, inSfondo).catch(() => undefined) ?? Promise.resolve();

export function createNotifications(db: RoutForgeDb, porta: Notifications, clock: Clock): NotificationService {
  // Dopo un ricaricamento il web non ha più timer e su Android un permesso revocato cancella le notifiche esatte: la
  // prima riconciliazione del processo riarma tutto (stesso id = sostituzione, D-NOTIF-1 n. 5)
  let prima = true;
  let permessoChiesto = false;
  let coda: Promise<void> = Promise.resolve();

  async function esegui(now: number): Promise<void> {
    try {
      // L'inizio settimana (FUNZ §23) si legge qui e non negli ingressi osservati: dentro la query live la lettura
      // farebbe perdere a Dexie le successive; un suo cambio arriva con la riconciliazione del ciclo seguente
      const { inizioSettimana } = await readSettings(db);
      const desiderate = desiredSet({ ...(await readInputs(db, now)), inizioSettimana }, now);
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
      logReconcile(now, null);
    } catch (e) {
      // Registro com'era: la prossima riconciliazione riprova; l'errore va in Diagnostica (T-032, D-NOTIF-1 n. 12)
      logReconcile(now, e);
    }
  }

  // La coda non resta mai rigettata: un errore imprevisto non ferma le riconciliazioni successive (INV-16)
  const reconcile = (now: number): Promise<void> =>
    (coda = coda.then(() => esegui(now)).catch((e: unknown) => logError('notifiche', e)));
  return {
    reconcile,
    start: () =>
      watch(
        () => readInputs(db, clock.now()),
        () => void reconcile(clock.now()),
      ),
    async test(now) {
      try {
        // Fuori dal registro: non è una notifica di un blocco e la riconciliazione non deve toccarla
        permessoChiesto = true;
        await porta.requestPermission();
        await porta.schedule([{ ...testNotification(now), idNativo: nativeId(CHIAVE_PROVA) }]);
      } catch (e) {
        // Nessuna eccezione verso la UI (INV-16): l'errore va in Diagnostica
        logError('notifiche', e);
      }
    },
    permissions: () => (porta.permissions?.() ?? Promise.resolve(SENZA_PERMESSI)).catch(() => SENZA_PERMESSI),
    // In coda come le riconciliazioni, così nessuna arma una voce mentre il registro si svuota
    cancelAll: () =>
      (coda = coda
        .then(async () => {
          const voci = await list(db, 'registroNotifiche');
          if (voci.length > 0) await porta.cancel(voci.map((v) => v.idNativo));
          await purge(
            db,
            'registroNotifiche',
            voci.map((v) => v.id),
          );
        })
        .catch((e: unknown) => logError('notifiche', e))),
    ...(porta.sveglia && { sveglia: porta.sveglia }),
  };
}
