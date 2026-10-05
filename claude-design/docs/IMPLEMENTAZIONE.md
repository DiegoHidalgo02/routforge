# RoutForge — Dal design al codice

Come si legge l'export del design, cosa è prodotto e cosa scenografia, in che ordine si implementa e come si verifica. Il comportamento è in `spec/`; le decisioni che vincono su tutto in `CLAUDE.md`.

## 1. Quale documento risponde a quale domanda

| Domanda | Documento |
|---|---|
| Cosa fa l'app e con quali regole | `spec/RoutForge_FUNZIONALITA.md`, `spec/RoutForge_MECCANISMI.md`, `spec/RoutForge_SCENARI.md` |
| Quali decisioni vincono | `CLAUDE.md` |
| Quali schermate e stati esistono | `HANDOFF.md` (mappa degli stati), `docs/COPERTURA.md` |
| Che aspetto hanno | `design/DESIGN.md`, `design/tokens.css`, `RoutForge Design System.dc.html` |
| Quali componenti costruire | `docs/COMPONENTI.md` |
| Cosa apre cosa | `docs/NAVIGAZIONE.md` |
| Come cambiano gli stati | `docs/STATI.md` |
| Cosa fa ogni bottone | `docs/CONTROLLI.md` |
| Da dove viene ogni valore mostrato | `docs/DATI-UI.md` |
| Testi, formati, notifiche | `docs/TESTI.md` |

## 2. Come si legge un file `.dc.html`

Ogni file si apre nel browser e ha due parti.

**Template** (fra `<x-dc>` e `</x-dc>`): HTML con stili inline, che sono la specifica esatta di misure, colori, raggi e ombre.
- `{{ nome }}`: valore calcolato dalla logica (`renderVals()`).
- `<sc-if value="{{ x }}">`: blocco mostrato se `x` è vero. `<sc-for list="{{ righe }}" as="r">`: ripetizione.
- `style-hover`, `style-active`, `style-focus`: stati di interazione.
- `<dc-import name="S5 Dettaglio Panel" kind="todo">`: componente figlio con le sue props (kebab-case nel template, camelCase nella logica).
- `data-screen-label`: nome del pezzo, lo stesso delle didascalie delle tavole e dei commenti di revisione.

**Logica** (`<script data-dc-script>`): una classe `Component` con `state`, `renderVals()` e gli handler. Simula il comportamento quanto basta a mostrare gli stati (timer dei toast, apertura dei fogli, form). Le regole vere sono in MECCANISMI.

**`data-props`** sul tag script: il catalogo degli stati del componente. Ogni prop `enum` elenca gli stati disegnati; le tavole `0N` li montano uno per uno.

`@keyframes` nel `<helmet>` hanno gli stessi nomi di `tokens.css`. `support.js` è il motore di anteprima e non fa parte del prodotto. I file sono riferimenti da ricreare con i pattern del repository, non codice da copiare.

## 3. Prodotto o scenografia

| Nel mock | Nel prodotto |
|---|---|
| Cornice del telefono 390×844, raggio 44 | viewport reale con safe area |
| S8 Sveglia | sveglia a schermo intero del sistema (solo mobile) con i contenuti e le azioni di S8; le note sotto i tasti sono didascalie |
| S9 Notifiche di sistema | notifiche native: il mock fissa titolo, testo, azioni, canale e ordine; la forma è del sistema. L'etichetta del trigger a destra di ogni card («5 min prima», «verifica · metà durata») è una didascalia |
| S13 Widget sul fondale | widget Android 4×2; il fondale è scenografia |
| Scenario: oggi mer 23 set 2026, corso importato il 16 set, puntatore 0.7, M0 6 / 9 con Go/No-Go 7 / 7, 3 esiti da registrare | dati reali; lo scenario resta come fixture per riprodurre le tavole (`docs/DATI-UI.md`) |
| Toast con timer locale, form che non salvano, spinner fermo | scrittura reale, «Annulla» che ripristina, stato reale della richiesta |
| Props e Tweaks delle tavole (`now`, `view`, `state`…) | non esistono: lo stato viene dai dati e dall'orologio (`docs/STATI.md`) |
| Testi italiani nel markup | chiavi del dizionario in sei lingue (`docs/TESTI.md`) |

- **Collegamenti del prototipo**: i link fra le schermate e i parametri dell'indirizzo (`?dopo=sessione`, `?nuovo=…`, `?sessione=1`, `?view=…`) servono solo a percorrere i mock in fila (NAVIGAZIONE §10). Nell'app sono navigazione e stato condiviso. I tempi del ciclo di completamento (560 + 260 ms) e le Celebrazioni invece sono prodotto (DESIGN §6).

## 4. Dal mock al componente

1. Un componente del prodotto per ogni voce di `docs/COMPONENTI.md`; le varianti sono le props del mock.
2. Il **Panel** è il contenuto, le cornici Mobile e Desktop sono layout: il contenuto si implementa una volta, con la variante `wide` per il desktop.
3. Nessun valore fuori da `tokens.css` (variabili CSS o tema Tailwind `@theme`). Un valore nuovo entra prima come token, con il suo uso.
4. Lo stato visivo si ricava dallo stato di dominio con le regole di `docs/STATI.md`: la prop `state` di S5, per esempio, viene dallo stato del blocco, dal giorno e dall'orologio.
5. Ogni azione segue `docs/CONTROLLI.md`, ogni apertura `docs/NAVIGAZIONE.md`, ogni valore `docs/DATI-UI.md`, ogni testo `docs/TESTI.md`.
6. Sull'aspetto, in caso di dubbio, vince il file `.dc.html`; sul comportamento vince `CLAUDE.md`, poi `spec/`.

## 5. Ordine di costruzione

L'ordine è quello di CONTESTO §6. Per ogni passo, cosa del design serve e quali scenari lo chiudono.

| Passo | Schermate e stati | Componenti principali | Scenari |
|---|---|---|---|
| 1 Dati e import del corso | S10 `empty` `importing` `warnings` `error` `list` · S11 Corso e Modulo · S12 `unitState` | CourseCard, ImportCard, ModuleGroup, UnitAccordion, GoNoGoChecklist, CoreConcept, ResourceRow | C1, H1, H3 |
| 2 Attività e calendario | S1 giorno, settimana, mese, vuoti, archivio, `variant=done` · S4 quattro tipi, `mode=edit`, `due`, `reminder` · S5 `kind` × `state`, `review`, `followup`, `remaining`, `delete`, `deleted` | ActivityCard, Timeline, WeekStrip, MonthGrid, ArchiveDeck, DayClosedCard, CreateSheet, DetailPanel, ReviewSheet, Toast | A1–A6, B2, B4–B6, E1–E3 · A7 · G5 |
| 3 Scheduler | S1 persi e «non fatto» · S5 `perso` `recupera` `altro-giorno` · AbsenceBanner | — | A1, A2, B1, B3, B7, C8, G4 |
| 4 Sessione | S15 tutti gli stati · banner e carta «Sessione in corso» · S5 studio | SetupPanel, TimerRing, PomodoroSegments, DebriefSheet, HyperfocusTimer, SessionShell | C2–C9, D1–D7 |
| 5 Notifiche | S9 · S8 · S21 · S22 `notifications` `notifications-denied` | AlarmScreen, PendingOutcomeRow | A4, A6, C6, F1–F7 |
| 6 Adesso, riordino, Notifiche, widget | S1 `now` · `nowKind` · `sheet` voci · fasi · esito · `drag=lift` · `move=attivo` (mobile) · `move` hover · focus (desktop) · S21 · S13 `widget` | HeroCard, CheckControl, RemainingSheet, PhaseReviewSheet, EsitoSheet, DragLift, ReorderBar, ReorderArrows, HomeWidget | G1–G4 · C10 |
| 7 Materiali e AI | S12 `material` `genState` · S13 `pdf` `pdf-scan` · S19 tutti gli stati | MaterialForm, PdfViewer, PracticeGenerator, Flashcard, QuizQuestion, DevSwipeCard, BugHunterCode, TriviaPlayer, ChatThread | H2, H4, H5, I1–I4 |
| 8 Statistiche | S20 quattro tab, `period`, `empty` | StatCard, PeriodSegmented, Heatmap | — |
| 9 Backup, lingua, impostazioni, diagnostica | S22 `root` `ai` `ai-nokey` `backup` `backup-export` `backup-erase` `diagnostics` | SettingsGroup, SettingsRow, InlineConfirm | — |
| 10 Sincronizzazione | S22 `login` `login-code` `account` `account-offline` `account-conflict` `account-erase` | SyncStatus, DeviceRow, CodeInput | J1–J5 |

## 6. Verifica

- Per ogni riga della mappa degli stati di `HANDOFF.md`, la schermata del prodotto confrontata con la tavola alla stessa misura (390×844 mobile, 1280×800 desktop).
- Fixture: `design/course-data.js` e lo scenario riproducono le tavole.
- Controlli trasversali: un solo primary per vista; cifre in font-num; focus visibile; con riduzione animazioni solo dissolvenze; scala del testo di sistema fino al 200 % senza testo informativo tagliato; target ≥ 44 px.
- Gli scenari di `spec/RoutForge_SCENARI.md` restano i criteri di accettazione; `docs/COPERTURA.md` dice dove ognuno si vede.

## 7. Blocchi da risolvere

In `docs/BLOCCHI.md`: sono gli unici punti non definiti. Tutto il resto è definitivo.
