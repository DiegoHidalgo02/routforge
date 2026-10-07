/**
 * Il dispositivo durante la sessione (MECC §10.4, T-017): schermo acceso e Non Disturbare dell'iperfocus, dietro le
 * porte di `ports/device.ts`. Gli adapter li inietta il punto di composizione (`src/main.tsx`), come il database di
 * `db.ts`; prima, e nei test che non li danno, non fanno nulla. Un adapter che fallisce non arriva alla UI (INV-16).
 */
import { logError } from './diagnostics';
import type { DoNotDisturb, ScreenAwake } from './ports/device';

let schermo: ScreenAwake = { keep: () => () => undefined };
let nonDisturbare: DoNotDisturb = { enable: () => Promise.resolve(false), disable: () => undefined };

export function configureSessionDevice(porte: { schermo: ScreenAwake; nonDisturbare: DoNotDisturb }): void {
  ({ schermo, nonDisturbare } = porte);
}

/** Un errore della piattaforma va in Diagnostica (T-032), mai alla UI (INV-16). */
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (e) {
    logError('dispositivo', e);
    return fallback;
  }
}

/** Schermo acceso finché non si chiama la funzione restituita. */
export function keepScreenOn(): () => void {
  const rilascia = safe(
    () => schermo.keep(),
    () => undefined,
  );
  return () => safe(rilascia, undefined);
}

/** Non Disturbare per l'iperfocus: `true` se è attivo; senza permesso l'iperfocus vale comunque (§10.4). */
export const enableDoNotDisturb = (): Promise<boolean> =>
  safe(() => nonDisturbare.enable(), Promise.resolve(false)).catch((e: unknown) => {
    logError('dispositivo', e);
    return false;
  });

export const disableDoNotDisturb = (): void => safe(() => nonDisturbare.disable(), undefined);

/** L'accesso a Non disturbare concesso all'app (Diagnostica); `null` dove la piattaforma non lo ha (il web). */
export const doNotDisturbAccess = (): Promise<boolean | null> =>
  nonDisturbare.access ? nonDisturbare.access().catch(() => null) : Promise.resolve(null);
