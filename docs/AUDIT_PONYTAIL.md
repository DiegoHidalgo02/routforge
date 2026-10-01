# Audit ponytail (over-engineering) — 01/10/2026

*Revisione dell'intero albero chiesta dall'utente il 01/10/2026 («ottimizzare ed efficientare il codice e la struttura»).
Quattro scansioni per strato (dominio; app, dati e piattaforma; UI; script e configurazione) più tre controlli
meccanici (export mai importati, chiavi i18n morte, blocchi CSS identici fra moduli). Solo complessità: correttezza,
sicurezza e prestazioni sono fuori perimetro. Proposte: circa −1.000 righe; applicate con giudizio, mai contro una
decisione registrata (`docs/01_DECISIONI.md`) né contro il backlog.*

**Esito**: tre commit, 66 file, +405/−863 righe (−458 nette su 26.360 di sorgenti, test e CSS), gate verde a ogni
passo (689 test: due test ridondanti in meno), dominio e app ripetuti in Auckland e Los Angeles, Oggi e Sessione
riviste in Edge headless a 360 e 1280 (`coverage/cdp-t043.mjs`, `coverage/cdp-t047.mjs`).

## 1. Applicato

### Dominio, app e dati — commit `35c4de6` (24 file, +110/−237)

| Strato | Taglio |
|---|---|
| domain/time | `startOfLocalDay`/`endOfLocalDay` con `setHours`, `addLocalDays` con `setDate`, `localDayKey` in una riga |
| domain | regole duplicate ricondotte a una sede (INV-13): `at` → `isDayKey`, `recurrenceLastDay` → `shiftPeriod`, `dayStart` → `localInstant`, `inheritedDay` in una riga |
| domain | codice morto: `blockDay`, `previewAll` (D-DESIGN-1 n. 9), `courseProgress`, `totalMinutes`, `Segmento.ciclo`, `BUG_HUNTER_MAX_ATTEMPTS` |
| domain/notifications | `voceSenzaBlocco` al posto di tre literal a 12 campi (tempo scaduto, digest, prova) |
| domain | `canCheckRoutine`, `orphanPlan`, `lostPlan`, `sessionMinutes` in forma diretta |
| app | `completed`/`reopened` scritti direttamente con `saveBlock`, `BATTITO` → `MINUTE`, `sessionDevice` con un solo `safe`, re-export di `ErroreImportCorso` tolto (la UI importa dal dominio) |
| data | `inTransaction` passa i nomi a Dexie, `listBy`/`listKeyRange` in una riga, `blocksOfDay` → `blocksBetween` |

### UI — commit `d651a7f` (29 file, +191/−477)

- La mappa tipo → `--fill/--ink/--soft/--light/--deep` sta in `src/ui/styles/global.css` (i selettori d'attributo
  non sono rinominati dai CSS Modules: era già globale); via le copie parziali di NowBlock, Create e Detail.
- `composes` al posto delle copie: Session compone `.chip`, `.interruttore`, `.knob` da Create; NowBlock e Detail
  compongono `.badge` da Today; Detail compone `.testoToast`/`.annullaToast` da Today e `.fase`/`.numero` da Create.
  Vale perché l'ordine nel bundle è quello degli import di `App.tsx` (Create prima di Session).
- `.soloDesktop` con una sola media query (`width < 1024px`) al posto di `display: revert` più tre override;
  `.card` di NowBlock ed `.elencoGiorno` di Today dichiarate una volta; classe `.inCorso` morta tolta.
- Gli otto wrapper `watchX` dei servizi (absence, calendar, completion, courses, nowBlock, session ×3) sparivano:
  facevano solo `watch(() => readX(db, …), onChange)`. Le schermate osservano con `watch(() => readX(appDb, …), set)`,
  con `watch` ri-esportato da `src/app/db.ts` (la UI non importa da `data`, INV-1).
- `format.ts` offre `fuso`, `fmtData`, `SETTIMANA`; `TIPO` e `titolo` di Detail vengono da lì; i chip delle durate del
  setup sono un solo `map`; «Riapri» del todo e della routine è un solo bottone; `VISTE` è un array di nomi; `useNow(ms)`
  genera `useMinuto` e `useSecondo`; `Section` perde la prop `inizio` mai passata; tre chiavi i18n morte
  (`meseVuoto`, `avviataAlle`, `abbandona`) tolte dalle sei lingue.

### Script e configurazione — commit `3c76e5d` (15 file, +104/−149)

- `import.meta.dirname`/`filename` (Node ≥ 20.11, `engines` aggiornato) al posto di `dirname(fileURLToPath(import.meta.url))`
  in nove script; walker ricorsivi → `readdirSync(dir, { recursive: true })` in architettura, tracciabilità e
  check-design (segreti tiene il suo walker: deve potare `node_modules`; audit-claude è strumento dell'utente).
- `check-design.mjs`: elenco atteso di soli nomi (`found` accettava già qualunque sottocartella).
- `vitest.config.ts` dentro `vite.config.ts` (`test` con `/// <reference types="vitest/config" />`, JSX dal plugin);
  `tsconfig.json` senza `esModuleInterop` e `forceConsistentCasingInFileNames` (ridondanti); `check` senza
  `--noEmit` ripetuto; `.vscode/settings.json` punta a `vite.config.ts`.
- Via il test-fotografia del backlog «oggi il loop si ferma a T-021» (da riscrivere a ogni chiusura di task; i casi
  sintetici e il parsing del backlog reale coprono la logica) e l'autotest di `toMatchObject` in corso-esempio.

## 2. Proposto e non applicato (con il motivo)

- I 19 `::after` dell'area di tocco 44 in una classe globale: gli `inset` differiscono per elemento (`100%`, `40px`,
  `--space-6`, con o senza i lati); una regola sola servirebbe due varianti e una prova dei bersagli di tocco, che
  nessuno screenshot mostra. Rinviato.
- `.primaria`/`.secondaria` di Detail composte da `.inizia`/`.abbandona` di Session: porterebbero `flex: 1` e
  `max-width` ai bottoni secondari (layout diverso). Rinviato.
- `<dialog>` annidato per la sheet del Dettaglio e il ref-callback `showModal` al posto di `useEffect`: `showModal` due
  volte in StrictMode e i dialog annidati hanno comportamenti da provare nel browser. Rinviato.
- L'inline di `Segmentato` e `Suggerimento` (componenti con un solo chiamante): un componente con un chiamante non è
  over-engineering, è un nome.
- La proiezione a mano di `UnitaSetup` (sei campi): intenzionale, le righe intere delle unità portano il markdown.
- `stessaVoce` con `JSON.stringify` su tutti i campi, tabella `DELTA` per `review` di SM-2, factory `closed(stato)` per
  `completed`/`skipped`, ternari al posto degli `switch` sui tipi: meno righe ma meno leggibili; «noioso batte furbo».
- Riscrittura di `pendingOutcomes` su `canRegisterOutcome`: cambia un confine (`fine` nulla, `≥`) senza un task che la
  usi (T-022). Rinviato a T-022.

## 3. Tenuto apposta (lo prevedono spec, decisioni o backlog)

- Servizi scritti prima della loro UI, con test che coprono scenari: `snoozeNotification` (T-021), `test()` della
  notifica di prova (T-032, D-NOTIF-2), `deleteRecurrence` (T-042), `readStreak` (T-029, usato da D7),
  `importCourseFromZip` (l'inline sposterebbe i test al livello del database), `pendingOutcomes` (T-022), moduli
  `sm2.ts` e `practice.ts` (passi 7–8 di CONTESTO §6). Cancellarli oggi e riscriverli al loro task è churn e toglie
  copertura in TRACCIABILITA.
- `AvvisiCiclo.avvisiRitardo/avvisiPerso` e il ritorno di `rollTodos`: la Diagnostica (T-032) li legge (D-SCHED-1,
  D-NOTIF-2).
- Le otto tabelle vuote di `SCHEMA_V1` (mazzi, carte, pratiche, …): «la versione 1 non si modifica»
  (`.claude/rules/dati.md`); toglierle è un cambio di schema che decide l'utente.
- Due `tsconfig`: D-TS-1 verifica il dominio senza la lib DOM; un solo file perderebbe la garanzia.
- Strumenti dell'utente: archiviazione di `scripts/audit-claude.mjs` (~100 righe), la sezione «altri agenti»
  (Codex), `scripts/loop.ps1` accanto a `loop.sh` (PowerShell è la shell dell'utente), `--forza-modello`, gli hook di
  `.claude/hooks`, gli ignore di `coverage/` (contiene gli script CDP, da non lintare), `@vitejs/plugin-react` (Fast
  Refresh), `scripts/token.test.mjs` come file a sé (citato da `.claude/rules/test.md`).
- Export usati solo internamente o dai test (15 costanti e tipi): togliere `export` non riduce righe; da fare quando si
  tocca il file. `SOGLIA_NON_VERIFICATO` resta separata da `LOST_GRACE_MS`: stesso valore, regole diverse (D-TIMER-2).
- Fixture duplicate nei test (`orologioFinto` in scheduler e session, `modulo`/`unita` in outcome e session, ~70 righe):
  un `src/app/fixtures.ts` condiviso è possibile; non fatto per non accoppiare i test fra loro.

## 4. Numeri dei controlli meccanici (01/10, prima dei tagli)

- 14 funzioni esportate usate solo dai test (quasi tutte della sezione 3); 3 chiavi i18n morte su 335; 1 classe CSS
  morta; 92 righe di CSS identico ripetuto fra moduli su 5.524 (1,7 %).
- Dipendenze: tutte usate (fflate legge la directory ZIP, che `DecompressionStream` non fa; `@fontsource` è l'unico
  modo offline; ogni devDependency ha un uso).
