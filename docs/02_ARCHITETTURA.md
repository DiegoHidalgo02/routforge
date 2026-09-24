# RoutForge — Architettura

*Come è organizzato il codice e perché. Le regole di comportamento restano nelle spec; qui c'è solo la forma del software. Gli invarianti e la loro verifica sono in `docs/INVARIANTI.md`; le decisioni ad alto impatto hanno una scheda in `docs/decisioni/`.*

## 0. Scelta dello stack (T-000, decide l'agente dopo l'import del design)

Procedura: (1) `/design` → import completo; `npm run design:check` = 0 mancanti; (2) leggere `claude-design/HANDOFF.md`,
`claude-design/design/DESIGN.md`, `claude-design/design/tokens.css`, `claude-design/support.js`, `claude-design/design/course-data.js` e almeno S1, S4, S15, S20
mobile+desktop; (3) valutare i candidati con i criteri sotto; (4) scrivere la decisione in `docs/01_DECISIONI.md` e
nella scheda `docs/decisioni/D-STACK-1.md` (scelta, motivi, alternative scartate) e in `docs/STATO.md`; (5) adattare §3, §6 e §7 di questo documento,
`docs/DIPENDENZE.md` (righe «previste») e `.claude/rules/ui.md`, `.claude/rules/piattaforma.md`.

| Criterio (in ordine di peso) | Domanda da porre al design |
|---|---|
| Riuso del design | Quanto di `tokens.css` / HTML / `support.js` si porta nell'app senza riscriverlo? (React/Vue/Svelte + CSS: quasi tutto; React Native/Flutter: quasi nulla) |
| Tre piattaforme, un codice | Android, iOS e web installabile con le stesse funzioni (CONTESTO §3) |
| Capacità native richieste | Notifiche in background, sveglie a schermo intero, Non Disturbare, widget Android, TTS, file system: disponibili come plugin? |
| Testabilità | Il dominio resta puro TS (già fatto); i servizi si testano con adapter finti |
| Semplicità e competenze | Curva di apprendimento per l'autore (front-end web) e per gli agenti; niente complessità prematura |
| Reattività | Oggi pronto in < 0,5 s; scheduler in background senza bloccare la UI |

| Candidato | Quando vince |
|---|---|
| **A. TypeScript + React + Vite (PWA) + Capacitor** | Se il design è HTML/CSS riutilizzabile e le capacità native sono coperte dai plugin (atteso) |
| B. Vue/Svelte + Vite + Capacitor | Se `support.js`/gli HTML del design sono più vicini a template che a componenti React |
| C. React Native / Expo | Solo se il design richiede widget nativi non realizzabili in WebView (improbabile) |
| D. Flutter | Solo se A–C falliscono i criteri; costo: riscrivere l'aspetto |

**Deciso in T-000 (24/09/2026): candidato A.** Motivi, alternative e dettagli che discendono dal design (CSS Modules su
`tokens.css`, `lucide-react`, font locali, `react-router`) in `docs/decisioni/D-STACK-1.md`. Il resto del documento
descrive lo stack scelto.

## 1. Strati e regola di dipendenza

```
src/
├── domain/      Meccanismi puri (TS senza I/O). Già presenti: time, types, sm2, streak, pomodoro,
│                practice, pointer, lost, nowBlock, course/parser. In arrivo: scheduler/ (occurrences, horizon, cycles),
│                notifications/ (desiredSet, quietHours, digest), session/ (timer, outcome), stats, sync/ (merge).
│                Nomi di file in inglese, vocabolario del modello in italiano (D-NAMING-1)
├── data/        Persistenza locale (Dexie/IndexedDB, D-DATA-1): schema, repository, migrazioni. Nessuna regola di business.
│                Già presente: sample-course/ (M0, M1 del corso di esempio, copia dell'export del design: D-SAMPLE-1).
├── app/         Servizi: SchedulerService (cicli §9), SessionService (timer §10), NotificationPlanner (§13),
│                CoursePointer (§11), StatsService (§20), SyncService (§25). Orchestrano domain + data + platform.
│   └── ports/   Interfacce verso la piattaforma (Clock, Notifications, Alarms, DoNotDisturb, Widget, FileSystem,
│                TextToSpeech, Haptics, Network, SyncTransport, AiClient, Storage) + adapter finti per i test
├── ui/          React 19 (D-STACK-1): schermate (Oggi, Crea, Dettaglio, Corsi, Sessione, AI, Statistiche, Notifiche,
│                Impostazioni), componenti, hook. Solo token di `claude-design/design/tokens.css`.
└── platform/    Adapter nativi dietro le porte (Capacitor, D-STACK-1): LocalNotifications, AlarmScreen (full-screen intent),
                 DoNotDisturb, Widget (Android), FileSystem/Backup, TextToSpeech, Haptics, Clock.
```

**Regola**: `ui → app → data → domain`. `platform` è iniettato in `app` tramite le porte (`src/app/ports/*.ts`) così
i servizi si testano con adapter finti. `domain` non importa nulla dagli altri strati e non usa `Date.now()`.
Verifica: `scripts/architettura.test.mjs` (INV-1, INV-2, INV-3); le regole operative di ogni strato sono in `.claude/rules/`.

## 2. Perché il dominio è puro

CONTESTO §3 chiede che scheduler, esiti/puntatore, notifiche, SM-2, checklist, fasi, parser e sync siano
verificabili in isolamento e che ogni ciclo sia idempotente. Un meccanismo puro (input → output, `now` come
parametro) si testa con date fisse (`local(2026, 9, 23, 7, 0)`) in qualsiasi fuso orario: in CI la suite gira nel fuso
del runner e in quattro fusi diversi (Rome, Los Angeles, Kolkata a mezz'ora, Auckland) e attraversa il cambio d'ora di
ottobre 2026 (`time.test.ts`). Il fuso del processo resta un globale implicito: il dominio è puro rispetto all'orologio,
non rispetto al fuso (D-TIME-1; al cambio di fuso vale l'ora locale di parete e i blocchi futuri si riancorano, D-TIME-2).

## 3. Modello di persistenza (T-004 — Dexie, D-DATA-1 confermata in T-000)

Tabelle Dexie (una per entità di MECC §1); campi comuni: `id` (UUID v4), `createdAt`, `updatedAt`, `deletedAt|null`.
Nomi di tabelle e campi in italiano come nel dominio (D-NAMING-1).

| Tabella | Chiavi/indici principali | Note |
|---|---|---|
| `corsi`, `moduli`, `unita`, `sezioni`, `risorse` | `corsoId`, `moduloId`, `unitaId`, ordine | Albero import; `unita.markdown` integrale (fonte AI) |
| `ricorrenze` | `corsoId?`, `attiva` | Definizioni routine/studio con fasi (template con id stabili), promemoria, date, date saltate; orario di parete e fuso di calcolo (D-TIME-2) |
| `blocchi` | `[giornoLocale+inizio]`, `ricorrenzaId+inizio` (univoco), `stato`, `tipo`, `corsoId` | Un record per occorrenza; `giornoLocale` calcolato all'inserimento per la vista Giorno in < 0,5 s; per i blocchi futuri anche orario di parete e fuso, per il riancoraggio (D-TIME-2) |
| `sessioni` | `avvio`, `bloccoId?` | Focus, pause, segmenti, interruzioni (incl. "iperfocus"), minuti per unità, tipo di chiusura |
| `logFasi` | chiave occorrenza (`ricorrenzaId+inizio` o `eventoId`) | Riscrittura idempotente (§5) |
| `mazzi`, `carte` | `unitaId`, `carte.scadenza` | Stato SM-2 per carta (`facilita`, `intervalloGiorni`, `scadenza`, come `StatoCarta` del dominio) |
| `pratiche` | `unitaId`, `tipo`, `creataIl` | Quiz, DevSwipe, Bug Hunter, Trivia + risultati |
| `conversazioni`, `messaggi` | `ambito`, `ultimoMessaggio` | Elenco raggruppato per età (§18) |
| `materiali`, `materialiBinari` | `unitaId` | Metadati separati dal PDF (§17) |
| `fileCodice` | `unitaId?`, `sessioneId?` | Solo contesto AI |
| `preferenze` | chiave | Impostazioni, streak, sessione attiva, ultima apertura, modello AI, account |

Il **registro notifiche** (chiave logica → id nativo) sta in una tabella `registroNotifiche` esclusa da backup e sync.

## 4. Servizi chiave

- **SchedulerService.run(now)** — esegue nell'ordine vincolante di §9 usando `domain/lost.ts`, `domain/pointer.ts`,
  e i futuri `domain/scheduler/*`. Invocato a: avvio, primo piano, cambio giorno (timer 60 s sulla data locale),
  CRUD di routine, ricezione sync. Deve essere idempotente: rieseguirlo senza cambiamenti non scrive nulla (INV-15).
- **SessionService** — una sola sessione attiva (§10); stato persistito in `preferenze` per sopravvivere alla chiusura
  (D4); tick derivato dagli istanti assoluti, non da contatori.
- **NotificationPlanner.desiredSet(now)** — calcola l'insieme desiderato (§13.3) in modo deterministico
  (id = hash di trigger+anticipo+blocco); l'adapter fa `cancel(registro − desiderato)` e `schedule(desiderato − registro)`.
  **Vincolo**: su Android l'id di una notifica locale è un **intero a 32 bit**; l'hash deve produrre un intero in
  [-2147483648, 2147483647] (chiave logica testuale → id numerico nel registro), gestendo le collisioni.
- **CoursePointer.recompute(corsoId)** — `assignPointer` sui blocchi futuri `programmati` del corso; chiamato dopo
  ogni esito, marcatura persa di studio, generazione, import.

**Schema comune dei meccanismi** (già usato per le notifiche, §13.3): una funzione pura del dominio riceve lo stato
rilevante e `now` e restituisce l'**insieme desiderato** o la **differenza da applicare** (da creare, aggiornare,
eliminare); il servizio applica solo la differenza. Vale per occorrenze (T-011), orizzonte dei todo (T-012), cicli
(T-013) e notifiche (T-019): l'idempotenza diventa un test («seconda esecuzione: differenza vuota») e la persistenza
resta fuori dal dominio.

## 5. UI

- Router con le sezioni di FUNZ §1: Oggi (`/`), Crea (`/crea`), Statistiche, Profilo/Corsi, Notifiche, Diagnostica,
  Impostazioni; dettaglio come pannello laterale su desktop (S5 Panel) e schermata su mobile (S5 Mobile).
- Stato: store leggero (Zustand o `useSyncExternalStore` su Dexie live queries) — deciso in T-006.
- Accessibilità: `prefers-reduced-motion` e scala testo di sistema rispettati (CONTESTO §3); safe area su mobile.
- Nessun colore/spaziatura fuori da `claude-design/design/tokens.css`.
- Stack (D-STACK-1): React 19 + Vite; stili con **CSS Modules** che usano solo i token di `src/ui/styles/tokens.css`
  (copia di `claude-design/design/tokens.css`), niente Tailwind né stili inline con valori; icone `lucide-react` (tratto
  1.75); font Manrope e IBM Plex Mono locali (`@fontsource`); rotte con `react-router`. Le schermate dei mock si
  ricreano come componenti: Panel + cornice mobile/desktop, come nell'export.

## 6. Piattaforma (Capacitor, D-STACK-1)

| Capacità | Web | Android | iOS | Note |
|---|---|---|---|---|
| Notifiche locali | solo scheda aperta | sì (background) | sì | plugin `@capacitor/local-notifications` |
| Sveglie a schermo intero | no | full-screen intent + `SCHEDULE_EXACT_ALARM` | limitato (notifica critica/time-sensitive) | plugin nativo da scrivere (T-021) |
| Non Disturbare | no | `ACCESS_NOTIFICATION_POLICY` | non disponibile → iperfocus vale comunque (§10.4) | T-017 |
| Widget | no | Kotlin AppWidget (T-023) | "se disponibile" (WidgetKit, dopo) | |
| Backup su cartella documenti | download | `@capacitor/filesystem` Documents | Files | §22 |
| TTS (Trivia) | Web Speech API | `@capacitor-community/text-to-speech` | idem | §18 |
| Schermo acceso | Wake Lock API | plugin keep-awake | idem | §10.4 |

## 7. Comandi di scaffold per T-006 (stack deciso in T-000, D-STACK-1)

```bash
npm create vite@latest . -- --template react-ts        # nel repo esistente (mantieni package.json esistente: fondi gli script)
npm i react react-dom react-router lucide-react @fontsource/manrope @fontsource/ibm-plex-mono
npm i -D @vitejs/plugin-react vite vite-plugin-pwa @types/react @types/react-dom
npm i -D eslint-plugin-react-hooks eslint-plugin-jsx-a11y
npm i @capacitor/core @capacitor/app @capacitor/local-notifications @capacitor/filesystem @capacitor/haptics
npm i -D @capacitor/cli && npx cap init RoutForge com.routforge.app --web-dir dist
npm i dexie
npx cap add android            # richiede Android Studio (Checkpoint 3); iOS richiede un Mac
cp claude-design/design/tokens.css src/ui/styles/tokens.css   # senza modifiche (INV: nessun valore fuori dai token)
```
Ogni pacchetto è già «previsto» in `docs/DIPENDENZE.md`: all'installazione la riga passa a `dev`/`runtime`.
Il gate resta `npm run verify`; ai test di dominio si aggiungono test dei servizi (adapter finti) e, per la UI,
Vitest + Testing Library solo dove uno scenario lo richiede (es. G3 trascinamento). ESLint e Prettier sono già nel gate
(D-LINT-1): T-006 aggiunge le regole del framework e un `tsconfig` con lib `DOM` per `ui` e `platform` (D-TS-1).

## 8. Rischi architetturali noti (audit del 24/09/2026)

| Rischio | Dove colpisce | Cosa prevedere | Quando |
|---|---|---|---|
| Comportamento al cambio di fuso (D-TIME-2) | schema dati, generazione occorrenze, sync fra dispositivi in fusi diversi | **deciso**: ora locale di parete; campi ora di parete e fuso (T-004), riancoraggio delle occorrenze (T-011) come passo del ciclo prima dell'estensione (T-013), sync con ora di parete (T-033) | T-004, T-011, T-013, T-033 |
| Orologi dei dispositivi e «ultimo vince» (MECC §25) | sync: `updatedAt` dal dispositivo; due orologi sfasati invertono l'esito di un conflitto | sorgente dell'istante decisa al **CP4** (D-SYNC-1); test di fusione con orologi sfasati in T-033 | prima di T-033 |
| Chiave AI nella sync (MECC §25) e nel backup (MECC §22 + §1) | privacy dell'utente | cifratura lato client per la sync (D-SYNC-1); esclusione o cifratura nel backup (D-BACKUP-1) | CP4, prima di T-030 e T-033 |
| Numeri di modulo/unità duplicati nello ZIP | id del parser in collisione | **deciso** (D-PARSE-3, T-003): duplicato saltato con avviso, test nel parser | fatto |
| Id delle notifiche interi a 32 bit (Android) | registro notifiche, riconciliazione | hash → intero a 32 bit, gestione collisioni, test dedicato | T-019 |
| Permesso "sveglie esatte" revocabile dall'utente (Android 12+): l'app si riavvia e le notifiche esatte programmate vengono cancellate | notifiche e sveglie | la riconciliazione all'avvio (ciclo §9) le ricrea; la Diagnostica mostra lo stato del permesso | T-019, T-021 |
| Doze (Android): le notifiche `allowWhileIdle` possono scattare al massimo una volta ogni 9 minuti per app | trigger ravvicinati (pre, inizio, verifica) | test su dispositivo con Doze; per le sveglie usare le API di allarme esatto | T-021 |
| Archiviazione del browser rimovibile dal sistema (web e WebView) | dati locali (IndexedDB) | richiedere archiviazione persistente (`navigator.storage.persist()`), mostrarne lo stato in Diagnostica, ricordare il backup | T-004, T-006, T-032 |
| Gate eseguito a ogni fine turno (hook Stop) più lento man mano che crescono i test (UI in particolare) | loop agentico | quando `npm run verify` supera ~60 s, separare `verify` (dominio + unità + regole) da `verify:completo` (UI) e usare il primo nell'hook | quando serve |
| Lib `DOM` visibile al dominio | purezza del dominio | **risolto** (D-TS-1): la radice compila con `ES2022`; `ui` e `platform` avranno il proprio `tsconfig` in T-006 | fatto |
| Font caricati da Google Fonts nei mock del design | offline (CONTESTO §3), privacy | font impacchettati in locale con `@fontsource` (D-STACK-1); nessuna richiesta di rete per l'aspetto | T-006 |

## 9. Invarianti e verifiche automatiche

`docs/INVARIANTI.md` elenca ogni proprietà da preservare con la sua verifica. Nel gate oggi: direzione delle dipendenze e
purezza del dominio (`scripts/architettura.test.mjs`), tracciabilità scenari ↔ test (`scripts/tracciabilita.test.mjs`),
registro delle dipendenze (`scripts/dipendenze.test.mjs`), assenza di segreti (`scripts/segreti.test.mjs`), lint e
formato. Da automatizzare nei task che li introducono: schema con campi comuni (T-004), idempotenza dello scheduler
(T-013), adapter che non propagano errori (T-019, T-021). Prima di aggiungere una regola solo scritta: può essere un test?

## 10. Processo di modifica proporzionato al rischio

Ciclo di ogni task in `docs/05_LOOP_AGENTICO.md` §1; per le modifiche **ad alto impatto** (confini, `types.ts`, schema
dati, porte, modello notifiche, sync, sicurezza) la revisione indipendente di §7 dello stesso documento (D-REVIEW-1).
Le decisioni si registrano in `docs/01_DECISIONI.md`; quelle ad alto impatto hanno una scheda in `docs/decisioni/` con
contesto, decisione, motivazione, alternative, conseguenze e verifica.
