/// <reference types="vitest/config" />
// App web (D-STACK-1): `npm run dev`, `npm run build`. I test (Vitest) vivono accanto al codice: ambiente "node" per
// il dominio (più veloce); un test della UI chiede jsdom in testa al file (`// @vitest-environment jsdom`, T-015) e ha
// il JSX di React 19 dal plugin, come la build.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { version } from './package.json';

export default defineConfig({
  plugins: [react()],
  // La versione dell'app per Impostazioni → Informazioni (FUNZ §23, MECC §23: «dalla build»)
  define: { __VERSIONE__: JSON.stringify(version) },
  // Vite esplora ogni .html della radice in cerca di dipendenze: i mock di claude-design/ restano fuori (D-DESIGN-4)
  optimizeDeps: { entries: ['index.html'] },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
});
