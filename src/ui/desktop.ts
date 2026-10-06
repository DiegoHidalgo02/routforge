// Il layout desktop da 1024 px (D-UI-1) per le schermate che cambiano struttura, non solo stile: Oggi (la giornata
// senza archivio) e Corsi (elenco e pannello affiancati, S10 Corsi Desktop).
import { useSyncExternalStore } from 'react';

const DESKTOP = '(min-width: 1024px)';
const segui = (cambia: () => void) => {
  const m = window.matchMedia(DESKTOP);
  m.addEventListener('change', cambia);
  return () => m.removeEventListener('change', cambia);
};
export const eDesktop = (): boolean => window.matchMedia(DESKTOP).matches;
export const useDesktop = (): boolean => useSyncExternalStore(segui, eDesktop);
