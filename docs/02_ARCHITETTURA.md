# RoutForge — Architettura

*Come è organizzato il codice e perché. Le regole di comportamento restano nelle spec; qui c'è solo la forma del software.*

## 0. Scelta dello stack (T-000, decide l'agente dopo l'import del design)

Procedura: (1) `/design` → import completo; `npm run design:check` = 0 mancanti; (2) leggere `design/HANDOFF.md`,
`design/DESIGN.md`, `design/tokens.css`, `design/support.js`, `design/course-data.js` e almeno S1, S4, S15, S20
mobile+desktop; (3) valutare i candidati con i criteri sotto; (4) scrivere la decisione in `docs/01_DECISIONI.md`
(D-STACK-1: scelta, motivi, alternative scartate) e in `docs/STATO.md`; (5) adattare §3, §6 e §7 di questo documento.

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

Finché T-000 non è chiuso, il resto di questo documento descrive il **candidato A** e va adattato alla scelta.

## 1. Strati e regola di dipendenza

```
src/
├── domain/      Meccanismi puri (TS senza I/O). Già presenti: time, types, sm2, streak, pomodoro,
│                practice, pointer, lost, nowBlock. In arrivo: course/parser, scheduler, notifications, session
├── data/        Persistenza locale (candidato A: Dexie/IndexedDB): schema, repository, migrazioni. Nessuna regola di business.
├── app/         Servizi: SchedulerService (cicli §9), SessionService (timer §10), NotificationPlanner (§13),
│                CoursePointer (§11), StatsService (§20), SyncService (§25). Orchestrano domain + data + platform.
├── ui/          Framework scelto in T-000 (candidato A: React 19): schermate (Oggi, Crea, Dettaglio, Corsi, Sessione, AI, Statistiche, Notifiche,
│                Impostazioni), componenti, hook. Solo token di `design/tokens.css`.
└── platform/    Adapter nativi dietro interfacce TS (candidato A: Capacitor): LocalNotifications, AlarmScreen (full-screen intent),
                 DoNotDisturb, Widget (Android), FileSystem/Backup, TextToSpeech, Haptics, Clock.
```

**Regola**: `ui → app → data → domain`. `platform` è iniettato in `app` tramite interfacce (`src/app/ports/*.ts`) così
i servizi si testano con adapter finti. `domain` non importa nulla dagli altri strati e non usa `Date.now()`.

## 2. Perché il dominio è puro

CONTESTO §3 chiede che scheduler, esiti/puntatore, notifiche, SM-2, checklist, fasi, parser e sync siano
verificabili in isolamento e che ogni ciclo sia idempotente. Un meccanismo puro (input → output, `now` come
parametro) si testa con date fisse (`local(2026, 9, 23, 7, 0)`) in qualsiasi fuso orario: la suite viene
eseguita in quattro fusi (Rome, Los Angeles, Kolkata, Auckland) e attraversa il cambio d'ora di ottobre 2026.

## 3. Modello di persistenza (T-004 — candidato A: Dexie)

Tabelle Dexie (una per entità di MECC §1); campi comuni: `id` (UUID v4), `createdAt`, `updatedAt`, `deletedAt|null`.

| Tabella | Chiavi/indici principali | Note |
|---|---|---|
| `corsi`, `moduli`, `unita`, `sezioni`, `risorse` | `corsoId`, `moduloId`, `unitaId`, ordine | Albero import; `unita.markdown` integrale (fonte AI) |
| `ricorrenze` | `corsoId?`, `attiva` | Definizioni routine/studio con fasi (template con id stabili), promemoria, date, date saltate |
| `blocchi` | `[giornoLocale+inizio]`, `ricorrenzaId+inizio` (univoco), `stato`, `tipo`, `corsoId` | Un record per occorrenza; `giornoLocale` calcolato all'inserimento per la vista Giorno in < 0,5 s |
| `sessioni` | `avvio`, `bloccoId?` | Focus, pause, segmenti, interruzioni (incl. "iperfocus"), minuti per unità, tipo di chiusura |
| `logFasi` | chiave occorrenza (`ricorrenzaId+inizio` o `eventoId`) | Riscrittura idempotente (§5) |
| `mazzi`, `carte` | `unitaId`, `carte.dueAt` | Stato SM-2 per carta (`ease`, `intervalDays`, `dueAt`) |
| `pratiche` | `unitaId`, `tipo`, `creataIl` | Quiz, DevSwipe, Bug Hunter, Trivia + risultati |
| `conversazioni`, `messaggi` | `ambito`, `ultimoMessaggio` | Elenco raggruppato per età (§18) |
| `materiali`, `materialiBinari` | `unitaId` | Metadati separati dal PDF (§17) |
| `fileCodice` | `unitaId?`, `sessioneId?` | Solo contesto AI |
| `preferenze` | chiave | Impostazioni, streak, sessione attiva, ultima apertura, modello AI, account |

Il **registro notifiche** (chiave logica → id nativo) sta in una tabella `registroNotifiche` esclusa da backup e sync.

## 4. Servizi chiave

- **SchedulerService.run(now)** — esegue nell'ordine vincolante di §9 usando `domain/lost.ts`, `domain/pointer.ts`,
  e i futuri `domain/scheduler/*`. Invocato a: avvio, primo piano, cambio giorno (timer 60 s sulla data locale),
  CRUD di routine, ricezione sync. Deve essere idempotente: rieseguirlo senza cambiamenti non scrive nulla.
- **SessionService** — una sola sessione attiva (§10); stato persistito in `preferenze` per sopravvivere alla chiusura
  (D4); tick derivato dagli istanti assoluti, non da contatori.
- **NotificationPlanner.desiredSet(now)** — calcola l'insieme desiderato (§13.3) in modo deterministico
  (id = hash di trigger+anticipo+blocco); l'adapter fa `cancel(registro − desiderato)` e `schedule(desiderato − registro)`.
- **CoursePointer.recompute(corsoId)** — `assignPointer` sui blocchi futuri `programmati` del corso; chiamato dopo
  ogni esito, marcatura persa di studio, generazione, import.

## 5. UI

- Router con le sezioni di FUNZ §1: Oggi (`/`), Crea (`/crea`), Statistiche, Profilo/Corsi, Notifiche, Diagnostica,
  Impostazioni; dettaglio come pannello laterale su desktop (S5 Panel) e schermata su mobile (S5 Mobile).
- Stato: store leggero (Zustand o `useSyncExternalStore` su Dexie live queries) — deciso in T-006.
- Accessibilità: `prefers-reduced-motion` e scala testo di sistema rispettati (CONTESTO §3); safe area su mobile.
- Nessun colore/spaziatura fuori da `design/tokens.css`.

## 6. Piattaforma (candidato A: Capacitor)

| Capacità | Web | Android | iOS | Note |
|---|---|---|---|---|
| Notifiche locali | solo scheda aperta | sì (background) | sì | plugin `@capacitor/local-notifications` |
| Sveglie a schermo intero | no | full-screen intent + `SCHEDULE_EXACT_ALARM` | limitato (notifica critica/time-sensitive) | plugin nativo da scrivere (T-021) |
| Non Disturbare | no | `ACCESS_NOTIFICATION_POLICY` | non disponibile → iperfocus vale comunque (§10.4) | T-017 |
| Widget | no | Kotlin AppWidget (T-023) | "se disponibile" (WidgetKit, dopo) | |
| Backup su cartella documenti | download | `@capacitor/filesystem` Documents | Files | §22 |
| TTS (Trivia) | Web Speech API | `@capacitor-community/text-to-speech` | idem | §18 |
| Schermo acceso | Wake Lock API | plugin keep-awake | idem | §10.4 |

## 7. Comandi di scaffold per T-006 (candidato A; da adattare alla decisione di T-000)

```bash
npm create vite@latest . -- --template react-ts        # nel repo esistente (mantieni package.json esistente: fondi gli script)
npm i react react-dom
npm i -D @vitejs/plugin-react vite vite-plugin-pwa @types/react @types/react-dom
npm i @capacitor/core @capacitor/app @capacitor/local-notifications @capacitor/filesystem @capacitor/haptics
npm i -D @capacitor/cli && npx cap init RoutForge com.routforge.app --web-dir dist
npm i dexie
npx cap add android            # richiede Android Studio (Checkpoint 3); iOS richiede un Mac
cp design/tokens.css src/ui/styles/tokens.css
```
Il gate resta `npm run verify`; ai test di dominio si aggiungono test dei servizi (adapter finti) e, per la UI,
Vitest + Testing Library solo dove uno scenario lo richiede (es. G3 trascinamento).
