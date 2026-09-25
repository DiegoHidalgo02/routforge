// Rotte (FUNZ §1, docs/03_HANDOFF_DESIGN_CODE.md §1): le sezioni ancora vuote hanno solo l'intestazione; le riempie il
// loro task. «+ Crea» aperto dall'app porta nello stato la schermata di partenza (`sfondo`), che resta sotto il
// dialog; aperto da un collegamento diretto si apre sopra la shell. Lo stesso vale per il Dettaglio (`/attivita/:id`).
import { LucideProvider } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, type Location } from 'react-router';
import { Courses } from './Courses';
import { Create } from './Create';
import { Detail } from './Detail';
import { Section } from './Section';
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
          <Route path="statistiche" element={<Section titolo="statistiche" />} />
          <Route path="corsi" element={<Courses />} />
          <Route path="notifiche" element={<Section titolo="notifiche" indietro />} />
          <Route path="impostazioni" element={<Section titolo="impostazioni" indietro />} />
          <Route path="account" element={<Section titolo="account" indietro />} />
          <Route path="diagnostica" element={<Section titolo="diagnostica" indietro />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {sfondo && (
        <Routes>
          <Route path="crea" element={<Create />} />
          <Route path="attivita/:id" element={<Detail />} />
        </Routes>
      )}
    </>
  );
}

export function App() {
  return (
    // Tratto delle icone 1.75 (DESIGN.md §7)
    <LucideProvider strokeWidth={1.75}>
      <BrowserRouter>
        <Rotte />
      </BrowserRouter>
    </LucideProvider>
  );
}
