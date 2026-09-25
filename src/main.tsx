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
import { App } from './ui/App';
import { lingua } from './ui/i18n';

document.documentElement.lang = lingua;

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
