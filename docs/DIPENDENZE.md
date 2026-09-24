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

## Previste (entrano nel task indicato; stack deciso in T-000, `docs/decisioni/D-STACK-1.md`)

| Pacchetto | Tipo | Uso | Motivo | Decisione |
|---|---|---|---|---|
| `dexie` | prevista | `src/data`, T-004 | IndexedDB con stesso codice su web e WebView; id globali e `updatedAt` per la sync | D-DATA-1 |
| `fake-indexeddb` | prevista | dev, test di `src/data`, T-004 | repository testati senza browser | D-DATA-1 |
| `fflate` | prevista | `src/app` (lettura ZIP), T-003 | estrazione dei `.md` dallo ZIP del corso; piccola, senza dipendenze, stesso codice su web e WebView | D-STACK-1 |
| `react`, `react-dom`, `@types/react`, `@types/react-dom` | prevista | `src/ui`, T-006 | React 19: la logica dei mock è scritta con l'API di `React.Component`, la traduzione in componenti è meccanica | D-STACK-1 |
| `vite`, `@vitejs/plugin-react`, `vite-plugin-pwa` | prevista | dev, build e PWA, T-006 e T-035 | build, CSS Modules nativi e web installabile | D-STACK-1 |
| `react-router` | prevista | `src/ui`, T-006 | rotte di `docs/03_HANDOFF_DESIGN_CODE.md` §1 e collegamenti diretti da widget e notifiche (MECC §21) | D-STACK-1 |
| `lucide-react` | prevista | `src/ui`, T-006 | icone Lucide, tratto 1.75 (DESIGN.md §7): gli stessi glifi dei mock, senza copiare i tracciati a mano | D-STACK-1 |
| `@fontsource/manrope`, `@fontsource/ibm-plex-mono` | prevista | `src/ui`, T-006 | i font del design impacchettati in locale: l'app è offline (CONTESTO §3), niente Google Fonts | D-STACK-1 |
| `jsdom` | prevista | dev, test UI, T-006 | ambiente DOM per Vitest, solo nei test che uno scenario richiede (es. G3) | D-STACK-1 |
| `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` | prevista | dev, T-006 | regole degli hook e accessibilità di base nel gate (CONTESTO §3) | D-LINT-1, D-STACK-1 |
| `@capacitor/core`, `@capacitor/cli`, `@capacitor/app`, `@capacitor/local-notifications`, `@capacitor/filesystem`, `@capacitor/haptics` | prevista | `src/platform`, T-006 e T-021 | shell nativa Android/iOS e capacità richieste da CONTESTO §3 | D-STACK-1 |
| `@capacitor-community/text-to-speech` | prevista | `src/platform`, T-028 | Audio Flash-Trivia (MECC §18) | D-STACK-1 |
| `@google/genai` | prevista | `src/platform` (client AI), T-026 | fornitore Gemini scelto dalle spec | D-AI-1 |
| `i18next` | prevista | `src/ui`, T-031 | sei lingue da file JSON | D-I18N-1 |
| `motion` | prevista | `src/ui`, da T-006 solo dove il design lo prevede | animazioni e celebrazioni (FUNZ §23) | D-TOOLS-1 |
| `@testing-library/react` | prevista | dev, test UI, solo dove uno scenario lo richiede (es. G3) | test di interazione | D-TEST-1 |
