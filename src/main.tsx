// Punto di composizione dell'app, fuori dagli strati (docs/02_ARCHITETTURA.md §1): font e token, lingua, avvio.
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import './ui/styles/tokens.css';
import './ui/styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { appDb } from './app/db';
import { createScheduler } from './app/scheduler';
import { configureSessionDevice } from './app/sessionDevice';
import { webClock } from './platform/clock';
import { webDoNotDisturb, webScreenAwake } from './platform/device';
import { App } from './ui/App';
import { lingua } from './ui/i18n';

document.documentElement.lang = lingua;
// Schermo acceso e Non Disturbare della sessione (MECC §10.4): adapter web; i nativi con T-021.
configureSessionDevice({ schermo: webScreenAwake, nonDisturbare: webDoNotDisturb });

const radice = document.getElementById('root');
if (radice)
  createRoot(radice).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

// Archiviazione persistente (D-DATA-1, docs/02_ARCHITETTURA.md §8), dopo il montaggio e mai bloccante (INV-16): il
// browser può non averla o rifiutarla; lo stato si mostra in Diagnostica (T-032).
void navigator.storage?.persist?.().catch(() => false);
// Ciclo dello scheduler (MECC §9, D-SCHED-1): subito, al ritorno in primo piano, a ogni minuto e alle modifiche delle
// routine. Non blocca il primo disegno: le query live delle schermate mostrano il risultato quando arriva.
createScheduler(appDb, webClock).start();
