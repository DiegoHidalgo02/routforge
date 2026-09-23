# RoutForge

App personale di organizzazione e studio: calendario con quattro tipi di attività, scheduler automatico,
sessioni di studio con esiti che fanno avanzare un corso, promemoria, pratica generata dall'AI, statistiche,
sincronizzazione fra dispositivi. Android · iOS · web installabile. Dati sul dispositivo, offline salvo AI e sync.

## Stato
Passo 1 di 10 (CONTESTO §6). Dominio puro implementato e testato (57 test). Vedi `docs/STATO.md`.

## Avvio rapido
```bash
npm ci
npm run verify          # typecheck + test (gate unico)
npm run design:check    # verifica l'export di Claude Design in design/
claude                  # Claude Code: poi /task next
```
In VS Code: apri la cartella e accetta le estensioni consigliate; `Ctrl+Shift+B` esegue il gate.

## Mappa del repository
- `docs/spec/` — le cinque specifiche (fonte di verità, sola lettura)
- `docs/00_SINTESI.md` … `06_SUPERVISIONE.md`, `TASKS.md`, `STATO.md` — base di progetto operativa
- `design/` — export di Claude Design (aspetto)
- `src/domain/` — meccanismi puri testati in isolamento
- `.claude/` — configurazione di Claude Code (permessi, hook, comandi, subagent, skill)
- `.vscode/` — estensioni consigliate, impostazioni e attività (gate, loop, snapshot)
- `scripts/` — gate e loop agentico (`loop.ps1` / `loop.sh`)
- `CLAUDE.md` / `AGENTS.md` — istruzioni per gli agenti
