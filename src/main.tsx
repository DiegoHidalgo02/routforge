// Punto di composizione dell'app, fuori dagli strati (docs/02_ARCHITETTURA.md §1): font e token, lingua, avvio.
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
// Token del pacchetto di design così come sono, senza copia (D-DESIGN-4): si cambiano in Claude Design e si reimportano
import '../claude-design/design/tokens.css';
import './ui/styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { appDb } from './app/db';
import { configureDiagnostics } from './app/diagnostics';
import { configurePdf } from './app/materials';
import { createNotifications, registerNotificationService } from './app/notifications';
import { createScheduler } from './app/scheduler';
import { startHeartbeat } from './app/session';
import { configureSessionDevice } from './app/sessionDevice';
import { webClock } from './platform/clock';
import { webDoNotDisturb, webScreenAwake } from './platform/device';
import { webNotifications } from './platform/notifications';
import { webPdf } from './platform/pdf';
import { App } from './ui/App';
import { lingua } from './ui/i18n';
import { testiNotifica } from './ui/notificationTexts';

document.documentElement.lang = lingua;
// Schermo acceso e Non Disturbare della sessione (MECC §10.4): adapter web; i nativi con T-021.
configureSessionDevice({ schermo: webScreenAwake, nonDisturbare: webDoNotDisturb });
// L'orologio degli eventi della Diagnostica (T-032)
configureDiagnostics(webClock);
// Lettore dei PDF dei materiali (MECC §17, D-MAT-1): pdf.js, caricato solo al primo PDF
configurePdf(webPdf);

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
// Notifiche (MECC §13.3, D-NOTIF-1): riconciliate dopo ogni ciclo e a ogni scrittura sui loro ingressi; sul web solo
// con la scheda aperta. Il clic porta alla rotta con la navigazione della cronologia, che il router ascolta.
const apri = (percorso: string) => {
  history.pushState(null, '', percorso);
  dispatchEvent(new PopStateEvent('popstate'));
};
const notifiche = createNotifications(appDb, webNotifications(testiNotifica, apri), webClock);
registerNotificationService(notifiche);
createScheduler(appDb, webClock, notifiche).start();
notifiche.start();
// Battiti di continuità della sessione (MECC §10.4, D-TIMER-2): sul web solo a scheda aperta; il servizio Android è T-021
startHeartbeat(appDb, webClock);
