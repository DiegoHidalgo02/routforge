# Audit ponytail (over-engineering) — 01/10/2026

*Revisione dell'intero albero chiesta dall'utente il 01/10/2026 («ottimizzare ed efficientare il codice e la struttura»).
Quattro scansioni per strato (dominio; app, dati e piattaforma; UI; script e configurazione) più tre controlli
meccanici (export mai importati, chiavi i18n morte, blocchi CSS identici fra moduli). Solo complessità: correttezza,
sicurezza e prestazioni sono fuori perimetro. Proposte totali: circa −1.000 righe; applicate con giudizio, mai contro una
decisione registrata (`docs/01_DECISIONI.md`) né contro il backlog.*

## 1. Applicato (commit `35c4de6`, gate verde: 691 test; dominio e app ripetuti in Auckland e Los Angeles)

| Strato | Taglio | Righe |
|---|---|---|
| domain/time | `startOfLocalDay`/`endOfLocalDay` con `setHours`, `addLocalDays` con `setDate`, `localDayKey` in una riga | −18 |
| domain | regole duplicate ricondotte a una sede (INV-13): `at` → `isDayKey`, `recurrenceLastDay` → `shiftPeriod`, `dayStart` → `localInstant`, `inheritedDay` in una riga | −14 |
| domain | codice morto: `blockDay`, `previewAll` (D-DESIGN-1 n. 9), `courseProgress`, `totalMinutes`, `Segmento.ciclo`, `BUG_HUNTER_MAX_ATTEMPTS` | −35 |
| domain/notifications | `voceSenzaBlocco` al posto di tre literal a 12 campi (tempo scaduto, digest, prova) | −20 |
| domain | `canCheckRoutine`, `orphanPlan`, `lostPlan`, `sessionMinutes` in forma diretta | −12 |
| app | `completed`/`reopened` scritti direttamente con `saveBlock` (via `writeCompleted`/`writeReopened`), `BATTITO` → `MINUTE`, `sessionDevice` con un solo `safe`, re-export di `ErroreImportCorso` tolto | −22 |
| data | `inTransaction` passa i nomi a Dexie, `listBy`/`listKeyRange` in una riga, `blocksOfDay` → `blocksBetween` | −6 |

Totale: 24 file, +110/−237.

## 2. Da applicare (deciso, non ancora fatto: la sessione si è fermata per il limite d'uso)

**UI** (un commit, poi `coverage/cdp-t043.mjs` e `coverage/cdp-t047.mjs` per la verifica visiva di Oggi e Sessione):
- La mappa tipo → `--fill/--ink/--soft/--light/--deep` (quattro blocchi `[data-tipo='…']`) va da `Today.module.css` a
  `src/ui/styles/global.css`: i selettori d'attributo sono già globali (CSS Modules non li rinomina). Cancellare le copie
  parziali `.card[data-tipo]` (NowBlock), `.pannello[data-tipo]` e `.tipo[data-tipo]` (Create), `.pannello[data-tipo]`
  (Detail): stessi valori (−68).
- `Session.module.css`: `.chip`, `.interruttore`, `.knob` con `composes … from './Create.module.css'` più le sole
  differenze (`min-width`, `gap: 6px`, `font`, `min-height: var(--size-control)`, knob acceso `--color-primary`); via
  `.chip::after`, `.chip:hover`, `.chip[aria-pressed]`, `.knob::after`, `.interruttore[aria-checked] .knob::after`
  (−40; l'ordine Create → Session nel bundle è quello di `App.tsx`, già sfruttato da Detail).
- `.badge` di NowBlock e Detail (`.badge, .badgeTodo` con `align-self`) compongono da Today (−20); `.testoToast` e
  `.annullaToast` di Detail compongono da Today (−12, hover `surface-2` come Oggi); `.numero`/`.fase` di Detail
  compongono `numeroFase`/`fase` di Create (−8).
- `.soloDesktop`: solo `@media (width < 1024px) { .soloDesktop { display: none !important } }`; via `display: revert`
  e gli override `.frecce`/`.segmentato` (−10). `.card` doppia in NowBlock (`--stato-testo` nel primo blocco) e
  `.elencoGiorno` doppia nella media query di Today: un blocco solo (−9). Classe `.inCorso` morta in Session (−10).
- Chiavi i18n morte nei sei json: `meseVuoto`, `avviataAlle`, `abbandona` (−18).
- `Session.tsx`: i tre chip di durata scritti a mano diventano `[...DURATE, 'personalizzata', null].map(…)` (−16).
- `format.ts`: `fuso()`, `fmtData` (sigla · giorno · mese breve), `SETTIMANA`, `dataDi(giorno): Date`; via le copie
  in Detail, Create, Session, Today (−11); `TIPO` e `titolo` di Detail importati da `format.ts` (−7).
- `Detail.tsx`: il bottone «Riapri» è identico nei rami todo e routine: una costante (−7). `Today.tsx`:
  `VISTE = ['giorno','settimana','mese'] as const` (−4). `clock.ts`: `useNow(ms)` con `useMinuto`/`useSecondo`
  one-liner (−4). `Section`: via la prop `inizio` mai passata (−3).
- Gli otto wrapper `watchX` di `app` (absence, calendar, completion, courses, nowBlock, session ×3) fanno solo
  `watch(() => readX(…), onChange)`: `export { watch } from '../data/repository'` in `src/app/db.ts` e nelle schermate
  `useEffect(() => watch(() => readX(appDb, …), set), [...])`; anche in `scheduler.test.ts:552` (−35).
- Non applicare: i 19 `::after` dell'area di tocco (gli `inset` differiscono per elemento: una regola globale servirebbe
  due varianti e una prova dei bersagli); `.primaria`/`.secondaria` composte da `.inizia`/`.abbandona` (porterebbero
  `flex: 1` ai secondari); `<dialog>` annidato per la sheet del Dettaglio e il ref-callback `showModal` (rischio in
  StrictMode); l'inline di `Segmentato` e `Suggerimento` (componenti con un chiamante non sono over-engineering).

**Script e configurazione** (un commit):
- Cinque walker ricorsivi a mano → `readdirSync(dir, { recursive: true })` (architettura, tracciabilita, segreti,
  check-design, audit-claude) (−45); `dirname(fileURLToPath(import.meta.url))` ×9 → `import.meta.dirname`
  (`engines` → `>=20.11`) (−9).
- `scripts/prossimo-task.test.mjs`: via il test-fotografia «oggi il loop si ferma a T-021» (da riscrivere a ogni
  chiusura di task; i casi sintetici coprono la logica) e la memoria che lo ricorda (−6). `corso-esempio.test.mjs`:
  via l'alias `letto` e l'autotest di `toMatchObject` (−6).
- `tsconfig.json`: via `esModuleInterop` e `forceConsistentCasingInFileNames` (default), `noEmit` solo nel file;
  `check` senza il flag ripetuto (−3). Facoltativo: `vitest.config.ts` dentro `vite.config.ts` (−11).

## 3. Tenuto apposta (non è spreco: lo prevedono spec, decisioni o backlog)

- Servizi scritti prima della loro UI, con test che coprono scenari: `snoozeNotification` (T-021), `test()` della
  notifica di prova (T-032, D-NOTIF-2), `deleteRecurrence` (T-042), `readStreak` (T-029), `importCourseFromZip`
  (l'inline sposterebbe i test al livello del database), `pendingOutcomes` (T-022), moduli `sm2.ts` e `practice.ts`
  (passi 7–8 di CONTESTO §6). Cancellarli oggi e riscriverli al loro task è churn e toglie copertura in TRACCIABILITA.
- `AvvisiCiclo.avvisiRitardo/avvisiPerso`: la Diagnostica (T-032) li legge (D-SCHED-1, D-NOTIF-2).
- Le otto tabelle vuote di `SCHEMA_V1` (mazzi, carte, pratiche, …): «la versione 1 non si modifica» (`.claude/rules/dati.md`);
  toglierle è un cambio di schema che decide l'utente.
- Due `tsconfig`: D-TS-1 verifica il dominio senza la lib DOM; un solo file perderebbe la garanzia.
- Strumenti dell'utente: archiviazione di `scripts/audit-claude.mjs` (~100 righe), `scripts/loop.ps1` accanto a
  `loop.sh` (PowerShell è la shell dell'utente), `--forza-modello`, gli hook di `.claude/hooks`, gli ignore di
  `coverage/` (contiene gli script CDP, da non lintare), `@vitejs/plugin-react` (Fast Refresh).
- Export usati solo internamente o dai test (15 costanti e tipi): togliere `export` non riduce righe; da fare quando si
  tocca il file. `SOGLIA_NON_VERIFICATO` resta separata da `LOST_GRACE_MS`: stesso valore, regole diverse (D-TIMER-2).
- Riscritture «furbe» scartate: tabella `DELTA` per `review` di SM-2, `stessaVoce` con `JSON.stringify`, factory
  `closed(stato)` per `completed`/`skipped`, ternari al posto degli `switch` sui tipi: meno righe, meno leggibili.

## 4. Numeri dei controlli meccanici (01/10)

- 14 funzioni esportate usate solo dai test (quasi tutte della sezione 3); 3 chiavi i18n morte su 335; 1 classe CSS
  morta; 92 righe di CSS identico ripetuto fra moduli su 5.524 (1,7 %); fixture duplicate nei test (`orologioFinto`
  in scheduler e session, `modulo`/`unita` in outcome e session: un `src/app/fixtures.ts` condiviso farebbe −70).
- Dipendenze: tutte usate (fflate legge la directory ZIP, che `DecompressionStream` non fa; `@fontsource` è l'unico
  modo offline; ogni devDependency ha un uso).
