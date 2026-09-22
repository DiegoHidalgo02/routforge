# RoutForge — Strumenti del workflow agentico

*Verificati sul web il 22/09/2026: ogni voce riporta la fonte. Regola: uno strumento entra solo se ha una funzione precisa in una fase precisa. Niente liste fine a sé stesse.*

## 1. Strumenti scelti

| Strumento | Funzione | Motivo per RoutForge | Quando | Installazione (Claude Code, dentro il repo) |
|---|---|---|---|---|
| **Claude Code** (piano MAX) | Esecutore del loop: legge `CLAUDE.md`, esegue `/task`, hook `Stop` con gate `npm run verify` | Unico agente con hook, subagent, skill di progetto e `/design` per importare Claude Design | Sempre | `npm install -g @anthropic-ai/claude-code@latest`; poi `claude` nella cartella del repo |
| **Claude Design → `/design`** (ufficiale) | Import del progetto di design nel repo; `/design-sync` per riallineare | È il canale ufficiale di handoff (Help Center "Get started with Claude Design", aggiornato sett. 2026) | Fase 3 (una volta) e a ogni modifica del design | `/design` in Claude Code, oppure Export → "Handoff to Claude Code" |
| **Ship Studio** (v. Windows x64) | Cockpit: terminale agenti (Claude Code / Codex / OpenCode affiancati), preview live, snapshot/restore, git+GitHub, deploy Vercel della PWA | Un'unica finestra per lanciare il loop, guardare la preview e fare snapshot prima dei task rischiosi | Dalla T-006 in poi (preview); snapshot prima di ogni task "rischioso" | Download da github.com/ship-studio/ship-studio (`Ship.Studio_<v>_x64-setup.exe`); onboarding installa Node/Git/gh/agent CLI |
| **Superpowers** (obra) | Brainstorm → piano → esecuzione per subagent, TDD, debugging sistematico, verifica prima di dichiarare finito | Copre esattamente il ciclo Task → Analisi → Implementazione → Test → Verifica | Task medi/grandi (scheduler, sessione, notifiche): `/superpowers:brainstorm` poi `/superpowers:write-plan` | `/plugin install superpowers@claude-plugins-official` |
| **Ponytail** (DietrichGebert) | "Il miglior codice è quello non scritto": preferisce stdlib/piattaforma, taglia astrazioni; `/ponytail-review` | Contiene il costo in token e la complessità (obiettivo esplicito: niente complessità prematura) | Sempre attivo; `/ponytail-review` prima del commit di task grandi | `/plugin marketplace add DietrichGebert/ponytail` poi `/plugin install ponytail@ponytail` (due prompt separati) |
| **Impeccable** (pbakaus) | Regole deterministiche anti "AI slop" per il front-end; comandi come `/impeccable polish` | Fedeltà al design e qualità visiva delle schermate React | Da T-006 (UI) in poi, dopo ogni schermata | `npx impeccable install` poi `/impeccable init` |
| **claude-council** (hex) | Chiede la stessa domanda a Codex/Gemini/Grok e mostra le risposte affiancate; usa il CLI `codex` in abbonamento | Seconda opinione multi-fornitore su decisioni architetturali e dead-end di debug, sfruttando il piano gratuito OpenAI senza chiavi | Solo ai checkpoint e nei dead-end (quota gratuita limitata) | `/plugin marketplace add hex/claude-marketplace` poi `/plugin install claude-council`; `codex login`; `/claude-council:status` |
| **Graphify** (Graphify-Labs) | Grafo di conoscenza del repo+spec, interrogabile invece di rileggere i file (meno token per query) | Le spec sono ~90 KB: il grafo evita di ricaricarle a ogni sessione | Dopo l'import del design e ogni ~10 task: `/graphify .` | `pipx install graphifyy` poi `graphify install --project` (Windows supportato; in PowerShell usare `graphify .`) |
| **Skills di Matt Pocock** (handoff, grill-me, git-guardrails) | `handoff`: passaggio di consegne tra sessioni; `grill-me`: interroga il piano finché non ha buchi; `git-guardrails-claude-code`: hook che bloccano git distruttivo | Continuità tra sessioni (principio §9 del prompt) e sicurezza git | `handoff` a fine sessione; `grill-me` prima di task grandi; guardrails una volta | `npx skills add mattpocock/skills --skill handoff --skill grill-me --skill git-guardrails-claude-code` |
| **`/security-review`** (integrato) | Revisione di sicurezza del diff corrente | Codice che tocca chiave AI, PDF/file utente, backup, sync | Prima del merge dei task 24–28, 30, 33–34 | Nessuna: già in Claude Code (Pro/Max) |
| **Codex CLI** (piano gratuito OpenAI) | Revisore indipendente (`codex review`) e seat di claude-council | Modello di un altro laboratorio trova errori sistematici del primo | Revisione a fine task grandi; con `gpt-5.6-terra`; `gpt-5.6-luna` per revisioni rapide | `npm i -g @openai/codex`; `codex login` |
| **OpenCode** (modelli Zen free) | Task meccanici non sensibili: scaffolding di test, traduzioni delle chiavi i18n, refactor guidati da test | Costo zero, preserva la quota MAX | Solo con dati pubblici; mai chiavi, mai materiali dei corsi dell'utente | `npm i -g opencode-ai`; modello `nemotron-3.5-lightning-free` (veloce) o `nemotron-3-ultra-free` (1M ctx, lento, timeout noti) |
| **Motion** (ex Framer Motion) | Transizioni di layout e ridimensionamento in React | Celebrazioni "piena/sobria/off" e animazioni "auto/sempre/mai" (FUNZ §23) con `prefers-reduced-motion` | Da T-006, solo dove il design le prevede | `npm i motion` (in T-006) |

Linee guida **Karpathy** (Think first · Simplicity · Surgical changes · Goal-driven): integrate in `CLAUDE.md` §2, nessun plugin (D-TOOLS-1).

## 2. Verifica dei nomi citati nel prompt

| Nome | Esito |
|---|---|
| Impeccable, Ponytail, Claude Council (hex), Superpowers, Graphify, Handoff (Pocock), Ship Studio, karpathy-skills, Framer Motion (→ Motion) | **Esistono e sono aggiornati** (fonti: repo GitHub ufficiali, impeccable.style, opencode.ai/docs/zen) |
| "Strumenti cybersecurity" (generico) | Coperto da `/security-review` integrato + `npm audit` + guardrails git; nessuno strumento terzo necessario |
| Claude Design "MCP" | Non serve un MCP terzo: il canale ufficiale è `/design` in Claude Code. Esistono MCP non ufficiali (pilotano Chrome): **scartati** (fragili, sessione sensibile) |

## 3. Modelli: chi fa cosa

| Ruolo | Modello | Note |
|---|---|---|
| Pianificazione, architettura, task complessi (scheduler §9, notifiche §13, sessione §10, sync §25) | **Claude Fable 5.1** | Ragionamento lungo e agentico; usa la quota con attenzione |
| Implementazione standard, test, UI da design | **Claude Sonnet 5** | Rapporto velocità/qualità; default del loop |
| Task meccanici (rename, chiavi i18n, boilerplate) | **Claude Haiku 4.5** | Economico |
| Seconda opinione / revisione indipendente | Codex **gpt-5.6-terra** (o **luna** per rapidità) | Piano gratuito: poche chiamate, ai checkpoint |
| Bulk non sensibile | OpenCode **nemotron-3.5-lightning-free** | Endpoint NVIDIA "trial": nessun dato personale o confidenziale |
| Da evitare con dati del progetto | Muse Spark **"Contributor Free"** | Usa prompt e completamenti per addestrare modelli Meta |

In Claude Code: `/model` per cambiare modello a metà sessione; `/compact` per contenere il contesto; `/cost` per vedere il consumo.

## 4. Ordine di installazione (una volta, ~15 minuti)

1. Ship Studio → onboarding (Node, Git, gh, Claude Code).
2. `claude` nel repo → `/plugin install superpowers@claude-plugins-official`.
3. `/plugin marketplace add DietrichGebert/ponytail` → `/plugin install ponytail@ponytail`.
4. `npx impeccable install` (terminale) → `/impeccable init` (Claude Code).
5. `npx skills add mattpocock/skills --skill handoff --skill grill-me --skill git-guardrails-claude-code`.
6. `npm i -g @openai/codex` → `codex login` → `/plugin marketplace add hex/claude-marketplace` → `/plugin install claude-council` → `/claude-council:status`.
7. `pipx install graphifyy` → `graphify install --project`.
8. `/design` → import del progetto RoutForge → `npm run design:check`.
