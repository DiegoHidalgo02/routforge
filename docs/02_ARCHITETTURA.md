# RoutForge — Architettura

*Come è organizzato il codice e perché. Le regole di comportamento restano nelle spec; qui c'è solo la forma del software. Gli invarianti e la loro verifica sono in `docs/INVARIANTI.md`; le decisioni ad alto impatto hanno una scheda in `docs/decisioni/`.*

## 0. Stack (T-000, D-STACK-1)

**Deciso il 24/09/2026**: TypeScript + React 19 + Vite (PWA) + Capacitor, con Dexie per la persistenza (D-DATA-1).
Criteri, candidati scartati e dettagli presi dal vecchio design (CSS Modules sui token, `lucide-react`, font locali,
`react-router`) in `docs/decisioni/D-STACK-1.md`; i dettagli d'aspetto restano finché l'handoff del nuovo design non li
cambia (`docs/03_HANDOFF_DESIGN_CODE.md`). Il resto del documento descrive lo stack scelto.

## 1. Strati e regola di dipendenza

```
src/
├── domain/      Meccanismi puri (TS senza I/O). L'elenco dei moduli è `src/domain/index.ts`, che li esporta tutti
│                (il gate lo verifica, INV-3). Nomi di file in inglese, vocabolario del modello in italiano (D-NAMING-1)
├── data/        Persistenza locale (Dexie/IndexedDB, D-DATA-1): schema, repository, migrazioni. Nessuna regola di business.
│                Già presente: sample-course/ (M0 e M1 del corso di esempio e il risultato atteso del parser
│                `course-data.js`, FORMATO §0 e §5: D-SAMPLE-1, D-DESIGN-2).
├── app/         Servizi, un modulo per area (`src/app/*.ts`): orchestrano domain + data + porte. I quattro chiave
│                (scheduler, sessione, notifiche, puntatore) sono in §4; poi statistiche (`stats.ts`, §20),
│                sincronizzazione (`sync.ts`, §25), AI, backup, materiali, import del corso.
│   └── ports/   Interfacce verso la piattaforma, un file per area (`src/app/ports/*.ts`: orologio, dispositivo,
│                notifiche, file, rete, PDF, voce, widget, AI, sync); i test usano adapter finti. Nessuna porta Alarms:
│                la sveglia è un attributo della voce di notifica (D-NOTIF-1)
├── ui/          React 19 (D-STACK-1): schermate (Oggi, Crea, Dettaglio, Corsi, Sessione, AI, Statistiche, Notifiche,
│                Impostazioni), componenti, hook. Solo token di `claude-design/design/tokens.css` (importati da `src/main.tsx`, D-DESIGN-4).
└── platform/    Adapter dietro le porte (`src/platform/*.ts`): web (`clock`, `device`, `notifications`, …) e Android
                 con Capacitor (`*Android.ts`, plugin locali in `android/`, D-STACK-1); `src/main.tsx` sceglie quale
                 iniettare
```

**Regola**: `ui → app → data → domain`, e tutti possono usare `domain` (INV-1). `platform` è iniettato in `app`
tramite le porte (`src/app/ports/*.ts`) così i servizi si testano con adapter finti. `domain` non importa nulla dagli altri strati e non usa `Date.now()`.
Verifica: `scripts/architettura.test.mjs` (INV-1, INV-2, INV-3); le regole operative di ogni strato sono in `.claude/rules/`.

## 2. Perché il dominio è puro

CONTESTO §3 chiede che scheduler, esiti/puntatore, notifiche, SM-2, checklist, fasi, parser e sync siano
verificabili in isolamento e che ogni ciclo sia idempotente. Un meccanismo puro (input → output, `now` come
parametro) si testa con date fisse (`local(2026, 9, 23, 7, 0)`) in qualsiasi fuso orario: in CI la suite gira nel fuso
del runner e in quattro fusi diversi (Rome, Los Angeles, Kolkata a mezz'ora, Auckland) e attraversa il cambio d'ora di
ottobre 2026 (`time.test.ts`). Il fuso del processo resta un globale implicito: il dominio è puro rispetto all'orologio,
non rispetto al fuso (D-TIME-1; al cambio di fuso vale l'ora locale di parete e i blocchi futuri si riancorano, D-TIME-2).

## 3. Modello di persistenza (T-004 — Dexie, D-DATA-1, D-DATA-2)

Schema v1 in `src/data/db.ts`, repository in `src/data/repository.ts`. Tabelle Dexie (una per entità di MECC §1), chiave
primaria `id`; campi comuni `id`, `createdAt`, `updatedAt`, `deletedAt|null` (INV-14), più `gestoIl` nei record vivi
che viaggiano (istante dell'ultimo gesto dell'utente, conservato dalle scritture del ciclo; lo usa la fusione della
sync, D-SYNC-4 n. 4). `id` è un UUID v4 generato dal
repository, oppure deterministico dove l'identità è logica: albero del corso (D-PARSE-2), occorrenze di routine (slot:
ricorrenza + giorno locale + orario della ricorrenza, T-011), log fasi (id del blocco), preferenze (id = chiave),
registro notifiche (id = chiave logica). Eliminare lascia una **tombstone minima** `{id, createdAt, updatedAt,
deletedAt}`: fuori dagli indici secondari, così gli indici vedono solo i record vivi; con gli id logici non servono
indici univoci (D-DATA-2). Nomi di
tabelle e campi in italiano come nel dominio (D-NAMING-1). Un campo nuovo non richiede migrazioni; un indice nuovo sì
(versione successiva, additiva).

| Tabella | Indici (oltre a `id`) | Note |
|---|---|---|
| `corsi`, `moduli`, `unita`, `sezioni`, `risorse` | `corsoId` su ogni livello sotto il corso; `moduloId`, `unitaId`, `sezioneId` verso il genitore | Albero import; `unita.markdown` integrale (fonte AI). Non si salvano i campi che il dominio calcola: stato dei moduli, conteggi, unità corrente. `saveCourse` scrive l'albero in una transazione; risorsa = sezione + posizione (`…:R1`); `corsi.esempio` marca il corso di esempio (D-IMPORT-1) |
| `ricorrenze` | `corsoId` | Tipo `Ricorrenza` del dominio: giorni, ora di parete e fuso (D-TIME-2), date, date saltate, fasi (template con id stabili); promemoria in T-019. «Attiva» si calcola (fine assente o ≥ oggi, §7): IndexedDB non indicizza i booleani |
| `blocchi` | `[giornoLocale+inizio]`, `ricorrenzaId`, `stato`, `tipo`, `corsoId` | Un record per occorrenza, con id = slot della ricorrenza (D-DATA-2): resta lo stesso se l'utente la sposta (C4) e la generazione la ritrova con `get`. `giornoLocale`, `orarioInizio`, `orarioFine` e `fuso` li deriva `saveBlock` dagli istanti e li conserva se gli istanti non cambiano (D-TIME-2) |
| `sessioni` | `avvio`, `bloccoId` | Sessioni chiuse (`SessioneChiusa`, T-017): la sessione attiva con i suoi istanti, `chiusura` (`completata`, `terminata_prima`, `abbandonata`), `chiusaIl` (fine reale), `riepilogo` (focus, extra, pause, segmenti, interruzioni incl. "iperfocus", minuti per unità) ed `esito` scelto (`DatiEsito`: esito, confidenza, nota, «conta nel piano»; `null` = abbandonata, T-018) |
| `logFasi` | `ricorrenzaId` | id = id del blocco dell'occorrenza: un log per occorrenza, ricompletare sovrascrive (§5) |
| `mazzi`, `carte` | `mazzi.unitaId`; `carte.mazzoId`, `carte.scadenza` | Stato SM-2 per carta (`facilita`, `intervalloGiorni`, `scadenza`, come `StatoCarta` del dominio) |
| `pratiche` | `unitaId`, `tipo`, `creataIl` | Quiz, DevSwipe, Bug Hunter, Trivia + risultati |
| `conversazioni`, `messaggi` | `conversazioni.ambito`, `conversazioni.ultimoMessaggio`; `messaggi.conversazioneId` | Elenco raggruppato per età (§18) |
| `materiali`, `materialiBinari` | `materiali.unitaId`; `materialiBinari.materialeId` | Metadati separati dal PDF (§17) |
| `fileCodice` | `unitaId`, `sessioneId` | Solo contesto AI |
| `preferenze` | — (id = chiave) | Impostazioni, streak, sessione attiva, ultima apertura (con l'avviso `ritornoAssenza`, D-ASSENZA-1), modello AI, account |
| `registroNotifiche` | — (id = chiave logica) | Chiave logica → id nativo; derivato, escluso da backup e sync (MECC §1) |

## 4. Servizi chiave

- **SchedulerService** (`src/app/scheduler.ts`, T-013, D-SCHED-1) — `runCycle(db, now, fuso)` esegue in **una
  transazione** riancoraggio (D-TIME-2) → estensione delle ricorrenze → spostamento dei todo → reset degli orfani →
  marcatura dei persi → puntatore di ogni corso, con i giudizi di `domain/scheduler/*`, `domain/lost.ts` e
  `domain/pointer.ts`, e restituisce gli id degli avvisi «in ritardo» e «perso» (li arma la riconciliazione dopo il
  ciclo, derivandoli dalle marcature `ritardoIl` e `persoIl`: T-020, D-NOTIF-2; gli id restano per la Diagnostica). `createScheduler(db, clock)`
  dà `run()` e `start()`: all'avvio, al ritorno in primo piano, **ogni minuto** (il ciclo intero: B7, fini alle
  23:59) e a ogni scrittura su `ricorrenze` (CRUD di routine, poi la sync); lo avvia `src/main.tsx`. Dopo la
  transazione, in `run()`, la riconciliazione delle notifiche (T-019). Idempotente: rieseguirlo senza cambiamenti non
  scrive nulla (INV-15); un ciclo che fallisce non scrive e non arriva alla UI. All'avvio e al ritorno in primo piano
  `start()` registra anche l'apertura, dopo un ciclo riuscito (`registerOpening` di `src/app/absence.ts`, T-014,
  D-ASSENZA-1): scrive `preferenze.ultimaApertura` fuori dal ciclo e da INV-15.
- **SessionService** (`src/app/session.ts`, T-016, T-017, T-046, T-047) — una sola sessione attiva (§10); stato persistito in
  `preferenze.sessioneAttiva` per sopravvivere alla chiusura (D4): solo istanti (pause, interruzioni, cambi d'unità,
  salti, ultimo battito e intervalli non verificati), il timer li deriva con `domain/timer.ts` (D-TIMER-1, D-TIMER-2).
  La casistica delle chiusure (ogni caso → riga in `sessioni`, blocco, unità, streak) è in `docs/SESSIONI.md`, un
  test per riga in `src/app/session.test.ts`.
  `startHeartbeat(db, clock)` scrive il battito subito, ogni minuto e al ritorno in primo piano con la porta `Clock`
  (`now`, `every`, `onForeground`, `inForeground`: solo con l'app in primo piano, cioè la scheda visibile sul web;
  su Android anche con il servizio della sessione attivo, T-021),
  fuori dal ciclo (INV-15); più di 30' dall'ultimo battito diventano un intervallo non verificato, fuori dal focus
  finché l'utente non lo conta (§10.4). «Abbandona» dal 65% della durata pianificata chiude con l'esito Continua
  (`abandonPlan`, D-SESS-2). `endSession` e `abandonSession` salvano la sessione
  chiusa in `sessioni` con tipo e riepilogo, nella stessa transazione del blocco; `endSession` riceve l'esito e lo
  scrive con `writeOutcome` di `src/app/outcome.ts` (T-018, D-ESITO-1): unità, blocco (o blocco retroattivo della
  libera che conta), streak in `preferenze.streak` e puntatore del corso. «Registra esito» senza sessione è
  `registerOutcome` dello stesso modulo.
- **NotificationPlanner** = `createNotifications` (`src/app/notifications.ts`, T-019, D-NOTIF-1) — `desiredSet(…, now)`
  di `src/domain/notifications/desiredSet.ts` calcola l'insieme desiderato (§13.3) in modo deterministico (chiave
  `trigger:anticipo:blocco`); `reconcilePlan` confronta col registro e il servizio chiama `cancel(registro − desiderato)`
  e `schedule(desiderato − registro, o cambiate)`, poi riscrive solo la differenza. Innescata da `run()` dello scheduler
  dopo il ciclo e dal `watch` sui suoi ingressi (ogni mutazione di blocco, routine, sessione e impostazioni); la prima
  riconciliazione del processo riarma tutto. **Vincolo**: su Android l'id di una notifica locale è un **intero a 32 bit**:
  FNV-1a con segno, collisioni +1 in ordine di chiave, id del registro conservati. Dentro `desiredSet` stanno anche gli
  one-shot «perso» e «in ritardo» (da `persoIl` e `ritardoIl` + 10 s), il digest (`domain/notifications/digest.ts`, alla
  prossima occorrenza dell'orario, contenuto ricalcolato a ogni riconciliazione) e i posticipi (`preferenze.posticipi`,
  tocco + 10'), così il registro vede gli istanti veri (T-020, D-NOTIF-2); nessuna fascia silenziosa dell'app
  (D-NOTIF-3, T-045); la notifica di prova (`test()`) va direttamente alla porta, fuori dal registro.
- **CoursePointer.recompute(corsoId)** = `recomputePointer` (`src/app/pointer.ts`, T-013) — `pointerPlan` sui blocchi di
  studio futuri `programmati` del corso, scrive solo gli `unitaId` che cambiano; il ciclo lo chiama per ogni corso
  (dopo la generazione e la marcatura persa, FUNZ §8), T-018 dopo ogni esito.

**Schema comune dei meccanismi** (già usato per le notifiche, §13.3): una funzione pura del dominio riceve lo stato
rilevante e `now` e restituisce l'**insieme desiderato** o la **differenza da applicare** (da creare, aggiornare,
eliminare); il servizio applica solo la differenza. Vale per occorrenze (T-011), orizzonte dei todo (T-012), cicli
(T-013) e notifiche (T-019): l'idempotenza diventa un test («seconda esecuzione: differenza vuota») e la persistenza
resta fuori dal dominio.

## 5. UI

- Router con le sezioni di FUNZ §1: Oggi (`/`), Crea (`/crea`), Statistiche, Profilo/Corsi, Notifiche, Diagnostica,
  Impostazioni; dettaglio come pannello laterale su desktop e schermata su mobile (D-UI-1).
- Stato: nessuna libreria; `useSyncExternalStore` sulle query live di Dexie esposte da `app` (deciso in T-006, D-STACK-1).
- Shell (T-006, D-UI-1): `src/ui/Shell.tsx` (BottomNav; da 1024 px sidebar 240), menu del logo utente `src/ui/ProfileMenu.tsx`,
  rotte in `src/ui/App.tsx`; testi con `t()` di `src/ui/i18n` (sei JSON, lingua da `pickLanguage`, MECC §23); punto di
  composizione `src/main.tsx` (font, token, lingua, archiviazione persistente), fuori dagli strati.
- Accessibilità: `prefers-reduced-motion` e scala testo di sistema rispettati (CONTESTO §3); safe area su mobile.
- Stack (D-STACK-1): React 19 + Vite; stili con **CSS Modules** che usano solo i token di `claude-design/design/tokens.css` (importati da `src/main.tsx`, D-DESIGN-4),
  niente Tailwind né stili inline con valori; icone `lucide-react` (tratto 1.75); font Manrope e IBM Plex Mono locali
  (`@fontsource`); rotte con `react-router`.

## 6. Piattaforma (Capacitor, D-STACK-1)

| Capacità | Web | Android | iOS | Note |
|---|---|---|---|---|
| Notifiche locali | solo scheda aperta | sì (background) | sì | plugin `@capacitor/local-notifications` |
| Sveglie a schermo intero | no: notifica che resta finché la si tocca (`requireInteraction`, D-NOTIF-1) | full-screen intent + `SCHEDULE_EXACT_ALARM` | limitato (notifica critica/time-sensitive) | plugin nativo da scrivere (T-021) |
| Non Disturbare | no | `ACCESS_NOTIFICATION_POLICY` | non disponibile → iperfocus vale comunque (§10.4) | T-017 |
| Timer con app chiusa (D-TIMER-2) | no: solo Wake Lock a scheda aperta; battiti e intervallo non verificato (T-047) | servizio in primo piano con notifica-cronometro (T-021) | Live Activity + notifica «tempo scaduto» (T-036) | il tempo oltre 30' dall'ultimo battito non conta nel focus |
| Widget | no | AppWidget in Java (T-023) | "se disponibile" (WidgetKit, dopo) | |
| Backup su cartella documenti | download | `@capacitor/filesystem` Documents | Files | §22 |
| TTS (Trivia) | Web Speech API (si ferma a schermo spento) | plugin locale `VoceTrivia`: coda di `TextToSpeech` con i silenzi (D-NATIVO-4) | da scrivere (T-036) | §18 |
| Schermo acceso | Wake Lock API | plugin keep-awake | idem | §10.4 |

## 7. Comandi di scaffold (T-006 fatto il 25/09/2026; Capacitor in T-021, PWA in T-035)

```bash
# T-006 (fatto): UI web
npm i react react-dom react-router lucide-react @fontsource/manrope @fontsource/ibm-plex-mono
npm i -D @types/react @types/react-dom vite@7 @vitejs/plugin-react@5 eslint-plugin-react-hooks eslint-plugin-jsx-a11y
# Capacitor (fatto il 06/10/2026 per il PDF col visore del sistema, D-MAT-2): core, android, filesystem, cli
npm i -D @capacitor/cli && npx cap init RoutForge com.routforge.app --web-dir dist
npx cap add android            # progetto in android/, versionato; iOS richiede un Mac
npm run build && npx cap sync android && (cd android && ./gradlew assembleDebug)   # APK di debug
# T-021 (fatto): il resto dei plugin
npm i @capacitor/app @capacitor/local-notifications
# T-035: PWA installabile (manifest con nome e icona di CP6)
npm i -D vite-plugin-pwa
```
Vite resta alla 7 finché Vitest è alla 3 (`docs/DIPENDENZE.md`). Ogni pacchetto è «previsto» in `docs/DIPENDENZE.md`:
all'installazione la riga passa a `dev`/`runtime`. Il gate resta `npm run verify`: `check` esegue i due tsconfig (radice senza
DOM; `tsconfig.dom.json` per `ui`, `platform` e `main.tsx`, D-TS-1), il lint include hook di React e accessibilità e ferma
anche gli avvisi (D-LINT-1). Per la UI, Vitest + Testing Library solo dove uno scenario lo richiede (es. G3 riordino).
La versione è una sola, `version` di `package.json`: la legge Vite per Impostazioni (`__VERSIONE__`) e Gradle per l'APK
(`versionName`; `versionCode` = maggiore·10000 + minore·100 + patch), audit P3-30.

## 8. Rischi architetturali noti (audit del 24/09/2026)

| Rischio | Dove colpisce | Cosa prevedere | Quando |
|---|---|---|---|
| Comportamento al cambio di fuso (D-TIME-2) | schema dati, generazione occorrenze, sync fra dispositivi in fusi diversi | **deciso**: ora locale di parete; campi ora di parete e fuso (T-004), riancoraggio delle occorrenze (T-011) come passo del ciclo prima dell'estensione (T-013), sync con ora di parete (T-033) | T-004, T-011, T-013, T-033 |
| Orologi dei dispositivi e «ultimo vince» (MECC §25) | sync: `updatedAt` dal dispositivo; due orologi sfasati invertono l'esito di un conflitto | sorgente dell'istante decisa al **CP4** (D-SYNC-1); test di fusione con orologi sfasati in T-033 | prima di T-033 |
| Chiave AI nella sync (MECC §25) e nel backup (MECC §22 + §1) | privacy dell'utente | cifratura lato client per la sync (D-SYNC-1); esclusione o cifratura nel backup (D-BACKUP-1) | CP4, prima di T-030 e T-033 |
| Numeri di modulo/unità duplicati nello ZIP | id del parser in collisione | **deciso** (D-PARSE-3, T-003): duplicato saltato con avviso, test nel parser | fatto |
| Id delle notifiche interi a 32 bit (Android) | registro notifiche, riconciliazione | **deciso** (D-NOTIF-1): FNV-1a con segno, collisioni +1, test in `src/domain/notifications/desiredSet.test.ts` | fatto (T-019) |
| Permesso "sveglie esatte" revocabile dall'utente (Android 12+): l'app si riavvia e le notifiche esatte programmate vengono cancellate | notifiche e sveglie | la prima riconciliazione del processo riarma tutto il desiderato (T-019, fatto); la Diagnostica mostra lo stato del permesso | T-021, T-032 |
| Doze (Android): le notifiche `allowWhileIdle` possono scattare al massimo una volta ogni 9 minuti per app | trigger ravvicinati (pre, inizio, verifica) | test su dispositivo con Doze; per le sveglie usare le API di allarme esatto | T-021 |
| Archiviazione del browser rimovibile dal sistema (web e WebView) | dati locali (IndexedDB) | richiedere archiviazione persistente (`navigator.storage.persist()`) al primo avvio, mostrarne lo stato in Diagnostica, ricordare il backup | richiesta all'avvio in `src/main.tsx` (T-006, fatto); stato in Diagnostica (T-032) |
| Gate eseguito a ogni fine turno (hook Stop) più lento man mano che crescono i test (UI in particolare) | loop agentico | quando `npm run verify` supera ~60 s, separare `verify` (dominio + unità + regole) da `verify:completo` (UI) e usare il primo nell'hook | quando serve |
| Lib `DOM` visibile al dominio | purezza del dominio | **risolto** (D-TS-1): la radice compila con `ES2022`; `ui` e `platform` hanno `tsconfig.dom.json` (T-006) | fatto |
| Font caricati da Google Fonts nei mock del design | offline (CONTESTO §3), privacy | font impacchettati in locale con `@fontsource` (D-STACK-1); nessuna richiesta di rete per l'aspetto | fatto (T-006) |

## 9. Invarianti e verifiche automatiche

`docs/INVARIANTI.md` elenca ogni proprietà da preservare con la sua verifica. Nel gate oggi: direzione delle dipendenze e
purezza del dominio (`scripts/architettura.test.mjs`), tracciabilità scenari ↔ test (`scripts/tracciabilita.test.mjs`),
registro delle dipendenze (`scripts/dipendenze.test.mjs`), assenza di segreti (`scripts/segreti.test.mjs`), classi dei CSS Modules
(`scripts/classi-css.test.mjs`, INV-23), campi
comuni e tombstone in ogni tabella (`src/data/db.test.ts`, INV-14), lint e formato. Da automatizzare nei task che li
introducono: idempotenza dello scheduler (T-013), adapter che non propagano errori (T-019, T-021). Prima di aggiungere
una regola solo scritta: può essere un test?

## 10. Processo di modifica proporzionato al rischio

Ciclo di ogni task in `docs/05_LOOP_AGENTICO.md` §1; per le modifiche **ad alto impatto** (confini, `types.ts`, schema
dati, porte, modello notifiche, sync, sicurezza) la revisione indipendente di §7 dello stesso documento (D-REVIEW-1).
Le decisioni si registrano in `docs/01_DECISIONI.md`; quelle ad alto impatto hanno una scheda in `docs/decisioni/` con
contesto, decisione, motivazione, alternative, conseguenze e verifica.
