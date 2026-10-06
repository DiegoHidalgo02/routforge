/**
 * Impostazioni (S22; FUNZ §23; T-032): legge e scrive in `preferenze` l'aspetto e il calendario (animazioni,
 * celebrazioni, aptico, inizio settimana; `domain/settings.ts`). Una scrittura parte dalle impostazioni salvate, così
 * due cambi vicini non si perdono. Le impostazioni delle notifiche stanno in `notifications.ts`.
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, save } from '../data/repository';
import { readableSettings, type Impostazioni } from '../domain/settings';

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
