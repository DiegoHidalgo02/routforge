---
paths:
  - "src/ui/**"
---
# Regole per `src/ui` (schermate e componenti)

- Importa da `app` e `domain`; mai da `data` o `platform` (INV-1).
- Nessuna regola di business nei componenti: stati, soglie e transizioni arrivano dai servizi o dal dominio. Il
  comportamento viene dalle spec, l'aspetto dal design importato in `claude-design/` (05/10/2026, D-DESIGN-3) dopo il
  suo handoff per schermata (`docs/03_HANDOFF_DESIGN_CODE.md`; `claude-design/CLAUDE.md` sono le decisioni
  vincolanti del design). Se design e spec divergono vince il design (D-DESIGN-1) e la divergenza va nell'handoff.
- Colori, tipografia, spaziature, raggi e ombre solo dai token di `src/ui/styles/tokens.css` (copia non modificata dei
  token dell'export del design: oggi del vecchio, finché il nuovo handoff non la sostituisce); nessun valore hardcoded.
- Stack (D-STACK-1): React 19 + Vite; componenti `.tsx` con CSS Modules che usano solo `var(--…)`; niente Tailwind né
  stili inline con valori; icone da `lucide-react` (tratto 1.75); font locali (`@fontsource`); rotte con `react-router`.
- Ogni testo visibile è una chiave i18n nelle sei lingue (FUNZ §22), notifiche incluse; i valori del dominio
  (`in_corso`) non si mostrano mai direttamente. La chiave va in tutti e sei i file di `src/ui/i18n/` (un dizionario
  senza una chiave non compila) e si legge con `t()`; la lingua viene solo da `pickLanguage` (MECC §23).
- Mobile sotto 1024 px, desktop da 1024 px (D-UI-1). I keyframe `rf-…` stanno in `tokens.css`, globali: in un CSS
  Module si citano con `global(rf-in)`, altrimenti vengono rinominati e l'animazione sparisce senza errori.
- Il focus è `:root :focus-visible` in `src/ui/styles/global.css` (`--ring-focus`, sopra le ombre dei componenti). Un
  componente che cambia `box-shadow` in `:hover` o `:active` pareggia quella specificità e copre l'anello: gli serve un
  suo `:focus-visible` con `var(--ring-focus)`.
- Riduzione animazioni e scala del testo di sistema sempre rispettate; nessun numero di versione nelle schermate,
  salvo Impostazioni → Informazioni (FUNZ §23, D-DESIGN-1 n. 12).
- Dal pacchetto di design (D-DESIGN-4): fedeltà alta a colori, tipografia, misure, stati, interazioni e animazioni dei
  `.dc.html`, ricreati con i pattern di questo repository e mai copiati (la classe `Component` è la simulazione del
  mock); un componente per ogni voce di `claude-design/docs/COMPONENTI.md`, salvo i nomi già qui; il Panel si scrive
  una volta, con la variante `wide`, e le cornici Mobile e Desktop sono solo layout. Lo stato visivo deriva dal dominio
  e dall'orologio (`claude-design/docs/STATI.md`), mai dalle props dei mock; azioni da `docs/CONTROLLI.md`, aperture da
  `docs/NAVIGAZIONE.md`, valori da `docs/DATI-UI.md`, testi da `docs/TESTI.md` del pacchetto (chiavi piatte come in
  `src/ui/i18n/`, italiano verbatim dai mock).
- Scenografia da non implementare: cornice del telefono, status bar, fondali di S8, S9 e S13, didascalie delle tavole e
  di S8 e S9, collegamenti e parametri dei mock, props e Tweaks (`claude-design/docs/IMPLEMENTAZIONE.md` §3).
- Un valore presente in un mock e assente da `tokens.css` entra prima come token, con il suo uso; un valore che nessun
  mock contiene è una decisione di design: fermati. Un solo primary per vista; cifre in `--font-num`; `--ring-focus` e
  `--ring-focus-danger` su ogni controllo; target ≥ 44 px; scala del testo fino al 200 % senza testo informativo
  tagliato; layout fluidi da 320 e da 1024 (DESIGN §9); anti-pattern di DESIGN §8; percentuali con lo spazio («38 %»).
- Markdown dei corsi, note e risposte AI mostrati senza HTML grezzo; senza chiave AI un errore leggibile e il resto
  funziona; notifiche, widget e sincronizzazione non bloccano mai l'app (l'errore va in Diagnostica).
- Fixture dei confronti con le tavole: `src/data/sample-course/course-data.js` e lo scenario dei mock (mercoledì
  23 settembre 2026, 16:08, settimana 21–27) con l'orologio iniettato; `npm run confronto` fotografa tavola e app alla
  stessa misura.
- Test UI solo dove uno scenario lo richiede (es. G3); gli altri scenari si verificano a livello di servizio.
- Prima di chiudere una schermata: subagent `design-checker` per l'aspetto (con `npm run confronto` sugli stati
  toccati), `spec-reviewer` per il comportamento.
