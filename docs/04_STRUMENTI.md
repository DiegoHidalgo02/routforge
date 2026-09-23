# RoutForge — Strumenti del workflow agentico

*Verificati sul web il 22/09/2026: ogni voce riporta la fonte. Regola: uno strumento entra solo se ha una funzione precisa in una fase precisa. Niente liste fine a sé stesse.*

## 1. Strumenti scelti

| Strumento | Funzione | Motivo per RoutForge | Quando | Installazione (Claude Code, dentro il repo) |
|---|---|---|---|---|
| **Claude Code** (piano MAX) | Esecutore del loop: legge `CLAUDE.md`, esegue `/task`, hook `Stop` con gate `npm run verify` | Unico agente con hook, subagent, skill di progetto e `/design` per importare Claude Design | Sempre | `npm install -g @anthropic-ai/claude-code@latest`; poi `claude` nella cartella del repo |
| **Claude Design → `/design`** (ufficiale) | Import del progetto di design nel repo; `/design-sync` per riallineare | È il canale ufficiale di handoff (Help Center "Get started with Claude Design", aggiornato sett. 2026) | Fase 3 (una volta) e a ogni modifica del design | `/design` in Claude Code, oppure Export → "Handoff to Claude Code" |
| **VS Code** (+ `.vscode/` del repo) | Ambiente unico: estensione Claude Code (pannello + terminale), estensione Codex, terminali divisi per più agenti, Test Explorer di Vitest, task `Ctrl+Shift+B` = gate, Git/GitLens, Simple Browser per la preview | Scelta dell'utente (23/09/2026) al posto di Ship Studio: nessuno strumento in più da imparare, estensioni ufficiali di Anthropic e OpenAI, configurazione versionata nel repo | Sempre | Apri la cartella → accetta le estensioni consigliate (`.vscode/extensions.json`); Claude Code: `anthropic.claude-code`; Codex: `openai.chatgpt` |
| **Superpowers** (obra) | Brainstorm → piano → esecuzione per subagent, TDD, debugging sistematico, verifica prima di dichiarare finito | Copre esattamente il ciclo Task → Analisi → Implementazione → Test → Verifica | Task medi/grandi (scheduler, sessione, notifiche): `/superpowers:brainstorm` poi `/superpowers:write-plan` | `/plugin install superpowers@claude-plugins-official` → ambito **Project** |
| **Ponytail** (DietrichGebert) | "Il miglior codice è quello non scritto": preferisce stdlib/piattaforma, taglia astrazioni; `/ponytail-review` | Contiene il costo in token e la complessità (obiettivo esplicito: niente complessità prematura) | Sempre attivo; `/ponytail-review` prima del commit di task grandi | `/plugin marketplace add DietrichGebert/ponytail` poi `/plugin install ponytail@ponytail` → ambito **Project** (due prompt separati) |
| **Impeccable** (pbakaus) | Regole deterministiche anti "AI slop" per il front-end; comandi come `/impeccable polish` | Fedeltà al design e qualità visiva delle schermate React | Da T-006 (UI) in poi, dopo ogni schermata | `npx impeccable install --providers=claude --scope=project` poi `/impeccable init` |
| **claude-council** (hex) | Chiede la stessa domanda a Codex/Gemini/Grok e mostra le risposte affiancate; usa il CLI `codex` in abbonamento | Seconda opinione multi-fornitore su decisioni architetturali e dead-end di debug, sfruttando il piano gratuito OpenAI senza chiavi | Solo ai checkpoint e nei dead-end (quota gratuita limitata) | `/plugin marketplace add hex/claude-marketplace` poi `/plugin install claude-council` → ambito **Project**; `codex login`; `/claude-council:status` |
| **Graphify** (Graphify-Labs) | Grafo di conoscenza del repo+spec, interrogabile invece di rileggere i file (meno token per query) | Le spec sono ~90 KB: il grafo evita di ricaricarle a ogni sessione | Dopo l'import del design e ogni ~10 task: `/graphify .` | `pipx install graphifyy` poi `graphify install --project` (Windows supportato; in PowerShell usare `graphify .`) |
| **Skills di Matt Pocock** (grill-me, git-guardrails-claude-code) | `grill-me`: interroga il piano finché non ha buchi; `git-guardrails-claude-code`: hook che bloccano git distruttivo | Piani più solidi e sicurezza git. La skill `handoff` **non** si installa: il repo ha già il comando `/handoff` specifico per RoutForge (evita il conflitto di nomi) | `grill-me` prima dei task **F**; guardrails una volta | `npx skills add mattpocock/skills --skill grill-me --skill git-guardrails-claude-code -a claude-code` (senza `-g`: resta nel progetto) |
| **`/security-review`** (integrato) | Revisione di sicurezza del diff corrente | Codice che tocca chiave AI, PDF/file utente, backup, sync | Prima del merge dei task 24–28, 30, 33–34 | Nessuna: già in Claude Code (Pro/Max) |
| **Codex CLI** (piano gratuito OpenAI) | Revisore indipendente (`codex review`) e seat di claude-council | Modello di un altro laboratorio trova errori sistematici del primo | Revisione a fine task grandi; con `gpt-5.6-terra`; `gpt-5.6-luna` per revisioni rapide | `npm i -g @openai/codex`; `codex login` |
| **OpenCode** (modelli Zen free) | Task meccanici non sensibili: scaffolding di test, traduzioni delle chiavi i18n, refactor guidati da test | Costo zero, preserva la quota MAX | Solo con dati pubblici; mai chiavi, mai materiali dei corsi dell'utente | `npm i -g opencode-ai`; modello `nemotron-3.5-lightning-free` (veloce) o `nemotron-3-ultra-free` (1M ctx, lento, timeout noti) |
| **Motion** (ex Framer Motion) | Transizioni di layout e ridimensionamento in React | Celebrazioni "piena/sobria/off" e animazioni "auto/sempre/mai" (FUNZ §23) con `prefers-reduced-motion` | Da T-006, solo dove il design le prevede | `npm i motion` (in T-006) |

Linee guida **Karpathy** (Think first · Simplicity · Surgical changes · Goal-driven): integrate in `CLAUDE.md` §2, nessun plugin (D-TOOLS-1).

## 2. Verifica dei nomi citati nel prompt

| Nome | Esito |
|---|---|
| Impeccable, Ponytail, Claude Council (hex), Superpowers, Graphify, Handoff (Pocock), Ship Studio (verificato ma **non adottato**: sostituito da VS Code), karpathy-skills, Framer Motion (→ Motion) | **Esistono e sono aggiornati** (fonti: repo GitHub ufficiali, impeccable.style, opencode.ai/docs/zen) |
| "Strumenti cybersecurity" (generico) | Coperto da `/security-review` integrato + `npm audit` + guardrails git; nessuno strumento terzo necessario |
| Claude Design "MCP" | Non serve un MCP terzo: il canale ufficiale è `/design` in Claude Code. Esistono MCP non ufficiali (pilotano Chrome): **scartati** (fragili, sessione sensibile) |

## 3. Modelli: chi fa cosa

La scelta per ogni task è nella colonna **Modello** di `docs/TASKS.md`. Criterio:

| Modello | Quando | Task |
|---|---|---|
| **Claude Opus 5.5** | task difficili: decisioni irreversibili, logica che intreccia molte regole, algoritmi con molti casi limite, rischio dati, codice nativo | T-000, T-004, T-011, T-012, T-013, T-017, T-018, T-019, T-021, T-023, T-029, T-030, T-033, T-034, T-036 |
| **Claude Sonnet 5** | default: funzionalità, UI, integrazioni | tutti gli altri |
| **Claude Haiku 4.5** | regole chiare e meccaniche | T-014, T-025 |
| **Claude Fable 5.1** | nessun task di default: solo escalation, quando Opus 5.5 con sforzo alto continua a mancare una condizione | — |
| Codex **gpt-5.6-terra** (o **luna**) | seconda opinione / revisione indipendente | ai checkpoint e a fine passo |
| OpenCode **nemotron-3.5-lightning-free** | bulk non sensibile | task **M**, solo con dati non riservati |

Escalation: se il gate resta rosso dopo due tentativi, passa al gradino successivo: Haiku → Sonnet → Opus 5.5 → Opus 5.5 con sforzo più alto → Fable 5.1. Motivo (23/09/2026): Opus 5.5 supera Fable 5.1 sui benchmark di coding agentico (Terminal-Bench 4.0, FrontierCode, CursorBench) con prezzo API inferiore del 60%; la guida di Anthropic sulla scelta del modello indica Fable solo per i problemi che Opus continua a mancare. Da evitare con dati del progetto: Muse Spark **"Contributor Free"** (usa prompt e completamenti per l'addestramento).

In Claude Code: `/model` per cambiare modello a metà sessione; `/compact` per contenere il contesto; `/cost` per vedere il consumo.

## 4. Ordine di installazione (una volta, ~15 minuti)

1. VS Code → apri la cartella del repo → "Installa" sulle estensioni consigliate; da terminale verifica `node -v` (≥ 20), `git --version`, `gh --version`; installa PowerShell 7 (`winget install Microsoft.PowerShell`) per `scripts/loop.ps1`; **Git for Windows è necessario**: gli hook del progetto usano Git Bash.
2. `claude` nel repo → `/plugin install superpowers@claude-plugins-official`.
3. `/plugin marketplace add DietrichGebert/ponytail` → `/plugin install ponytail@ponytail`.
4. `npx impeccable install --providers=claude --scope=project` (terminale) → `/impeccable init` (Claude Code).
5. `npx skills add mattpocock/skills --skill grill-me --skill git-guardrails-claude-code -a claude-code` (non `handoff`: il repo ha già `/handoff`; niente `-g`).
6. `npm i -g @openai/codex` → `codex login` → `/plugin marketplace add hex/claude-marketplace` → `/plugin install claude-council` → `/claude-council:status`.
7. `pipx install graphifyy` → `graphify install --project`.
8. `/design` → import del progetto RoutForge → `npm run design:check`.

## 5. Solo ciò che serve a RoutForge (ambiti e pulizia)

Regola: **tutto ciò che è di RoutForge vive nel progetto** (`.claude/` del repo, versionato); il livello utente (`~/.claude/`) contiene solo ciò che vale davvero per ogni progetto. Motivo: ciò che sta a livello utente si carica ovunque, consuma contesto e, per le skill, **il personale vince sul progetto** a parità di nome (documentazione ufficiale, "Resolve skills that share a name").

| Cosa | Dove vive per RoutForge | Come si isola o si toglie |
| --- | --- | --- |
| Plugin | `enabledPlugins` in `.claude/settings.json` (installazione con ambito **Project**) | `/plugin` → disabilita → "solo per te in questo progetto" (scrive `.claude/settings.local.json`); o `enabledPlugins: {"nome@marketplace": false}` |
| Skill personali di altri progetti | — | `/skills` → evidenzia → `Spazio` fino a **off** → `Esc` (salva `skillOverrides` in `.claude/settings.local.json`, vale solo qui); oppure archiviale con `npm run audit:claude` |
| Skill sincronizzate da claude.ai | — | spegnile nelle impostazioni skill di claude.ai, o `"syncClaudeAiSkills": false` in `~/.claude/settings.json` |
| Comandi, subagent, regole personali | — | archiviazione reversibile: `node scripts/audit-claude.mjs --archivia tipo:nome --conferma` |
| `~/.claude/CLAUDE.md` e i suoi `@import` | istruzioni di progetto solo in `CLAUDE.md` del repo | sposta nel progetto giusto ciò che non è universale; controlla con `/memory` |
| Server MCP di ambito utente | nessuno richiesto da RoutForge | `/mcp` o `claude mcp remove <nome> -s user` |

Strumenti di controllo: `npm run audit:claude` (inventario completo, conflitti di nome, archiviazione e ripristino), `/context` (peso di skill, memoria e MCP nel contesto), `/skill-doctor` (skill e plugin mai usati).
