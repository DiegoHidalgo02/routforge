/// <reference types="vitest/config" />
// App web (D-STACK-1): `npm run dev`, `npm run build`. I test (Vitest) vivono accanto al codice: ambiente "node" per
// il dominio (più veloce); un test della UI chiede jsdom in testa al file (`// @vitest-environment jsdom`, T-015) e ha
// il JSX di React 19 dal plugin, come la build.
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Vite esplora ogni .html della radice in cerca di dipendenze: i mock di claude-design/ restano fuori (D-DESIGN-4)
  optimizeDeps: { entries: ['index.html'] },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
});
