// Rotte (FUNZ §1, docs/03_HANDOFF_DESIGN_CODE.md §1): le sezioni ancora vuote hanno solo l'intestazione; le riempie il
// loro task. «+ Crea» aperto dall'app porta nello stato la schermata di partenza (`sfondo`), che resta sotto il
// dialog; aperto da un collegamento diretto si apre sopra la shell. Lo stesso vale per il Dettaglio (`/attivita/:id`).
import { LucideProvider } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, type Location } from 'react-router';
import { Alarm } from './Alarm';
import { ChatScreen, Conversations } from './Chat';
import { Course, Module, Unit } from './Course';
import { CorsiColonne } from './Courses';
import { Create } from './Create';
import { Detail } from './Detail';
import { MaterialsSpace, MaterialViewer } from './Materials';
import { Notifications } from './Notifications';
import { DeckScreen, ReviewScreen } from './Practice';
import { PracticeScreen } from './PracticeGames';
import { useSettings, watchSettings } from './preferenze';
import { About, Account, AiSettings, Backup, Diagnostics, NotificationSettings, Settings } from './Settings';
import { ActiveSession, SessionSetup } from './Session';
import { Stats } from './Stats';
import { Shell } from './Shell';
import { Recupero } from './Recupero';
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
          {/* Su desktop elenco e pannello affiancati (S10 Corsi Desktop); su mobile una pagina alla volta */}
          <Route path="corsi" element={<CorsiColonne />}>
            <Route path=":corso" element={<Course />} />
            <Route path=":corso/moduli/:n" element={<Module />} />
            <Route path=":corso/unita/:unita" element={<Unit />} />
          </Route>
          <Route path="sessione/setup" element={<SessionSetup />} />
          <Route path="sessione" element={<ActiveSession />} />
          <Route path="notifiche" element={<Notifications />} />
          <Route path="chat" element={<ChatScreen />} />
          <Route path="chat/conversazioni" element={<Conversations />} />
          <Route path="pratica/:id" element={<PracticeScreen />} />
          <Route path="mazzo/:id" element={<DeckScreen />} />
          <Route path="ripasso" element={<ReviewScreen />} />
          <Route path="materiali/:id" element={<MaterialViewer />} />
          <Route path="impostazioni" element={<Settings />} />
          <Route path="impostazioni/notifiche" element={<NotificationSettings />} />
          <Route path="impostazioni/informazioni" element={<About />} />
          <Route path="impostazioni/ai" element={<AiSettings />} />
          <Route path="impostazioni/backup" element={<Backup />} />
          <Route path="impostazioni/materiali" element={<MaterialsSpace />} />
          <Route path="account" element={<Account />} />
          <Route path="diagnostica" element={<Diagnostics />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
        {/* La sveglia a schermo intero sta sopra l'app, senza shell né banner della sessione (S8, T-057) */}
        <Route path="sveglia" element={<Alarm />} />
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

/** Impostazioni → Animazioni per Motion: «Auto» segue la riduzione del sistema, «Sempre» la ignora, «Mai» le spegne. */
const RIDUZIONE = { auto: 'user', sempre: 'never', mai: 'always' } as const;

export function App() {
  // Animazioni, celebrazioni e aptico delle Impostazioni (T-032): un solo ascolto per tutta l'app
  useEffect(() => watchSettings(), []);
  const { animazioni } = useSettings();
  return (
    // Tratto delle icone 1.75 (DESIGN.md §7)
    <MotionConfig reducedMotion={RIDUZIONE[animazioni]}>
      <LucideProvider strokeWidth={1.75}>
        <BrowserRouter>
          {/* Un errore di disegno mostra la pagina di recupero, non il vuoto (T-059) */}
          <Recupero>
            <Rotte />
          </Recupero>
        </BrowserRouter>
      </LucideProvider>
    </MotionConfig>
  );
}
