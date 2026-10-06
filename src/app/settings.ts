/**
 * Impostazioni (S22; FUNZ §23, §7.7; MECC §13; T-032): legge e scrive in `preferenze` l'aspetto e il calendario
 * (animazioni, celebrazioni, aptico, inizio settimana; `domain/settings.ts`) e le notifiche (`ImpostazioniNotifiche`, che
 * la riconciliazione segue da sola: D-NOTIF-1). Una scrittura parte dalle impostazioni salvate, così due cambi vicini
 * non si perdono.
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, save } from '../data/repository';
import type { ImpostazioniNotifiche } from '../domain/notifications/desiredSet';
import { readableSettings, type Impostazioni } from '../domain/settings';
import { CHIAVE_IMPOSTAZIONI_NOTIFICHE, readNotificationSettings } from './notifications';

export const CHIAVE_IMPOSTAZIONI = 'impostazioni';

export async function readSettings(db: RoutForgeDb): Promise<Impostazioni> {
  return readableSettings((await get(db, 'preferenze', CHIAVE_IMPOSTAZIONI))?.valore);
}

export function saveSettings(db: RoutForgeDb, modifica: Partial<Impostazioni>, now: number): Promise<void> {
  return inTransaction(db, ['preferenze'], async () => {
    await save(
      db,
      'preferenze',
      { id: CHIAVE_IMPOSTAZIONI, valore: { ...(await readSettings(db)), ...modifica } },
      now,
    );
  });
}

/** Cambia le impostazioni delle notifiche a partire da quelle salvate (o dai default di §13.1). */
export function editNotificationSettings(
  db: RoutForgeDb,
  modifica: (v: ImpostazioniNotifiche) => ImpostazioniNotifiche,
  now: number,
): Promise<void> {
  return inTransaction(db, ['preferenze'], async () => {
    await save(
      db,
      'preferenze',
      { id: CHIAVE_IMPOSTAZIONI_NOTIFICHE, valore: modifica(await readNotificationSettings(db)) },
      now,
    );
  });
}
