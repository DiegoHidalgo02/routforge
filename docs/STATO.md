# RoutForge — Stato dello sviluppo

*Aggiornato dall'agente alla fine di ogni task. Letto automaticamente a inizio sessione (hook SessionStart). Contesto tecnico, non un diario.*

**Data**: 2026-09-25 · **Passo corrente** (CONTESTO §6): 1 — Dati e import del corso · **Gate**: `npm run verify` verde (129 test, 18 file: typecheck + lint + formato + test)

## Fatto
- **T-004 R (25/09)** Schema v1 Dexie (`src/data/db.ts`, 19 tabelle, indici di `docs/02_ARCHITETTURA.md` §3) e repository minimi (`src/data/repository.ts`: `save`, `saveBlock`, `remove`, `get`, `list`, `blocksOfDay`); test con `fake-indexeddb` (INV-14 su ogni tabella, v1 e riapertura). **D-DATA-2**: tombstone minima; occorrenza con id deterministico dello slot; ancoraggio di parete derivato da `saveBlock` e conservato se gli istanti non cambiano; log fasi con id = blocco; niente indici booleani. `OraDiParete`, `FaseTemplate`, `Ricorrenza`, `Blocco.ricorrenzaId` in `types.ts`; `localTimeKey` in `time.ts`. Scritto da Opus 5.5 in una sessione parallela; **revisione indipendente** qui (Fable 5.1, `/ponytail-review` più i rilievi del suo `spec-reviewer`): l'indice univoco sull'orario attuale dell'occorrenza avrebbe lasciato passare un duplicato dopo «Anticipa sessione» (C4) → id di slot, nessun indice univoco; log fasi id = blocco; fuso convergente a parità di offset (INV-15); `ambito` senza vocabolario di dominio nel layer dati.
- **T-003 (24/09)** Lettura ZIP nel layer applicativo: `src/app/courseImport.ts` (`importCourseFromZip`, `fflate`) inoltra i file a `parseCourse`, che filtra e appiattisce; `ErroreImportCorso` leggibile per ZIP corrotto o senza moduli; **D-PARSE-3 applicata** (modulo o unità con numero duplicato: il secondo saltato con avviso). H1 end-to-end da uno ZIP reale (`src/app/courseImport.test.ts`) → riga H1 `coperto`. Il titolo chiesto all'utente resta alla UI (T-006, D-PARSE-1). **Rivisto il 25/09**: `unzipSync` decomprime solo i `.md` (opzione `filter` di fflate).
- **T-000 (24/09)** Import del design e stack: export letto per intero; **D-STACK-1 decisa** (React 19 + Vite PWA + Capacitor, Dexie e fflate confermati, CSS Modules su `tokens.css`, `lucide-react`, `@fontsource`, `react-router`: `docs/decisioni/D-STACK-1.md`); handoff verificato (`docs/03_HANDOFF_DESIGN_CODE.md` §9) con 17 divergenze design ↔ spec (§10 dello stesso documento); M0/M1 copiati in `src/data/sample-course/`, letti **senza avvisi** e confrontati con `course-data.js` nel gate (`scripts/corso-esempio.test.mjs`, INV-19; D-PARSE-2 estesa); parser: il separatore `---` resta fuori dal test di fit; decisioni D-SAMPLE-1 e D-TRIVIA-1; revisione del `spec-reviewer` applicata. **Rivisto il 24/09** (`/ponytail-review`): test del corso di esempio ridotto (fixture importato, confronto con `toMatchObject`), divergenze spostate in 03_HANDOFF §10 (questo file sotto il limite dell'hook), `jsdom` rinviato al primo test UI (G3).
- T-001 Dominio puro: `time`, `types`, `sm2` (I1), `streak` (C2), `pomodoro` (D3), `practice` (I2, I3), `pointer` (C1, C2, C3 + moduli bloccati), `lost` (A1, A2, B2, B3, B4, B7, E2, C6), `nowBlock` (G1, G2, E3). Suite eseguita in più fusi orari e attraverso il cambio d'ora di ottobre 2026.
- T-002 Parser del corso `src/domain/course/parser.ts` (FORMATO_CORSO §1–§4, MECC §16): H1 e template §2–§3 su fixture sintetiche (21 test); fedeltà ai file reali M0/M1 e a `course-data.js` verificata in T-000.
- Configurazione Claude Code: `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json` (permessi + hook SessionStart/Stop), comandi `/task /gate /scenario /stato /handoff`, subagent `spec-reviewer` `test-writer` `design-checker`, skill `routforge-spec`, **regole per strato in `.claude/rules/`** (dominio, dati, app, piattaforma, ui, test, docs).
- Documenti: `docs/00_SINTESI.md`, `01_DECISIONI.md` + schede `docs/decisioni/` (D-ARCH-1, D-TIME-1, D-TIME-2, D-DATA-1, D-NAMING-1, D-STACK-1), `02_ARCHITETTURA.md`, `03_HANDOFF_DESIGN_CODE.md`, `04_STRUMENTI.md`, `05_LOOP_AGENTICO.md`, `06_SUPERVISIONE.md`, `TASKS.md`, **`INVARIANTI.md`**, **`TRACCIABILITA.md`** (54 scenari), **`DIPENDENZE.md`**; script `scripts/loop.ps1|sh`, `scripts/check-design.mjs`; CI in cinque fusi (runner + Rome, Los Angeles, Kolkata, Auckland).
- Ambiente di sviluppo: **VS Code** (D-IDE-1) con estensioni, impostazioni (Prettier al salvataggio, ESLint), attività; isolamento degli strumenti (`npm run audit:claude`).
- Audit della foundation, prima passata (24/09, `docs/AUDIT_FOUNDATION.md` §0–§12): vocabolario unico (D-NAMING-1), regola dei moduli unica (D-MODULI-1), test architetturale, rischi di piattaforma, CP0 (D-TIME-2).
- **CP0 deciso (24/09)**: ora locale di parete (D-TIME-2, `docs/decisioni/D-TIME-2.md`); da realizzare in T-004, T-011, T-013, T-019, T-033.
- **Foundation, seconda passata (24/09, `docs/AUDIT_FOUNDATION.md` §13)**: gate esteso a lint e formato (D-LINT-1); lib `DOM` tolta dalla radice e parser senza `URL` (D-TS-1); residui inglesi nel parser corretti; matrice di tracciabilità verificata dal gate (D-TRACC-1); registro delle dipendenze verificato (D-DEP-1); test dei segreti (D-SEC-1); export del design versionato (D-DESIGN-1); regole per strato (D-RULES-1); revisione indipendente per le modifiche ad alto impatto (D-REVIEW-1); hook robusti; il loop non avvia un task marcato **CPn** finché il checkpoint non è deciso; otto incoerenze documentali corrette (00_SINTESI §6, righe 11–18); T-037 (H3, eliminazione a cascata) aggiunto al backlog.
- Strumenti solo di progetto (D-TOOLS-3, 24/09) e export del design versionato (`claude-design/`, 45/45 file, D-DESIGN-1).

## In corso
- Nessun task in corso.

## Problemi aperti
- Export di Claude Design versionato in `claude-design/`: `npm run design:check` = 46 presenti, 45 attesi, 0 mancanti (il file in più è il README del repository).
- Font: i mock caricano Manrope e IBM Plex Mono da Google Fonts; l'app li impacchetta in locale con `@fontsource` (D-STACK-1, T-006).
- Archiviazione persistente (`navigator.storage.persist()`, D-DATA-1) rinviata a T-006: serve la lib `DOM` e l'avvio dell'app; stato in Diagnostica in T-032.
- `crypto.randomUUID` (id dei record, `src/data/repository.ts`) richiede un contesto sicuro: ok su https, localhost e WebView Android; iOS da verificare in T-036.
- Strumenti solo di progetto (D-TOOLS-3, 24/09): plugin superpowers, ponytail, claude-council, mattpocock-skills, impeccable installati in ambito project per questa cartella e spenti a livello utente; skill Graphify in `.claude/skills/graphify/`; connettori claude.ai e Claude in Chrome spenti qui (`disabledMcpServers`). Verificare in una sessione nuova con `/plugin`, `/mcp`, `/context` e `npm run audit:claude`. Se `/mcp` mostra ancora i connettori, spegnerli da lì.
- `/impeccable init` eseguito (24/09): `PRODUCT.md` alla radice (utenti: studenti in generale; posizione: studio e vita in un calendario; piattaforma `web`, un solo linguaggio visivo). DESIGN.md di impeccable non scritto: l'aspetto resta in `claude-design/`.
- Nessun remote git in questo checkout: la CI non ha mai girato (`gh repo create … --push`, guida Fase 1).
- `scripts/loop.sh` compare sempre come modificato su Windows (bit di esecuzione): `git config core.fileMode false` **prima** di `git add`, così l'indice conserva il modo 100755 e lo script resta eseguibile su macOS/Linux (se già aggiunto: `git update-index --chmod=+x scripts/loop.sh`).
- `npm audit`: due avvisi moderati su `@vitest/mocker` (redirect mock del dev server, non usato); correzione solo con Vitest 5 → task dedicato, non urgente (`docs/DIPENDENZE.md`).
- Permessi di Claude Code: `.claude/settings.json` e `.claude/hooks/**` sono in `permissions.ask` dal 24/09: modificarli richiede una conferma esplicita, anche in modalità loop.
- Marketplace di terze parti dichiarate nel repository (ponytail, hex, impeccable): fiducia esplicita, senza versione fissata (D-TOOLS-2); revocabile mettendo il plugin a `false`.
- Decisioni aperte: D-QUIZ-1 (CP5); D-BACKUP-1 chiave AI nel file di backup e sorgente dell'orologio di `updatedAt` (CP4).

## Divergenze design ↔ spec
- 17 divergenze rilevate in T-000 (24/09/2026), più note interne al design: elenco in `docs/03_HANDOFF_DESIGN_CODE.md` §10. Vince la spec: il codice segue le righe di §1 dello stesso documento; i mock vanno corretti in Claude Design e reimportati (`/design-sync`).

## Prossimo task
- **T-005** (Sonnet 5): corso di esempio nell'app; T-003 e T-004 fatti.
- In parallelo, dominio puro: **T-011** (Opus 5.5; il formato dell'id di slot delle occorrenze si fissa lì, D-DATA-2) e poi **T-012**.
- T-006 è sbloccato (T-004 fatto): l'utente può ancora porre il veto sullo stack (CP1) prima che parta.

## Checkpoint in attesa
- CP1 (informativo): D-STACK-1 scritta (`docs/decisioni/D-STACK-1.md`, riga in `docs/01_DECISIONI.md`); l'utente può porre il veto prima di T-006; senza risposta la decisione vale.
