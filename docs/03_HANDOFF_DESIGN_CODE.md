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
- **All'handoff valgono gli invarianti già scritti**: i token del nuovo design (`claude-design/design/tokens.css`)
  entrano in `src/ui/styles/tokens.css` e il loro confronto torna nel gate (INV-20).
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

**Dipendenze del codice dal vecchio design**: `src/ui/styles/tokens.css` (copia del vecchio export, da non modificare
a mano; INV-20 sospeso), font `@fontsource/manrope` e `@fontsource/ibm-plex-mono`, icone `lucide-react` col tratto
1.75 (D-STACK-1), `src/ui/Logomark.tsx`, voce dei testi (`PRODUCT.md`, `src/ui/i18n/`), eccezione di
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
| Adesso (MECC §14, FUNZ §2; G1, G2) | blocco separato `NowBlock` con ×, `preferenze.adessoChiuso`, variante compressa (T-010, D-NOW-2) | la card dell'attività in corso o imminente cresce a hero nella lista, al suo orario, per ogni tipo; nessuna chiusura; «Giornata chiusa» | T-048 |
| Trascinamento (MECC §15, FUNZ §2; G3) | todo senza orario → orario o giorno, persi riprogrammati, aggancio a 5', «Annulla» (T-015, D-DRAG-1) | solo riordino dei todo senza orario nella stessa priorità; frecce su desktop, tasti su mobile; ordine persistito e sincronizzato | T-044 (riscritto); il trascinamento di T-015 si toglie |
| Cerchio della card (MECC §3, §4, §24; A3, A7, C10) | todo e routine (D-DETT-3), sheet «Voci non spuntate» (D-DETT-2) | tutti i tipi: evento, studio con «Registra esito» (minuti = durata pianificata); «Voci rimaste»; archivio col trascinamento senza «Raccogli», «Completate», toast con «Annulla» 5 s | T-049 |
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

**Test del vecchio design che restano verdi ma descrivono il comportamento superato** (da riscrivere col loro task):
`src/domain/drag.test.ts`, `src/app/drag.test.ts`, `src/ui/Today.test.tsx` (vecchio G3 → T-044);
`src/domain/nowBlock.test.ts`, `src/app/nowBlock.test.ts` (chiusura del vecchio G2 → T-048).

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
    `rf-hero-in` di DESIGN §5. T-048.
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
24. Data di un evento in Modifica fuori da oggi … oggi + 6: non definita. **Bloccante**. T-042.
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
    (MECC §16 lo include: si aggiunge). **Bloccante** minore. T-037.
35. Widget: «max 6 + N» e «3 todo alta priorità» non sono più in MECC §21 (allineato `docs/00_SINTESI.md`). T-023.

**S19, S20, S22** (tavole 06, 07, 09)
36. Chat: nessun ingresso alle Conversazioni, menu dell'ambito, bolla in streaming e dopo l'interruzione, citazioni
    LINK e PDF e il loro tocco, markdown delle risposte. **Bloccante**. T-026.
37. Statistiche: tasso dei persi, costanza settimanale, % per fascia, soglie della heatmap, formato del delta, periodo
    «tutto», tessere che seguono il periodo; il Focus di Studio non coincide con la Panoramica (cifra del mock).
    **Bloccante**. T-029.
38. Impostazioni: orario del digest, scelte di Animazioni, Celebrazioni, Aptico, Inizio settimana e Lingua delle
    risposte, vista Informazioni, nome dell'account, errori di accesso e di sincronizzazione. **Bloccante**. T-032, T-033.
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

## 4. Mappa schermata → design → task

Ordine di `/incremento` (prima riga = primo incremento); CP2 si rifà su S1 dopo T-050.

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
