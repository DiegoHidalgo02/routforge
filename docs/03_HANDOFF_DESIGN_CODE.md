# RoutForge — Handoff design → codice

*Dove il design entra nel progetto e che cosa deve trovare. Comportamento → `docs/spec/`; aspetto → il design
importato in `claude-design/`, riferimento solo dopo il suo handoff, che si scrive in questo file. Se design e spec
divergono vince il design (D-DESIGN-1): la divergenza si annota qui e l'utente decide come allineare la spec. Regole
d'implementazione della UI: `.claude/rules/ui.md`.*

## 0. Stato (05/10/2026)

- **Design importato** (D-DESIGN-3). Il progetto Claude Design «RoutForge product design»
  (`https://claude.ai/design/p/8acfd054-2d68-41a6-8623-3f201d476f98`) è in `claude-design/` così com'è: 59 file di
  testo copiati via MCP (`read_file`) e verificati sui byte dichiarati da `list_files`; `.thumbnail` (binario) non è
  importato. Il pacchetto è scritto per stare alla radice di un repository: qui la sua radice è `claude-design/`, quindi
  i percorsi che cita si leggono con quel prefisso (`HANDOFF.md` → `claude-design/HANDOFF.md`, `docs/BLOCCHI.md` →
  `claude-design/docs/BLOCCHI.md`, `design/tokens.css` → `claude-design/design/tokens.css`). Punto d'ingresso:
  `claude-design/HANDOFF.md`; decisioni vincolanti del design: `claude-design/CLAUDE.md` (vincono sulla spec, CONTESTO
  §2); punti non definiti: `claude-design/docs/BLOCCHI.md`; specifica operativa: `claude-design/docs/`.
- **Spec allineate**: le quattro spec del pacchetto (`claude-design/spec/`) sostituiscono `docs/spec/` (INV-5,
  richiesta dell'utente del 05/10/2026); `RoutForge_FORMATO_CORSO.md`, M0, M1 e `course-data.js` restano quelli del
  repository: il BLOCCO 3 del pacchetto è risolto qui (`docs/spec/`, `src/data/sample-course/`), e
  `claude-design/design/course-data.js` è identico a `src/data/sample-course/course-data.js` (INV-19). Ciò che cambia
  rispetto al codice e alle decisioni è in §2.
- **Prossimo passo**: l'handoff per schermata in questo file (schermata → file del design → task), con il prompt
  preparativo dell'utente adattato al repository; la prima schermata implementata va al CP2 (`docs/06_SUPERVISIONE.md`).
  Finché una schermata non è mappata qui, il suo riferimento visivo non è attivo.
- **Token**: dal T-052 l'app importa `claude-design/design/tokens.css` così com'è da `src/main.tsx`, senza copia
  (INV-20); i token a segnaposto sono risolti per tipo in `src/ui/styles/global.css` (§3 n. 1).
- **L'export si versiona così com'è** in `claude-design/` (D-DESIGN-1); si cambia in Claude Design e si reimporta, mai
  a mano. `.gitignore`, `.prettierignore` ed `eslint.config.js` lo escludono già (ZIP, formato, lint). I `.dc.html`
  caricano React 18 e i font da internet solo per l'anteprima dei mock: non è prodotto.

## 1. Da confrontare con il nuovo design (inventario al 04/10/2026)

Non sono requisiti nuovi: sono fatti del progetto attuale che il confronto deve coprire. Dove il nuovo design li
contraddice decide l'utente (D-DESIGN-1).

**Schermate e rotte del codice** (`src/ui/App.tsx`, costruite sul vecchio design): Oggi `/` (Giorno · Settimana · Mese,
striscia, fascia senza orario, blocco Adesso, trascinamento, ritorno dopo un'assenza) · «+ Crea» `/crea` (quattro tipi)
· Dettaglio `/attivita/:id` (spunta, checklist, fasi, follow-up, esito) · Corsi `/corsi` (elenco, import ZIP, corso di
esempio) · Sessione `/sessione/setup` e `/sessione` (setup, timer, iperfocus, sheet di chiusura con gli esiti, banner e
card nella sidebar) · shell con BottomNav sotto 1024 px e sidebar da 1024 (D-UI-1), menu del logo utente. Con la sola
intestazione: Statistiche, Notifiche, Impostazioni, Account, Diagnostica. «+ Crea» e Dettaglio si aprono anche sopra la
schermata di partenza.

**Schermate che non avevano un task** (FUNZ §4.2, §9.2, §11.1, §11.2; FORMATO §4): corso, modulo e unità ora sono
T-053, la scheda Note del timer è in T-055 (Materiale e AI restano a T-024 e T-026). Rotte del nuovo design in
`claude-design/docs/NAVIGAZIONE.md` §4 (servono anche ai collegamenti diretti di MECC §21).

**Regole adottate dal vecchio design** (D-DESIGN-1 n. 1–25): per ciascuna la regola e i paragrafi di spec allineati
nella tabella di `docs/decisioni/D-DESIGN-1.md`; la n. 25 resta una differenza di testo con FUNZ §4.4 («Chiudi evento»
nel codice, «Completa evento» nella spec). Le scelte minime dove quel design taceva sul comportamento (n. 5 ricerca, 10
Trivia, 13 Panoramica delle statistiche, 14 voci di Notifiche e Impostazioni) si rivedono se il nuovo design le precisa.

**Scelte dell'utente su aspetto e interazione**, prese contro o accanto al vecchio mock: D-UI-2 (tre icone di vista su
mobile), D-NOW-3 (colori del blocco Adesso dal tipo), D-CAL-2 (aloni dei pallini, card in corso, Mese con la griglia
anche vuoto, periodo che entra dal lato dello scorrimento), D-DETT-1 («Riapri» per la routine completata). D-DETT-3
(spunta diretta dal cerchio della card) è comportamento (MECC §3, §24): il nuovo design deve offrirla. Chiuso sulla spec
contro il mock il 02/10/2026: l'unità del recupero non si cambia nel setup (D-SESS-1 n. 6).

**Elementi che il vecchio design non disegnava**. Fatti con i token esistenti: riga «Altro anticipo · fino a 31
giorni» in «+ Crea» (D-NOTIF-1); avviso dell'intervallo non verificato nel timer con «Conta nel focus» (D-TIMER-2);
«Chiudi come Continua (n%)» nello sheet di chiusura e il testo della schermata finale (D-SESS-2); «Abbandona · nessun
esito» nello sheet di chiusura (D-ESITO-1); «Registra esito» dal Dettaglio nello stesso sheet (D-ESITO-1); sheet «Voci
non spuntate» (D-DETT-2); stati del setup e del timer senza mock («Cambia unità» aperto, «Salta segmento» spento
sull'ultimo segmento, iperfocus spento col cronometro, card della sessione nella sidebar) e iperfocus sopra tutta la
finestra, sidebar compresa (vecchio §10 n. 33, D-TIMER-1); banner del ritorno dopo un'assenza su desktop
(D-ASSENZA-1). Da fare con T-032: digest del mattino in una riga propria di Impostazioni → Notifiche, nessuna card «Ore
silenziose» (D-NOTIF-3).

**Segnalazioni aperte sul vecchio design**: maniglia di trascinamento sotto il contrasto 3:1 dei componenti; «Annulla»
d'azione (Undo) non distinto dall'«Annulla» dei form; nessun token per il fondo della testa del timer nel tempo extra;
focus visibile assente dai mock; il testo del ritorno dopo un'assenza («…, i todo sono a oggi», chiave
`ritornoAssenza`) può essere falso per MECC §6, perché i todo con orizzonte giorno o scaduto restano «non fatti» nel
loro giorno.

**Dipendenze del codice dal vecchio design**: font `@fontsource/manrope` e `@fontsource/ibm-plex-mono`, icone
`lucide-react` col tratto 1.75 (D-STACK-1; il nuovo design li conferma: ASSET), `src/ui/Logomark.tsx`, voce dei testi (`PRODUCT.md`, `src/ui/i18n/`), eccezione di
`.impeccable/config.json` su `src/ui/Detail.module.css`. Le sigle S1…S22 in commenti, test, task fatti, decisioni e
nella colonna «Dove» di `docs/TRACCIABILITA.md` nominano le schermate del vecchio export: sono storia, finché
l'handoff non dà i nomi nuovi.

**Backlog**: i task aperti di `docs/TASKS.md` descrivono il comportamento; la loro parte visiva arriva con l'handoff,
che mappa le schermate nuove sui task.

## 2. Che cosa cambia rispetto al codice e alle decisioni (confronto delle spec, 05/10/2026)

Dal diff fra le spec del repository (30/09/2026) e quelle del pacchetto, più `claude-design/CLAUDE.md`. Decisione:
D-DESIGN-3. Ogni voce è un task nuovo o ritocca un task esistente; l'handoff per schermata aggiunge il resto.

| Dove | Oggi nel codice | Nuovo design | Task |
|---|---|---|---|
| Adesso (MECC §14, FUNZ §2; G1, G2) | blocco separato `NowBlock` con ×, `preferenze.adessoChiuso`, variante compressa (T-010, D-NOW-2) | la card dell'attività in corso o imminente cresce a hero nella lista, al suo orario, per ogni tipo; nessuna chiusura | T-048 (fatto, 05/10/2026) |
| Trascinamento (MECC §15, FUNZ §2; G3) | todo senza orario → orario o giorno, persi riprogrammati, aggancio a 5', «Annulla» (T-015, D-DRAG-1) | solo riordino dei todo senza orario nella stessa priorità; frecce su desktop, tasti su mobile; ordine persistito e sincronizzato | T-044 (riscritto); il trascinamento di T-015 si toglie |
| Cerchio della card (MECC §3, §4, §24; A3, A7, C10) | todo e routine (D-DETT-3), sheet «Voci non spuntate» (D-DETT-2) | tutti i tipi: evento, studio con «Registra esito» (minuti = durata pianificata); «Voci rimaste»; archivio col trascinamento senza «Raccogli», «Completate», toast con «Annulla» 5 s | T-049 (fatto), T-056, T-040 |
| Crea (MECC §2, FUNZ §3; G5) | data libera, × nel foglio (T-007, D-CREA-1) | giorno di partenza = selezionato entro oggi + 6; attività solo nei prossimi 7 giorni; nessuna ×; animazione di conferma e toast con «Annulla» | T-050 |
| «Segna fatto» da notifica (MECC §4, §13.2; A6) | azione nativa non ancora collegata (T-021) | con voci aperte apre il Dettaglio su «Voci rimaste»; senza, completa in background | T-051 (dopo T-021) |
| Sveglie (MECC §13.1 n. 4, FUNZ §7.3; F7) | `sveglia` è un attributo della voce (D-NOTIF-1): verificare che verifica, esito e one-shot non la ereditino | verifica, esito e avvisi una tantum non sono mai sveglie; tasto principale della sveglia nel fill del tipo | T-019 (test F7), T-021 |
| Ricerca (FUNZ §1, CONTESTO §5) | T-039 aperto (D-DESIGN-1 n. 5) | nessuna ricerca | T-039 annullato |
| Navbar e intestazione (FUNZ §1) | pill «Oggi» nell'intestazione e nel Mese (T-043) | su mobile «Oggi» della barra in basso riporta a oggi; nessun tasto «Oggi» nell'intestazione né nel Mese; su desktop «Oggi» fra le frecce | handoff di S1 |
| Fine sessione (FUNZ §12; S15 `done`) | schermata finale di T-018 e T-046 | «Giorni di fila 13 · +1», «Torna a Oggi», «Riduci» | handoff di S15 |
| Celebrazioni e percentuali (FUNZ §23; `claude-design/CLAUDE.md`) | — | sobria (default) · piena · off; percentuali con lo spazio («38 %») | T-032, i18n |
| Schermate senza codice | — | S8 sveglia, S9 notifiche di sistema, S11 e S12 (corso, modulo, unità), S13 PDF e widget, S19 AI, S20 statistiche, S21 notifiche, S22 impostazioni | i task del backlog (T-021–T-032) e quelli che nascono dall'handoff |

**Blocchi del pacchetto** (`claude-design/docs/BLOCCHI.md`): 1 (creazione su desktop) e 2 («Registra esito» dal
cerchio su desktop) hanno un comportamento provvisorio scritto lì, da seguire; 3 è risolto dai file del repository;
4 sono D-SYNC-1, D-BACKUP-1, la cifratura della chiave (CP4) e D-QUIZ-1 (CP5), già aperte qui.

**Scelte dell'utente da riconfermare sul nuovo design**: D-UI-2 (icone di vista), D-NOW-3 (colori di Adesso dal tipo:
il design ha la card per tipo), D-CAL-2 (aloni, card in corso, Mese vuoto), D-DETT-1 («Riapri»: la spec ora cita anche
«Annulla» nel toast). Il vocabolario italiano dei mock e di `claude-design/docs/TESTI.md` sostituisce quello del
vecchio design nelle sei lingue (T-031).


## 3. Verifica del design (05/10/2026, D-DESIGN-4)

Fatta con subagenti per gruppo di schermate (S1; S4 e S5; S10–S13; S15, S8, S9 e S21; S19, S20 e S22) e due script
una tantum (valori dei mock contro i token; token vecchi contro nuovi). Tornano: i 33 `@keyframes` dei mock e di
`tokens.css` (stessi nomi); `docs/COPERTURA.md` copre i 60 scenari (alcuni ◐: una parte è solo logica); i colori dei
mock sono tutti token, salvo le varianti alfa che vengono dai token a segnaposto (n. 1). Qui solo ciò che cambia che
cosa si costruisce: per ogni voce fonti, effetto, task e decisione della gerarchia (`claude-design/CLAUDE.md` >
`.dc.html` > docs del pacchetto > spec), oppure **bloccante** (la gerarchia non decide: la domanda è nel report).

**Globali**
1. Token a segnaposto (`tokens.css`: `--shadow-primary-cat`, `--shadow-hero`, `--glow-dot-live` con `<fill>`, `<ink>`)
   non sono CSS valido: usati come sono, l'ombra sparisce. Decisione: si risolvono per tipo in `global.css` con
   `color-mix()` sui token del tipo; stesso meccanismo per le tinte alfa del success (Giornata chiusa). T-052.
2. Riduzione animazioni: la coda di `tokens.css` azzera ogni durata (`animation-duration` e `transition-duration` a
   `.01ms` su `*`), mentre DESIGN §4, §11 e HANDOFF dicono «solo dissolvenze». Stesso livello: **bloccante** (domanda);
   provvisorio, la coda così com'è (nessuna animazione).
3. Chiave Gemini: S19 dice «resta solo su questo dispositivo: va inserita su ognuno», CONTESTO §5 e MECC §25 la
   sincronizzano come impostazione e BLOCCO 4 ne tiene aperta la cifratura. Il design vincerebbe (CONTESTO §2), ma
   cambia l'ambito della sync (CP4): **bloccante** (domanda). T-026, T-033.
4. «Inizia sessione» (S12, DESIGN, SCENARI C4) e «Avvia sessione» (S5) per la stessa azione: due file S, TESTI §1
   vuole un nome solo. **Bloccante** (domanda); provvisorio «Inizia sessione».
5. Opzione «sveglia» nel foglio Crea anche nella cornice desktop; le sveglie esistono solo su mobile (CONTESTO §3).
   Decisione: dipende dalla piattaforma (Android, iOS), non dalla larghezza. T-050.
6. Studio nel foglio Crea in blu primary (S4), viola nei token, in DESIGN e negli altri file. Decisione: viola. T-050.
7. Scenario dei mock: le attività del giorno sono costanti dei componenti S1, non un file di dati. Decisione: fixture
   del confronto scritta in T-052 sui valori di S1, con il corso di `src/data/sample-course/course-data.js`.
8. Icone: i tre pulsanti di vista e la maniglia dei mock non coincidono con un'icona Lucide. Decisione: l'icona Lucide
   più vicina (ASSET «Icone»), controllata nel confronto. Icone dell'app, delle notifiche e splash non sono nel
   pacchetto: mancanza registrata per T-035 (CP6).

**S1 Oggi** (tavola 01)
9. Card persa o saltata e todo «Non fatto» non disegnate (DESIGN §5 «defilata (opacità)» senza valore): **bloccante**
   (aspetto). T-048, T-049.
10. «Categoria» nel sub di routine e todo («Workout · 3 fasi», «Deep Work · 30 min») e luogo dello studio («Aula B2»):
    nessun campo in MECC §2 né nel foglio Crea. **Bloccante** (domanda: togliere dal sub o aggiungere il campo). T-048.
11. Barre del Focus nella terna di progresso: significato e scala non definiti (DATI-UI). **Bloccante**. T-040.
12. Giornata chiusa: riga «Domani» senza attività domani, fascia con soli todo senza orario non disegnate
    (**bloccante**); i segmenti contano anche i todo senza orario, contro MECC §24: vince il file, spec da allineare. T-040.
13. Archivio delle completate: si apre solo trascinando; rotella e tastiera non disegnate, mentre
    `claude-design/CLAUDE.md` lo vuole raggiungibile dalla rotella. **Bloccante** (direzione e soglia). T-040.
14. Scatto della card Adesso quando l'ora arriva con l'app aperta: non disegnato. Decisione: la stessa entrata
    `rf-hero-in` di DESIGN §5. T-048 (applicata, n. 55).
15. Desktop: nessuna variante «Tra poco», «Da recuperare», Giornata chiusa o archivio. Decisione: la stessa card
    (DESIGN §5, MECC §14); Giornata chiusa e archivio solo mobile (DESIGN §5). Banner del ritorno dopo un'assenza su
    desktop: **bloccante** (posizione). T-048, T-040.
16. Frecce di riordino 28 × 26 contigue (target 44 impossibile) e visibili solo con puntatore o fuoco: su un tablet
    touch da 1024 px non c'è modo di mostrarle. **Bloccante**. T-044.
17. Pallino di sincronizzazione dell'avatar disegnato solo «in pari» (offline, conflitto, senza account mancano):
    **bloccante**. T-033.
18. Bottone del periodo su desktop (chevron) senza comportamento; scorrimento laterale fra i giorni (FUNZ §2) non
    disegnato: **bloccante**. T-048.
19. Saluto → data all'apertura (file) contro «con lo scroll» (DESIGN §6); menu account a quattro voci. Decisione: il
    file (e NAVIGAZIONE §2). T-052.
20. Mese vuoto: su desktop diverso da DESIGN §6, su mobile non disegnato. Decisione: il file su desktop, DESIGN §6 e
    TESTI §8 su mobile. T-040.

**S4 Crea e S5 Dettaglio** (tavole 02, 03)
21. Anticipo libero fino a 31 giorni (MECC §13.1, FUNZ §7.2) assente: solo i sette anticipi fissi. Decisione: il design;
    la riga «Altro anticipo» del codice (T-019) esce con T-050; spec da allineare (proposta).
22. Selettore dell'inizio della ricorrenza e della «Corso», orari iniziali del form a vuoto: non disegnati né regolati.
    **Bloccante**. T-050.
23. Todo senza orario: l'etichetta «Promemoria» resta senza contenuto (la spec dice «solo digest»). **Bloccante**
    (domanda: residuo del mock?). T-050.
24. Data di un evento in Modifica fuori da oggi … oggi + 6: non definita. **Bloccante**. T-042 (provvisorio: resta la
    sua, una nuova si sceglie fra oggi e oggi + 6, D-MOD-1).
25. Dettaglio: routine persa oggi (Fatta o Saltata fino alle 23:59), fasi «nulle» e «saltate» a blocco chiuso, meta
    per gli altri orizzonti e priorità, motivo della CTA spenta: non disegnati. **Bloccante** (aspetto e testi). T-054.
26. Routine completata senza «Riapri» (ce l'ha solo il todo). Decisione: il design; D-DETT-1 da riconfermare (§2). T-054.
27. Dopo «Elimina» il pannello resta aperto col toast. **Bloccante** (comportamento). T-054.
28. «Salva» della Modifica torna a Oggi con «Modifiche salvate». Decisione: il design. T-042.
29. BLOCCHI 1 (creazione su desktop) e 2 («Registra esito» dal cerchio su desktop): il provvisorio scritto in
    `claude-design/docs/BLOCCHI.md`. T-050, T-049.

**S10–S13 Corsi, PDF, widget** (tavole 04, 10)
30. Titolo del corso quando manca `00_struttura` (FORMATO §1, D-PARSE-1): nessun passo in S10. **Bloccante**; il codice
    attuale lo chiede e resta finché il design non lo disegna. T-053.
31. Materiali e file di codice a livello di corso (MECC §16, §18): nessuna schermata. **Bloccante**. T-024, T-025.
32. Stato «in corso» della sezione dell'unità non derivabile da «fatta quando tutte le risorse sono aperte»; righe
    delle unità senza resa per saltata, da rivedere e parziale; «Verifica del modulo» (domande, esercizi) senza
    schermata. **Bloccante**. T-053.
33. VideoCard offline o in errore; PDF da «scaricare» in S13 `pdf-scan` (la spec non ha PDF remoti); evidenziazione
    della citazione senza token. **Bloccante**. T-024.
34. Eliminazione del corso: nessun toast, «corso corrente → successivo» senza resa, «log fasi» assente dall'elenco
    (MECC §16 lo include: si aggiunge). **Bloccante** minore. T-037 (applicata: dopo «Elimina corso» si torna all'elenco
    senza toast; il log fasi è nella cascata ma non nel foglio, perché le routine di studio non hanno fasi e la riga
    direbbe sempre 0; un «corso corrente» non c'è nello stato dell'app, D-CASCATA-1).
35. Widget: «max 6 + N» e «3 todo alta priorità» non sono più in MECC §21 (allineato `docs/00_SINTESI.md`). T-023.

**S19, S20, S22** (tavole 06, 07, 09)
36. Chat: nessun ingresso alle Conversazioni, menu dell'ambito, bolla in streaming e dopo l'interruzione, citazioni
    LINK e PDF e il loro tocco, markdown delle risposte. **Bloccante**. T-026.
37. Statistiche: tasso dei persi, costanza settimanale, % per fascia, soglie della heatmap, formato del delta, periodo
    «tutto», tessere che seguono il periodo; il Focus di Studio non coincide con la Panoramica (cifra del mock).
    T-029: scelte in D-STATS-1; dove il mock decide, vince il design (scelta dell'utente 06/10/2026, n. 75).
38. Impostazioni: orario del digest, scelte di Animazioni, Celebrazioni, Aptico, Inizio settimana e Lingua delle
    risposte, vista Informazioni, nome dell'account, errori di accesso e di sincronizzazione. **Bloccante**. T-032, T-033:
    scelte provvisorie in D-IMPOST-1 e n. 76.
39. Tavola 06 «Bug Hunter · soluzione» monta il secondo tentativo, non lo stato risolto: da correggere nel design;
    vale il codice del Panel e SCENARI I3. T-028.

**S15 Sessione, S8, S9, S21** (tavole 05, 08)
40. Intervallo non verificato: il mock ha «Conta come studio» e «Lascia fuori», il codice e D-TIMER-2 «Conta nel
    focus» senza alternativa. Decisione: il mock; «Lascia fuori» lascia l'intervallo escluso (§10.4) e chiude
    l'avviso; D-TIMER-2 si allinea col task. T-055.
41. «Esci comunque» in iperfocus: il mock resta sullo schermo col toast, CONTROLLI dice «sessione chiusa».
    **Bloccante** (destinazione e chiusura). T-055.
42. Timer con barra di 3 px al posto dell'anello di DESIGN e CONTROLLI; la pill «Iperfocus» del timer non è
    raggiungibile (iperfocus apre lo schermo intero). Decisione: il mock; la pill non si costruisce. T-055.
43. «Cambia unità» anche fuori dal pomodoro e senza un foglio di scelta disegnato. **Bloccante**. T-055.
44. Durata «Personalizzata» senza controllo d'inserimento; cronometro in corso (conto in avanti) non disegnato.
    **Bloccante**. T-055.
45. Sessione senza unità (il setup offre «Nessuna unità», C9): timer, Materiale, ambito AI, debrief e fine mostrano
    sempre «Unità 0.7». **Bloccante** (resa); intanto vale MECC §11. T-055.
46. «Registra esito» senza sessione (da S21, dalla notifica dell'esito, dal cerchio: C6, C10): il debrief del mock ha
    sempre il timer dietro, «Continua a studiare», «Abbandona», minuti per unità. **Bloccante** (che cosa si toglie).
    T-049, T-022.
47. «Abbandona»: manca la variante delle sessioni senza blocco (nessuna soglia, MECC §10.5); sotto soglia il mock torna
    al setup, il prodotto a Oggi col blocco `programmato` (D7); sopra, «conta nel piano» è sì per regola. Decisione:
    spec per regola e navigazione, testo del mock dove c'è il blocco. T-055.
48. Fine: il «+1» del mock compare a ogni Completata o Continua che conta, MECC §12 lo dà solo alla prima del giorno;
    «La card su Oggi è spuntata» è falso per la libera o con «conta» spento. Decisione: si applicano entrambe le
    condizioni. T-055.
49. Pausa e pomodoro: il mock ferma il conto, D1 lo vuole in corsa per le sessioni ancorate all'orologio; senza durata
    il mock fissa 120 min, D-POMO-1 vuole 4 cicli. Decisione: SCENARI D1, D2 e la spec. T-055.
50. Debrief senza altezza massima: a 360 × 640 sborda. Decisione: come il Dettaglio, fino a 56 px dal bordo alto con
    scorrimento interno (DESIGN §6). T-055.
51. AI dentro la sessione: «Ambito» senza menu, campo finto, nessuno stato senza chiave o offline. Decisione: CONTROLLI
    (ambito = unità della sessione) e gli stati di S19. T-055, T-026.
52. S8 Sveglia: «Chiudi» in più rispetto alle «due azioni» di DESIGN e a MECC §13.2. Decisione: il mock, senza azione.
    S9: trigger, tempi, azioni e canali coincidono con MECC §13.2, F1, F3, F7, A4; «Si avvia ancora come recupero fino
    alle 17:15» contro MECC §8 («anche dopo»): vince il mock, spec da allineare. T-021.
53. S21: «Recupera» solo sulle righe non ancora perse (MECC §8, §10.1 lo ammettono anche da perso): vince il design, il
    recupero di un perso resta nel Dettaglio. «Ieri · gestite»: motivi verbatim dai mock, sezione omessa se vuota. T-022.
54. S21 «Segna tutte lette» sta nell'intestazione della shell senza comportamento; il contatore conta le pendenti; il
    «segno di novità» di MECC §8 non è disegnato. **Bloccante**. T-022.

**Implementazione** (scelte prese nel codice, verificate con `npm run confronto`)
55. Card Adesso (T-048): sub dello studio «corso · Unità n.n» come DATI-UI e S8 (S1 scrive il nome breve del modulo,
    «Riattivazione JavaScript»); in corso senza durata il dato è l'orario d'inizio e «senza durata» (stato non
    disegnato); lo scatto di 900 ms avviene una volta per apertura dell'app, subito con la riduzione delle animazioni;
    su desktop nessuna entrata né anello, come S1 Desktop, anche quando l'ora arriva con l'app aperta (n. 14 vale per
    il mobile). Il cerchio della hero segue `canCheckFromCalendar`: l'evento lo riceve con T-049.
56. Cerchio (T-049): spento anche per lo studio di oggi non ancora finito o in corso (il design disegna solo «un altro
    giorno»), con il titolo «Si segna nel giorno previsto» solo per gli altri giorni; esiti di studio (parziale,
    indietro) senza cerchio finché T-040 non li mette nell'archivio. I fogli aperti dal cerchio stanno ancora nel
    Dettaglio (T-056); spunta disegnata e chiusura della riga con Motion (06/10/2026, D-IMPOST-1).
57. Riordino (T-044, D-RIORD-1): la card sollevata segue il puntatore (i mock sono fermi: sul mobile la disegnano sopra
    lo slot, sul desktop sopra la riga originale, che resta com'è); sul desktop la maniglia è solo il segno della presa,
    fuori dall'ordine del fuoco, e la regione live c'è anche lì (MECC §15, il mock desktop non la ha); «Fine» della
    barra è una chiave sua (`fineRiordino`: «Fine» di Crea è l'ora di fine).
58. Progresso e prossime attività (T-040, D-PROG-1): i colori dei grafici si calcolano anche su desktop (il mock li ha
    fissi), la curva della settimana viene dai dati, le barre del Focus aspettano il n. 11; «Prossime attività» guarda i
    28 giorni seguenti. Le classi delle frecce del riordino si chiamano `frecceRiordino`: con `frecce` coprivano le
    frecce del periodo della testata (difetto di T-044, corretto).
59. Archivio e Giornata chiusa (T-040, D-PROG-1 n. 8–9): senza i pallini proiettati e i raccordi del mazzo, senza
    `rf-land` (la card passa al mazzo quando la riga si è chiusa: `rf-collapse` e la spunta disegnata ci sono, con
    Motion, dal 06/10/2026) e con i segmenti senza scaglionamento;
    le card dell'archivio aperto restano a `--opacity-archive` (il .32 del mock non regge il contrasto); Invio e Spazio
    sul mazzo in attesa del n. 13.
60. Crea (T-050): il foglio non si rimpicciolisce fino alla card né la fa posare nel calendario (Giorno, Settimana,
    Mese): l'attività compare al suo posto al ridisegno e Oggi mostra «… creato» con «Annulla»; la chiusura trascinando
    in basso vale solo al tocco (col mouse «Annulla» ed Esc). La data dell'evento e l'inizio della ricorrenza si
    scelgono solo fra oggi e oggi + 6.
61. Fogli dal cerchio (T-056): «Voci rimaste», «Revisione fasi» e «Registra esito» salgono da soli sopra Oggi (su
    desktop riempiono il pannello di 440, BLOCCHI n. 2); il loro contenuto è ancora quello del vecchio design (titolo,
    testo, «Non ora» al posto di «Tutte fatte») e si rifà con il Dettaglio (T-054). Se una scrittura fallisce compare il
    pannello del Dettaglio con l'errore.
62. Dettaglio (T-054): la matita «Modifica» arriva con T-042; «corso non importato qui» con la sync (T-034);
    l'unità aperta mostra concetto core e modulo, non ancora le sezioni dell'«Unità inline» del mock; dopo «Elimina»
    il pannello si chiude allo scadere del toast (n. 27, provvisorio). Nel foglio di eliminazione «solo questa
    occorrenza» invece di «l'occorrenza di oggi» del mock, che sbaglia su un'occorrenza di un altro giorno.
63. Modifica (T-042, D-MOD-1): la matita del Dettaglio apre il foglio di Crea in modifica sopra lo stesso sfondo;
    «Annulla» torna al Dettaglio (il mock non lo disegna), «Salva» a Oggi con «Modifiche salvate» senza «Annulla»
    (n. 28). La data fuori da oggi … oggi + 6 resta la sua (n. 24, provvisorio). Nel pacchetto «Il tipo non si cambia
    dopo la creazione» è in text-3, che `tokens.css` esclude per il testo informativo (3,2:1 a 12 px): l'app segue il
    mock, da decidere.
64. Toast di Oggi (S1): pallino verde per ciò che è fatto (spunta, esito, voci tutte fatte), nel colore del todo per i
    todo nuovi (creato, voci rimaste, follow-up), primary per il resto (creazioni, «Modifiche salvate»), come nel mock.
65. Sessione (T-055, primo incremento): schede Materiale · AI · Note sotto il timer, con la testata ferma e il contenuto
    che scorre; Materiale = concetto core e sezioni dell'unità studiata adesso, testo semplice, titolo della sezione
    ricavato dall'intestazione (`sectionTitle`: la regola non è nel design), descrizione con la maiuscola come nel mock;
    senza unità «Nessuna unità assegnata» (n. 45); i «Tuoi» materiali arrivano con T-024. AI: lo stato «Serve la chiave
    API Gemini» di S19 finché non c'è il client (T-026); il conteggio «2» della scheda e il link «Come ottenere una
    chiave» non hanno un significato o una destinazione nel pacchetto: non ci sono. Note: markdown sulla sessione
    attiva, salvate dopo 600 ms di quiete e all'uscita dal campo, restano nella sessione chiusa; «salvate» in text-3
    come nel mock. Intervallo non verificato con «Lascia fuori» e «Conta come studio» (n. 40, applicata). Fine: «Giorni
    di fila» con «+1» solo se la chiusura ha fatto crescere la streak; «La card su Oggi è spuntata» solo con un blocco,
    per la libera solo la seconda frase (n. 48, applicata).
66. Sessione su desktop (T-055): Materiale a sinistra e AI · Note in una colonna di 400 a destra, come S15 Desktop;
    nella sessione la carta della sidebar non offre «Riprendi». Debrief: «Abbandona» centrato sotto i bottoni, con «il
    blocco torna programmato» solo se c'è un blocco (n. 47); la riga «Carica il codice prodotto» c'è solo con un'unità
    (n. 78).
67. Sessione, ritocchi (T-055): testata del timer in tempo extra su `--color-surface-overrun`; «Abbandona» oltre soglia
    col testo del mock («… oltre il 65 %: si chiude con esito Continua», n. 47); card dell'unità del setup con «dal
    puntatore» anche sull'unità della routine e «6 / 13 unità» del corso; origine «Recupero · occorrenza di … saltata
    | persa» e «Sessione libera · dall'unità». «Della routine · 45» del mock con l'orologio alle 16:08 contraddice la
    sua «fine prevista 16:45»: resta la durata fino alla fine del blocco (37, D-SESS-1).
68. Debrief multi-materia (T-055, D3): il riquadro «Minuti per unità · l'esito resta sulla pianificata» compare quando
    la sessione ha dato minuti a un'unità diversa dalla pianificata, in qualunque modalità (il mock lo lega al
    pomodoro); i minuti escludono le pause dei segmenti, come il riepilogo.
69. Corsi (T-053, primo incremento): S10 con la testata del mock (logo del profilo al posto dell'avatar con
    l'iniziale, che arriva con l'account di T-033; sottotitolo «1 corso · N unità completate»; Impostazioni) e card che
    apre il corso con «Prossima · 0.7 …» dal puntatore; la sezione «Account e sincronizzazione» arriva con T-033. S11
    Corso su `/corsi/:corso`: avanzamento, routine di studio del corso, puntatore, moduli a fisarmonica con unità e
    verifica del modulo, moduli bloccati col lucchetto. Il cestino («Elimina corso») arriva con T-037. Il cerchio
    dell'unità da fare è in border-strong come nel mock (claude-design/CLAUDE.md vorrebbe text-3): da decidere.
70. Sessione, rilievi di design-checker (T-055): durate e «6 / 13 unità» in mono, icone come il mock (bersaglio,
    righe, libro, chiave), testo al 200 % con altezze minime e righe che vanno a capo, schede larghe almeno 44,
    «Lascia fuori» senza bordo. Restano letterali le misure del mock senza token, elencate in Session.module.css.
    **Da decidere**: il Materiale senza concetto né sezioni o durante la lettura non ha uno stato disegnato (oggi è
    vuoto); nella sessione su desktop il mock non ha la voce «Oggi» nella sidebar, la shell sì.
71. Corsi, S11 Modulo e S12 (T-053): la CTA («Riprendi da 0.7», «Inizia sessione») sta in fondo alla pagina, non
    fissa, perché su mobile c'è la barra in basso della shell; porta al setup di S15 sull'unità (CONTROLLI). «Chiedi
    all'AI» non c'è finché manca il client (T-026). Le «trasversali» del modulo si mostrano fino alla prima parentesi:
    il mock toglie anche «SOLO due — », una regola scritta solo per M0. Un'unità che non è la prossima del puntatore
    ha il badge dello stato sulla riga del modulo (il mock lo disegna solo sulla riga del puntatore). I criteri «auto»
    non mostrano «ultimo 6/10» finché non c'è il quiz (T-027). Su desktop (06/10/2026) l'elenco a 320 sta accanto a
    corso, modulo e unità, ognuno col suo scorrimento (all'apertura il primo corso, il corso senza indietro), e l'unità
    ha la seconda colonna di 320 con video, «Tuoi» e codice (la pratica con T-027) quando il pannello ha almeno 640 di
    contenuto (container query: a 1280 circa 300 + 320 come la tavola 04, a 1024 ne ha 400 e resta una colonna); barra
    indietro/cestino ferma in cima al pannello, barre di scorrimento nascoste, corso e modulo in 760 padding compreso,
    «Importa ZIP» nella testata dell'elenco, stato vuoto senza testata (rilievi di design-checker). Scelte: l'indietro
    del corso, che il mock disegna senza effetto, qui non c'è; la conferma «Elimina corso» resta il dialog modale nativo
    sulla finestra (S11 la ancora al pannello); la CTA chiude la pagina, larga al più
    320, invece del piede fisso del mock; modulo e unità entrano senza `rf-in`.
72. Notifiche S21 (T-022): il contatore conta gli esiti diventati pendenti dopo l'ultimo «Segna tutte lette» (CONTROLLI:
    «svuota il contatore, le pendenti restano»); le azioni secondarie aprono S15 in recupero, S12 o il Dettaglio senza
    togliere la riga (il mock la toglie, la spec la tiene finché non c'è l'esito); «Ieri · gestite» descrive l'avviso
    dal suo trigger («avviso 15 min prima», «3 todo senza orario»), perché il registro non sa come è stato gestito
    («completato · 1 fase saltata → todo creato» del mock).
73. Corso di esempio con i segnaposto M2–M4 (T-041, FORMATO §5): in S11 sono righe bloccate col testo del mock
    («Bloccato · Go/No-Go di M1» e la nota sullo sblocco). **Da decidere**: un segnaposto resta bloccato anche col
    modulo precedente passato, perché non ha file; il mock non disegna quel caso e il testo promette uno sblocco che
    non arriva (proposta: «Non ancora importato»).
74. Corsi e Notifiche, rilievi di design-checker (dopo T-053 e T-022): su mobile corso, modulo e unità sono un pannello
    surface da bordo a bordo con margini 20 ed entrata `rf-slide` (la pagina annulla i margini della shell; su desktop
    sta nel pannello accanto all'elenco a 320, n. 71). La VideoCard di S12 (FORMATO §3, CONTROLLI) mostra il
    primo link YouTube della sezione Studio: il player `youtube-nocookie`, in un iframe sandbox, si carica solo da
    «Riproduci»; su desktop sta in cima alla seconda colonna (n. 71). Da verificare con T-021 e
    T-036 che YouTube accetti l'origine dell'app nativa (chiede il referrer). Al passaggio il titolo dell'unità diventa
    primary come chiede lo `style-hover` del mock, che nel mock non si vede perché il titolo ha il colore in linea; le
    righe di «Ieri» restano a opacità .75 senza token (`--opacity-*` non ha quel valore).
75. Statistiche S20 (T-029, D-STATS-1): quattro schede e periodo (90 all'apertura); vuoto del mock senza alcuna
    sessione né blocco giudicato, altrimenti «nessun dato nel periodo» sulla riga (TESTI). **Vince il design** (scelta
    dell'utente, 06/10/2026; D-STATS-1 punto 12): «Costanza per giorno» al posto della costanza settimanale e dei minuti
    per giorno della settimana di §20; la Puntualità è lo scarto con segno («−4 min») al posto di ritardo e anticipo
    medi; la frase dei persi è il momento più frequente («Quasi tutti di venerdì dopo le 18»: «di» al posto di «il»,
    che la domenica cambia) al posto di tasso, giorno e tipo; Focus di Studio col primo numero grande; «2 sess.» per
    un'unità non finita; le barre per settimana sempre 12; ritardi oltre 5', salti delle fasi per settimana e media della
    costanza non mostrati; la mappa di calore ha oggi nell'ultima cella. **Da fare dall'utente**: allineare MECC §20
    (proposta nel riepilogo della sessione del 06/10). Pratica senza dati fino a T-027 e T-028.
76. Impostazioni S22 (T-032, D-IMPOST-1): radice e Notifiche come il mock, Informazioni con la versione della build;
    «Sempre» delle animazioni vale per quelle in Motion (scelta dell'utente 06/10/2026). **Da decidere**: la vista di
    Animazioni, Celebrazioni, Feedback aptico e Inizio settimana (oggi il selettore del sistema); il sottotitolo della
    radice («Alex», il nome dell'account, con T-033); il pallino di «Routine di studio» primary nel mock (qui il colore
    del tipo, come nel resto dell'app); la barra in basso nelle viste interne (il mock la mostra solo sulla radice); l'orario del
    digest senza controllo. Diagnostica come il mock: permesso, allarmi precisi e accesso a Non
    Disturbare dalle porte (sul web gli ultimi due «Non disponibile», su Android i valori del sistema: T-021), account «Non attivo»; il registro mostra solo gli errori dei servizi, «Spazio locale» divide dati e
    cache dove il browser lo dice; «Coda notifiche» è un valore solo (armate e prossima, come il mock) dove MECC §23
    vuole pendenti e voci nel registro distinti.
77. Materiali (T-024, D-MAT-1): «Tuoi» in S12 come il mock (contatore e righe compaiono col primo materiale); la
    riga di un link come la ResourceRow delle sezioni e quella di un PDF senza testo («senza testo, non usato
    dall'AI») non sono disegnate. Su Android il PDF si apre col visore del sistema e S13 resta il ripiego (richiesta
    dell'utente 06/10/2026, D-MAT-2). Visualizzatore S13 con le pagine disegnate da pdf.js; la barra della pagina sta in
    alto sotto la testata (in basso la coprirebbe la barra della shell); lo stato `pdf-scan` del mock («Apri le
    pagine») non serve perché i PDF sono sul dispositivo; la nota si legge come testo, senza interpretare il markdown.
    Spazio dei materiali in Impostazioni con «Elimina» e «Annulla» per 5 s; nella pagina dell'unità un cestino accanto a
    ogni riga di «Tuoi», con lo stesso «Annulla» (scelta dell'utente 06/10/2026, D-MAT-1: il mock non ha l'azione).
    **Da decidere**: la lettura della nota. Su desktop «Tuoi» sta nella colonna da 320 dell'unità (n. 71).
78. File di codice (T-025, D-CODE-1): blocco di S12 come il mock (albero in surface-2, esclusi in text-3, nota,
    pill «File o ZIP di progetto»); senza file restano la nota e la pill. Una cartella tecnica esclusa è una riga sola.
    CONTROLLI dice «max 500 file», S12 «max 500 KB per file»: vale S12 (§17). I caricamenti si eliminano da Impostazioni
    → Spazio dei materiali. La riga «Carica il codice prodotto» della chiusura di S15 carica nei «Tuoi» dell'unità e
    poi dice «N file · M esclusi» in text-2; senza unità non compare (D-CODE-1 punto 11).
79. Backup e dati S22 (T-030, D-BACKUP-2): gruppo «Backup» con «Esporta backup» (sottotitolo con la stima «~ N MB»,
    i PDF contati un terzo in più per il base64) e «Importa backup», «Ultimo backup · ven 11 set · 22:10», esito in linea
    in success-soft, conferme in linea in surface-2 come il mock, «Zona pericolosa» con «Elimina tutti i dati». Sul web
    l'esito dice «Backup scaricato» (il mock disegna solo Documenti); lo spazio dei materiali resta la sua vista dalla
    radice, che il mock disegna anche dentro «Backup e dati»; la riga «Elimina tutti i dati» della radice apre questa vista.
80. Scelte del council del 07/10/2026 (delegate dall'utente; `.claude/council-cache/council-1791340507.md`): la conferma
    «Elimina corso» resta il `<dialog>` modale nativo sulla finestra, eccezione di accessibilità a S11 che la ancora al
    pannello (fuoco intrappolato, Esc, sfondo inerte); la CTA del pannello desktop di modulo e unità sta in un piede
    sticky come il mock (n. 71); `rf-land` non c'è (layout animation fragile fra due liste, n. 59): al suo posto il
    contatore «Completate» pulsa come `rf-bump`.
81. S8 Sveglia (T-057, D-NATIVO-3): come il mock (striscia del tipo, campana `rf-bell`, ora 56/60, data lunga, badge,
    titolo, fascia, contesto nell'ink del tipo con `graduation-cap` anche sul todo, tre tasti a tutta larghezza; confronto
    del 07/10 su studio e todo). L'ora è quella corrente: allo scatto coincide con quella del mock, dopo un Posticipa è
    quella vera. Il contesto del todo è la sola checklist («Deep Work» del mock non ha una fonte nei dati), quello dello
    studio «corso · Unità n»; routine ed evento non ne hanno. Gli anticipi oltre il mock: «1 ora prima», «2 ore prima»,
    «90 min prima». La nota sotto i tasti è una didascalia. «Chiudi» toglie la sveglia dalla tendina senza azione (la riga
    resta nel registro per S21). Vince il mock su DESIGN (contesto in ink e non text-2, anticipo in text-3, icona 18 del
    tasto, tre tasti e non due).
82. S19 Chat e S22 «Modello e chiave AI» (T-026, D-AI-2): come i mock (confronto del 07/10 su chat con citazioni, senza
    chiave, S22 senza chiave). Dove il mock tace: l'elenco delle conversazioni si apre da «Conversazioni» nella chat
    vuota (nessun ingresso nel mock, n. 36); la pill gira l'ambito come il mock (CONTROLLI dice menu); in streaming la
    bolla cresce con «Interrompi» sotto, dopo l'interruzione resta senza etichetta; markdown minimo senza link; errore
    generico «Risposta non arrivata» con «Riprova» oltre ai quattro del mock; chat a schermo pieno senza BottomNav come la
    sessione; «Invia» e «Verifica» sempre attivi come il mock. S22: «41 richieste questo mese» non c'è (nessuna fonte),
    «Ambito predefinito» è informativo, «Lingua delle risposte» col selettore del sistema (Automatica e le sei lingue),
    il toggle «Testo dei PDF all'AI» di CONTROLLI non è disegnato e non c'è (i PDF con testo entrano sempre), «Come
    ottenerla» apre Google AI Studio. La pill «Chiedi all'AI» di S11 e S12 usa `Sun` di Lucide (il mock disegna un'icona
    simile). S15: la scheda AI è il pannello della chat sull'unità della sessione.

## 4. Mappa schermata → design → task

Ordine di `/incremento` (prima riga = primo incremento); CP2 si rifà su S1 dopo T-050: S1 è pronto per il CP2 dal 06/10/2026 (T-048, T-049, T-044, T-040, T-050), le schermate successive aspettano l'approvazione.

| Schermata | File del design (`claude-design/`) | Tavola | Task |
|---|---|---|---|
| Cornici, menu account, banner sessione | `S1 Oggi Mobile`, `S1 Oggi Desktop`, `S20 Shell Mobile`, `S20 Shell Desktop` | 01, 07 | T-052 |
| S1 Oggi | `S1 Oggi Mobile`, `S1 Oggi Desktop` | 01 | T-048, T-049, T-044, T-040, T-050 |
| S4 Crea · Modifica | `S4 Crea Panel`, `Mobile`, `Desktop` | 02 | T-050, T-042 |
| S5 Dettaglio | `S5 Dettaglio Panel`, `Mobile`, `Desktop` | 03 | T-054, T-042 |
| S15 Sessione | `S15 Sessione Panel`, `Mobile`, `Desktop` | 05 | T-055 |
| S10 · S11 · S12 Corsi | `S10 Corsi Mobile`, `Desktop`, `S11 Corso Panel`, `S11 Modulo Panel`, `S12 Unità Panel` | 04 | T-053, T-037, T-024, T-025, T-027 |
| S21 Notifiche | `S21 Notifiche Panel` (in `S20 Shell`) | 08 | T-022 |
| S8 Sveglia · S9 notifiche di sistema | `S8 Sveglia Mobile`, `S9 Notifiche di sistema Mobile` | 08 | T-021, T-051 |
| S19 AI e pratica | `S19 AI Panel`, `Mobile`, `Desktop` | 06 | T-026, T-027, T-028 |
| S20 Statistiche | `S20 Statistiche Panel` (in `S20 Shell`) | 07 | T-029 |
| S22 Impostazioni | `S22 Impostazioni Panel` (in `S20 Shell`) | 09 | T-032, T-030, T-033 |
| S13 PDF · widget | `S13 Extra Panel`, `S13 Extra Mobile` | 10 | T-024, T-023 |
