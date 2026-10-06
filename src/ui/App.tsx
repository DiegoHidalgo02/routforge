// Rotte (FUNZ §1, docs/03_HANDOFF_DESIGN_CODE.md §1): le sezioni ancora vuote hanno solo l'intestazione; le riempie il
// loro task. «+ Crea» aperto dall'app porta nello stato la schermata di partenza (`sfondo`), che resta sotto il
// dialog; aperto da un collegamento diretto si apre sopra la shell. Lo stesso vale per il Dettaglio (`/attivita/:id`).
import { LucideProvider } from 'lucide-react';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, type Location } from 'react-router';
import { Course, Module, Unit } from './Course';
import { Courses } from './Courses';
import { Create } from './Create';
import { Detail } from './Detail';
import { Notifications } from './Notifications';
import { t } from './i18n';
import { watchSettings } from './preferenze';
import { Section } from './Section';
import { About, NotificationSettings, Settings } from './Settings';
import { ActiveSession, SessionSetup } from './Session';
import { Stats } from './Stats';
import { Shell } from './Shell';
import { Today } from './Today';

function Rotte() {
  const location = useLocation();
  const sfondo = (location.state as { sfondo?: Location } | null)?.sfondo;
  return (
    <>
      <Routes location={sfondo ?? location}>
        <Route element={<Shell />}>
          <Route index element={<Today />} />
          <Route path="crea" element={<Create />} />
          <Route path="attivita/:id" element={<Detail />} />
          <Route path="attivita/:id/modifica" element={<Create />} />
          <Route path="statistiche" element={<Stats />} />
          <Route path="corsi" element={<Courses />} />
          <Route path="corsi/:corso" element={<Course />} />
          <Route path="corsi/:corso/moduli/:n" element={<Module />} />
          <Route path="corsi/:corso/unita/:unita" element={<Unit />} />
          <Route path="sessione/setup" element={<SessionSetup />} />
          <Route path="sessione" element={<ActiveSession />} />
          <Route path="notifiche" element={<Notifications />} />
          <Route path="impostazioni" element={<Settings />} />
          <Route path="impostazioni/notifiche" element={<NotificationSettings />} />
          <Route path="impostazioni/informazioni" element={<About />} />
          <Route
            path="impostazioni/ai"
            element={<Section titolo="modelloChiaveAi" indietro sottotitolo={t('impostazioni')} />}
          />
          <Route
            path="impostazioni/backup"
            element={<Section titolo="backupDati" indietro sottotitolo={t('impostazioni')} />}
          />
          <Route
            path="impostazioni/materiali"
            element={<Section titolo="spazioMateriali" indietro sottotitolo={t('impostazioni')} />}
          />
          <Route path="account" element={<Section titolo="account" indietro sottotitolo={t('impostazioni')} />} />
          <Route
            path="diagnostica"
            element={<Section titolo="diagnostica" indietro sottotitolo={t('impostazioni')} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {sfondo && (
        <Routes>
          <Route path="crea" element={<Create />} />
          <Route path="attivita/:id" element={<Detail />} />
          <Route path="attivita/:id/modifica" element={<Create />} />
        </Routes>
      )}
    </>
  );
}

export function App() {
  // Animazioni, celebrazioni e aptico delle Impostazioni (T-032): un solo ascolto per tutta l'app
  useEffect(() => watchSettings(), []);
  return (
    // Tratto delle icone 1.75 (DESIGN.md §7)
    <LucideProvider strokeWidth={1.75}>
      <BrowserRouter>
        <Rotte />
      </BrowserRouter>
    </LucideProvider>
  );
}
