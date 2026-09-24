# RoutForge — Audit della foundation

*24 settembre 2026. Base analizzata: repository al commit `7eda970` più il `docs/` inviato dall'utente (identico byte per byte a quello del repository: `/impeccable init` non ha modificato `docs/`). Fonte primaria: `docs/spec/`. Questo documento non sostituisce le spec: dice se la struttura portante le regge.*

## 0. Verdetto

La foundation è **adatta** a costruire RoutForge: strati corretti, dominio puro e testato sugli scenari, gate unico, loop agentico con controlli meccanici. L'audit ha trovato **un difetto strutturale ad alto costo di inversione** (vocabolario del dominio in due lingue, con due forme della stessa unità del corso e la regola di sblocco dei moduli scritta due volte), **corretto**; **una contraddizione nelle spec** sul fuso orario che nessuno può risolvere al posto dell'utente (**CP0**, prima dello schema dati); e **quattro rischi di piattaforma** da prevedere nei task che li toccano. Non è stato aggiunto codice applicativo.

## 1. Modello del progetto (Fase 1)

App personale, un utente, più dispositivi (Android, iOS, web installabile), offline salvo AI e sync. Sintesi completa e numeri in `docs/00_SINTESI.md`; qui solo ciò che serve a giudicare la foundation.

- **Problema**: pianificare e svolgere lo studio insieme al resto della giornata, con un calendario che si ripianifica da solo, sessioni che fanno avanzare un corso importato e pratica generata dall'AI.
- **Nucleo di regole** (MECCANISMI): stati dei blocchi, marcatura persi (+30'), orizzonte dei todo, generazione occorrenze (28 gg), cicli dello scheduler in ordine vincolante e idempotenti (§9), puntatore dell'unità (§11), notifiche con finestra di 14 gg e riconciliazione (§13), SM-2 (§19), statistiche (§20), sync ultimo-vince con tombstone (§25).
- **Requisiti non funzionali** (CONTESTO §3): tempo locale, Oggi pronto in < 0,5 s, niente blocchi della UI da notifiche/widget/sync, cicli idempotenti, sei lingue, accessibilità, **meccanismi puri verificabili in isolamento**, scenari = criteri di accettazione.
- **Integrazioni**: Gemini (chiave dell'utente), servizio di sync (email + codice), capacità native (notifiche, sveglie, DND, widget, file system, TTS).
- **Decisioni già prese**: CONTESTO §5 (cose che l'app non fa, AI, sync, backup, corso di esempio).
- **Non ancora deciso**: stack (T-000, dopo l'import del design), servizio di sync (CP4), comportamento al cambio di fuso (**CP0**, nuovo).

### Conflitti fra documenti

| # | Documenti | Conflitto | Risolvibile dal contesto? | Stato |
|---|---|---|---|---|
| 1 | CONTESTO §3 vs MECCANISMI §1 | "fuso orario e ora legale non devono spostare i blocchi di giorno" vs "ogni istante è assoluto; il giorno è quello locale dell'inizio". Con l'ora legale le due frasi coincidono (già testato); **in viaggio divergono** | No: la precedenza formale darebbe ragione a MECCANISMI, ma CONTESTO esprime un'intenzione diversa e la scelta cambia lo schema dati | **Aperto → CP0 / D-TIME-2** |
| 2 | FORMATO_CORSO §2 vs FUNZIONALITÀ §14 | criterio Go/No-Go "auto" legato al "quiz del modulo", ma i quiz si generano per unità | Parzialmente | D-QUIZ-1 da confermare (CP5) |
| 3–9 | vari | già registrati in `docs/00_SINTESI.md` §6 | Sì | risolti con decisioni `D-…` |

## 2. Specifica operativa (Fase 2) — baseline

**A. Componenti.** Dominio puro (tempo, stati, persi/recupero, orizzonte, occorrenze, scheduler, esiti e puntatore, streak, pomodoro, notifiche, SM-2, pratiche, parser del corso, statistiche, sync) · Persistenza locale con id globali, `updatedAt`, tombstone · Servizi applicativi (scheduler, sessione, pianificatore notifiche, puntatore, statistiche, sync) · UI (9 sezioni del design) · Adattatori di piattaforma dietro interfacce.

**B. Relazioni.** UI → servizi → persistenza → dominio; i servizi usano la piattaforma solo tramite porte (`src/app/ports`). Il dominio non conosce nessuno.

**C. Dipendenze.** Parser → vocabolario del dominio e regola dei moduli · Scheduler → occorrenze, orizzonte, persi, puntatore, notifiche, streak (in quest'ordine) · Sessione → pomodoro, esiti, puntatore, streak · Notifiche → stati dei blocchi, preferenze, ore silenziose · Sync → tutte le entità (identità, tombstone) · Statistiche → sessioni ed esiti.

**D. Flussi principali.** Import corso → puntatore iniziale · Routine di studio → occorrenze → sessione → esito → puntatore e streak · Ciclo dello scheduler all'avvio/primo piano/cambio giorno · Riconciliazione delle notifiche · Generazione AI → validazione → pratica → SM-2 · Backup/ripristino · Sync.

**E. Vincoli da non violare.** Ordine dei cicli (§9) e idempotenza · tempo locale e "now" come parametro · un solo esito per sessione e una sola sessione attiva · offline-first · nessun dato fuori dal dispositivo salvo sync e contesto AI · spec in sola lettura.

**F. Requisiti strutturali per la foundation.** Dominio isolato e testabile senza piattaforma · un vocabolario unico allineato alle spec · regole scritte una volta sola · gate unico eseguito in locale, negli hook e in CI · test in più fusi orari · identità dei record pronta per la sync · stack scelto solo dopo il design · confini fra strati verificati meccanicamente.

## 3. Foundation esistente (Fase 3)

| Elemento | Contenuto | Coerente con `docs/`? |
|---|---|---|
| `src/domain/` | 10 moduli puri + parser, 88 test sugli scenari | Sì (vocabolario corretto in questo audit) |
| `docs/` | spec (sola lettura), sintesi, decisioni, architettura, handoff, strumenti, loop, supervisione, backlog, stato, guida, piani | Sì |
| `CLAUDE.md`, `AGENTS.md` | regole per gli agenti | Sì (convenzione precisata) |
| `.claude/` | permessi, hook SessionStart/Stop, comandi `/task /gate /scenario /stato /handoff`, 3 subagent, skill `routforge-spec` | Sì |
| `scripts/` | `loop.ps1/.sh`, `prossimo-task.mjs`, `audit-claude.mjs`, `check-design.mjs` | Sì |
| `package.json` | TypeScript 5.9, Vitest 3.2; script `check`, `test`, `verify`, `design:check`, `audit:claude` | Sì (dev/build/lint arrivano con lo stack) |
| `tsconfig.json` | strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` | Sì (lib DOM da rivedere in T-006) |
| `.github/workflows/ci.yml` | `npm ci`, `verify`, test in 3 fusi | Sì |
| `.vscode/` | estensioni, impostazioni, attività | Sì |
| `.gitignore`, `.gitattributes`, `.editorconfig` | LF forzato, segreti esclusi | Sì |
| `design/` | solo `README.md` in questo repository | Atteso: l'export è sul PC dell'utente |

## 4. Gap analysis (Fase 4)

**Gap.** (1) Nessun controllo meccanico della purezza del dominio e della direzione delle dipendenze: la regola era solo scritta → **aggiunto** `scripts/architettura.test.mjs`. (2) Contraddizione sul fuso non tracciata come decisione bloccante → **aggiunti** D-TIME-2 e CP0. (3) Vincolo degli id numerici delle notifiche non documentato → **aggiunto** in ARCHITETTURA §4 e nei criteri di T-019.

**Incoerenze.** (1) **Vocabolario misto**: `Block{kind,state,start,…}` e `UnitRef{moduleOrder,state,minutes,…}` in inglese contro la regola di `CLAUDE.md` e contro il parser in italiano → **corretto** (D-NAMING-1). (2) Opzioni dell'import `courseId/title` in inglese → **corrette** in `corsoId/titolo`.

**Rischi.** Fuso orario (CP0) · id notifiche a 32 bit · permesso sveglie esatte revocabile · Doze · archiviazione del browser rimovibile · durata del gate nell'hook Stop. Dettaglio e task di riferimento in `docs/02_ARCHITETTURA.md` §8.

**Ridondanze.** La regola di sblocco dei moduli era implementata due volte (`computeModuleStates` nel parser, `openModules` nel puntatore) → **unificata** in `statiModuli()` (D-MODULI-1). La guida esiste come documento condiviso e come `docs/GUIDA_OPERATIVA.md`: ridondanza voluta (copia versionata), dichiarata in testa al file.

**Prematurità.** Nessun elemento prematuro rilevante: niente framework UI, niente database, niente dipendenze non usate. `dev`/`build`/`lint`/`format` correttamente **assenti** finché lo stack non è scelto.

**Omissioni da predisporre ora.** Nessun'altra oltre a quelle già applicate. Da predisporre **al momento giusto**: ESLint + Prettier e `lint` nel gate (T-006, criteri aggiunti), `navigator.storage.persist()` (T-004/T-006), test degli id notifiche (T-019).

**Decisioni corrette da non toccare.** Strati e porte · dominio con "now" come parametro · istanti in epoch ms con aritmetica sul giorno locale (robusta all'ora legale, testata) · test accanto al codice e titolati per scenario · gate unico in hook e CI · test in più fusi · stack deciso dopo il design · identità dei record per la sync prevista nello schema · loop che sceglie il modello per task e si ferma prima di Fable.

## 5. Analisi predittiva (Fase 5)

| Punto di attrito futuro | Perché | Prevenzione |
|---|---|---|
| Schema dati (T-004) costruito su un vocabolario misto | ogni repository, servizio e test avrebbe tradotto fra due nomi dello stesso attributo | vocabolario unificato **ora** |
| Decisione sul fuso presa implicitamente dentro T-004/T-011 | cambiare dopo = migrare i dati e rigenerare le occorrenze | **CP0** prima dei due task |
| Scheduler (T-013) che diventa un modulo enorme | sei cicli con regole proprie | ogni ciclo è una funzione pura già separata o prevista (`lost`, `pointer`, occorrenze, orizzonte); lo scheduler li orchestra soltanto |
| Notifiche (T-019/T-021) con id non numerici | incompatibili con Android; registro da riscrivere | vincolo documentato e testato in T-019 |
| Regola dei moduli divergente fra import e puntatore | un modulo "aperto" nel corso ma "bloccato" per il puntatore | una sola funzione |
| Dominio che assorbe dipendenze di piattaforma | test lenti e non isolabili | test architetturale nel gate |
| Gate lento nell'hook Stop | il loop rallenta con i test UI | soglia e divisione di `verify` documentate (ARCHITETTURA §8) |
| Sync con dispositivi in fusi diversi | dipende da CP0 | decisione registrata prima di T-033 |

Dipendenze circolari: nessuna (il parser dipende dal puntatore, non viceversa). Sostituibilità: piattaforma e persistenza dietro porte; il dominio non cambia se cambia lo stack.

## 6. Script e tooling (Fase 6)

| Script | Stato | Classe |
|---|---|---|
| `check` (tsc), `test`, `test:watch`, `verify` | funzionanti; `verify` = typecheck + 88 test | necessario ora |
| `design:check` | funziona; oggi segnala 45 file mancanti in questo repository (il design è sul PC dell'utente) | necessario ora |
| `audit:claude` | inventario degli accumuli di Claude Code | necessario ora |
| `loop.ps1` / `loop.sh` + `prossimo-task.mjs` | modello per task, stop prima di Fable, tag prima dei task R | necessario ora |
| `dev`, `build` | assenti | più avanti (T-006, dipende dallo stack) |
| `lint`, `format` | assenti | più avanti (T-006, criteri aggiunti) |
| `clean`, `setup` | assenti | non necessari: `npm ci` è il setup; nessun artefatto di build da pulire |
| database / migrazioni | assenti | più avanti (T-004) |
| deploy / release | assenti | più avanti (T-035) |
| CI | `npm ci`, `verify`, test in 3 fusi | necessario ora |

Nessuno script errato.

## 7. Dipendenze e configurazione (Fase 7)

- `typescript`, `vitest`: necessarie. Nessuna dipendenza ridondante o prematura.
- Mancanti per l'architettura documentata, **da aggiungere nel task che le usa** (non ora): framework UI e build (T-006), persistenza locale (T-004), ZIP (T-003), Capacitor e plugin (T-006, T-021), SDK Gemini (T-026), i18n (T-031), client di sync (T-033), ESLint/Prettier (T-006).
- `tsconfig`: `lib` include `DOM` anche per il dominio; il rischio è coperto dal test architetturale, e la separazione per strato è prevista in T-006.
- Node ≥ 20 in `engines`, Node 22 in CI: coerenti.

## 8. Foundation target (Fase 8)

```text
routforge/
├── docs/                    spec (sola lettura) + documenti operativi + AUDIT_FOUNDATION.md + piani/
├── design/                  export di Claude Design (sul PC dell'utente)
├── src/
│   ├── domain/              meccanismi puri — vocabolario unico (D-NAMING-1)
│   │   └── course/          parser del corso (usa statiModuli del puntatore)
│   ├── data/                ← T-004 (dopo CP0)
│   ├── app/ + app/ports/    ← T-013 in poi
│   ├── ui/                  ← T-006 (dopo T-000)
│   └── platform/            ← T-021
├── scripts/                 loop, selettore del task, audit, controllo design, test architetturale
├── .claude/ .vscode/ .github/
└── CLAUDE.md AGENTS.md package.json tsconfig.json vitest.config.ts
```

Le cartelle future **non** vengono create ora: nascono con il primo file che le giustifica (niente struttura vuota).

## 9. Modifiche applicate in questo audit (Fase 9)

| Modifica | Requisito o rischio | Problema prevenuto | Quando |
|---|---|---|---|
| Vocabolario unico nel dominio (rename guidato dal compilatore) | `CLAUDE.md` §4; CONTESTO §3 (testabilità) | conversioni e sinonimi in tutti gli strati futuri | subito (fatto) |
| `statiModuli()` unica; `StatoModulo` in `types.ts` | FORMATO_CORSO §4 | divergenza fra import e puntatore | subito (fatto) |
| Test architetturale nel gate | CLAUDE.md §3; CONTESTO §3 | dominio contaminato da I/O o piattaforma | subito (fatto) |
| Test: unità importata = unità del puntatore | FORMATO_CORSO §4; MECCANISMI §11 | regressione del vocabolario | subito (fatto) |
| D-TIME-2 + CP0 su T-004 e T-011 | CONTESTO §3 vs MECCANISMI §1 | decisione implicita e costosa da invertire | subito (fatto) |
| Vincoli di piattaforma in ARCHITETTURA §8 e criteri di T-006, T-019 | CONTESTO §3 (robustezza), MECCANISMI §13 | notifiche perse, dati rimossi, stile incoerente fra agenti | nei task indicati |

Nessuna business logic, API, UI, database o integrazione aggiunti.

## 10. Validazione (Fase 10)

Eseguito in questo ambiente: `tsc --noEmit` pulito; `vitest run` **88/88** verdi; stessa suite in 4 fusi orari; selettore del loop sul backlog reale (indica T-000 con Fable 5.1); ZIP estratto in una cartella vuota con `npm ci` e `npm run verify` verdi; patch applicabile con `git am` sul commit `7eda970` (verificato).

**Non eseguibile qui**: lint e build (non esistono ancora, per scelta); Claude Code reale, hook e loop su Windows; `design:check` con l'export reale; contenuto prodotto da `/impeccable init` (non incluso in `docs.zip`).

## 11. Modelli (Fase 11)

**Fatti verificati (fonti ufficiali, settembre 2026).**
- Claude Opus 5.5, rilasciato il 22/09/2026: Anthropic dichiara prestazioni al livello di Fable 5.1 per la maggior parte del lavoro. Nello stesso annuncio avverte che a questi livelli i margini dei benchmark sono una guida meno affidabile e che nell'uso interno il divario con Fable 5.1 è più stretto dei punteggi. Tutti i risultati sono misurati a sforzo massimo (fonte: anthropic.com/claude-opus-5-5).
- Piano Max: Fable 5 e 5.1 sono inclusi fino al 50% dei limiti settimanali e li consumano più in fretta degli altri modelli (fonte: support.claude.com, articolo 15424964).
- **"Claude Haiku 5" non esiste**: l'Haiku attuale è 4.5; Anthropic ha annunciato Sonnet 5.5 e Haiku 5.5 "nelle prossime settimane" (annuncio di Opus 5.5).

**Benchmark indipendenti (Artificial Analysis).** Intelligence Index: Opus 5.5 a 58, Fable 5.1 e GPT-6 Astra a 53. Terminal-Bench 4.0: Opus 5.5 al 59,6% nella misura indipendente, contro il 66,4% dichiarato da Anthropic. Opus 5.5 resta dietro su CritPt, AA-LCR (ragionamento a contesto lungo) e GDP.pdf; a sforzo massimo usa circa 119.000 token di output per compito, contro circa 78.000 di Fable 5.1.

**Osservazioni di chi li usa** (Every, Hacker News): Opus 5.5 vicino a Fable sul codice (circa 90%); Fable preferito per pianificazione e problemi grandi.

**Inferenze per RoutForge.**

| Attività | Modello | Perché |
|---|---|---|
| Analisi architetturale, comprensione multi-file a contesto lungo, decisioni irreversibili (T-000, piani di T-013/019/033) | Fable 5.1 | punto dove Opus 5.5 non ha un vantaggio dimostrato (AA-LCR) e dove un errore costa di più |
| Implementazione complessa, refactoring coordinato su più file, debugging | Opus 5.5 | coding agentico al livello di Fable a costo per compito molto minore |
| Funzionalità standard e UI da design | Sonnet 5 | equilibrio fra qualità e quota |
| Modifiche meccaniche con regole chiare | Haiku 4.5 | velocità e costo |
| Revisione indipendente | Codex (gpt-5.6-terra) | errori sistematici diversi da quelli di Claude |

Da riverificare all'uscita di Sonnet 5.5 e Haiku 5.5 e dopo il confronto diretto su T-011 (D-MODEL-1).

## 12. Roadmap di sviluppo

```text
Foundation ............................ FATTA (questo audit)
    ↓
Validazione architetturale ............ T-000 (design + stack, Fable) · CP0 (fuso) · CP1 (veto stack)
    ↓
Infrastruttura di base ................ T-004 schema dati (Opus) · T-006 scaffold UI + lint/format · T-003 lettura ZIP · T-005 corso di esempio
    ↓
Dominio e nucleo ...................... T-011 occorrenze · T-012 orizzonte · T-013 scheduler (piano Fable → codice Opus)
                                        T-016–T-018 sessione ed esiti · T-019–T-020 modello notifiche (piano Fable → codice Opus)
    ↓
Funzionalità applicative (passi 2 e 6 di CONTESTO §6)
                                        T-007 Crea · T-008 Oggi (CP2) · T-009 Dettaglio · T-010 Adesso · T-014 · T-015 · T-022
    ↓
Integrazioni .......................... T-021 notifiche native e sveglie (CP3) · T-023 widget · T-024–T-028 materiali e AI (CP5)
                                        T-033–T-034 sync (CP4, piano Fable → codice Opus)
    ↓
Funzionalità di completamento ......... T-029 statistiche · T-030 backup · T-031 lingue · T-032 impostazioni e diagnostica
    ↓
Test end-to-end ....................... tutti i 45 scenari di SCENARI.md coperti; revisione di fine passo (spec-reviewer + Codex)
    ↓
Hardening ............................. /security-review su AI, file, backup, sync · Oggi < 0,5 s su 500 blocchi · archiviazione persistente · Doze e sveglie esatte su dispositivo
    ↓
Pronto per la produzione .............. T-035 build Android firmata + PWA (CP6) · T-036 iOS (serve un Mac)
```
