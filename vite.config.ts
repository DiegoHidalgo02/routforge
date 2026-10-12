/// <reference types="vitest/config" />
// App web (D-STACK-1): `npm run dev`, `npm run build`. I test (Vitest) vivono accanto al codice: ambiente "node" per
// il dominio (più veloce); un test della UI chiede jsdom in testa al file (`// @vitest-environment jsdom`, T-015) e ha
// il JSX di React 19 dal plugin, come la build.
import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { version } from './package.json';
import { isAnonKey } from './src/platform/syncSupabase';

/** Un colore dei token del design (INV-20): il manifest non legge il CSS. */
const token = (nome: string): string => {
  const m = new RegExp(`--${nome}:\\s*(#[0-9A-Fa-f]{6})`).exec(readFileSync('claude-design/design/tokens.css', 'utf8'));
  if (!m?.[1]) throw new Error(`token --${nome} non trovato in claude-design/design/tokens.css`);
  return m[1];
};

/**
 * Le intestazioni del deploy web (audit C-9; D-RILASCIO-1), scritte in `dist/_headers` a ogni build: le leggono
 * Cloudflare Pages e Netlify, gli altri host le ignorano. La rete va solo all'app, a Gemini e al progetto Supabase della
 * build, se c'è: un codice iniettato non potrebbe spedire chiave AI e sessione a un altro progetto. Il wasm è di pdf.js;
 * Vite incorpora come `data:` i font sotto i 4 KB.
 */
const intestazioni = (supabase: string | undefined): string => {
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' https://generativelanguage.googleapis.com${supabase ? ` ${new URL(supabase).origin}` : ''}`,
    'frame-src https://www.youtube-nocookie.com',
    "worker-src 'self' blob:",
    "media-src 'self' blob: data:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
  return [
    '/*',
    `  Content-Security-Policy: ${csp}`,
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()',
    '',
  ].join('\n');
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());
  // Mai una chiave segreta di Supabase nella build: finirebbe nell'app, e chi la legge scavalca l'RLS (audit P2-21)
  const chiave = env.VITE_SUPABASE_ANON_KEY;
  if (chiave && !isAnonKey(chiave))
    throw new Error(
      'VITE_SUPABASE_ANON_KEY non è la chiave anonima di Supabase (Project Settings → API: anon o publishable)',
    );
  return {
    plugins: [
      react(),
      {
        name: 'routforge-intestazioni',
        apply: 'build',
        generateBundle() {
          this.emitFile({ type: 'asset', fileName: '_headers', source: intestazioni(env.VITE_SUPABASE_URL) });
        },
      },
      // Web installabile e offline (CONTESTO §3; T-035, D-RILASCIO-1): manifest e service worker di Workbox con tutti i
      // file della build in cache. Dopo un nuovo deploy il service worker nuovo prende subito il controllo
      // (`skipWaiting`, `clientsClaim`: con `injectRegister: false` il plugin non li mette da solo) e la pagina si
      // ricarica. Lo registra `src/platform/pwa.ts`, solo nel browser: nell'app Capacitor i file arrivano dall'APK.
      VitePWA({
        injectRegister: false,
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
        manifest: {
          name: 'RoutForge',
          short_name: 'RoutForge',
          description: 'Calendar, scheduler and study sessions that move a course forward',
          display: 'standalone',
          theme_color: token('color-bg'),
          background_color: token('color-bg'),
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Tutto offline salvo AI e sync (CONTESTO §3): anche il worker di pdf.js e i font; il bundle principale supera
          // i 2 MiB predefiniti di Workbox con margine
          globPatterns: ['**/*.{js,mjs,css,html,woff2,svg,png}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
          navigateFallback: 'index.html',
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
        },
      }),
    ],
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
