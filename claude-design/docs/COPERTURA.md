# RoutForge — Copertura

Ogni scenario di `spec/RoutForge_SCENARI.md` con le schermate e gli stati che lo rappresentano. ✓ rappresentato · ◐ una parte è solo logica · — solo logica, nessuno stato UI proprio.

## 1. Scenario Matrix

| ID | Scenario | Schermate · stati | Transizioni | Coperto |
|---|---|---|---|---|
| A1 | Todo senza orario, orizzonte giorno, non fatto | S1 fascia senza orario («Chiama Marco · Orizzonte giorno») · S4 `due=today` · S5 todo `state=perso` («Non fatto», spuntabile) · S9 `group=todo` (avviso «non fatto» silenzioso, 02/10) | card → S5 → Segna come fatto | ✓ |
| A2 | Todo settimana che rotola | S4 `due=week` («rotola fino a dom») · S1 «Orizzonte settimana» · S9 `group=todo` («ora è su oggi, rotola fino a domenica 27») | il varco libero 08–22 è logica | ◐ |
| A3 | Checklist che completa il todo | S5 todo `checked=3` (3/7) · `checked=7` (Completato · Riapri) · `view=remaining` | Segna come fatto → Voci rimaste → Crea todo → toast → Annulla | ✓ |
| A4 | Digest mattutino con arretrati | S9 `group=todo` («2 da fare (1 arretrato)») · S22 `notifications` (Digest del mattino) · S21 «Ieri · gestite» | tocco → S1 | ✓ |
| A5 | Priorità nella fascia senza orario | S1 Mobile (in cima, Alta/Norm.) · S1 Desktop (in coda) | — | ✓ |
| A6 | «Segna fatto» dalla notifica con voci aperte (nuovo, 02/10) | S9 `group=todo` · S8 `kind=todo` · S5 `view=remaining` | Segna fatto → Dettaglio su Voci rimaste → Tutte fatte · Crea todo | ✓ |
| A7 | Spunta dalla lista | S1 Mobile e Desktop (cerchio), `sheet=voci` | cerchio → spunta → mazzo · toast «Annulla» · voci aperte → foglio | ✓ |
| B1 | Generazione e orizzonte 28 giorni | S4 routine (Fine · Per sempre / A termine) · S1 `view=settimana`, `view=mese` | generazione = logica | ◐ |
| B2 | Spunta solo nel giorno previsto | S5 routine (Fatta) · `state=altro-giorno` (disabilitata + motivo) · `state=perso` | — | ✓ |
| B3 | Routine notturna | stessa card «in corso» di S1 e stato di S5 routine; nessuna tavola 23:00–01:00 | — | ◐ |
| B4 | Routine senza durata | S4 routine senza fine («senza durata · resta aperta tutto il giorno») · S20 `tab=behaviors` | — | ✓ |
| B5 | Fasi a inversione | S5 routine `view=review` → `view=done` («Fatta · N fasi su M») · Riapri | Fatta → revisione → Conferma → Riapri | ✓ |
| B6 | Modifica della routine | S4 `type=routine mode=edit` (nuovo: «valgono dalle prossime occorrenze… il passato resta com'è») | S5 Modifica → S4 → Salva | ✓ |
| B7 | Recupero dopo la verifica | S9 `group=studio` (verifica, perso) · S9 `group=routine` (verifica, persa) · S20 «Verifica di metà durata» | notifica → Inizia → S15 | ✓ |
| C1 | Puntatore iniziale | S11 Corso/Modulo («Prossima · 0.7») · S4 studio (hint del puntatore) · S5 study (unità 0.7, corretta) | — | ✓ |
| C2 | Continua | S15 `view=debrief` · S5 study `state=parziale` · S12 `unitState=parziale` · S15 `view=done` (streak) | debrief → Registra esito → done | ✓ |
| C3 | Completata, Indietro, Salta | S15 debrief (sub corretti: 0.8 · 0.7 · 0.6) · S5 study `completato` / `indietro` / `saltato` · S12 `completata` / `da rivedere` / `saltata` | — | ✓ |
| C4 | Anticipo | S5 study `state=anticipo` (Anticipa sessione / Sessione libera) · S1 `now=mancanti` | Anticipa → S15 setup | ✓ |
| C5 | Recupero tardivo e ritardo | S5 study `state=recupera` · S15 `source=recovery` (unità ora bloccata) · S1 `now=recupera` | Recupera → setup → timer | ✓ |
| C6 | Esito su blocco perso | S21 `view=list` · S9 `group=studio` (perso con Registra esito) · S15 debrief | Registra esito → debrief → riga esce dalle pendenti | ✓ |
| C7 | Sessione libera che conta | S12 «Inizia sessione» · S15 `source=free` · debrief «Conta nel piano» | — | ✓ |
| C8 | Abbandono e orfani | S15 debrief «Abbandona · nessun esito, il blocco torna programmato» · S5 study (programmato) | il reset degli orfani è logica | ◐ |
| C9 | Routine di studio senza corso | S5 study `course=none` (nuovo) · S15 `source=nocourse` con «Nessuna unità» (nuovo) · S21 «Studio · senza corso» | Avvia sessione → setup con scelta | ✓ |
| C10 | Esito dal cerchio | S1 Mobile `sheet=esito` | cerchio → «Registra esito» → esito → card nel mazzo · toast «Annulla» | ✓ |
| D1 | Ancorata all'orologio | S15 setup routine («finisce alle 16:45 anche se metti in pausa») · timer · S9 `group=sessione` (Tempo scaduto) | — | ✓ |
| D2 | Ancorata al focus | S15 `source=free` setup e timer («le pause allungano la fine») | — | ✓ |
| D3 | Pomodoro multi-materia | S15 `view=timer mode=p25` (segmenti, Salta, Cambia unità) · `view=debrief mode=p25` (nuovo: minuti per unità) | — | ✓ |
| D4 | Persistenza e continuità | banner Sessione in corso su S1, S10, S20 (nuovo), carta nella sidebar desktop (nuovo) · S15 `timer-state=unverified` · S9 `group=sessione` (notifica persistente Android) | Riprendi → timer | ✓ |
| D5 | Iperfocus | S15 `hyper=true` · `view=iperfocus` · `exit=tentativo` · `exit=registrata` · `timer-state=overrun` | Esci → Resta / Esci comunque | ✓ |
| D6 | Una sola sessione | banner su S10 (nuovo) · S12 «Inizia sessione» | con sessione attiva porta a S15 timer (transizione, nessuno stato dedicato) | ◐ |
| D7 | Abbandono oltre soglia | S15 debrief («Abbandona · oltre il 65 %: si chiude con esito Continua») | — | ✓ |
| E1 | Evento con fasi e follow-up | S5 event `view=review` → `view=followup` → toast · `view=done` | Completa evento → Conferma → Crea todo → Annulla | ✓ |
| E2 | Evento mai perso | S5 event `state=concluso` · S1 `now=passato` | — | ✓ |
| E3 | Tutto il giorno | S4 evento «Tutto il giorno» (promemoria alle 08:00) · S9 `group=routine` («Scadenza tasse · oggi») | — | ✓ |
| F1 | Studio con default | S9 `group=studio` (15:55 pre · 16:00 inizio · 16:22 verifica · 16:55 esito) | se la sessione parte la verifica non arriva | ✓ |
| F2 | Personalizzato multiplo con sveglia | S4 `type=event reminder=custom` · S8 `kind=evento` (nuovo) | — | ✓ |
| F3 | Nessuna fascia silenziosa | S22 `notifications` senza Ore silenziose · S9 (canale silenzioso solo per gli avvisi una tantum) | — | ✓ |
| F4 | Finestra di 14 giorni | solo logica (S22 Diagnostica mostra la coda) | — | — |
| F5 | Posticipa | S8 «Posticipa +10 min» · S9 azioni Posticipa | +10' stessa chiave | ✓ |
| F6 | Cambio di stato | S22 `notifications` (spegnere un tipo) | riconciliazione = logica | ◐ |
| F7 | L'esito non è mai una sveglia (nuovo, 02/10) | S8 senza `kind=esito` · S9 `group=studio` (esito come notifica) · S21 | — | ✓ |
| G1 | Blocchi contigui | S1 card Adesso hero | confine fine esclusa = logica | ◐ |
| G2 | Chiusura di Adesso | per decisione la card Adesso non si chiude, su mobile e su desktop; SCENARI G2, FUNZ §2 e MECC §14 aggiornati | — | ✓ |
| G3 | Riordino: solo nella stessa priorità, frecce su desktop | S1 `drag=lift` mobile e desktop · S1 Desktop `move=hover` · `move=focus` | sollevamento → rilascio nel gruppo · freccia → scambio con il vicino | ✓ |
| G4 | Cambio giorno ad app aperta | solo logica | — | — |
| G5 | Crea dal giorno selezionato | S1 Mobile `view` giorno · settimana · mese + foglio Crea (S4 Crea Mobile) | giorno scelto → + → foglio da quel giorno → la card atterra nel giorno, nella riga o nella casella · toast «Annulla» | ✓ |
| H1 | Import | S10 `importing` · `warnings` · `error` · `list` · Desktop `empty` · `importing` · `error` (montati) | Importa → avvisi → Ok | ✓ |
| H2 | PDF groundabile e passivo | S12 Tuoi («testo estratto, usato dall'AI») · S13 `pdf` · `pdf-scan` · S12 `material=pdf-big` (nuovo: oltre 20 MB) | — | ✓ |
| H3 | Eliminazione corso | S10 `view=course confirm-delete` (montato) | Elimina corso → conferma → elenco | ✓ |
| H4 | Lingua dell'AI | S12 «Nella lingua del materiale» · S22 `ai` «Lingua delle risposte · Automatica» | la lingua dei contenuti è dato | ◐ |
| H5 | Validazione | S12 `genState=loading` · `genState=error` (nuovi: «non ho salvato nulla») · S19 quiz | Genera → errore → Riprova | ✓ |
| I1 | SM-2 | S19 `flashcard-front` · `flashcard-back` (solo etichette) · `flashcard-done` (nuovo) | — | ✓ |
| I2 | DevSwipe | S19 `devswipe` · `devswipe-wrong` · `devswipe-done` | — | ✓ |
| I3 | Bug Hunter | S19 `bughunter` · `bughunter-solved` · `bughunter-done` | — | ✓ |
| I4 | Audio Flash-Trivia | S19 `trivia` · `trivia-explain` · `trivia-done` | — | ✓ |
| J1 | Due dispositivi offline | S22 `account-offline` (nuovo: «3 modifiche in coda») | sincronizzazione = logica | ◐ |
| J2 | Conflitto | S22 `account-conflict` | Ok → in pari | ✓ |
| J3 | Studio senza corso su un altro dispositivo | S5 study `course=missing` (nuovo) · S15 `source=nocourse` | Avvia sessione → setup libero | ✓ |
| J4 | Primo accesso con dati locali | S22 `login` → `login-code` → `account` | fusione = logica | ◐ |
| J5 | Uscita | S22 `account` «Esci» → `login` | — | ◐ |

Totale: 60 · ✓ 47 · ◐ 11 · — 2.

## 2. Screen Inventory

| Schermata | File | Ingresso | Stati (prop) | Verso |
|---|---|---|---|---|
| S1 Oggi mobile | `S1 Oggi Mobile` | avvio, nav Oggi, widget | `now` mancanti · adesso · recupera · passato · `variant` default · empty · done · `view` giorno · settimana · settimana-vuota · mese · `archive` · `drag=lift` · `menu` · `absence` · `session` | S5, S15 setup, S4, S10/S21/S22 dal menu |
| S1 Oggi desktop | `S1 Oggi Desktop` | idem | card Adesso hero nella lista · `view` (+ mese-vuoto) · `drag=lift` (resta la riga originale) · `session` | S5 pannello, S4 pannello |
| S4 Crea / Modifica | `S4 Crea Panel` + Mobile/Desktop | FAB, Crea, Modifica, widget «+» | `type` ×4 · `filled` · `reminder` auto · off · custom · `due` today · week · month · `mode` create · edit (ora esposti dalle cornici) | S1 |
| S5 Dettaglio | `S5 Dettaglio Panel` + Mobile/Desktop | card, Adesso, notifica | `kind` ×4 · `view` detail · review · followup · remaining · done · delete (nuovo) · deleted (nuovo) · `state` ×11 (ora esposto) · `course` syllabus · none · missing (nuovo) · `checked` · `unitOpen` | S4 edit, S15, S19, S1 |
| S8 Sveglia | `S8 Sveglia Mobile` | trigger con sveglia | `kind` studio · todo · routine · evento (nuovo; `esito` rimosso) | S15, S5 |
| S9 Notifiche di sistema | `S9 Notifiche di sistema Mobile` (nuovo) | sistema operativo | `group` studio · todo · routine · sessione | S15 setup/timer/debrief, S5, S12, S1 |
| S10 Corsi | `S10 Corsi Mobile`, `S10 Corsi Desktop` | menu account | `view` empty · list · importing · warnings · error · course · module · unit · `confirmDelete` · `unitState` · `material` · `genState` · `session` (pass-through nuovi) | S11, S12 |
| S11 Corso · Modulo | `S11 Corso Panel`, `S11 Modulo Panel` | S10 | `confirmDelete` · `module` · `openUnit` | S11 Modulo, S12, S15 |
| S12 Unità | `S12 Unità Panel` | S11, S21 | `unit` · `unitState` ×5 · `material` none · link · note · pdf-big (nuovo) · `genState` idle · loading · error (nuovo) · `wide` | S15 setup, S19 |
| S13 PDF · Widget | `S13 Extra Panel` + Mobile | S12 (PDF), Home | `view` pdf · pdf-scan · widget | S1, S5, S4 |
| S15 Sessione | `S15 Sessione Panel` + Mobile/Desktop | S5, S1, S12, S9, S21 | `view` setup · timer · iperfocus · debrief · done · `timerState` ×4 · `source` routine · free · recovery · nocourse (nuovo) · `mode` ×4 · `hyper` · `tab` ×3 · `exit` ×3 | S1 |
| S19 AI e pratica | `S19 AI Panel` + Mobile/Desktop | S12, S5, S11 Modulo | `view` ×22 (flashcard-done nuovo) | S12, S22 |
| S20 Statistiche | `S20 Shell` + `S20 Statistiche Panel` | nav | `tab` ×4 · `period` · `empty` (ora esposti) · `session` | — |
| S21 Notifiche | `S21 Notifiche Panel` in Shell | menu, badge | `view` list · empty | S15, S12, S5 |
| S22 Impostazioni | `S22 Impostazioni Panel` in Shell | menu, gear | `view` root · notifications · notifications-denied · account · account-conflict · account-offline · account-erase · login · login-code · ai · ai-nokey · backup · backup-export · backup-erase · diagnostics | S21, S19 |

Tavole: `01 Oggi` … `10 PDF Widget` montano ogni stato elencato. Specimen dei primitivi: `RoutForge Design System`.

## 3. State Matrix

| Schermata | Vuoto | Caricamento | Errore | Successo / feedback | Conferma | Sheet / overlay | Non pertinente |
|---|---|---|---|---|---|---|---|
| S1 | `variant=empty`, settimana e mese vuoti | — | — | `variant=done`, spunta 150 ms | — | menu account, S4/S5 sopra | caricamento ed errore: dati locali, Oggi pronto entro 0,5 s (CONTESTO §3) |
| S4 | `filled=false` | — | fine ≤ inizio (evento) | chiusura del foglio | — | è il foglio | salvataggio locale, nessuna attesa |
| S5 | — | — | — | OutcomeRow, toast con Annulla | `view=delete` (ripetute) | review · followup · remaining · delete | todo ed evento si eliminano con toast, senza conferma (CONTROLLI) |
| S8 | — | — | — | — | — | schermo intero | — |
| S9 | — | — | — | — | — | del sistema | — |
| S10 | `empty` | `importing` | `error`, `warnings` | `list` | — | — | — |
| S11 | — | — | — | — | `confirmDelete` | sheet di conferma | — |
| S12 | — | `genState=loading` | `genState=error`, `material=pdf-big` | riga nuova in Tuoi | — | form in linea | — |
| S15 | — | — | `timer-state=unverified` | `view=done` | `exit=tentativo` | debrief | — |
| S19 | `chat-history-vuota`, `flashcard-done` | risposta in streaming con «Interrompi» | `chat-error`, `chat-nokey`, `chat-offline` | `*-done`, `quiz-done` | — | menu dell'ambito | — |
| S20 | `empty=true` | — | — | — | — | — | dati locali |
| S21 | `view=empty` | — | — | riga che esce dalle pendenti | — | — | — |
| S22 | — | «Sincronizza ora» | `ai-nokey`, `account-conflict`, `notifications-denied`, `account-offline` | `backup-export`, login riuscito → account | import · `account-erase` · `backup-erase` | — | — |

Stati che si escludono: caricamento ed editing non coesistono (S12 genera mentre i form dei materiali restano usabili, sono indipendenti); `exit=tentativo` esiste solo con `view=iperfocus`; `timer-state=unverified` solo con una sessione aperta; `view=delete` solo per routine e routine di studio; `course=none|missing` solo per `kind=study`; `source=nocourse` è sempre ancorata all'orologio. Combinazione sospetta: S8 `kind=esito` (§12 n. 7).

## 4. Interaction Matrix

| Controllo | Stati rappresentati | Dove |
|---|---|---|
| Button primary | default · hover · active · disabled · loading | specimen; loading in S12 Genera (nuovo) e S10 import |
| Button secondary · ghost | default · hover · disabled | mock; disabled in S22 «Sincronizza ora» offline (nuovo) |
| Button danger | default | S11, S22 conferme, S5 «Tutta la routine» (nuovo) |
| IconButton, FAB | default · hover | mock |
| Chip / tessera / segmento | selezionato · non selezionato · disabilitato | S4 (anticipi con tutto il giorno), S15, S20 |
| Toggle | on · off | S4, S15, S22 |
| Input / textarea / select | default · focus (ink del tipo) · errore | S4; nuovi input in S12 Tuoi |
| Checkbox / cerchio | spuntato · da fare | S5 checklist, S11 Go/No-Go, S1 |
| Accordion | aperto · chiuso | S11, S5 unità, S22 notifiche per tipo |
| Sheet / dialogo | aperto · chiuso | S5, S11, S15 |
| Toast con Annulla | visibile | S5 (creazione e, nuovo, eliminazione) |
| Maniglia di trascinamento | sollevata | S1 `drag=lift` |
| Card attività | da fare · in corso · completata · persa · trascinata · hero | S1 |
| Notifica di sistema | con e senza azioni · silenziosa · persistente | S9 (nuovo) |
| Focus visibile | solo implementazione (`--ring-focus`, HANDOFF) | — |

## 5. Transition Map

```text
S1 card ──tocco──▶ S5
S5 ──Modifica──▶ S4 mode=edit ──Salva──▶ S5
S5 todo ──Segna come fatto──▶ completato | (voci rimaste) remaining ──Crea todo──▶ toast ──Annulla──▶ remaining
S5 routine ──Fatta──▶ review ──Conferma──▶ «Fatta · N fasi» ──Riapri──▶ programmato
S5 evento ──Completa evento──▶ review ──Conferma (fasi saltate)──▶ followup ──Crea todo──▶ toast ──Annulla──▶ followup
S5 ──Elimina──▶ todo/evento: toast «Eliminata» | routine/studio: delete ──Solo questa | Tutta──▶ toast ──Annulla──▶ detail
S1/S5 studio ──Avvia | Anticipa | Recupera──▶ S15 setup ──Inizia──▶ timer | iperfocus
S15 timer ──Termina──▶ debrief ──Registra esito──▶ done ──Torna a Oggi──▶ S1
S15 timer ──Riduci──▶ S1 + banner ──Riprendi──▶ timer
S15 debrief ──Abbandona──▶ < 65 %: S1 (programmato) | ≥ 65 %: done con Continua
S15 iperfocus ──Esci──▶ tentativo ──Resta──▶ iperfocus | ──Esci comunque──▶ registrata
S15 riapertura dopo > 30' ──▶ unverified ──Conta come studio | Lascia fuori──▶ timer
S9 ──Inizia──▶ S15 setup | ──Segna fatto──▶ completato | ──Registra esito──▶ S15 debrief | ──Posticipa──▶ +10' | tocco ──▶ S5 · S12 · S15 timer
S8 ──primaria──▶ come S9 | ──Posticipa──▶ +10' | ──Chiudi──▶ resta in S21
S21 ──Registra esito──▶ debrief | ──Recupera──▶ setup recovery | ──Apri unità──▶ S12
S10 empty ──Carica esempio──▶ list | ──Importa ZIP──▶ importing ──▶ warnings ──Ok──▶ list | error ──Scegli un altro file──▶ importing
S10 list ──▶ S11 Corso ──▶ S11 Modulo ──▶ S12 ──Inizia sessione──▶ S15 setup (con sessione attiva: timer, D6)
S11 Corso ──Elimina corso──▶ conferma ──Elimina──▶ S10
S12 ──+ Link | + Nota──▶ form ──Aggiungi | Salva──▶ riga in Tuoi | ──+ PDF > 20 MB──▶ errore ──Scegli un altro file──▶ selettore
S12 ──Genera──▶ loading ──▶ S19 pratica | errore ──Riprova──▶ loading
S19 pratica ──▶ *-done ──Rifai──▶ pratica | ──Torna all'unità──▶ S12 ; ripasso ──▶ flashcard-done
S19 chat-nokey ──Impostazioni──▶ S22 ai
S22 login ──Inviami il codice──▶ login-code ──Accedi──▶ account ──Esci──▶ login
S22 account ──Cancella i dati remoti──▶ account-erase ──Annulla | Cancella──▶ account
S22 backup ──Esporta──▶ backup-export | ──Importa──▶ conferma ──Sostituisci──▶ ricarica | ──Elimina tutti i dati──▶ backup-erase
```

## 6. Responsive Coverage

- **Mobile 390 × 844**: tutte le cornici Mobile, S8, S9, S13.
- **Desktop 1280 × 800**: S1, S4, S5, S10–S12 (Panel `wide`), S15, S19, S20–S22. La sessione in corso su desktop è la carta nella sidebar, come in S15 Desktop (S1, S10, S20; confermata). Anche su desktop la card Adesso è la hero nella lista.
- **Tablet**: nessuna tavola, per decisione. Vale D-UI-1: sotto 1024 px struttura mobile (BottomNav, schermate piene), da 1024 sidebar 240 + pannello 440. I Panel hanno larghezze massime (S19 600, S20 980, S12 1080) e reggono la colonna allargata.
- **Solo mobile per natura**: sveglia (S8), notifiche di sistema (S9; sul web solo a scheda aperta), widget (S13, Android).
