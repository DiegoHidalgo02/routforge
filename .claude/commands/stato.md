---
description: Ricostruisci docs/STATO.md dallo stato reale del repository (git, test, backlog)
allowed-tools: Bash(git status:*), Bash(git log:*), Bash(npm run verify:*)
---
Leggi `git log --oneline -15`, `git status`, esegui `npm run verify` e leggi `docs/TASKS.md`.
Riscrivi `docs/STATO.md` mantenendone la struttura: Fatto · In corso · Problemi aperti · Divergenze design ↔ spec ·
Prossimo task · Checkpoint in attesa. Non cancellare i problemi aperti che non risultano risolti dal codice.
