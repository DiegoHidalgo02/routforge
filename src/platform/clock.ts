/**
 * Adapter web della porta `Clock` (docs/02_ARCHITETTURA.md §6; D-SCHED-1 n. 6): `Date.now`, il fuso di `Intl`, un
 * battito che si riallinea a ogni scatto al multiplo successivo di `ms` (con un minuto, al cambio di minuto come
 * l'orologio della UI), il ritorno in primo piano e il primo piano corrente da `visibilityState`. Nell'app nativa il
 * ritorno in primo piano viene da `@capacitor/app` («resume»), che la WebView segnala sempre (T-021), e col servizio in
 * primo piano della sessione attivo l'app conta come in primo piano anche a WebView nascosta (D-TIMER-2).
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import type { Clock } from '../app/ports/clock';

const nativo = Capacitor.isNativePlatform();
let sessioneInPrimoPiano = false;

/** Il servizio in primo piano della sessione è attivo (o non più): i battiti continuano a WebView nascosta. */
export const segnaPrimoPiano = (attivo: boolean): void => {
  sessioneInPrimoPiano = attivo;
};

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
    if (nativo) {
      const ascolto = App.addListener('resume', fn);
      return () => void ascolto.then((a) => a.remove());
    }
    const quandoVisibile = () => {
      if (document.visibilityState === 'visible') fn();
    };
    document.addEventListener('visibilitychange', quandoVisibile);
    return () => document.removeEventListener('visibilitychange', quandoVisibile);
  },
  inForeground: () => document.visibilityState === 'visible' || sessioneInPrimoPiano,
};
