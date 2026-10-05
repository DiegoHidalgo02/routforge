# RoutForge — Handoff per Claude Code

**Stato: definitivo.** Le schermate `S*.dc.html` sono la fonte visiva di verità e rappresentano il design approvato: nessuna alternativa, variante o interpretazione è aperta. Questo file è l'unico punto d'ingresso; tutti i percorsi sono dalla radice del progetto.

RoutForge è un pianificatore di studio e attività, mobile-first (390×844, fluido da 320) con struttura desktop da 1024 px (sidebar 240, pannello 440). Fedeltà richiesta: alta — colori, tipografia, misure, stati, interazioni e animazioni come nei file.

## Da leggere, in ordine
1. `HANDOFF.md` — questo file: struttura, mappa schermate e stati, regole operative.
2. `CLAUDE.md` — decisioni vincolanti: vincono su ogni altro documento.
3. `docs/BLOCCHI.md` — gli unici punti non definiti.
4. `docs/IMPLEMENTAZIONE.md` — come si legge un `.dc.html`, prodotto e scenografia, ordine di costruzione, verifica.
5. `design/DESIGN.md` — regole del design system: colore, tipografia, spazio, motion, primitivi, pattern, layout, stati di interazione, accessibilità.
6. `design/tokens.css` — tutti i valori, keyframe compresi. Nessun valore fuori da qui.
7. `design/ASSET.md` — font, icone, marchio, immagini, scenografia.
8. `RoutForge Design System.dc.html` — specimen dei primitivi e dei pattern.
9. `docs/COMPONENTI.md` — inventario dei componenti: dove sono nei mock, varianti e stati.
10. `docs/NAVIGAZIONE.md` — percorsi, fogli e pannelli, indietro, collegamenti diretti.
11. `docs/STATI.md` — macchine a stati e stati mostrati, con le props che li disegnano.
12. `docs/CONTROLLI.md` — ogni bottone e input per schermata.
13. `docs/DATI-UI.md` — da dove viene ogni valore mostrato.
14. `docs/TESTI.md` — regole di scrittura, formati, notifiche, messaggi.
15. `docs/COPERTURA.md` — scenario → schermate e stati.
16. `spec/` — comportamento di prodotto: CONTESTO, FUNZIONALITA, MECCANISMI, SCENARI (criteri di accettazione).

## Struttura del progetto
```text
HANDOFF.md · CLAUDE.md            ingresso e decisioni vincolanti
docs/                             specifica operativa
  BLOCCHI.md                      punti non definiti
  IMPLEMENTAZIONE.md · COMPONENTI.md · NAVIGAZIONE.md · STATI.md
  CONTROLLI.md · DATI-UI.md · TESTI.md · COPERTURA.md
spec/                             spec di prodotto
  RoutForge_CONTESTO.md · RoutForge_FUNZIONALITA.md · RoutForge_MECCANISMI.md · RoutForge_SCENARI.md
design/                           design system
  DESIGN.md                       regole
  tokens.css                      token (Tailwind @theme o equivalente) e keyframe
  ASSET.md                        font, icone, marchio, immagini
  course-data.js                  fixture: il corso dei mock già letto
S{n} Nome Panel|Mobile|Desktop.dc.html   schermate e componenti (fonte visiva)
0{n} Nome.dc.html                 tavole: tutti gli stati montati, con didascalia
RoutForge Design System.dc.html   specimen
support.js                        motore di anteprima dei .dc.html (non è prodotto)
```
I `.dc.html` stanno alla radice perché il motore di anteprima risolve i componenti come file fratelli di `support.js`. Si aprono nel browser: il markup con stili inline è la specifica esatta di misure e colori, la classe `Component` in coda al file è la logica di stato del mock. Non sono codice da copiare: vanno ricreati con i pattern del repository di destinazione.

## Stack
React 19 + Vite PWA + Capacitor (D-STACK-1); usare le librerie già presenti nel repository. Font Manrope e IBM Plex Mono, icone Lucide (`design/ASSET.md`). Piattaforme e requisiti non funzionali: `spec/RoutForge_CONTESTO.md` §3.

## Componenti e schermate

Tre tagli per schermata: **Panel** (il contenuto, riusato da entrambe le cornici), **Mobile** (il Panel dentro il telefono 390×844 con navbar e sheet), **Desktop** (lo stesso contenuto in layout a sidebar). Le cornici passano `wide=true` ai Panel su desktop.

| S | Schermata | File | Spec |
|---|---|---|---|
| S1 | Oggi (giorno · settimana · mese, card Adesso hero con scatto dell'ora, archivio completate in prospettiva, terna di progresso nel colore dei dati, trascinamento) | `S1 Oggi Mobile` (monta `S4 Crea Panel` come foglio sopra Oggi), `S1 Oggi Desktop` | §2, §13 · MECCANISMI §14, §15, §24 |
| S4 | Crea / modifica attività (4 tipi) | `S4 Crea Panel`, `Mobile`, `Desktop` | §3, §4, §7 · MECCANISMI §2 |
| S5 | Dettaglio attività (11 stati, revisione fasi, follow-up, voci rimaste, eliminazione, studio senza unità) | `S5 Dettaglio Panel`, `Mobile`, `Desktop` | §4, §5, §6 · MECCANISMI §3–§5, §8 |
| S8 | Sveglia a schermo intero | `S8 Sveglia Mobile` (fuori navigazione, solo mobile) | §7, §19 · MECCANISMI §13 |
| S9 | Notifiche di sistema (trigger, digest, avvisi una tantum, notifica persistente della sessione) | `S9 Notifiche di sistema Mobile` (fuori navigazione, solo mobile) | §7, §11.2 · MECCANISMI §13 |
| S10 | Corsi: elenco, import, avvisi, errore | `S10 Corsi Mobile`, `S10 Corsi Desktop` (montano S11/S12) | §9 · MECCANISMI §16 |
| S11 | Corso (moduli, blocco Go/No-Go, verifica del modulo) · Modulo (unità con 4 sezioni, checklist Go/No-Go, progetto) | `S11 Corso Panel`, `S11 Modulo Panel` | §9, §10 · FORMATO_CORSO |
| S12 | Unità (concetto core, 4 sezioni, video, materiali, file di codice, pratica) | `S12 Unità Panel` | §10, §14 · MECCANISMI §17 |
| S13 | PDF · widget Home | `S13 Extra Panel`, `S13 Extra Mobile` | §10, §18 · MECCANISMI §21 |
| S15 | Sessione di studio (setup, timer, pause, extra, iperfocus, debrief, esito) | `S15 Sessione Panel`, `Mobile`, `Desktop` | §11–§13 · MECCANISMI §10–§12 · SCENARI D5 |
| S19 | AI e pratica (chat, quiz, flashcard, DevSwipe, Bug Hunter, Audio Flash-Trivia) | `S19 AI Panel`, `Mobile`, `Desktop` | §14–§16 · MECCANISMI §18, §19 |
| S20 | Shell di Statistiche · Notifiche · Impostazioni + Statistiche | `S20 Shell Mobile`, `S20 Shell Desktop`, `S20 Statistiche Panel` | §17 · MECCANISMI §20 |
| S21 | Notifiche | `S21 Notifiche Panel` (dentro S20 Shell) | §7, §19 · MECCANISMI §13 |
| S22 | Impostazioni (9 viste) | `S22 Impostazioni Panel` (dentro S20 Shell) | §23, §7.7, §16, §20, §21, §24 · MECCANISMI §22, §23, §25 |

## Mappa degli stati (tavole `0N`)

Gli stati sono le props passate a `dc-import` nei file `0N *.dc.html`; ogni stato progettato è montato in una tavola. La corrispondenza scenario → stati, le transizioni e i gap aperti sono in `docs/COPERTURA.md`.

| Tavola | Stati montati |
|---|---|
| 01 Oggi | Mobile (`intro=false`): giorno con card Adesso hero · `archive=open` · `now=recupera` · `now=mancanti` · `now=passato` · `variant=done` (Giornata chiusa) · `variant=empty` · `session` · `absence` · `menu` · `view=settimana` · `view=settimana-vuota` · `view=mese` · `drag=lift` (riordino dei todo senza orario) · `move=attivo` (riordino con i tasti) · `sheet=voci` · `sheet=fasi` · `sheet=esito` (passaggi del cerchio sopra Oggi) · `nowKind` todo · routine · evento (card Adesso per tipo). Desktop: giorno con card Adesso hero nella lista · `view=settimana` · `view=settimana-vuota` · `view=mese` · `view=mese-vuoto` · `drag=lift` · `move=hover` · `move=focus` (frecce di riordino) · `session` (carta nella sidebar) |
| 02 Crea | `type` todo · study · routine · event (`filled=true`) · `type=todo filled=false` · `type=routine mode=edit` · `type=event reminder=custom` · `type=todo due=today` · `due=month` · Desktop `type=study filled` |
| 03 Dettaglio | Mobile: `kind` todo · routine · event · study · `view=review` · `view=followup` · `view=remaining`. Panel: todo `state=perso` · `checked=7` · `view=deleted`; routine `view=done` · `state` saltato · perso · altro-giorno · `view=delete` · `view=deleted`; evento `state=concluso` · `view=done`; studio `unitOpen` · `state` anticipo · in corso · parziale · completato · indietro · saltato · perso · recupera · altro-giorno · `course=none` · `course=missing` · `view=delete`. Desktop `kind=study` |
| 04 Corsi | Mobile: empty · importing · warnings · error · list · course · module · unit · `course confirmDelete` · `unit unitState` non iniziata · da rivedere · completata · `list session`. Panel wide S12: `material` link · note · pdf-big (con `genState=loading`) · `genState=error`. Desktop: empty · importing · error · course · module · unit. Corso: M0 aperto in accordion, M1 aperto, M2–M4 bloccati. Modulo: unità 0.7 aperta, Go/No-Go 7/7 · Go. Unità: 0.7 `parziale` |
| 05 Sessione | `setup` (routine · `source` free · recovery · nocourse · `hyper`) · `timer` (`timer-state` paused · overrun · unverified · `mode=p25` · `source=free` · `tab` ai · notes) · `view=iperfocus` · `exit` tentativo · registrata · `debrief` (anche `mode=p25` con minuti per unità) · `done` · Desktop setup · timer · debrief · done |
| 06 AI e pratica | flashcard fronte/retro · `flashcard-done` · quiz · quiz-answered · `quiz-done` · `devswipe` · `devswipe-wrong` · `devswipe-done` · `bughunter` · `bughunter-solved` · `bughunter-done` · `trivia` · `trivia-explain` · `trivia-done` · chat · chat-global · chat-nokey · chat-offline · `chat-error` · `chat-error-key` · `chat-error-model` · `chat-error-safety` · `chat-history` · `chat-history-vuota` · Desktop chat, chat-history, devswipe-done |
| 07 Statistiche | `screen=stats` con i 4 `tab` · `period=7` · `empty` · `session` · Desktop panoramica · studio |
| 08 Notifiche | `screen=notif view=list|empty` · Desktop list · empty · S9 notifiche di sistema `group` studio · todo · routine · sessione · sveglia `kind` studio · todo · routine · evento |
| 09 Impostazioni | `screen=settings` con root, notifications, `notifications-denied`, ai, `ai-nokey`, account, account-conflict, `account-offline`, login, login-code, backup, diagnostics · Panel `account-erase` · `backup-export` · `backup-erase` · Desktop root · notifications · account |
| 10 PDF Widget | `pdf` · `pdf-scan` · `widget` (nessuna cornice desktop). La vista Mese è S1 `view=mese` (tavola 01) |

### Prop solo da Tweaks
`S1 Oggi Mobile.strikeDelay` (ms dello scatto dell'ora; 0 = già hero) · `S1 Oggi Mobile.celebration` sobria · piena · off · `S15 Sessione Panel.mode` p50 · p90 · `S20 Statistiche Panel.period` 30 · 90 · all · `S11 Modulo Panel.module` · `openUnit` · `S12 Unità Panel.unit`.

## Dati del corso
Corsi, moduli, unità, sezioni e risorse dei mock vengono da `design/course-data.js` (il corso già letto: fixture e risultato atteso del parser). I file originali del corso e il formato d'import non sono nel pacchetto: `docs/BLOCCHI.md` blocco 3. I moduli M2–M4 sono solo numero e titolo. Niente titoli, conteggi, ore o carte inventati.

Scenario dei mock (costanti nei componenti, da sostituire con lo stato reale): oggi mercoledì 23 settembre 2026, settimana 21–27 · corso "Syllabus Software Engineer 2026" importato il 16 set · unità 0.1–0.6 completate, puntatore 0.7 · M0 6/9, Go/No-Go 7/7 · Go (tutti i criteri spuntati; "Domande socratiche" dal quiz del modulo) · M1 aperto 0/4 · M2–M4 bloccati.

Regole: una sezione dell'unità è **fatta** quando tutte le sue risorse sono state aperte o la sessione l'ha marcata; l'unità si completa con esito "Completata" (MECCANISMI §10–11). Il modulo passa quando tutti i criteri Go/No-Go sono sì; il criterio auto si spunta quando il quiz "Domande socratiche" del modulo raggiunge la soglia scritta nel criterio (≥8/10 in M0, ≥7/8 in M1). Un modulo bloccato non si apre e non entra nel puntatore; il primo modulo è sempre aperto.

## Regole operative
- I componenti `S*` sono la verità; `DESIGN.md` li descrive. In caso di dubbio vince il file `.dc.html`.
- Nessun valore fuori da `tokens.css`: se serve un valore nuovo, prima si aggiunge il token con il suo uso.
- Focus visibile (`--ring-focus`, `--ring-focus-danger`) su ogni controllo: i mock non lo mostrano.
- `prefers-reduced-motion`: solo dissolvenze (coda di `tokens.css`).
- Informazioni (Impostazioni → Avanzate) mostra la versione dell'app (FUNZ §23); il numero arriva dalla build e i mock non lo riportano.
- Cornice del telefono (raggio 44), status bar e home indicator assenti sono scenografia dei mock, non prodotto.
- Le stringhe sono in italiano nei mock; l'app è in sei lingue (CONTESTO §3): ogni testo visibile passa da un dizionario.
- I collegamenti fra le schermate dei mock e i parametri dell'indirizzo (`?dopo=sessione`, `?nuovo=…`, `?creato=…`, `?sessione=1`, `?view=…`) servono solo a percorrere i mock (`docs/NAVIGAZIONE.md` §10): non sono prodotto.
- Gli unici punti non definiti sono in `docs/BLOCCHI.md`. Non vanno risolti inventando.
