# RoutForge — Stato dello sviluppo

*Aggiornato dall'agente alla fine di ogni task. Letto automaticamente a inizio sessione (hook SessionStart).*

**Data**: 2026-09-22 · **Passo corrente** (CONTESTO §6): 1 — Dati e import del corso · **Gate**: `npm run verify` verde (77 test, 9 file)

## Fatto
- T-001 Dominio puro: `time`, `types`, `sm2` (I1), `streak` (C2), `pomodoro` (D3), `practice` (I2, I3), `pointer` (C1, C2, C3 + moduli bloccati), `lost` (A1, A2, B2, B3, B4, B7, E2, C6), `nowBlock` (G1, G2, E3). Suite eseguita in 4 fusi orari e attraverso il cambio d'ora di ottobre 2026.
- T-002 Parser del corso `src/domain/course/parser.ts` (FORMATO_CORSO §1–§4, MECC §16): H1 e template §2–§3 su fixture sintetiche (20 test). Fedeltà ai file reali M0/M1 e a `course-data.js` rimandata a T-000 (servono i file dell'export).
- Configurazione Claude Code: `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json` (permessi + hook SessionStart/Stop), comandi `/task /verify /scenario /status /handoff`, subagent `spec-reviewer` `test-writer` `design-checker`, skill `routforge-spec`.
- Documenti: `docs/00_SINTESI.md`, `01_DECISIONI.md`, `02_ARCHITETTURA.md` (§0 procedura di scelta dello stack), `03_HANDOFF_DESIGN_CODE.md`, `04_STRUMENTI.md`, `05_LOOP_AGENTICO.md`, `06_SUPERVISIONE.md`, `TASKS.md`; script `scripts/loop.ps1|sh`, `scripts/check-design.mjs`; CI.

- Ambiente di sviluppo: **VS Code** al posto di Ship Studio (D-IDE-1): `.vscode/` con estensioni consigliate, impostazioni e attività; `scripts/loop.ps1` corretto (`$args` → `$claudeArgs`).

## In corso
- Nessun task in corso.

## Problemi aperti
- L'export di Claude Design non è nel repo: `npm run design:check` segnala 45 file mancanti. Serve l'azione dell'utente (`/design` in Claude Code, o Export → ZIP in `design/`). Finché manca, T-000 non può chiudersi e T-003/T-004/T-006 restano in attesa.
- D-QUIZ-1 da confermare al CP5 (criterio Go/No-Go "auto").

## Divergenze design ↔ spec
- (nessuna rilevata: il design non è ancora stato importato)

## Prossimo task
- **T-000** Import del design e scelta dello stack (decide l'agente, `docs/02_ARCHITETTURA.md` §0). Prerequisito: l'utente esegue `/design` nel repo.
- In parallelo, senza dipendenze dal design: **T-011** (generazione occorrenze, MECC §7) e **T-012** (orizzonte todo, MECC §6) sono dominio puro e possono partire subito.

## Checkpoint in attesa
- CP1 (informativo): la decisione sullo stack verrà scritta qui e in `docs/01_DECISIONI.md` alla chiusura di T-000.
