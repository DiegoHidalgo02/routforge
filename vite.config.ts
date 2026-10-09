/// <reference types="vitest/config" />
// App web (D-STACK-1): `npm run dev`, `npm run build`. I test (Vitest) vivono accanto al codice: ambiente "node" per
// il dominio (più veloce); un test della UI chiede jsdom in testa al file (`// @vitest-environment jsdom`, T-015) e ha
// il JSX di React 19 dal plugin, come la build.
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { version } from './package.json';
import { isAnonKey } from './src/platform/syncSupabase';

export default defineConfig(({ mode }) => {
  // Mai una chiave segreta di Supabase nella build: finirebbe nell'app, e chi la legge scavalca l'RLS (audit P2-21)
  const chiave = loadEnv(mode, process.cwd()).VITE_SUPABASE_ANON_KEY;
  if (chiave && !isAnonKey(chiave))
    throw new Error(
      'VITE_SUPABASE_ANON_KEY non è la chiave anonima di Supabase (Project Settings → API: anon o publishable)',
    );
  return {
    plugins: [react()],
    // La versione dell'app per Impostazioni → Informazioni (FUNZ §23, MECC §23: «dalla build»)
    define: { __VERSIONE__: JSON.stringify(version) },
    // Vite esplora ogni .html della radice in cerca di dipendenze: i mock di claude-design/ restano fuori (D-DESIGN-4)
    optimizeDeps: { entries: ['index.html'] },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
      environment: 'node',
      // I flussi della UI e dei servizi scrivono in IndexedDB e aspettano il ridisegno: su una macchina carica superano
      // i 5 s predefiniti anche quando sono corretti (audit P2-14)
      testTimeout: 20_000,
    },
  };
});
