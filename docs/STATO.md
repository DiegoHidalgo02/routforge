# RoutForge — Stato dello sviluppo

*Aggiornato dall'agente alla fine di ogni task. Letto automaticamente a inizio sessione (hook SessionStart). Contesto tecnico, non un diario.*

**Data**: 2026-09-29 · **Passo corrente** (CONTESTO §6): 4 — Sessione, aperto con T-016 (setup); poi T-017 (timer) e T-018 (esiti); del passo 2 restano T-040 e T-042 (Modifica) · **Gate**: `npm run verify` verde (500 test, 46 file: typecheck su due tsconfig + lint + formato + test, due file di test della UI in jsdom)

## Fatto
*Una voce per task, la più recente in cima; il dettaglio (file, test, verifiche nel browser, esiti delle revisioni) sta nella riga di `docs/TASKS.md`, nel registro delle decisioni e nel messaggio del commit.*
- **T-016 (29/09)** Setup della sessione (MECC §10.1): `src/domain/session.ts` (`sessionContext`, `startContext`, `studyActions`, `anticipatedBlock`, `lockedUnit`, `courseDefaultUnit`, `startPlan`), `src/app/session.ts` (`startSession` in una transazione con `preferenze.sessioneAttiva`, `anticipateSession`, `abandonSession`, `setupInputs`; il ciclo legge la sessione con `readActiveSession`), `/sessione/setup` e segnaposto `/sessione` con «Abbandona» (`src/ui/Session.tsx`), azioni della sessione nel blocco Adesso e nel footer studio di S5, sottotitolo «corso · Unità n.n». `Blocco.minutiRitardo` e `minutiAnticipo`. D-SESS-1, divergenza 32. Gate 500. Revisioni `spec-reviewer` (conforme con rilievi) e `design-checker` (non fedele alla prima stesura): applicati i rilievi di comportamento e d'impaginazione.
- **T-015 (28/09)** Trascinamento nella vista Giorno (MECC §15, D-DESIGN-1 n. 2, S1 `drag`): `src/domain/drag.ts` (`canDrag`, `dropReferences`, `dropStart`, `dropDays`, `timeOnDay`, `movedBlock`), `moveBlock` con l'annulla protetto (`src/app/drag.ts`), maniglia, blocco del mock nel punto d'inserimento, striscia da oggi durante la presa, toast 5 s e tastiera in `src/ui/Today.tsx`; primo test della UI in jsdom. D-DRAG-1, `docs/00_SINTESI.md` §6 n. 27, divergenza 31, nuovo T-044. Gate 462; tre fusi; mutazione 31/31; browser a 360 (tocco) e 1280 (mouse), en e it. Revisioni `spec-reviewer` e `design-checker` non conformi alla prima stesura: rilievi applicati.
- **T-014 (28/09)** Ritorno dopo un'assenza (MECC §9): `localDaysBetween`, `scheduler/absence.ts`, `registerOpening` da `start()`, banner in Oggi. D-ASSENZA-1, divergenza 30.
- **T-043 (28/09)** Ritocchi di S1 chiesti dall'utente: spunta dal cerchio (D-DETT-3), card in corso e aloni (D-CAL-2), colori di Adesso dal tipo (D-NOW-3), data breve a 360, Mese con la griglia vuota, ordine desktop nel DOM. `docs/00_SINTESI.md` §6 n. 26, divergenze 27–29.
- **T-013 (28/09)** Ciclo dello scheduler (MECC §8, §9, §11): `runCycle` in una transazione, `createScheduler` con la porta `Clock` (avvio, primo piano, ogni minuto, scritture su `ricorrenze`), `useOggi` e `useMinuto`. D-SCHED-1.
- **T-012 (26/09)** Todo che rotolano (MECC §6): `rollPlan`, `lateNoticeDue`, `isRollingTodo`, `Blocco.ritardoIl` e `orarioOriginale`, servizio `rollTodos`. D-HOR-1.
- **T-010 (26/09)** Blocco Adesso in Oggi (`NowBlock.tsx`, servizio `nowBlock.ts`, chiusura in `preferenze.adessoChiuso`). D-NOW-2, divergenza 26 (→ T-040).
- **T-009 (25/09)** Dettaglio S5 su `/attivita/:id` (`completion.ts`, `checklist.ts`, `phases.ts`; unica scrittura del completamento; eliminazione con `dateSaltate` e annulla). D-DETT-1, D-DETT-2, divergenze 23–25, nuovo T-042.
- **T-011 (25/09)** Occorrenze delle routine (MECC §7): `scheduler/occurrences.ts` (id di slot, 28 giorni, `editPlan`, `reanchor`), servizio `recurrences.ts`. D-OCC-1.
- **D-DESIGN-1 (25/09)** Nelle divergenze vince il design (scelta dell'utente): spec allineata, nuovi T-039, T-040, T-041.
- **T-008 (25/09)** Oggi (S1, 10 Mese): Giorno, Settimana e Mese, striscia, fascia senza orario, stati vuoti (`calendar.ts`). D-CAL-1, divergenze 21–22; CP2 approvato dall'utente.
- **T-007 (25/09)** «+ Crea» (S4) su `/crea`: `validateActivity`, `sortDay`, `createActivity`. D-CREA-1.
- **T-038 (25/09)** Profilo → Corsi (S10): esempio, import ZIP con avvisi, titolo se manca `00_struttura`, card con i numeri reali. D-I18N-2.
- **T-006 R (25/09)** Scaffold UI (D-STACK-1): React 19, Vite 7, rotte, icone, font locali, lint React e a11y, `tsconfig.dom.json`, token nel gate, shell S20, i18n. D-UI-1, D-TS-1, D-LINT-1.
- **T-000–T-005 (24–25/09)** Design importato e stack (D-STACK-1, INV-19); dominio puro di T-001; parser del corso (T-002); lettura ZIP (T-003, D-PARSE-3); schema v1 Dexie e repository (T-004, D-DATA-2); corso di esempio salvato (T-005, D-IMPORT-1).
- **Fondamenta (24/09)**: configurazione Claude Code (comandi, subagent, regole per strato), documenti operativi, VS Code (D-IDE-1), audit (`docs/AUDIT_FOUNDATION.md`), strumenti solo di progetto (D-TOOLS-3), export del design in `claude-design/`.

## In corso
- Nessun task in corso.

## Problemi aperti
**Da decidere con l'utente, non bloccanti**
- `docs/00_SINTESI.md` §6 n. 26: la routine persa si spunta dal Dettaglio (B2), non dal cerchio (§24); per ammetterla basta `perso` per la routine in `canCheckFromCalendar`. N. 27: l'orizzonte di un todo trascinato riparte dal giorno nuovo (D-DRAG-1 n. 8).
- Routine creata dopo il suo orario di oggi: l'occorrenza nasce persa e con T-020 partirebbe l'avviso «perso»; tenerlo, non avvisare, o non creare lo slot (D-OCC-1): lo decide T-020.
- Decisioni aperte: D-QUIZ-1 (CP5); D-BACKUP-1, chiave AI nel backup e orologio di `updatedAt` (CP4). Le scelte di D-DESIGN-1 dove il design taceva (n. 5, 10, 13, 14) vanno riviste se Claude Design le precisa; `docs/spec/**` resta in `deny`.

**Obblighi per i prossimi task**
- Sessione attiva (D-SCHED-1, D-SESS-1): la scrivono e la tolgono solo `startSession` e `abandonSession` di `src/app/session.ts`, nella stessa transazione del blocco; T-017 decide chi chiude una sessione rimasta dopo un crash e sostituisce il segnaposto `/sessione` con il timer. Fra inizio ed esito il blocco di studio successivo dello stesso corso riceve la stessa unità (l'unità resta pendente finché T-018 non scrive l'esito). Il ritardo di un recupero di giorni passati è grande: T-029 decide se entra nel ritardo medio. «Anticipa» e l'avvio non riconciliano ancora le notifiche (T-019).
- Blocco Adesso (T-010): per lo studio l'azione è della sessione (T-016), per gli altri tipi «Apri»; la colonna desktop resta vuota sotto il blocco fino a T-040; con `in_corso` e la fine passata i minuti si fermano a 0, e col banner della sessione lo sticky scende di 52 px (T-017); `adessoChiuso`, `ultimaApertura` e `ritornoAssenza` stanno in `preferenze`: se entrano nella sync lo decide T-033.
- Notifiche: gli avvisi «in ritardo» e «perso» partono con T-020 (i todo già spostati o «non fatti» hanno `ritardoIl` e non verranno avvisati); la riconciliazione di T-019 va agganciata anche a modifica ed eliminazione delle routine e a `moveBlock` con il suo annulla.
- `orarioOriginale` va azzerato anche dalla Modifica (T-042). Modificare una routine riscrive le occorrenze future previste: uno spostamento manuale (C4) o un perso ripreso col trascinamento torna al suo slot, o sparisce se lo slot è passato (§7, D-DRAG-1 n. 7); la UI della modifica e dell'eliminazione dell'intera routine è T-042.
- Saltare una singola occorrenza = giorno in `dateSaltate` con `editRecurrence` più `remove` del blocco (un `remove` da solo verrebbe rianimato dalla generazione, D-DATA-2); vale anche per la sync (T-033). La generazione dopo la sync è T-034.
- Errori silenziosi fino alla Diagnostica (T-032, INV-16): cicli falliti, `ricorrenzeSaltate`, query live di `watch` che falliscono (la schermata resta vuota o ferma all'ultimo valore).
- Da verificare su Android con T-021: `visibilitychange` della WebView (altrimenti `@capacitor/app`, anche per il ritorno dopo un'assenza), `Intl` e `Date` insieme al cambio di fuso, costo del ciclo ogni minuto (17–34 ms su desktop con 2.470 blocchi), avvio a pagina nascosta contato come apertura (D-ASSENZA-1).

**UI: limiti noti**
- Oggi: a 320 px con la pill «Oggi» la data breve si tronca in tedesco e portoghese; lo scorrimento touch desktop va provato su iPad (T-036); le righe `Mini` di Settimana e Mese non aprono il Dettaglio (T-040); la vista pronta con 500 blocchi è misurata solo in fake-indexeddb; rilievi di T-008 non applicati (altezze fisse con il testo ingrandito, px della geometria del mock, `rf-in` dal basso).
- Trascinamento (T-015): nessuno scorrimento automatico al bordo dello schermo; il riordino dei todo senza orario è T-044; dopo un rilascio col puntatore il fuoco resta dov'era. Dopo la × del blocco Adesso e del ritorno dopo un'assenza il fuoco torna all'inizio del documento: da risolvere insieme.
- Sessione (T-016): setup e segnaposto `/sessione` mai visti in un browser né provati in altri fusi (in questa sessione il loop non poteva lanciare Edge headless né `powershell.exe` con `TZ`): da controllare a 360, 390 e 1280 e con `TZ` prima di T-017; differenze minori dal mock in `docs/03_HANDOFF_DESIGN_CODE.md` §10 n. 32. Nessuna schermata dell'unità (S12 `/unita/:id`) ha un task: FUNZ §4.2 fa partire «Inizia sessione» e la sessione libera dall'unità, oggi si parte dal blocco Adesso e dal Dettaglio.
- Dettaglio S5: chiudendo il pannello prima dei 5 s dell'«Annulla» l'eliminazione resta; lo studio non ha unità proposta ed esiti fino a T-018; il toast usa la chiave `annulla` dei form («Cancel»), quello del trascinamento `annullaAzione` («Undo»).
- «+ Crea»: la fine della ricorrenza sceglie N fra 1, 2, 4, 8, 12 come il mock; le schermate leggono `Date.now()` (la porta `Clock` è dei servizi, D-SCHED-1 n. 9).
- Corsi S10 (T-038, script in `coverage/cdp-t038.mjs`) e Crea S4 (T-007) mai viste in un browser: da controllare con Edge headless a 390 e 1280; i numeri delle card S10 non sono in `--font-num` e mancano i plurali fino a T-031.
- Test della UI: jsdom c'è da T-015 (`// @vitest-environment jsdom` in testa al file) ma non impagina: `useOggi`, `useMinuto` e il banner del ritorno sono verificati solo nel browser (G4 `parziale`).

**Ambiente e strumenti**
- Nessun remote git: la CI e `/security-review` non hanno mai girato (revisioni manuali; il rischio di un `.md` enorme nello ZIP decompresso in memoria va limitato con T-021).
- `npm audit`: due avvisi moderati su `@vitest/mocker` (correzione solo con Vitest 5); `eslint-plugin-jsx-a11y` usa `overrides` per ESLint 10 (`docs/DIPENDENZE.md`).
- `scripts/loop.sh` risulta modificato su Windows: `git config core.fileMode false` prima di `git add` (se già aggiunto: `git update-index --chmod=+x scripts/loop.sh`).
- Favicon e icone arrivano con CP6 (T-035); `crypto.randomUUID` richiede un contesto sicuro, iOS da verificare in T-036.
- Permessi e strumenti: `.claude/settings.json` e `.claude/hooks/**` in `permissions.ask`; plugin solo di progetto e marketplace di terze parti senza versione fissata (D-TOOLS-2, D-TOOLS-3), da verificare con `/plugin`, `/mcp` e `npm run audit:claude`.

## Divergenze design ↔ spec
- 32 divergenze, elenco e note interne al design in `docs/03_HANDOFF_DESIGN_CODE.md` §10: le prime 22 risolte a favore del design (D-DESIGN-1), 23–25 risolte (D-DETT-1, D-DETT-2), la 26 affidata a T-040, 27–29 scelte dell'utente contro il mock (D-NOW-3, D-CAL-2), la 30 è il testo del ritorno dopo un'assenza (vince il mock), la 31 i suggerimenti del trascinamento (D-DRAG-1), la 32 la scelta della materia nel setup (D-SESS-1, da confermare con l'utente: nel recupero il mock lascia cambiare l'unità). Da segnalare a Claude Design le note interne, il contrasto della maniglia (circa 1,7:1) e l'«Annulla» d'azione non distinto da quello dei form.

## Prossimo task
- T-016 fatto (setup della sessione): `/task next` prende **T-017** (timer, R, Opus 5.5: sostituisce il segnaposto `/sessione`). È sbloccato anche **T-019** (modello notifiche, piano Fable → codice Opus: la riconciliazione entra in `run()` e dopo `moveBlock`). Del passo 2 restano **T-040** (contenuti di S1 e variante «tutto fatto» del blocco Adesso) e **T-042** (Modifica dal Dettaglio).
- **T-037** (eliminazione a cascata), **T-041** (segnaposto M2–M4) e **T-044** (riordino dei todo senza orario) sono sbloccati.

## Checkpoint in attesa
- Nessuno. CP2 (S1 Oggi) **approvato dall’utente il 25/09/2026**, provato dal telefono; T-040 resta da fare e cambierà S1.
