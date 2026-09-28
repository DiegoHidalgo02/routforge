/**
 * Adapter web della porta `Clock` (docs/02_ARCHITETTURA.md §6; D-SCHED-1 n. 6): `Date.now`, il fuso di `Intl`, un
 * battito che si riallinea a ogni scatto al multiplo successivo di `ms` (con un minuto, al cambio di minuto come
 * l'orologio della UI) e il ritorno in primo piano da `visibilitychange`. Vale anche nella WebView di Capacitor; se lì
 * l'evento non arriva al ritorno dell'app, l'adapter nativo con `@capacitor/app` è di T-021.
 */
import type { Clock } from '../app/ports/clock';

export const webClock: Clock = {
  now: () => Date.now(),
  fuso: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  every(ms, fn) {
    let timer: ReturnType<typeof setTimeout>;
    const prossimo = () => {
      timer = setTimeout(
        () => {
          fn();
          prossimo();
        },
        ms - (Date.now() % ms),
      );
    };
    prossimo();
    return () => clearTimeout(timer);
  },
  onForeground(fn) {
    const quandoVisibile = () => {
      if (document.visibilityState === 'visible') fn();
    };
    document.addEventListener('visibilitychange', quandoVisibile);
    return () => document.removeEventListener('visibilitychange', quandoVisibile);
  },
};
