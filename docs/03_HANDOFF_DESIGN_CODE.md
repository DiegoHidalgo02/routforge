# RoutForge — Handoff Design → Code

*Ciò che Claude Code deve sapere per costruire l'interfaccia senza perdere informazioni. Due fonti, una regola: **come appare** → export di Claude Design in `claude-design/` (`tokens.css`, `DESIGN.md`, `HANDOFF.md`, `S*.dc.html`); **come si comporta** → spec in `docs/spec/`. Se il design mostra un comportamento diverso dalla spec, vince la spec e la differenza va annotata in §10 (conteggio in `docs/STATO.md`) per essere corretta in Claude Design.*

## 0. Prerequisito: portare il design nel repo

1. In Claude Code, dentro il repo: `/design` → importa il progetto RoutForge (oppure, su claude.ai/design: Export → "Handoff to Claude Code" → "Send to local coding agent", o "Download as .zip" da scompattare in `claude-design/`).
2. `npm run design:check` deve elencare **0 file mancanti** (vedi `claude-design/README.md` per l'elenco atteso).
3. I file `spec/M0-Riattivazione_JavaScript.md` e `spec/M1-Tooling_Moderno.md` dell'export sono il **corso di esempio** (FORMATO_CORSO §5, D-SAMPLE-1): copiati in `src/data/sample-course/` in T-000 (copia verificata dal gate, INV-19); T-005 li carica nell'app.
4. `claude-design/design/course-data.js` è il risultato atteso del parser su M0+M1 (FORMATO_CORSO §0): confrontato in T-000 (`scripts/corso-esempio.test.mjs`, nel gate); coincide a meno di quattro differenze annotate, dove vincono le regole di FORMATO §2–§3 (D-PARSE-2).

## 1. Inventario delle schermate

Nomenclatura dell'export: `S<n> <Nome> Desktop|Mobile|Panel.dc.html` (Panel = pannello laterale destro su desktop);
`01…10 <Nome>.dc.html` = tappe di documentazione con i flussi; `RoutForge Design System.dc.html` = catalogo componenti.

| Schermata (design) | Sezione app | Spec di comportamento | Route | Contenuto obbligatorio |
|---|---|---|---|---|
| S20 Shell Desktop/Mobile | Navigazione | FUNZ §1 | — | Sezioni Oggi · +Crea · Statistiche · Profilo. Su mobile Profilo = menu dal logo utente (Corsi · Esiti da registrare con badge · Account e sincronizzazione · Impostazioni) e schermata S10; su desktop sidebar 240. Dal logo utente si raggiungono anche Notifiche (= «Esiti da registrare») e **Diagnostica** (FUNZ §1; assente nel menu dei mock: divergenza 16, §10), che sta anche dentro Impostazioni (S22, FUNZ §23). Nessuna schermata di benvenuto; nessuna ricerca («Cerca ⌘K» dei mock non è in spec); nessun nome utente («Ciao», solo email) |
| S1 Oggi Desktop/Mobile, 01 Oggi | Oggi | FUNZ §2, MECC §14, §15, §24 | `/` | Saluto «Ciao» → data dopo pochi secondi; segmentato Giorno·Settimana (mobile) / Giorno·Settimana·Mese (desktop); fascia senza orario in cima per priorità; blocchi cronologici; blocco Adesso/prossimo con stato; trascinamento solo todo senza orario (maniglia a sei punti); messaggio ritorno dopo assenza |
| 10 Mese PDF Widget | Oggi (Mese), PDF, Widget | FUNZ §2, §10, §18 | `/?vista=mese` | Griglia mese con puntini dei tipi; su desktop elenco del giorno a lato; stato vuoto; visualizzatore PDF; widget Android |
| S4 Crea Desktop/Mobile/Panel, 02 Crea | + Crea | FUNZ §3, MECC §2 | `/crea` | Quattro tipi nella stessa schermata; campi per tipo (tabella MECC §2); gradini di durata; orizzonte; priorità solo senza orario; checklist (todo); fasi (routine/evento); promemoria Auto/Off/Personalizzato con sveglie ≤ 7 h; senza orario → solo digest |
| S5 Dettaglio Desktop/Mobile/Panel, 03 Dettaglio | Dettaglio attività | FUNZ §4–§6, MECC §3–§5 | `/attivita/:id` | Modifica/elimina/completa; spunta todo sempre; routine Fatta/Saltata solo nel giorno; revisione fasi a inversione (tocchi solo le non fatte + Conferma); follow-up per fasi saltate degli eventi; "Completa evento"; "Registra esito" e "Anticipa sessione" per lo studio; stato `concluso` per eventi passati |
| S10 Corsi Desktop/Mobile, S11 Corso Panel, S11 Modulo Panel, 04 Corsi | Profilo → Corsi | FUNZ §9, FORMATO_CORSO §4 | `/corsi`, `/corsi/:id`, `/moduli/:id` | Import ZIP / corso di esempio con avvisi (max 5); percentuale unità completate e tempo dedicato; moduli con stato bloccato/aperto/passato, finestra indicativa, trasversali; criteri Go/No-Go (manuali e auto); progetto del modulo |
| S12 Unità Panel | Unità | FUNZ §9.2, §10, §14; FORMATO §3 | `/unita/:id` | Concetto core (titolo + testo); 4 sezioni Teoria·Studio·Pratica·Mini progetto con risorse e descrizioni; VideoCard dal primo YouTube della sezione Studio; materiali tuoi (link/nota/PDF); file di codice (solo albero); "Inizia sessione" / ripasso / riprendi; genera quiz/flashcard/DevSwipe/Bug Hunter/Trivia; pratiche recenti |
| S13 Extra Mobile/Panel | Vista Mese (mobile), visualizzatore PDF, widget Android: sono i pannelli montati dalla tavola «10 Mese PDF Widget» (riga sopra), non contenuti extra dell'unità | FUNZ §2, §10; MECC §17, §21 | vedi tavola 10 | Mese: elenco ↔ mese dal bottone in testa, elenco del giorno scelto. PDF: testata (nome, unità, dimensione, pagine), «testo estratto» o «scansionato · passivo», apertura esterna. Widget 4×2 (MECC §21): sessione attiva, blocco adesso/prossimo, agenda di oggi (max 6 + «+N»), fino a 3 todo alta priorità senza orario, giorni del mese con carico, carte da ripassare, «+» → Crea (il mock mostra solo mese, agenda, prossimo blocco e «+»: divergenza 17, §10) |
| S15 Sessione Desktop/Mobile/Panel, 05 Sessione | Sessione di studio | FUNZ §11, MECC §10 | `/sessione/setup`, `/sessione` | Setup (cosa/quanto/modalità/iperfocus); timer con schede Materiale·AI·Note; pausa/ripresa; interruzioni; segmenti pomodoro; cambio unità; badge «Tempo extra +04:12»; iperfocus a schermo intero con ora di sblocco e conferma «Esci comunque/Resta»; banner "sessione in corso" nel resto dell'app; riepilogo con i quattro esiti, confidenza 1–5, nota, "conta nel piano", upload codice |
| S8 Sveglia Mobile | Sveglia a schermo intero | FUNZ §7.2, MECC §13.1–13.2 | overlay nativo | Ora, titolo, orario e tipo del blocco; azioni del trigger (Inizia / Segna fatto / Registra esito / Apri il blocco) + Posticipa 10' |
| S19 AI Desktop/Mobile/Panel, 06 AI e pratica | Assistente e pratica | FUNZ §14–§16, MECC §18–§19 | `/ai`, `/pratica/:id` | Chat globale e contestuale (unità/modulo/corso) in streaming interrompibile, con citazioni TEORIA/CODICE/NOTA/LINK/PDF; elenco conversazioni raggruppato per età con ambito, n. messaggi, data e stato vuoto; generazione 5–25 + difficoltà; quiz (4 opzioni, punteggio, %); flashcard con 4 bottoni e prossima scadenza accanto; DevSwipe a una mano (swipe dx/sx, vibrazione, spiegazione 2 righe); Bug Hunter (tocca la riga, 2 tentativi); Audio Flash-Trivia (play/pausa/salta/stop); riepilogo finale con «Rifai la pratica» / «Torna all'unità»; errori AI leggibili (chiave assente, quota, rete) |
| S20 Statistiche Panel, 07 Statistiche | Statistiche | FUNZ §17, MECC §20 | `/statistiche` | Periodo 7/30/90/tutto; Panoramica (streak, ore, mappa 84 giorni, tre indicatori, disciplina, corsi); Comportamenti; Studio (incl. iperfocus e tempo extra); Pratica |
| S21 Notifiche Panel, 08 Notifiche | Schermata Notifiche | FUNZ §19, MECC §8 | `/notifiche` | Esiti pendenti (studio persi ≤ 3 giorni o programmati con fine passata, max 5, dal più recente) con «Registra esito»; badge |
| S22 Impostazioni Panel, 09 Impostazioni | Impostazioni | FUNZ §23–§24, MECC §13.1, §22–§23 | `/impostazioni` | Notifiche (generale, per tipo, ore silenziose, digest, prova, permessi allarmi); modello AI + chiave; backup export/import (conferma); account e sync; spazio materiali; animazioni auto/sempre/mai; celebrazioni piena/sobria/off; aptico; diagnostica copiabile; Informazioni; elimina tutti i dati; **nessun numero di versione** |

## 2. Componenti condivisi (dal catalogo `RoutForge Design System.dc.html`)

Da mappare uno a uno all'import, con questi contratti minimi:

| Componente | Props/stati che il codice deve supportare |
|---|---|
| `CardAttivita` | tipo (todo/evento/routine/studio) · orario o "senza orario" · stato (vedi §3) · priorità (solo todo senza orario) · badge checklist «fatte/totali» · badge unità (studio) · maniglia trascinamento (solo todo senza orario) |
| `ChipStato` | programmato · in corso · completato · parziale · indietro · saltato · perso/non fatto · concluso |
| `BloccoAdesso` | stato: «tra N min» · «adesso» · «recupera» · «orario passato»; azioni Inizia sessione / Apri; chiudi per oggi |
| `Segmentato` | Giorno·Settimana (mobile) · Giorno·Settimana·Mese (desktop) |
| `FormCrea` | quattro varianti; validazione MECC §2; selettore promemoria (Auto/Off/Personalizzato + sveglia per anticipo ≤ 7 h) |
| `Checklist` | max 60 voci; spunta singola; completamento automatico all'ultima voce; riapertura |
| `RevisioneFasi` | tutte fatte per default; tocco = saltata; Conferma; (eventi) follow-up per fase saltata |
| `Timer` | rimanente/trascorso · pausa · segmento corrente · tempo extra (+mm:ss) · iperfocus con ora di sblocco |
| `SheetEsito` | Completata/Continua/Indietro/Salta · confidenza 1–5 · nota · conta nel piano · carica codice |
| `Flashcard` | fronte/retro · 4 valutazioni con prossima scadenza |
| `CartaSwipe`, `BugHunterCodice`, `PlayerTrivia` | vedi FUNZ §14.3–§14.5 |
| `Heatmap84`, `Indicatore`, `Barre` | statistiche |
| `StatoVuoto` | settimana/mese/conversazioni/pratiche |

**Mappa al design (verificata in T-000).** Nel catalogo `RoutForge Design System.dc.html`: Button, IconButton, Chip,
Card (card attività = `CardAttivita`), StatCard, Sheet, HeaderRoot/HeaderDetail, BottomNav, Field · Select · Toggle ·
Selezione (= `Segmentato`), NowBlock (= `BloccoAdesso`), DayLabel, Timeline, Archivio completate, WeekStrip · MonthGrid,
SessionShell, CreateSheet (= `FormCrea`), Celebration. Solo nelle schermate, non nel catalogo: `Checklist` e
`RevisioneFasi` (S5), `Timer` e `SheetEsito` (S15), `Flashcard`, `CartaSwipe`, `BugHunterCodice`, `PlayerTrivia` (S19),
`Heatmap84`, `Indicatore`, `Barre` (S20 Statistiche), `StatoVuoto` (pattern di DESIGN.md §6, in S1, S10, S19, S20, S21).
**Da creare nel design**: `ChipStato` non esiste come primitivo; lo stato di un blocco è reso da OutcomeRow (S5),
dall'eyebrow del NowBlock e dalla resa della card (S1, §3 sotto): si implementa così, senza chip.

## 3. Stati visivi dei blocchi (MECC §1, §24)

| Stato | Resa | Interazione |
|---|---|---|
| `programmato` | normale | apri, spunta (se consentito), trascina (solo todo senza orario) |
| `in corso` | evidenziato, banner sessione | rientra nella sessione |
| `completato` / `parziale` / `indietro` / `saltato` | **in secondo piano**, restano nel giorno | apri dettaglio; annulla spunta (routine/todo) |
| `perso` ("non fatto" per i todo) | in secondo piano, etichetta | todo: spuntabile; studio: «Registra esito» / recupero; routine: non spuntabile |
| evento con fine passata senza completamento | `concluso` (mai "perso") | «Completa evento» sempre disponibile |
| blocco senza orario | fascia dedicata in cima (todo) / intera giornata (evento) | non occupa "Adesso", non conta minuti |

## 4. Responsive e piattaforme

- **Mobile**: una colonna; Giorno·Settimana nel segmentato, Mese dal bottone nell'header; dettaglio a schermo intero (S5 Mobile); trascinamento con pressione prolungata; sveglia a schermo intero (S8); safe area; widget Android.
- **Desktop/web**: Giorno·Settimana·Mese; settimana a 7 colonne; mese con elenco del giorno selezionato a lato; dettaglio/crea/sessione/AI come **pannello laterale** (S* Panel); cursore di presa solo sulle card trascinabili; notifiche solo con la scheda aperta.
- Riduzione animazioni e scala del testo di sistema sempre rispettate; animazioni auto/sempre/mai e celebrazioni piena/sobria/off dalle Impostazioni.

## 5. Regole visive

- `claude-design/design/tokens.css` è l'**unica** fonte di colori, tipografia, spaziature, raggi, ombre: nessun valore hardcoded in `src/ui`.
- `claude-design/design/DESIGN.md` governa gerarchia, densità, iconografia e tono dei testi; i testi visibili sono chiavi i18n nelle sei lingue (FUNZ §22), notifiche incluse.
- Stati vuoti espliciti dove la spec li nomina (settimana, mese, conversazioni).
- Il numero di versione non compare in nessuna schermata (FUNZ §23).

## 6. Flussi utente da rispettare (documentati nelle tappe 01–10)

1. **Primo avvio** → Oggi vuoto → Profilo → carica corso di esempio / importa ZIP → corso con moduli e unità (FUNZ §1, §9).
2. **Crea routine di studio** → occorrenze per 28 giorni con unità dal puntatore → tocco sull'occorrenza di oggi → unità → Inizia sessione → setup → timer → esito → puntatore aggiornato, streak (C1–C3).
3. **Giornata normale** → notifica pre → Inizia dalla notifica → sessione → esito a fine +10' se non registrato → esiti pendenti in Notifiche se perso (F1, C6).
4. **Routine con fasi** → spunta → revisione a inversione → Conferma (B5); evento con fasi → follow-up todo (E1).
5. **Todo che rotola** → orizzonte settimana → spostato a oggi in uno slot libero → notifica "in ritardo" una volta (A2, A1).
6. **Pratica** → da un'unità genera 5–25 → quiz/flashcard/DevSwipe/Bug Hunter/Trivia → riepilogo → Statistiche → Pratica (I1–I4).
7. **Backup e sync** → Impostazioni → export/import; account email+codice → attività e impostazioni allineate (J1–J5).

## 7. Vincoli non funzionali visibili in UI

Oggi con blocco Adesso pronto entro 0,5 s su dati esistenti (indice `giornoLocale`); nessuna operazione di notifica/widget/sync può bloccare la UI; tutto funziona offline salvo AI e sync (errori leggibili); tempo locale ovunque.

## 8. Cosa il design NON può dire (deriva sempre dalle spec)

Soglie e transizioni (§6–§9), regole del puntatore (§11), calcolo delle notifiche (§13), SM-2 (§19), definizioni statistiche (§20), regole di sync (§25), formato del corso (FORMATO_CORSO). Un'implementazione "fedele al mockup ma non alla spec" è non conforme.

## 9. Verifica dell'handoff (da eseguire al Checkpoint 2, dopo l'import)

- [x] `npm run design:check` → 0 file mancanti (T-000, 24/09/2026: 46 presenti, 45 attesi)
- [x] Ogni riga della tabella §1 ha un file di design corrispondente aperto e confrontato (T-000: tutte le 42 schermate, le tavole 01–10 e il catalogo)
- [x] Ogni componente di §2 esiste nel catalogo o è segnato come "da creare nel design" (mappa in §2)
- [x] Divergenze design↔spec elencate in §10 e risolte a favore della spec (17 divergenze + note interne al design, riviste dal `spec-reviewer`; le schermate si implementano secondo le righe di §1)
- [ ] `tokens.css` copiato in `src/ui/styles/` senza modifiche (T-006)
- [ ] Prima schermata implementata (S1 Oggi) approvata visivamente dall'utente (CP2, dopo T-008)

## 10. Divergenze design ↔ spec (T-000, 24/09/2026)

*Rilevate in T-000 (24/09/2026) leggendo tutte le schermate. Vince la spec: il codice segue le righe di §1; i mock vanno corretti in Claude Design.*
1. **Corso di esempio** (HANDOFF «BLOCCO 1», S10 Mobile/Desktop): la card «Software Engineer — percorso di esempio · 2 moduli · 2 unità» non corrisponde a nessun file. La spec non fissa quale corso (CONTESTO §5: incluso, conforme, senza avvisi; FORMATO §0: M0/M1 «devono importarsi senza avvisi»): D-SAMPLE-1 sceglie M0+M1 «Syllabus Software Engineer 2026», l'unico corpus conforme, 2 moduli · 13 unità; il badge «Esempio» del design va su quel corso. Il conteggio «5 moduli» (S10 `modules: 5`, S11 Corso `modCount` = moduli + `locked`) include i segnaposto M2–M4 senza file, che l'app non mostra (FORMATO §1, §4).
2. **Trascinamento di un blocco «perso»** (S1 Mobile e Desktop, tavola 01 `drag=perso`): il mock trascina «Palestra», una routine. MECC §15 e FUNZ §2: si trascinano solo i todo senza orario; il «perso» che torna programmato è un todo.
3. **S1 Desktop, vista Giorno**: il todo senza orario («Prepara la valigia») è in coda alla lista. MECC §24 e FUNZ §2: fascia senza orario in cima, ordinata per priorità (S1 Mobile è corretto).
4. **Nome utente** («Ciao, Alex»; «Alex» nel menu account, nella sidebar desktop, in S13 Mese, in S22 Account): FUNZ §2, l'account non ha un nome, solo l'email; il saluto è «Ciao».
5. **«Cerca ⌘K»** nella sidebar desktop (S1, S10, S15, S19, S20): nessuna ricerca nelle spec (FUNZ §1). Non si implementa.
6. **M1 mostrato «aperto»** con M0 a 3/7 criteri (HANDOFF «Dati del corso», S11 Corso): FORMATO §4 e D-PTR-1, M1 è bloccato finché tutti i criteri di M0 sono sì.
7. **S12 VideoCard**: primo link YouTube di qualsiasi sezione, regex senza `shorts/` ed `embed/`. FORMATO §3: primo YouTube della sezione Studio (`watch`, `youtu.be`, `shorts`, `embed`).
8. **S12 «Tuoi · restano anche se reimporti»**: MECC §16, ogni import crea un corso nuovo; i materiali restano sul corso vecchio, non passano al nuovo.
9. **S19 flashcard**: sui quattro bottoni solo l'etichetta del grado. FUNZ §15: accanto a ogni bottone la prossima scadenza.
10. **S19 `trivia-done`**: punteggio «8 / 10 · 80 %» ed elenco delle sbagliate. MECC §18: l'Audio Flash-Trivia non ha punteggio (risultato = ascoltate/totali) e non ha risposte da elencare (D-TRIVIA-1).
11. **S19 chat offline**: «il messaggio resta qui e parte quando torna la connessione». CONTESTO §3 («tutto funziona offline salvo AI»), MECC §18 (errore «rete») e FUNZ §16: senza rete errore leggibile; nessuna coda di invio (la coda offline esiste solo per la sync, MECC §25).
12. **S20 Shell Desktop, menu Impostazioni**: «Informazioni · v0.9». FUNZ §23 (e HANDOFF stesso): nessun numero di versione in nessuna schermata.
13. **S20 Statistiche · Panoramica**: KPI Costanza / Sessioni / Disciplina; mancano i tre indicatori di FUNZ §17.1 (efficienza del focus, giorni attivi, puntualità d'avvio) e le ore per corso.
14. **Voci non previste dalle spec** (non si implementano finché la spec non le aggiunge): «Segna tutte lette» e la sezione «Ieri · gestite» in Notifiche (S20 Shell, S21: la schermata mostra solo gli esiti pendenti, FUNZ §19, MECC §8); «Inizio settimana» (MECC §6: l'orizzonte settimana finisce sempre la domenica; FUNZ §23), «Lingua delle risposte» (MECC §18: lingua dell'ultimo messaggio), «Svuota cache», «Reinstalla PWA» (FUNZ §23–§24) ed elenco dispositivi con «Scollega» (FUNZ §21 e MECC §25: nel Profilo solo stato dell'account, ultima sync, «Sincronizza ora», uscita, cancellazione dei dati remoti) in Impostazioni.
15. **S1 Mobile, selettore di vista**: tre icone Giorno/Settimana/Mese in testa. FUNZ §2 (e riga S1 di `docs/03_HANDOFF_DESIGN_CODE.md` §1): segmentato Giorno · Settimana su mobile, il Mese si apre dal bottone nell'header.
16. **Menu dal logo utente** (S1 Mobile: Corsi · Esiti da registrare · Account e sincronizzazione · Impostazioni): manca la **Diagnostica**, che FUNZ §1 rende raggiungibile da lì (oltre che da Impostazioni, FUNZ §23).
17. **Widget Android** (S13, tavola 10): mostra mese, agenda di oggi, prossimo blocco e «+». MECC §21 (e DESIGN.md §6, che li prevede) chiede anche la sessione attiva, fino a 3 todo alta priorità senza orario e le carte da ripassare.

*Note interne al design (non contraddicono la spec; da segnalare a Claude Design)*: il tipo «studio» è blu primary in S4 Crea e S22 Notifiche, viola cat-study in S1, S5, S8, S21; dati inventati contro la regola «niente titoli inventati» di HANDOFF (S15 debrief «Unità 2.4 / 2.5 / 2.3», S5 studio «Modulo 00 · Unità 0.1» con il titolo della 0.7 e «0 / 6 unità», S20 Studio «Ultime unità» con titoli non del corso, S10 `warnings` che attribuisce a `M1-Tooling_Moderno.md` un'unità «importata con 3 sezioni» mentre M1 si importa senza avvisi); DESIGN.md §6 cita la scadenza «Quando capita» che S4 non ha (S4 vince); S15 e DESIGN.md §5 mostrano l'intestazione del mini progetto senza il prefisso «Mini Progetto Finale:» che FORMATO §3 conserva e S11 Modulo mostra intero (il parser lo conserva; la UI lo mostra intero); `course-data.js` si discosta dalle regole di FORMATO §2–§3 in quattro campi pur essendo dichiarato «risultato atteso» in FORMATO §0 (intestazione «Teoria (Fondamenta)», finestra di M1 «· mini-modulo», intro ridotta al primo paragrafo, link del test di fit ridotti al titolo): D-PARSE-2 estesa, differenze annotate in `scripts/corso-esempio.test.mjs`.
