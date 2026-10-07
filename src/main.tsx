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
import { configureBackupFiles } from './app/backup';
import { configurePdf } from './app/materials';
import { createNotifications, registerNotificationService } from './app/notifications';
import { createScheduler } from './app/scheduler';
import { blockRouteById, notificationGesture } from './app/notificationActions';
import { followWidget } from './app/widget';
import type { GestoNotifica, VoceToccata } from './app/ports/notifications';
import { followSessionInForeground, startHeartbeat } from './app/session';
import { configureSessionDevice } from './app/sessionDevice';
import { webClock } from './platform/clock';
import { webDoNotDisturb, webScreenAwake } from './platform/device';
import { androidDoNotDisturb, androidScreenAwake, androidSession, eAndroid } from './platform/deviceAndroid';
import { backupFiles } from './platform/files';
import { webNotifications } from './platform/notifications';
import { androidNotifications } from './platform/notificationsAndroid';
import { androidWidget, followLinks } from './platform/widgetAndroid';
import { webPdf } from './platform/pdf';
import { androidPdfViewer } from './platform/pdfAndroid';
import { App } from './ui/App';
import { lingua } from './ui/i18n';
import { etichetteNative, testiNotifica } from './ui/notificationTexts';
import { etichetteWidget } from './ui/widgetTexts';

document.documentElement.lang = lingua;
// Schermo acceso e Non Disturbare della sessione (MECC §10.4): su Android i nativi (T-021), altrimenti quelli del web
configureSessionDevice(
  eAndroid
    ? { schermo: androidScreenAwake, nonDisturbare: androidDoNotDisturb }
    : { schermo: webScreenAwake, nonDisturbare: webDoNotDisturb },
);
// L'orologio degli eventi della Diagnostica (T-032)
configureDiagnostics(webClock);
// Lettore dei PDF dei materiali (MECC §17, D-MAT-1): pdf.js, caricato solo al primo PDF; su Android il PDF si guarda
// col visore del sistema (D-MAT-2)
configurePdf(webPdf, androidPdfViewer);
// Il file del backup (MECC §22, T-030): scaricato sul web, nella cartella Documenti su Android
configureBackupFiles(backupFiles);

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
// con la scheda aperta, su Android armate dal sistema (T-021). Il clic porta alla rotta con la navigazione della
// cronologia, che il router ascolta; lo stato è quello che React Router legge (`usr`), per il foglio del Dettaglio.
const apri = (percorso: string, stato: unknown = null) => {
  const idx = ((history.state as { idx?: number } | null)?.idx ?? 0) + 1;
  history.pushState({ usr: stato, key: Math.random().toString(36).slice(2, 10), idx }, '', percorso);
  dispatchEvent(new PopStateEvent('popstate'));
};
// Il gesto su una notifica nativa (§13.2): l'app fa ciò che serve e poi si apre dove serve (T-021, T-051). Un gesto
// fatto senza aprire l'app arriva con il suo istante e non apre nulla (A6, T-057)
const gesto = (voce: VoceToccata, g: GestoNotifica, istante?: number) =>
  notificationGesture(appDb, voce, g, istante ?? webClock.now(), webClock.fuso()).then((d) => {
    if (istante === undefined && d) apri(d.percorso, d.vista ? { vista: d.vista } : null);
  });
// La sveglia a schermo intero apre S8 sopra il blocco schermo (T-057)
const android = eAndroid
  ? androidNotifications(testiNotifica, etichetteNative, gesto, (s) => apri('/sveglia', s))
  : null;
const notifiche = createNotifications(appDb, android ?? webNotifications(testiNotifica, apri), webClock);
registerNotificationService(notifiche);
// Su Android prima i gesti fatti ad app chiusa (T-057, A6): il primo ciclo altrimenti troverebbe il todo ancora da fare
// e lo sposterebbe in ritardo. Al più 3 s: un ponte che non risponde non ferma scheduler e notifiche
void Promise.race([android?.pronte, new Promise((r) => setTimeout(r, 3000))]).then(() => {
  createScheduler(appDb, webClock, notifiche).start();
  notifiche.start();
});
// Battiti di continuità della sessione (MECC §10.4, D-TIMER-2): sul web solo a scheda aperta; su Android il servizio in
// primo piano della sessione li tiene vivi anche con l'app chiusa (T-021)
startHeartbeat(appDb, webClock);
if (eAndroid) {
  followSessionInForeground(appDb, androidSession(etichetteNative.sessione));
  // Il widget della schermata Home e i suoi collegamenti diretti (MECC §21; T-023)
  followWidget(appDb, webClock, androidWidget(etichetteWidget));
  followLinks((c) =>
    c.tipo === 'attivita'
      ? void blockRouteById(appDb, c.id).then((percorso) => apri(percorso))
      : apri(c.tipo === 'crea' ? '/crea' : '/'),
  );
}
