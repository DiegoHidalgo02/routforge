/**
 * Adapter web delle porte del dispositivo (docs/02_ARCHITETTURA.md §6, MECC §10.4). Schermo acceso con la Wake Lock
 * API: il browser la rilascia quando la pagina si nasconde, quindi si richiede di nuovo al ritorno; dove manca non fa
 * nulla. Non Disturbare non esiste sul web: `enable` risponde `false`. Gli adapter nativi sono di T-021.
 */
import type { DoNotDisturb, ScreenAwake } from '../app/ports/device';

export const webScreenAwake: ScreenAwake = {
  keep() {
    let attivo = true;
    let blocco: WakeLockSentinel | null = null;
    const richiedi = () => {
      if (!attivo || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      navigator.wakeLock
        .request('screen')
        .then((b) => {
          if (attivo) blocco = b;
          else void b.release();
        })
        .catch(() => undefined);
    };
    richiedi();
    document.addEventListener('visibilitychange', richiedi);
    return () => {
      attivo = false;
      document.removeEventListener('visibilitychange', richiedi);
      void blocco?.release().catch(() => undefined);
      blocco = null;
    };
  },
};

export const webDoNotDisturb: DoNotDisturb = {
  enable: () => Promise.resolve(false),
  disable: () => undefined,
};
