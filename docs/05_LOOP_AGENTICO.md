# RoutForge — Loop agentico

*Come gira lo sviluppo giorno per giorno. Tutto in VS Code: estensione Claude Code e terminale integrato. Un solo esecutore per volta sul codice: Claude Code. Gli altri agenti revisionano o fanno lavoro delegato in cartelle separate.*

## 1. Il ciclo

```
docs/TASKS.md ──► /task next ──► Analisi (spec + scenari) ──► Test rossi ──► Implementazione
      ▲                                                                         │
      │                                                                         ▼
 aggiorna TASKS/STATO ◄── Commit ◄── Auto-revisione ◄── npm run verify (verde) ◄─┘
      │                                              ▲                │ rosso
      │                                              └── correzione ◄─┘
      └────────── prossimo task (o CHECKPOINT: si ferma e scrive in docs/STATO.md)
```

Quattro garanzie meccaniche, non solo istruzioni:
1. **SessionStart hook** (`.claude/hooks/session-start.mjs`): ogni sessione parte con `docs/STATO.md` e i prossimi task già nel contesto.
2. **Stop hook** (`.claude/hooks/stop-verify.mjs`): Claude non può chiudere il turno con `npm run verify` rosso (esce con codice 2 e riceve l'errore). Per una fase "rossa" voluta del TDD crea il file `.claude/hooks/SKIP_VERIFY` e rimuovilo subito dopo.
3. **Permessi** (`.claude/settings.json`): edit accettati automaticamente, comandi npm/git di lettura e commit permessi, comandi distruttivi negati, `docs/spec/` in sola lettura.
4. **Gate unico** `npm run verify` = typecheck + test, identico in locale, nell'hook e in CI (`.github/workflows/ci.yml`).

## 2. Modalità di esecuzione

### A. Interattiva (consigliata all'inizio, un task per volta)
```
claude                       # nel terminale integrato di VS Code (o dal pannello dell'estensione Claude Code)
> /task next                 # oppure /task T-007
```
Claude legge lo stato, pianifica, implementa, verifica, aggiorna i documenti e committa. Tu leggi il riassunto di 5 righe e lanci il successivo.

### B. Semi-autonoma (una sequenza di task senza intervento)
`scripts/loop.ps1` (Windows) / `scripts/loop.sh` esegue `claude -p "/task next" --permission-mode acceptEdits`
in ciclo finché: tutti i task sono `fatto`, oppure `docs/STATO.md` contiene `CHECKPOINT:` o `BLOCCO:`, oppure si
raggiunge il numero massimo di iterazioni. Lo script crea da solo il tag `pre-loop-<data>`: per tornare indietro `git switch -c recupero pre-loop-<data>`.
Da VS Code: *Terminale → Esegui attività… → loop agentico (3 task)*.
```
pwsh scripts/loop.ps1 -MaxTasks 5
```
Ogni iterazione è una sessione nuova: il contesto arriva da `CLAUDE.md` + hook SessionStart + `docs/STATO.md`
(principio di continuità). Non usare mai `--dangerously-skip-permissions`.

### C. Revisione indipendente (fine di ogni passo del piano)
- In Claude Code: `/claude-council:ask "Rivedi <file> rispetto a docs/spec/RoutForge_MECCANISMI.md §8"` → risposte di Codex (gpt-5.6-terra) affiancate.
- Oppure in un secondo terminale di VS Code (o nel pannello dell'estensione Codex): `codex review` sul diff.
- Per l'aspetto: subagent `design-checker`; per la conformità: subagent `spec-reviewer` (`.claude/agents/`).

## 3. Chi fa cosa (VS Code, terminali divisi)

| Dove in VS Code | Agente | Compito |
|---|---|---|
| Pannello estensione **Claude Code** (o terminale 1: `claude`) | Claude Code (Sonnet 5 di default; `/model` → Fable 5.1 per i task marcati **F** in `docs/TASKS.md`) | Esecuzione del loop; vede file aperti e selezione, mostra i diff inline |
| Pannello estensione **Codex** (o terminale 2: `codex`) | Codex (gpt-5.6-terra) | `codex review`, seconda opinione via council; **non modifica** file del loop |
| Terminale 3: `opencode` | OpenCode (nemotron-3.5-lightning-free) | Task meccanici delegati esplicitamente (marcati **M**), in un branch separato |
| Pannello **Testing** (Vitest Explorer) | — | Rieseguire e fare debug di un singolo test o scenario |
| **Simple Browser** (`Ctrl+Shift+P` → *Simple Browser: Show* → `http://localhost:5173`) o il browser con DevTools in modalità dispositivo | — | Preview della UI da T-006; breakpoint mobile/desktop |

Scorciatoie utili: `Ctrl+Shift+B` = gate `npm run verify`; `Ctrl+Shift+5` = divide il terminale; *Terminale → Esegui attività…* = `design:check`, loop, snapshot.

Regole di convivenza: un solo agente scrive sul branch `main`; gli altri lavorano su branch `agent/<nome>/<task>` e si integrano con PR (`gh pr create`). **Snapshot** prima dei task **rischiosi** (marcati **R**: migrazioni, plugin nativi, sync): attività *snapshot* (tag git `snapshot-<data>`); per tornare indietro `git switch -c recupero snapshot-<data>`.

## 4. Gestione della quota

- Piano MAX: finestre di 5 ore e settimanali. Sonnet 5 per l'80% dei task; Fable 5.1 solo dove il task lo indica; `/compact` a metà dei task lunghi; `CLAUDE.md` resta sotto le 120 righe.
- Piano gratuito OpenAI: poche chiamate al giorno → revisioni ai checkpoint, non a ogni commit.
- OpenCode free: illimitato ma con dati pubblici soltanto; `nemotron-3-ultra-free` solo per letture a contesto enorme.

## 5. Convenzioni di chiusura di un task

- `docs/TASKS.md`: stato `fatto`, con i test che lo dimostrano.
- `docs/STATO.md`: Fatto / In corso / Problemi aperti / Prossimo / Checkpoint.
- Commit: `tipo(ambito): descrizione (scenari)`; un commit per task, o più commit piccoli con il gate verde ognuno.
- A fine sessione lunga: `/handoff` (comando di progetto) → `docs/handoff/<data>.md`.

## 6. Quando il loop si ferma da solo

`CHECKPOINT:` (decisione umana, `docs/06_SUPERVISIONE.md`), `BLOCCO: informazione necessaria`, gate rosso per tre iterazioni consecutive sullo stesso task, dipendenze native mancanti (Android Studio, Mac per iOS).
