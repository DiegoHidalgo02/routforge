# RoutForge — Stato dello sviluppo

*Aggiornato dall'agente alla fine di ogni task. Letto automaticamente a inizio sessione (hook SessionStart). Contesto tecnico, non un diario.*

**Data**: 2026-09-24 · **Passo corrente** (CONTESTO §6): 1 — Dati e import del corso · **Gate**: `npm run verify` verde (102 test, 14 file: typecheck + lint + formato + test)

## Fatto
- T-001 Dominio puro: `time`, `types`, `sm2` (I1), `streak` (C2), `pomodoro` (D3), `practice` (I2, I3), `pointer` (C1, C2, C3 + moduli bloccati), `lost` (A1, A2, B2, B3, B4, B7, E2, C6), `nowBlock` (G1, G2, E3). Suite eseguita in più fusi orari e attraverso il cambio d'ora di ottobre 2026.
- T-002 Parser del corso `src/domain/course/parser.ts` (FORMATO_CORSO §1–§4, MECC §16): H1 e template §2–§3 su fixture sintetiche (21 test). Fedeltà ai file reali M0/M1 e a `course-data.js` rimandata a T-000 (servono i file dell'export).
- Configurazione Claude Code: `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json` (permessi + hook SessionStart/Stop), comandi `/task /gate /scenario /stato /handoff`, subagent `spec-reviewer` `test-writer` `design-checker`, skill `routforge-spec`, **regole per strato in `.claude/rules/`** (dominio, dati, app, piattaforma, ui, test, docs).
- Documenti: `docs/00_SINTESI.md`, `01_DECISIONI.md` + schede `docs/decisioni/` (D-ARCH-1, D-TIME-1, D-TIME-2, D-DATA-1, D-NAMING-1, D-STACK-1), `02_ARCHITETTURA.md`, `03_HANDOFF_DESIGN_CODE.md`, `04_STRUMENTI.md`, `05_LOOP_AGENTICO.md`, `06_SUPERVISIONE.md`, `TASKS.md`, **`INVARIANTI.md`**, **`TRACCIABILITA.md`** (54 scenari), **`DIPENDENZE.md`**; script `scripts/loop.ps1|sh`, `scripts/check-design.mjs`; CI in cinque fusi (runner + Rome, Los Angeles, Kolkata, Auckland).
- Ambiente di sviluppo: **VS Code** (D-IDE-1) con estensioni, impostazioni (Prettier al salvataggio, ESLint), attività; isolamento degli strumenti (`npm run audit:claude`).
- Audit della foundation, prima passata (24/09, `docs/AUDIT_FOUNDATION.md` §0–§12): vocabolario unico (D-NAMING-1), regola dei moduli unica (D-MODULI-1), test architetturale, rischi di piattaforma, CP0 (D-TIME-2).
- **CP0 deciso (24/09)**: ora locale di parete (D-TIME-2, `docs/decisioni/D-TIME-2.md`); da realizzare in T-004, T-011, T-013, T-019, T-033.
- **Foundation, seconda passata (24/09, `docs/AUDIT_FOUNDATION.md` §13)**: gate esteso a lint e formato (D-LINT-1); lib `DOM` tolta dalla radice e parser senza `URL` (D-TS-1); residui inglesi nel parser corretti; matrice di tracciabilità verificata dal gate (D-TRACC-1); registro delle dipendenze verificato (D-DEP-1); test dei segreti (D-SEC-1); export del design da versionare (D-DESIGN-1); regole per strato (D-RULES-1); revisione indipendente per le modifiche ad alto impatto (D-REVIEW-1); hook robusti; il loop non avvia un task marcato **CPn** finché il checkpoint non è deciso; otto incoerenze documentali corrette (00_SINTESI §6, righe 11–18); T-037 (H3, eliminazione a cascata) aggiunto al backlog.

## In corso
- Nessun task in corso. La seconda passata è nel commit `e67b04e`.

## Problemi aperti
- L'export di Claude Design non è nel repo: `npm run design:check` segnala 45 file mancanti. La cartella di destinazione è `claude-design/` (rinominata il 24/09 per non confonderla con la sottocartella `design/` dell'export). Il progetto Claude Design è raggiungibile dal server MCP `claude-design` e contiene 43 dei 45 file: mancano `spec/M0-Riattivazione_JavaScript.md` e `spec/M1-Tooling_Moderno.md` (corso di esempio, FORMATO §5), da recuperare dall'utente. Import: `/design` in Claude Code, oppure Export → ZIP scompattato in `claude-design/` (guida, Fase 4). Finché manca, T-000 non può chiudersi. L'export va versionato (D-DESIGN-1).
- Plugin di Claude Code: dichiarati nel repository il 24/09 (`.claude/settings.json`: `enabledPlugins` + `extraKnownMarketplaces`): superpowers, ponytail, claude-council, mattpocock-skills, impeccable attivi; security-guidance e frontend-design spenti qui. Alla prossima apertura Claude Code propone di installare i mancanti (ponytail, impeccable): confermare, poi `/plugin` e `npm run audit:claude`. Le copie precedenti del repo sul Desktop hanno registrazioni proprie, irrilevanti per questa cartella.
- `/impeccable init` non è ancora stato eseguito in questa copia del repository: va fatto dopo l'import del design (guida, Fase 4).
- Nessun remote git in questo checkout: la CI non ha mai girato (`gh repo create … --push`, guida Fase 1).
- `scripts/loop.sh` compare sempre come modificato su Windows (bit di esecuzione): `git config core.fileMode false` **prima** di `git add`, così l'indice conserva il modo 100755 e lo script resta eseguibile su macOS/Linux (se già aggiunto: `git update-index --chmod=+x scripts/loop.sh`).
- `npm audit`: due avvisi moderati su `@vitest/mocker` (redirect mock del dev server, non usato); correzione solo con Vitest 5 → task dedicato, non urgente (`docs/DIPENDENZE.md`).
- Permessi di Claude Code: `.claude/settings.json` e `.claude/hooks/**` sono in `permissions.ask` dal 24/09: modificarli richiede una conferma esplicita, anche in modalità loop.
- Marketplace di terze parti dichiarate nel repository (ponytail, hex, impeccable): fiducia esplicita, senza versione fissata (D-TOOLS-2); revocabile mettendo il plugin a `false`.
- Decisioni aperte: D-QUIZ-1 (CP5); D-BACKUP-1 chiave AI nel file di backup e sorgente dell'orologio di `updatedAt` (CP4); D-PARSE-3 numeri duplicati di modulo/unità nello ZIP (prima di T-003).

## Divergenze design ↔ spec
- (nessuna rilevata: il design non è ancora stato importato)

## Prossimo task
- **T-000** Import del design e scelta dello stack (decide l'agente, `docs/02_ARCHITETTURA.md` §0; scheda `docs/decisioni/D-STACK-1.md`). Prerequisito: l'utente esegue `/design` nel repo.
- In parallelo a T-000, senza dipendenze dal design: **T-011** (occorrenze con ora di parete) e poi **T-012** (orizzonte todo) sono dominio puro e possono partire subito (`/task T-011`, modello Opus 5.5). T-003, T-004, T-005 e T-006 attendono T-000.

## Checkpoint in attesa
- CP1 (informativo): la decisione sullo stack verrà scritta qui e in `docs/01_DECISIONI.md` alla chiusura di T-000.
