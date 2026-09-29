/**
 * Il dispositivo durante la sessione (MECC §10.4, T-017): schermo acceso e Non Disturbare dell'iperfocus, dietro le
 * porte di `ports/device.ts`. Gli adapter li inietta il punto di composizione (`src/main.tsx`), come il database di
 * `db.ts`; prima, e nei test che non li danno, non fanno nulla. Un adapter che fallisce non arriva alla UI (INV-16).
 */
import type { DoNotDisturb, ScreenAwake } from './ports/device';

let schermo: ScreenAwake = { keep: () => () => undefined };
let nonDisturbare: DoNotDisturb = { enable: () => Promise.resolve(false), disable: () => undefined };

export function configureSessionDevice(porte: { schermo: ScreenAwake; nonDisturbare: DoNotDisturb }): void {
  ({ schermo, nonDisturbare } = porte);
}

/** Schermo acceso finché non si chiama la funzione restituita. */
export function keepScreenOn(): () => void {
  try {
    const rilascia = schermo.keep();
    return () => {
      try {
        rilascia();
      } catch {
        // Errore della piattaforma: resta alla Diagnostica (T-032)
      }
    };
  } catch {
    return () => undefined;
  }
}

/** Non Disturbare per l'iperfocus: `true` se è attivo; senza permesso l'iperfocus vale comunque (§10.4). */
export async function enableDoNotDisturb(): Promise<boolean> {
  try {
    return await nonDisturbare.enable();
  } catch {
    return false;
  }
}

export function disableDoNotDisturb(): void {
  try {
    nonDisturbare.disable();
  } catch {
    // Errore della piattaforma: resta alla Diagnostica (T-032)
  }
}
