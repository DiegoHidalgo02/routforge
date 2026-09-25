# RoutForge — Loop agentico

*Come gira lo sviluppo giorno per giorno. Tutto in VS Code: estensione Claude Code e terminale integrato. Un solo esecutore per volta sul codice: Claude Code. Gli altri agenti revisionano o fanno lavoro delegato in cartelle separate.*

## 1. Il ciclo

```
docs/TASKS.md ──► /task next ──► Analisi (spec + scenari + regole di strato) ──► Test rossi ──► Implementazione
      ▲                                                                                        │
      │                                                                                        ▼
 aggiorna TASKS/TRACCIABILITA/STATO ◄── Commit ◄── Auto-revisione (+ revisione indipendente se alto impatto, §7)
      │                                              ▲                │ rosso
      │                                              └── correzione ◄─┘ ◄── npm run verify (verde)
      └────────── prossimo task (o CHECKPOINT: si ferma e scrive in docs/STATO.md)
```

Quattro garanzie meccaniche, non solo istruzioni:
1. **SessionStart hook** (`.claude/hooks/session-start.mjs`): ogni sessione parte con `docs/STATO.md` e i prossimi task già nel contesto; le regole di strato in `.claude/rules/` si caricano quando tocchi i file a cui si applicano.
2. **Stop hook** (`.claude/hooks/stop-verify.mjs`): Claude non può chiudere il turno con `npm run verify` rosso (esce con codice 2 e riceve l'errore). Per una fase "rossa" voluta del TDD crea il file `.claude/hooks/SKIP_VERIFY` e rimuovilo subito dopo. Senza `node_modules` l'hook lo dice chiaramente: `npm ci`.
3. **Permessi** (`.claude/settings.json`): edit accettati automaticamente, comandi npm/git di lettura e commit permessi, comandi distruttivi negati, `docs/spec/` in sola lettura.
4. **Gate unico** `npm run verify` = typecheck + lint + formato + test, compresi i test del repository (architettura, tracciabilità degli scenari, registro delle dipendenze, segreti: `scripts/*.test.mjs`), identico in locale, nell'hook e in CI (`.github/workflows/ci.yml`). Elenco delle proprietà verificate in `docs/INVARIANTI.md`.

## 2. Modalità di esecuzione

### A. Interattiva (consigliata all'inizio, un task per volta)
```
claude                       # nel terminale integrato di VS Code (o dal pannello dell'estensione Claude Code)
> /task next                 # oppure /task T-007
```
Claude legge lo stato, pianifica, implementa, verifica, aggiorna i documenti e committa. Tu leggi il riassunto di 5 righe e lanci il successivo.

### B. Semi-autonoma (una sequenza di task senza intervento)
`scripts/loop.ps1` (Windows) / `scripts/loop.sh` a ogni giro chiede a `scripts/prossimo-task.mjs` il prossimo task
(stessa regola di `/task next`) e **il modello dalla colonna Modello** di `docs/TASKS.md`, compresi i task in due
fasi (Fable per il piano se `docs/piani/<ID>.md` non esiste, Opus per il codice se esiste). Poi esegue
`claude -p "/task <ID> loop" --model <modello> --permission-mode acceptEdits`.

Si ferma da solo quando: `docs/STATO.md` contiene `CHECKPOINT:` o `BLOCCO:`; non ci sono task eseguibili; il prossimo
task è marcato **CPn** (checkpoint non ancora deciso: il marcatore si toglie dalla riga quando la decisione è
registrata in `docs/01_DECISIONI.md`); il prossimo passo usa **Fable 5.1** (per non consumare la quota settimanale senza che tu lo sappia: eseguilo a mano, oppure
rilancia con `-ConsentiFable`); il gate è rosso; un giro non ha prodotto commit (evita ripetizioni infinite).
Crea il tag `pre-loop-<data>` all'avvio e un tag `snapshot-<ID>-<data>` prima di ogni task **R**.
```
pwsh -File scripts/loop.ps1 -MaxTasks 5
pwsh -File scripts/loop.ps1 -MaxTasks 5 -ConsentiFable     # include T-000 e le fasi di piano
```
Ogni giro è una sessione nuova: il contesto arriva da `CLAUDE.md` + hook SessionStart + `docs/STATO.md`.
Non usare mai `--dangerously-skip-permissions`.
Da verificare al primo giro (assunzioni non documentate da Claude Code): che `claude -p` espanda il comando di progetto
`/task` e che l'hook Stop giri anche in modalità non interattiva. In ogni caso il loop rilancia `npm run verify` da solo.

### C. Revisione indipendente (fine di ogni passo del piano e modifiche ad alto impatto, §7)
- In Claude Code: `/claude-council:ask "Rivedi <file> rispetto a docs/spec/RoutForge_MECCANISMI.md §8"` → risposte di Codex (gpt-5.6-terra) affiancate.
- Oppure in un secondo terminale di VS Code (o nel pannello dell'estensione Codex): `codex review` sul diff.
- Per l'aspetto: subagent `design-checker`; per la conformità: subagent `spec-reviewer` (`.claude/agents/`).

## 3. Chi fa cosa (VS Code, terminali divisi)

| Dove in VS Code | Agente | Compito |
|---|---|---|
| Pannello estensione **Claude Code** (o terminale 1: `claude`) | Claude Code (modello indicato dalla colonna **Modello** di `docs/TASKS.md`; cambia con `/model`) | Esecuzione del loop; vede file aperti e selezione, mostra i diff inline |
| Pannello estensione **Codex** (o terminale 2: `codex`) | Codex (gpt-5.6-terra) | `codex review`, seconda opinione via council; **non modifica** file del loop |
| Terminale 3: `opencode` | OpenCode (nemotron-3.5-lightning-free) | Task meccanici delegati esplicitamente (marcati **M**), in un branch separato |
| Pannello **Testing** (Vitest Explorer) | — | Rieseguire e fare debug di un singolo test o scenario |
| **Simple Browser** (`Ctrl+Shift+P` → *Simple Browser: Show* → `http://localhost:5173`) o il browser con DevTools in modalità dispositivo | — | Preview della UI da T-006; breakpoint mobile/desktop |

Scorciatoie utili: `Ctrl+Shift+B` = gate `npm run verify`; `Ctrl+Shift+5` = divide il terminale; *Terminale → Esegui attività…* = `design:check`, loop, snapshot.

Regole di convivenza: un solo agente scrive sul branch `main`; gli altri lavorano su branch `agent/<nome>/<task>` e si integrano con PR (`gh pr create`). **Snapshot** prima dei task **rischiosi** (marcati **R**: migrazioni, plugin nativi, sync): attività *snapshot* (tag git `snapshot-<data>`); per tornare indietro `git switch -c recupero snapshot-<data>`.

## 4. Gestione della quota

- Piano MAX: finestre di 5 ore e settimanali. Modello per task nella colonna **Modello** di `docs/TASKS.md` (Opus 5.5 per la maggior parte, Sonnet 5 per i task meccanici, D-MODEL-2; Fable 5.1 per T-000 e per i piani di T-013, T-019, T-033); `/compact` a metà dei task lunghi; `CLAUDE.md` resta sotto le 120 righe.
- Piano gratuito OpenAI: poche chiamate al giorno → revisioni ai checkpoint, non a ogni commit.
- OpenCode free: illimitato ma con dati pubblici soltanto; `nemotron-3-ultra-free` solo per letture a contesto enorme.

## 5. Convenzioni di chiusura di un task

- `docs/TASKS.md`: stato `fatto`, con i test che lo dimostrano.
- `docs/TRACCIABILITA.md`: righe degli scenari del task aggiornate (test, stato); `docs/DIPENDENZE.md` se sono entrati pacchetti.
- `docs/STATO.md`: Fatto / In corso / Problemi aperti / Prossimo / Checkpoint.
- Commit: `tipo(ambito): descrizione (scenari)`; un commit per task, o più commit piccoli con il gate verde ognuno.
- A fine sessione lunga: `/handoff` (comando di progetto) → `docs/handoff/<data>.md`.

## 6. Quando il loop si ferma da solo

`CHECKPOINT:` (decisione umana, `docs/06_SUPERVISIONE.md`), `BLOCCO: informazione necessaria` (incluso un pacchetto non registrato in `docs/DIPENDENZE.md`), gate rosso per tre iterazioni consecutive sullo stesso task, dipendenze native mancanti (Android Studio, Mac per iOS).

## 7. Modifiche ad alto impatto → revisione indipendente (D-REVIEW-1)

Il processo è proporzionato al rischio. Per ogni task vale il ciclo di §1: leggi → capisci → pianifica → controllo
architetturale (regole di strato in `.claude/rules/`, `docs/INVARIANTI.md`) → implementa → test → gate → documenta →
rileggi il diff.

Sono **ad alto impatto** le modifiche a: confini fra strati e `DIPENDENZE_AMMESSE` in `scripts/architettura.test.mjs`;
in `src/domain/types.ts` le rinomine, le rimozioni e i cambi di semantica di campi o valori esistenti (le aggiunte
additive coerenti con le spec, come un tipo `Ricorrenza` nuovo, restano nell'auto-revisione); schema di persistenza e migrazioni; porte di `src/app/ports` (nuove o
cambiate); modello delle notifiche (id, riconciliazione); sync; sicurezza (chiave AI, backup, file dell'utente);
astrazioni trasversali; refactoring su più strati.

Per queste, prima del commit:
1. chi implementa scrive in `docs/STATO.md` (In corso) cosa è cambiato e perché, con le decisioni `D-…` aggiornate e, se
   ad alto impatto, la scheda in `docs/decisioni/`;
2. un revisore che **non** ha scritto il codice rivede diff e documenti: l'altro modello (Fable 5.1 ↔ Opus 5.5 con
   `/model`, o in una sessione separata) oppure Codex (`codex review`); in modalità loop, dove l'altro modello non è
   disponibile, il subagent `spec-reviewer` nella stessa sessione, e la revisione dell'altro modello si fa a fine passo (§2.C);
3. le divergenze si risolvono nel codice o nella decisione, mai ignorandole; se il revisore ha ragione su un requisito,
   vince il requisito;
4. si aggiornano `docs/02_ARCHITETTURA.md`, `docs/INVARIANTI.md`, le schede in `docs/decisioni/` e
   `docs/TRACCIABILITA.md`;
5. si rilancia `npm run verify`.

Fable 5.1 e Opus 5.5 non sono «primo agente → secondo agente»: entrambi implementano, rivedono, fanno refactoring e
debugging. La colonna Modello di `docs/TASKS.md` sceglie chi **inizia** un task in base a costo e difficoltà; la
revisione incrociata è ciò che rende il lavoro dell'uno continuabile dall'altro. Le modifiche banali (testi, bug
locali, test aggiuntivi) non passano da qui.
