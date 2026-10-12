# RoutForge — Stato dello sviluppo

*Aggiornato dall'agente alla fine di ogni task e letto a inizio sessione dall'hook SessionStart, che ne mostra 7 000
caratteri: va tenuto sotto. Contesto tecnico, non un diario: i task fatti stanno in `docs/TASKS.md`, le regole nelle
decisioni (`docs/01_DECISIONI.md`).*

**Data**: 2026-10-12 · **Passo** (CONTESTO §6): 6 fatto; rilascio web e Android pronto (T-035) · **Design**:
`claude-design/`, spec allineata (D-DESIGN-3, 60 scenari), handoff in `docs/03_HANDOFF_DESIGN_CODE.md` §3–§4 ·
**Gate**: `npm run verify` (990 test in 92 file; macchina satura: `--maxWorkers=2`)

## Fatto
- **12/10 — T-035 rilascio** (D-RILASCIO-1): PWA installabile e offline, icone dal logo del design, APK firmato
  (`npm run apk`), build nella CI. Strumenti di Claude Code rivisti (D-TOOLS-4).
- **09/10 — Audit**: `audit/00…04`, roadmap di 79 voci; registro `audit/05-correzioni.md` (57 corrette, 2 in parte,
  5 coi soli test, 4 rinviate, 1 chiusa, 10 all'utente); INV-22, INV-23; problemi emersi: `audit/nuovi-problemi.md`.
- **05–07/10**: nuovo design (mappa dell'handoff §4), Android nativo (T-021, T-023, T-051, T-057), AI (T-026–T-028),
  backup (T-030), sync (T-033, T-034), recupero (T-059). **Fino al 02/10**: T-000–T-020, T-038, T-043, T-045–T-047.

## In corso
- Risposte dell'utente del 09/10 sull'audit e correzione dei problemi rimasti (N-1…N-9, voci rinviate).

## Problemi aperti
**Azioni dell'utente**
- Copia di sicurezza della cartella `~/.routforge` (chiave di firma: senza, l'app installata non si aggiorna più).
- Deploy web su un host con origine propria (Cloudflare Pages o Netlify; non GitHub Pages: D-RILASCIO-1).
- Sync vera: progetto Supabase coi passi in testa a `supabase/schema.sql`, variabili in `.env.local` e sull'host.
- Collaudo dell'APK sul telefono: `docs/COLLAUDO.md` (da un APK di debug: backup, disinstalla, installa, importa).
- CP4 (council, 07/10): tetto di spesa sulla chiave Gemini; MECC §22 e §25 da allineare (chiave AI fuori da backup
  e sync).

**Obblighi per i prossimi task** (le regole stanno nelle decisioni citate)
- Sessione attiva: la scrivono solo `startSession`, `editActiveSession`, `endSession`, `abandonSession`, nella
  transazione del blocco (D-SESS-1); `ultimoBattito` solo `startHeartbeat` (D-TIMER-2).
- Esiti solo da `writeOutcome` (D-ESITO-1); notifiche solo da `desiredSet` e dalla riconciliazione, che segue da sola
  le scritture sui suoi ingressi (D-NOTIF-1…3); ingresso nel gruppo di priorità con `enterGroup` (D-RIORD-1); saltare
  un'occorrenza = giorno in `dateSaltate` più `remove` del blocco (D-DATA-2).
- Errori dei servizi in `app/diagnostics.ts` (INV-16); un'impostazione letta dentro una transazione o una query live
  rompe Dexie: si passa come parametro (`progressInputs`, `readStats`).
- Notifiche sul web: il permesso lo chiede «Notifica di prova» col gesto; timer ritardati a scheda nascosta.

**Limiti noti**: le schermate leggono `Date.now()` (D-SCHED-1 n. 9); jsdom non impagina (G4 `parziale`); i 0,5 s
con 500 blocchi si misurano solo sul dispositivo (audit P2-14); `npm audit`: `tinypool` e `@vitest/mocker`
(strumenti di test, correzione con Vitest 5) e `uuid` di `@capacitor/cli`.

**Ambiente**
- `origin`: GitHub `DiegoHidalgo02/routforge`, CI coi quattro fusi e la build (`/fusi` in locale, D-TOOLS-4).
- Android: `npm run apk` o `npm run apk:debug`; una modifica a Gradle si prova con
  `./gradlew --offline :app:processDebugMainManifest`; niente emulatore.
- MCP: `claude-design` (dopo `/design-login` e `/mcp`; un reimport si verifica coi byte di `list_files`) e
  `context7` (`.mcp.json`). Plugin solo di progetto (D-TOOLS-2…4), da verificare con `/plugin` e
  `npm run audit:claude`.
- Browser: Edge headless via CDP; `npm run confronto` fotografa tavola e app alla stessa misura.
- `scripts/loop.sh` su Windows: `git config core.fileMode false` prima di `git add`.

## Divergenze design ↔ spec
- Le divergenze col codice stanno per schermata in `docs/03_HANDOFF_DESIGN_CODE.md` §2–§3; regola dell'utente:
  vince sempre il design (D-DESIGN-1).

## Prossimo task
- T-036 (iOS) richiede il Mac. Le voci **bloccante** di `docs/03_HANDOFF_DESIGN_CODE.md` §3 fermano solo il task che
  le tocca.

## Checkpoint in attesa
- **CP6 Release** (D-RILASCIO-1): firma, nome e icona scelti dall'agente su richiesta dell'utente; restano la copia di
  `~/.routforge` e l'host web. CP2 (S1 Oggi, D-DESIGN-5), CP3 (D-NATIVO-1), CP4 e CP5 decisi.
