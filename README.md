# RoutForge

App personale di organizzazione e studio: calendario con quattro tipi di attività, scheduler automatico,
sessioni di studio con esiti che fanno avanzare un corso, promemoria, pratica generata dall'AI, statistiche,
sincronizzazione fra dispositivi. Android · iOS · web installabile. Dati sul dispositivo, offline salvo AI e sync.

## Stato
Passo corrente, fatto, problemi aperti e prossimo task: `docs/STATO.md`. Il design è in `claude-design/` dal
05/10/2026 (D-DESIGN-3) con la spec allineata; una schermata si implementa dopo il suo handoff
(`docs/03_HANDOFF_DESIGN_CODE.md`).

## Avvio rapido
```bash
npm ci
npm run verify          # gate unico: typecheck + lint + formato + test (dominio e regole del repository)
npm run dev             # l'app nel browser (Vite); npm run build per la build web in dist/
npm run apk             # APK firmato con la chiave di ~/.routforge (npm run apk:debug senza chiave)
claude                  # Claude Code: poi /task next
```
In VS Code: apri la cartella e accetta le estensioni consigliate; `Ctrl+Shift+B` esegue il gate.

## Mappa del repository
- `docs/spec/` — le cinque specifiche (fonte di verità, sola lettura)
- `docs/00_SINTESI.md` … `06_SUPERVISIONE.md`, `TASKS.md`, `STATO.md` — base di progetto operativa
- `docs/03_HANDOFF_DESIGN_CODE.md` — stato del design e handoff design → codice
- `docs/INVARIANTI.md` — cosa deve restare vero e come lo verifica il gate
- `docs/TRACCIABILITA.md` — i 60 scenari: regole, dove vivono, task, test, stato
- `docs/DIPENDENZE.md` — registro dei pacchetti con motivo e decisione
- `docs/01_DECISIONI.md` + `docs/decisioni/` — registro delle decisioni e schede di quelle ad alto impatto
- `PRODUCT.md` — record di prodotto per il lavoro di design (plugin impeccable)
- `claude-design/` — il pacchetto di Claude Design (aspetto): `HANDOFF.md`, `CLAUDE.md` vincolante, `docs/`, `design/`, `spec/`, schermate e tavole `.dc.html`
- `src/` — codice: `domain` (meccanismi puri), `data` (Dexie e corso di esempio), `app` (servizi), `ui` (React), `platform` (adapter)
- `.claude/` — configurazione di Claude Code (permessi, hook, comandi, subagent, skill, regole per strato in `rules/`)
- `.vscode/` — estensioni consigliate, impostazioni e attività (gate, loop, snapshot)
- `scripts/` — gate (test di architettura, tracciabilità, dipendenze, segreti, corso di esempio) e loop agentico (`loop.ps1` / `loop.sh`)
- `CLAUDE.md` / `AGENTS.md` — istruzioni per gli agenti

## Storia
Il vecchio export di Claude Design, la copia della guida operativa, l'audit della foundation del 24/09/2026 e i piani
di T-013 e T-019 sono nella storia git: `git show 3c60512:<percorso>` (es. `claude-design/HANDOFF.md`). La guida
operativa viva è il documento condiviso https://claude.ai/code/artifact/a0f36568-af5d-4acc-bfe7-90cd8bd8ac7a.
