# RoutForge — Registro delle dipendenze

*Ogni pacchetto di `package.json` ha una riga qui, con il motivo e la decisione che lo giustifica. Verificato dal gate
(`scripts/dipendenze.test.mjs`, invariante INV-8): un pacchetto installato senza riga, o con tipo diverso, rende il gate
rosso. Tipi: `runtime` (dependencies) · `dev` (devDependencies) · `prevista` (non ancora installato: entra nel task
indicato, e allora la riga passa a `dev`/`runtime`).*

**Regola per l'agente (D-DEP-1).** Un pacchetto `prevista` si installa nel task indicato senza chiedere: basta aggiornare
la riga. Un pacchetto **non registrato** è una dipendenza non prevista (`docs/06_SUPERVISIONE.md`): prima si scrive la
decisione `D-…` in `docs/01_DECISIONI.md` con motivo e alternative, poi la riga qui, poi `npm install`. In modalità loop,
un pacchetto non registrato è un `BLOCCO:`.

## Installate

| Pacchetto | Tipo | Uso | Motivo | Decisione |
|---|---|---|---|---|
| `typescript` | dev | typecheck (`npm run check`) | TypeScript `strict` è il linguaggio del progetto | D-TEST-1 |
| `vitest` | dev | test (`npm test`), comprese le verifiche architetturali in `scripts/*.test.mjs` | gate unico, ambiente node, test accanto al codice. Due avvisi moderati noti su `@vitest/mocker` (redirect mock del dev server, funzione non usata): correzione disponibile solo con la major 5, da valutare in un task dedicato | D-TEST-1 |
| `eslint`, `@eslint/js`, `typescript-eslint` | dev | lint (`npm run lint`), regole "recommended" | `any`, `@ts-ignore`, variabili inutilizzate verificati dal gate e non solo scritti in CLAUDE.md | D-LINT-1 |
| `prettier` | dev | formato (`npm run format`, `npm run format:check`) | stile uniforme fra modelli e sessioni diverse | D-LINT-1 |
| `fflate` | runtime | `src/app/courseImport.ts` (lettura ZIP), T-003 | estrazione dei `.md` dallo ZIP del corso; piccola, senza dipendenze, stesso codice su web e WebView | D-STACK-1 |
| `dexie` | runtime | `src/data` (schema v1 e repository), T-004 | IndexedDB con stesso codice su web e WebView; id globali e `updatedAt` per la sync. I suoi tipi citano API DOM: senza la lib `DOM` (D-TS-1) restano comunque stretti sui metodi usati (verificato in T-004) | D-DATA-1 |
| `pdfjs-dist` | runtime | `src/platform/pdf.ts` (porta `LettorePdf`), T-024 | testo delle prime 40 pagine dei PDF dell'utente (MECC §17, H2) e pagine del visualizzatore (S13) anche dove il browser o la WebView non mostrano i PDF (Android); il worker è un file a parte, caricato solo quando si apre un PDF; la sua dipendenza opzionale `@napi-rs/canvas` serve solo in Node e non entra nel bundle | D-MAT-1 |
| `fake-indexeddb` | dev | test di `src/data` (`import 'fake-indexeddb/auto'`), T-004 | repository testati senza browser | D-DATA-1 |
| `react`, `react-dom` | runtime | `src/ui` e `src/main.tsx`, T-006 | React 19: la logica dei mock è scritta con l'API di `React.Component`, la traduzione in componenti è meccanica | D-STACK-1 |
| `@types/react`, `@types/react-dom` | dev | tipi di React per `tsconfig.dom.json`, T-006 | typecheck della UI | D-STACK-1 |
| `vite`, `@vitejs/plugin-react` | dev | `npm run dev`, `npm run build` (`vite.config.ts`), T-006; l'import `?raw` del corso di esempio (T-005). Vite resta alla 7 (Vitest 3 accetta fino alla 7: la 8 con Vitest 5, task dedicato), quindi `@vitejs/plugin-react` 5 (la 6 richiede Vite 8) | build, CSS Modules nativi, un solo Vite condiviso con Vitest | D-STACK-1 |
| `react-router` | runtime | `src/ui/App.tsx` (rotte della shell), T-006 | rotte delle sezioni (FUNZ §1) e collegamenti diretti da widget e notifiche (MECC §21) | D-STACK-1 |
| `lucide-react` | runtime | `src/ui`, T-006 | icone Lucide, tratto 1.75, come nel vecchio design: gli stessi glifi senza copiare i tracciati a mano | D-STACK-1 |
| `@capacitor/core`, `@capacitor/android`, `@capacitor/filesystem` | runtime | `src/platform/pdfAndroid.ts` e il progetto `android/` (`cap init`, `cap add android`), T-021 in parte | shell nativa Android (CONTESTO §3); il PDF scritto nella cache dell'app e aperto col visore del sistema dal plugin locale `VisorePdf` (D-MAT-2) | D-STACK-1, D-MAT-2 |
| `@capacitor/local-notifications`, `@capacitor/app` | runtime | `src/platform` (adapter Android della porta `Notifications`, ritorno in primo piano nell'orologio), T-021 | notifiche locali con canali e azioni rapide; il «resume» dell'app, che la WebView non segnala sempre con `visibilitychange` (MECC §13, §9) | D-STACK-1, D-NOTIF-1 |
| `@supabase/supabase-js` | runtime | `src/platform/syncSupabase.ts` (adapter della porta `SyncBackend`), T-033 | il servizio della sync scelto al CP4: accesso con email e codice (OTP), RPC `pull_records`/`push_records`/`revoke_device`, tabella `devices`; MIT, 2.x | D-SYNC-1 |
| `@capacitor-community/keep-awake` | runtime | `src/platform` (porta `ScreenAwake` su Android), T-021 | lo schermo non si spegne durante la sessione (MECC §10.4; sul web Wake Lock API, T-017) | D-STACK-1 |
| `@capacitor/cli` | dev | `npx cap sync android` dopo `npm run build`; `capacitor.config.ts` | copia della build web e dei plugin nel progetto Android | D-STACK-1 |
| `motion` | runtime | `src/ui` (`MotionConfig` in `App.tsx`, spunta disegnata e coriandoli), T-032 | le animazioni seguono Impostazioni → Animazioni anche contro la riduzione del sistema («Sempre»), che nel CSS di `tokens.css` è imposta con `!important`; celebrazioni di FUNZ §23 (scelta dell'utente, 06/10/2026: «per animazioni usiamo Framer Motion») | D-TOOLS-1, D-IMPOST-1 |
| `@fontsource/manrope`, `@fontsource/ibm-plex-mono` | runtime | `src/main.tsx`, T-006 | i font del design impacchettati in locale: l'app è offline (CONTESTO §3), niente Google Fonts | D-STACK-1 |
| `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` | dev | `eslint.config.js`, T-006 | regole degli hook e accessibilità di base nel gate (CONTESTO §3). `jsx-a11y` 6.10.2 dichiara ESLint fino alla 9: `overrides` in `package.json` gli passa ESLint 10 (il suo codice non usa le API rimosse dalla 10, verificato in T-006); l'override si toglie quando il plugin dichiara la 10 | D-LINT-1, D-STACK-1 |
| `jsdom` | dev | ambiente dei test della UI dove uno scenario lo richiede (`// @vitest-environment jsdom` in testa al file; resto della suite in `node`), T-015: `src/ui/Today.test.tsx` (G3) | ambiente DOM per Vitest. Versione 29: la 30 chiede Node 22.22 o 24.15, `engines` di `package.json` dice ancora Node 20 | D-STACK-1 |

## Previste (entrano nel task indicato; stack deciso in T-000, `docs/decisioni/D-STACK-1.md`)

| Pacchetto | Tipo | Uso | Motivo | Decisione |
|---|---|---|---|---|
| `vite-plugin-pwa` | prevista | dev, web installabile (manifest e service worker), T-035: nome e icona arrivano con CP6 | PWA sulla stessa build di Vite | D-STACK-1 |
| `i18next` | prevista | `src/ui`, T-031 | sei lingue da file JSON | D-I18N-1 |
| `@testing-library/react` | prevista | dev, test UI, solo dove uno scenario lo richiede (es. G3) | test di interazione | D-TEST-1 |
