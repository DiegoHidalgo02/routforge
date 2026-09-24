# D-STACK-1 — Stack applicativo (UI, build, shell nativa)

**Stato**: decisa il 24/09/2026 (T-000, dopo la lettura completa dell'export del design); si applica da T-006. Veto
dell'utente possibile prima di T-006 (CP1, `docs/06_SUPERVISIONE.md`). Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto

Tre piattaforme con lo stesso codice (CONTESTO §3); l'aspetto è definito dall'export di Claude Design (`tokens.css`,
HTML delle schermate, `support.js`); servono notifiche in background, sveglie a schermo intero, Non Disturbare, widget
Android, sintesi vocale, file system. L'autore è uno sviluppatore front-end web. Il dominio è TypeScript puro e non
dipende dalla scelta.

## Cosa dice l'export (letto in T-000: HANDOFF, DESIGN.md, tokens.css, support.js, course-data.js, 42 schermate, catalogo)

- Le schermate `.dc.html` sono template HTML con **stili inline** (valori esadecimali, non i token), interpolazione
  `{{ }}`, `sc-if`/`sc-for`, pseudo-attributi `style-hover`; in coda una classe `Component extends DCLogic` con
  `renderVals()` e ciclo di vita **alla React** (`setState`, `componentDidMount`, `React.createElement` per le icone).
  Il motore `support.js` è React 18 da CDN più Babel: serve solo all'anteprima (HANDOFF: «non fa parte del prodotto»).
- `tokens.css` sono custom properties CSS in `:root` più i keyframe; «Tailwind @theme o equivalente» è un suggerimento:
  nessuna schermata usa classi Tailwind.
- I font (Manrope, IBM Plex Mono) arrivano da Google Fonts nei mock; l'app è offline (CONTESTO §3), quindi vanno
  impacchettati.
- Ogni schermata è un Panel riusato da una cornice Mobile (390×844, navbar) e una Desktop (sidebar 240, pannello 440):
  la stessa scomposizione in componenti che avrà l'app.
- HANDOFF: «usare framework e librerie già presenti nel repository; se il progetto è nuovo, uno stack adatto a un'app
  mobile-first con layout desktop a sidebar»; i file `.dc.html` «non sono codice da copiare: vanno ricreati con i
  pattern del repository di destinazione».

## Decisione

Candidato **A** di `docs/02_ARCHITETTURA.md` §0: **TypeScript strict + React 19 + Vite** (web installabile con
`vite-plugin-pwa`) **+ Capacitor** per Android e iOS; persistenza **Dexie** (D-DATA-1 confermata); lettura ZIP con
**fflate**. Dettagli che discendono dal design, fissati qui:

- **Stili**: `tokens.css` copiato tal quale in `src/ui/styles/` e **CSS Modules** (nativi di Vite, nessun pacchetto) che
  usano solo `var(--…)`. Niente Tailwind (i mock non lo usano: sarebbe una dipendenza e un secondo vocabolario per gli
  stessi valori); niente stili inline con valori (i mock li hanno solo perché l'anteprima non ha un foglio di stile).
- **Icone**: `lucide-react` (DESIGN.md §7: Lucide, tratto 1.75; i tracciati inline dei mock sono gli stessi glifi).
- **Font**: `@fontsource/manrope` e `@fontsource/ibm-plex-mono` (file locali, licenza OFL): nessuna richiesta di rete.
- **Rotte**: `react-router` in modalità libreria, con le rotte di `docs/03_HANDOFF_DESIGN_CODE.md` §1 e i collegamenti
  diretti da widget e notifiche (MECC §21); dettaglio, crea, sessione e AI sono pannello laterale su desktop e schermata
  intera su mobile: stessa rotta, layout diverso.
- **Test UI**: Vitest + `@testing-library/react` + `jsdom`, solo dove uno scenario lo richiede (G3); il resto si verifica
  a livello di servizio (regole di `src/app`).
- **Lint**: `eslint-plugin-react-hooks` e `eslint-plugin-jsx-a11y` entrano nel gate in T-006 (D-LINT-1).
- **Stato della UI**: rinviato a T-006 (`docs/02_ARCHITETTURA.md` §5); candidati `dexie-react-hooks` (`useLiveQuery`)
  o Zustand.

## Motivazione (criteri di `docs/02_ARCHITETTURA.md` §0, in ordine di peso)

1. **Riuso del design**: ciò che si riusa è `tokens.css` (CSS puro), misure, colori e stati letti dai mock, e la logica
   delle classi `Component`, scritta con l'API di `React.Component`: la traduzione in componenti React è meccanica.
   Vue o Svelte obbligherebbero a riscrivere anche la logica dei mock; Tailwind non aggiungerebbe riuso perché non ci
   sono classi da riprendere.
2. **Tre piattaforme, un codice**: Vite + Capacitor = una base web che gira in WebView e come PWA; il dominio puro
   resta identico ovunque.
3. **Capacità native**: plugin ufficiali o della community per notifiche locali, filesystem, aptica, TTS; sveglie a
   schermo intero, Non Disturbare e widget richiedono un plugin proprio (T-021, T-023) con qualsiasi stack web, e
   codice nativo anche con React Native o Flutter.
4. **Testabilità**: invariata (dominio puro, porte finte, `jsdom` solo dove serve).
5. **Semplicità e competenze**: autore front-end web; React è lo stack con più esempi per i quattro modelli che
   scrivono il codice (Haiku e Sonnet per la UI, D-MODEL-1); documenti, regole di strato e subagent (`design-checker`)
   erano già scritti per il candidato A: costo di adattamento minimo.
6. **Reattività**: Vite divide il codice per rotta; «Oggi» in < 0,5 s dipende dall'indice `giornoLocale` (D-DATA-1),
   non dal framework.

## Alternative scartate

- **B. Vue/Svelte + Vite + Capacitor**: `sc-if`/`sc-for` somigliano ai template di Vue, ma la logica dei mock è React e
  HANDOFF chiede di ricreare, non copiare; Svelte 5 produrrebbe meno codice ma con più variabilità fra modelli;
  entrambi costringono a riscrivere documenti, regole e subagent. Nessun criterio li fa vincere.
- **C. React Native/Expo**: riuso del design quasi nullo (niente CSS né `tokens.css` diretto), web via
  `react-native-web` con differenze di resa; widget e sveglie restano nativi.
- **D. Flutter**: riscrittura completa dell'aspetto e del dominio (Dart).
- **Tailwind sopra `tokens.css`**: dipendenza e passo di build in più per valori già espressi come custom properties.
- **Icone copiate a mano dai mock**: più di quaranta tracciati da mantenere; `lucide-react` è la stessa libreria.

## Conseguenze

- `docs/DIPENDENZE.md`: righe «previste» confermate e completate (router, icone, font, plugin ESLint): entrano in T-006
  senza altre decisioni (D-DEP-1); `jsdom` e `@testing-library/react` solo con il primo test UI richiesto da uno scenario (G3).
- `docs/02_ARCHITETTURA.md` §0, §1, §3, §5, §6, §7 e `.claude/rules/ui.md`, `.claude/rules/piattaforma.md` aggiornati.
- `tsconfig` separato per `ui` e `platform` con lib `DOM` (D-TS-1) in T-006.
- D-DATA-1 confermata; D-I18N-1 invariata (libreria decisa in T-031).
- Vincoli per T-006 e per ogni schermata: nessun valore fuori da `tokens.css`; font locali; `prefers-reduced-motion`;
  focus visibile (`--ring-focus`); nessun numero di versione nelle schermate (FUNZ §23).
- Se il veto dell'utente cambia lo stack prima di T-006, si aggiornano solo le righe previste e i documenti citati:
  nessun codice dipende ancora dalla scelta.

## Verifica

`npm run design:check` verde (46 file presenti, 45 attesi, 0 mancanti). In T-006: `npm run dev` parte, `npm run verify`
verde con le regole React, `design-checker` su ogni schermata.
