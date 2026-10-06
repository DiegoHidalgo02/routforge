// Impostazioni dell'aspetto per le schermate (FUNZ §23, T-032): l'ultima lettura di `readSettings`, aggiornata da un solo
// ascolto avviato dall'app. Gli attributi sulla radice danno animazioni e celebrazioni al CSS; i gestori di eventi
// (aptico, coriandoli) leggono `impostazioni()`, i componenti `useSettings()`.
import { useSyncExternalStore } from 'react';
import { appDb, watch } from '../app/db';
import { readSettings } from '../app/settings';
import { IMPOSTAZIONI_DEFAULT, type Impostazioni } from '../domain/settings';

let correnti: Impostazioni = IMPOSTAZIONI_DEFAULT;
const ascoltatori = new Set<() => void>();

export const impostazioni = (): Impostazioni => correnti;

/** «Mai» le spegne sempre; «Auto» segue la riduzione del sistema; «Sempre» la ignora dove decide il codice. */
export const animazioniRidotte = (): boolean =>
  correnti.animazioni === 'mai' ||
  (correnti.animazioni === 'auto' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

export function watchSettings(): () => void {
  return watch(
    () => readSettings(appDb),
    (v) => {
      correnti = v;
      document.documentElement.dataset.animazioni = v.animazioni;
      document.documentElement.dataset.celebrazioni = v.celebrazioni;
      ascoltatori.forEach((f) => f());
    },
  );
}

const iscrivi = (f: () => void) => {
  ascoltatori.add(f);
  return () => void ascoltatori.delete(f);
};
export const useSettings = (): Impostazioni => useSyncExternalStore(iscrivi, impostazioni);

/** La vibrazione breve della spunta, se il feedback aptico è acceso (sul web dove il browser la offre). */
export const vibra = (): void => {
  if (correnti.aptico) navigator.vibrate?.(10);
};
