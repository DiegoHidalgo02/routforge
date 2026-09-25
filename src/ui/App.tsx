// Rotte (FUNZ §1, docs/03_HANDOFF_DESIGN_CODE.md §1): per ora sezioni vuote dentro la shell; le riempie il loro task.
import { LucideProvider } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ProfileMenu } from './ProfileMenu';
import { Section } from './Section';
import { Shell } from './Shell';

export function App() {
  return (
    // Tratto delle icone 1.75 (DESIGN.md §7)
    <LucideProvider strokeWidth={1.75}>
      <BrowserRouter>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Section titolo="oggi" inizio={<ProfileMenu variante="logo" />} />} />
            <Route path="crea" element={<Section titolo="crea" />} />
            <Route path="statistiche" element={<Section titolo="statistiche" />} />
            <Route path="corsi" element={<Section titolo="corsi" />} />
            <Route path="notifiche" element={<Section titolo="notifiche" indietro />} />
            <Route path="impostazioni" element={<Section titolo="impostazioni" indietro />} />
            <Route path="diagnostica" element={<Section titolo="diagnostica" indietro />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </LucideProvider>
  );
}
