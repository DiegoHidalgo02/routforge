# RoutForge

App personale di organizzazione e studio: calendario con quattro tipi di attività, scheduler automatico,
sessioni di studio con esiti che fanno avanzare un corso, promemoria, pratica generata dall'AI, statistiche,
sincronizzazione fra dispositivi. Android · iOS · web installabile. Dati sul dispositivo, offline salvo AI e sync.

## Stato
Passo 1 di 10 (CONTESTO §6). Foundation verificata e protetta dal gate (`docs/AUDIT_FOUNDATION.md`); dominio puro testato sugli scenari. Vedi `docs/STATO.md`.

## Avvio rapido
```bash
npm ci
npm run verify          # gate unico: typecheck + lint + formato + test (dominio e regole del repository)
npm run design:check    # verifica l'export di Claude Design in design/
claude                  # Claude Code: poi /task next
```
In VS Code: apri la cartella e accetta le estensioni consigliate; `Ctrl+Shift+B` esegue il gate.

## Mappa del repository
- `docs/spec/` — le cinque specifiche (fonte di verità, sola lettura)
- `docs/00_SINTESI.md` … `06_SUPERVISIONE.md`, `TASKS.md`, `STATO.md` — base di progetto operativa
- `docs/INVARIANTI.md` — cosa deve restare vero e come lo verifica il gate
- `docs/TRACCIABILITA.md` — i 54 scenari: regole, dove vivono, task, test, stato
- `docs/DIPENDENZE.md` — registro dei pacchetti con motivo e decisione
- `docs/01_DECISIONI.md` + `docs/decisioni/` — registro delle decisioni e schede di quelle ad alto impatto
- `docs/AUDIT_FOUNDATION.md` — audit della struttura portante e roadmap
- `docs/GUIDA_OPERATIVA.md` — **i passi da fare tu**, dall'installazione al ciclo di sessione (copia della guida condivisa)
- `design/` — export di Claude Design (aspetto)
- `src/domain/` — meccanismi puri testati in isolamento
- `.claude/` — configurazione di Claude Code (permessi, hook, comandi, subagent, skill, regole per strato in `rules/`)
- `.vscode/` — estensioni consigliate, impostazioni e attività (gate, loop, snapshot)
- `scripts/` — gate (test di architettura, tracciabilità, dipendenze, segreti) e loop agentico (`loop.ps1` / `loop.sh`)
- `CLAUDE.md` / `AGENTS.md` — istruzioni per gli agenti
