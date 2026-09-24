# RoutForge — Handoff per Claude Code

**Stato: READY FOR CLAUDE CODE.** Il design è definitivo: le schermate `S*.dc.html` sono la fonte visiva di verità, nessuna alternativa è aperta. Questo file è l'unico punto d'ingresso.

RoutForge è un pianificatore di studio e attività, mobile-first (390×844) con variante desktop (sidebar 240). Fedeltà richiesta: alta — colori, tipografia, misure, stati e interazioni vanno riprodotti come nei file.

## Da leggere, in ordine
1. `HANDOFF.md` — questo file: struttura, mappa schermate/stati, regole operative.
2. `design/DESIGN.md` — regole del design system: colore, tipografia, spazio, primitivi, pattern, navigazione, copy.
3. `design/tokens.css` — tutti i valori (colori, font, raggi, ombre, durate, keyframe). Nessun valore fuori da qui.
4. `RoutForge Design System.dc.html` — specimen dei primitivi con stati e dei pattern composti.
5. `spec/` — comportamento di prodotto (cosa fa l'app, regole, scenari di accettazione, formato del corso).

## Struttura del progetto
```text
HANDOFF.md                        punto d'ingresso
design/
  DESIGN.md                       regole del design system
  tokens.css                      token (Tailwind @theme o equivalente)
  course-data.js                  fixture: il corso dei mock già letto (moduli, unità, sezioni, criteri)
spec/
  RoutForge_CONTESTO.md           perimetro, piattaforme, glossario, decisioni di prodotto, ordine di costruzione
  RoutForge_FUNZIONALITA.md       cosa fa l'app (i riferimenti §N in questo file puntano qui)
  RoutForge_MECCANISMI.md         regole esatte: stati, soglie, transizioni, algoritmi
  RoutForge_SCENARI.md            criteri di accettazione end-to-end
  RoutForge_FORMATO_CORSO.md      formato del corso importabile (ZIP di markdown)
  M0-Riattivazione_JavaScript.md  modulo 0 del corso dei mock (9 unità)
  M1-Tooling_Moderno.md           modulo 1 del corso dei mock (4 unità)
0N Nome.dc.html                   tavole: indice degli stati, solo dc-import con didascalia
SN Nome Panel|Mobile|Desktop.dc.html   schermate e componenti
RoutForge Design System.dc.html   specimen
support.js                        motore di anteprima dei .dc.html — non fa parte del prodotto
```
Schermate, componenti e specimen stanno alla radice perché il motore di anteprima li risolve come file fratelli. I file `.dc.html` sono riferimenti di design in HTML: si aprono nel browser; il markup con stili inline è la specifica esatta di misure e colori, la classe `Component` in coda al file è la logica di stato del mock. Non sono codice da copiare: vanno ricreati con i pattern del repository di destinazione.

## Stack
Usare framework e librerie già presenti nel repository di destinazione; se il progetto è nuovo, uno stack adatto a un'app mobile-first con layout desktop a sidebar. Font: Manrope (UI) e IBM Plex Mono (numeri, orari, contatori), Google Fonts. Icone: Lucide, stroke 1.75. Piattaforme e requisiti non funzionali: `spec/RoutForge_CONTESTO.md` §3.

## Componenti e schermate

Tre tagli per schermata: **Panel** (il contenuto, riusato da entrambe le cornici), **Mobile** (il Panel dentro il telefono 390×844 con navbar e sheet), **Desktop** (lo stesso contenuto in layout a sidebar). Le cornici passano `wide=true` ai Panel su desktop.

| S | Schermata | File | Spec |
|---|---|---|---|
| S1 | Oggi (giorno · settimana · mese, blocco Adesso, archivio completate, trascinamento) | `S1 Oggi Mobile`, `S1 Oggi Desktop` (autonomi, senza Panel) | §2, §3, §14 · MECCANISMI §14, §15 |
| S4 | Crea / modifica attività (4 tipi) | `S4 Crea Panel`, `Mobile`, `Desktop` | §4, §5, §8 |
| S5 | Dettaglio attività (11 stati, revisione fasi, follow-up) | `S5 Dettaglio Panel`, `Mobile`, `Desktop` | §6, §7, §9 |
| S8 | Sveglia a schermo intero | `S8 Sveglia Mobile` (fuori navigazione, solo mobile) | §8, §20 · MECCANISMI §13 |
| S10 | Corsi: elenco, import, avvisi, errore | `S10 Corsi Mobile`, `S10 Corsi Desktop` (montano S11/S12) | §10 |
| S11 | Corso (moduli, blocco Go/No-Go, verifica del modulo) · Modulo (unità con 4 sezioni, checklist Go/No-Go, progetto) | `S11 Corso Panel`, `S11 Modulo Panel` | §10, §11 · FORMATO_CORSO |
| S12 | Unità (concetto core, 4 sezioni, video, materiali, file di codice, pratica) | `S12 Unità Panel` | §11, §15 |
| S13 | Mese · PDF · widget Home | `S13 Extra Panel`, `S13 Extra Mobile` | §3, §11, §19 |
| S15 | Sessione di studio (setup, timer, pause, extra, iperfocus, debrief, esito) | `S15 Sessione Panel`, `Mobile`, `Desktop` | §11–§14 · SCENARI D5 |
| S19 | AI e pratica (chat, quiz, flashcard, DevSwipe, Bug Hunter, Audio Flash-Trivia) | `S19 AI Panel`, `Mobile`, `Desktop` | §15–§17 · MECCANISMI §18 |
| S20 | Shell di Statistiche · Notifiche · Impostazioni + Statistiche | `S20 Shell Mobile`, `S20 Shell Desktop`, `S20 Statistiche Panel` | §18 |
| S21 | Notifiche | `S21 Notifiche Panel` (dentro S20 Shell) | §7, §8, §20 |
| S22 | Impostazioni (9 viste) | `S22 Impostazioni Panel` (dentro S20 Shell) | §24, §8.7, §17, §21, §22, §25 |

## Mappa degli stati (tavole `0N`)

Gli stati sono le props passate a `dc-import` nei file `0N *.dc.html`; aprendo la tavola si vedono tutti insieme.

| Tavola | Stati montati |
|---|---|
| 01 Oggi | Mobile (`intro=false`): `archive=open now=adesso` · `session` · `absence` · `menu` · `view=settimana` · `view=settimana-vuota` · `view=mese` · `drag=lift` · `drag=giorno` · `drag=perso`. Desktop: giorno · `view=settimana` · `view=settimana-vuota` · `view=mese` · `view=mese-vuoto` · `drag=lift` · `drag=perso` |
| 02 Crea | `type` todo · study · routine · event (`filled=true`) · `type=todo filled=false` (form vuoto) · Desktop `type=study filled` |
| 03 Dettaglio | `kind` todo · routine · event · study · `kind=routine view=review` · `kind=event view=followup` · Desktop `kind=study` |
| 04 Corsi | Mobile: empty · importing · warnings · error · list · course · module · unit. Desktop: course · module · unit. Corso: M0 aperto in accordion (unità + Verifica del modulo + "Apri il modulo"), M1 aperto, M2–M4 bloccati. Modulo: unità 0.7 aperta, Go/No-Go 3/7. Unità: 0.7 `parziale` |
| 05 Sessione | `setup` · `timer` · `timer timer-state=paused` · `timer timer-state=overrun` · `view=iperfocus` · `iperfocus exit=tentativo` · `iperfocus exit=registrata` · `debrief` · `done` · Desktop `timer` |
| 06 AI e pratica | flashcard fronte/retro · quiz · quiz-answered · `devswipe-done` · `bughunter-done` · `trivia-done` · `chat-history` · chat · chat-global · chat-nokey · chat-offline · Desktop `chat`, `chat-history`, `devswipe-done` |
| 07 Statistiche | `screen=stats` con i 4 `tab` · Desktop `screen=stats` |
| 08 Notifiche | `screen=notif view=list|empty` · Desktop `screen=notif` · sveglia `kind=studio|todo|routine|esito` |
| 09 Impostazioni | `screen=settings` con root, notifications, ai, account, account-conflict, login, login-code, backup, diagnostics · Desktop root |
| 10 Mese PDF Widget | `month` · `pdf` · `pdf-scan` · `widget` (nessuna cornice desktop) |

### Stati progettati, non montati dalle tavole
Si vedono aprendo il componente e cambiando la prop (Tweaks).
- `S19 AI Panel`: `quiz-done`, `devswipe`, `devswipe-wrong`, `bughunter`, `bughunter-solved`, `trivia`, `trivia-explain`, `chat-error`, `chat-history-vuota`.
- `S5 Dettaglio Panel.state`: anticipo, in corso, parziale, completato, indietro, saltato, perso, recupera, concluso, altro-giorno; `unitOpen`.
- `S1 Oggi Mobile`: `variant=collapsed|empty|done`, `now=mancanti|recupera|passato`. `S1 Oggi Desktop`: `drag=giorno`.
- `S4 Crea Panel`: `mode=edit`, `due=today|month`.
- `S15 Sessione Panel`: `mode=p25|p50|p90`, `hyper` (toggle del setup; lo schermo intero è `view=iperfocus`), `tab=ai|notes`, `source=free|recovery`.
- `S10 Corsi Desktop`: `view=empty|list|importing|error` (`warnings` esiste solo su mobile).
- `S11 Corso Panel`: `confirmDelete`, `navPad`. `S11 Modulo Panel`: `module=0|1`, `openUnit` (0.1–1.4 o `nessuna`). `S12 Unità Panel`: `unit` (0.1–1.4), `unitState` (non iniziata · parziale · da rivedere · completata · saltata).
- `S22 Impostazioni Panel`: `view=ai-nokey`. `S20 Statistiche Panel`: `period=7|30|all`, `empty`.

## Dati del corso
Corsi, moduli, unità, sezioni e risorse vengono da `spec/` (formato in `RoutForge_FORMATO_CORSO.md`; file di riferimento `M0-*.md` e `M1-*.md`). `design/course-data.js` è quel corso già letto: usarlo come fixture e come risultato atteso del parser. I tre moduli in `locked` (M2–M4) sono solo numero e titolo, senza file. Niente titoli, conteggi, ore o carte inventati.

Scenario dei mock (costanti nei componenti, da sostituire con lo stato reale): corso "Syllabus Software Engineer 2026" importato il 16 set · unità 0.1–0.6 completate, puntatore 0.7 · M0 6/9, Go/No-Go 3/7 (manuali 1, 3, 5 spuntati; "Domande socratiche" è auto) · M1 aperto 0/4 · M2–M4 bloccati.

Regole: una sezione dell'unità è **fatta** quando tutte le sue risorse sono state aperte o la sessione l'ha marcata; l'unità si completa con esito "Completata" (MECCANISMI §10–11). Il modulo passa quando tutti i criteri Go/No-Go sono sì; il criterio auto si spunta quando il quiz "Domande socratiche" del modulo raggiunge la soglia scritta nel criterio (≥8/10 in M0, ≥7/8 in M1). Un modulo bloccato non si apre e non entra nel puntatore; il primo modulo è sempre aperto.

## Regole operative
- I componenti `S*` sono la verità; `DESIGN.md` li descrive. In caso di dubbio vince il file `.dc.html`.
- Nessun valore fuori da `tokens.css`: se serve un valore nuovo, prima si aggiunge il token con il suo uso.
- Focus visibile (`--ring-focus`, `--ring-focus-danger`) su ogni controllo: i mock non lo mostrano.
- `prefers-reduced-motion`: solo dissolvenze (coda di `tokens.css`).
- Il numero di versione dell'app arriva dalla build: nessuna schermata lo mostra.
- Cornice del telefono (raggio 44), status bar e home indicator assenti sono scenografia dei mock, non prodotto.
- Le stringhe sono in italiano nei mock; l'app è in sei lingue (CONTESTO §3): ogni testo visibile passa da un dizionario.

## BLOCCO DA RISOLVERE
1. **Corso di esempio incluso nell'app.** `spec/RoutForge_CONTESTO.md` §5 richiede un corso di esempio integrato, conforme al formato e importabile senza avvisi. Nei mock (S10) compare una card "Software Engineer — percorso di esempio · 2 moduli · 2 unità" che non corrisponde ad alcun file; il solo corso conforme presente è M0+M1 ("Syllabus Software Engineer 2026"). Va deciso se il corso di esempio integrato è M0+M1 (e la card "Esempio" mostra quei numeri) oppure un file separato da fornire.
