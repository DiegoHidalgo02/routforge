# RoutForge — decisioni vincolanti

Il design è definitivo: le schermate `S*.dc.html` sono la fonte visiva di verità. Queste decisioni vincono su ogni altro documento, spec comprese; una divergenza si segnala, non si risolve in silenzio. Gli unici punti non definiti sono in `docs/BLOCCHI.md`. Ingresso: `HANDOFF.md`.

## Oggi (S1)
- Sorgenti: `S1 Oggi Mobile.dc.html` e `S1 Oggi Desktop.dc.html`; tavole in `01 Oggi.dc.html`.
- **Card Adesso**: nessun blocco «Adesso» separato, né su mobile né su desktop. La card dell'attività in corso o imminente cresce a hero dentro la lista, al suo orario (mobile: scatto dell'ora 900 ms dopo l'apertura; desktop: già hero). Niente vista compressa. Su desktop la colonna destra ha «Il tuo progresso oggi» e «Prossime attività».
- **La card Adesso non si chiude**: nessuna ×, nessun «Chiudi per oggi», su mobile e su desktop.
- **Card Adesso per ogni tipo** (prop `nowKind`): studio con il play 48; todo con orario, routine ed evento con il cerchio di completamento 28. Contenuto: eyebrow, badge del tipo, titolo (massimo due righe), un solo sub (checklist e orizzonte · categoria e fasi · luogo), durata e fascia. Todo ed evento con l'orario passato non diventano hero.
- **Giornata chiusa** (`variant=done`, e dal vivo dopo l'ultima spunta): card di pagina a tutta larghezza sotto l'archivio, senza pallino né aggancio alla timeline, in tinta success con la costruzione della hero. Testa con disco success 40, eyebrow e titolo; «La tua giornata» con la fascia oraria; barra 8 px a segmenti (larghezza = minuti, colore = tipo, `rf-seg`); legenda in due colonne con le durate allineate; riga «Domani · ora · titolo» su due righe, che porta al giorno dopo. Non ripete i numeri delle card di progresso.
- **Banner «Sessione in corso»**: sotto l'header e sopra la striscia dei giorni, fisso con lo scroll, su tutte le schermate mobile. Su desktop è la carta «Sessione in corso» nella sidebar sotto «Crea».
- **Archivio delle completate**: si apre con un trascinamento verso il basso e si richiude con uno verso l'alto; nessun tasto «Raccogli».
- **Navbar mobile**: «Oggi» riporta al giorno di oggi e in cima alla lista da qualsiasi giorno selezionato; su mobile nessun tasto «Oggi» nell'intestazione né nel Mese. Su desktop «Oggi» resta fra le frecce del periodo.

## Cerchio di completamento
- Il cerchio conferma subito, dalla card normale e dalla card Adesso, per tutti i tipi. Se servono passaggi compaiono sopra Oggi: «Voci rimaste» (todo con voci non spuntate), «Revisione fasi» (routine ed evento con fasi), «Registra esito» (studio; senza sessione conta la durata pianificata). Alla conferma il cerchio si spunta con la sua animazione.
- Spunta: spunta disegnata, la riga si chiude e la card atterra davanti al mazzo delle completate (mazzo in ordine di completamento); «Completate» si aggiorna; toast «Fatto · …» con «Annulla» per 5 s. Desktop: la riga resta al suo posto in secondo piano.
- Routine e studio di un altro giorno: cerchio spento (opacità .4), si segnano solo nel loro giorno. Il tocco sulla card, fuori dal cerchio, apre il Dettaglio.
- Celebrazioni (prop `celebration`): sobria (default) · piena (coriandoli) · off (nessuna animazione).

## Riordino dei todo senza orario
- Solo i todo senza orario, solo nella lista e solo fra todo con la stessa priorità: un todo non passa in un altro gruppo; il gruppo si cambia dalla priorità in Modifica. Un todo che entra in un gruppo va in fondo.
- Riordinare non assegna un orario né cambia giorno, stato o notifiche.
- **Trascinamento**, mobile e desktop: unico stato `drag=lift`. Mobile: card sollevata sopra uno slot tratteggiato `1.5px dashed #3A404B`, r14. Desktop: sotto la card sollevata resta visibile la riga originale. Nessuna scritta di aggancio, riga guida, snap o «Annulla».
- **Tasti su mobile** (`move=attivo`): un tocco sulla maniglia senza trascinare apre «Sposta su» · «Sposta giù» · «Fine».
- **Frecce su desktop** (`move`): con il mouse sopra o con il fuoco da tastiera compaiono «Sposta su» e «Sposta giù» a destra del todo; spente sul primo e sull'ultimo del gruppo.

## Crea
- **Nessuna × nel foglio Crea**. Su mobile il foglio si apre sopra Oggi e si chiude senza salvare trascinandolo in basso dal bordo alto (soglia 110 px) o con «Annulla». Su desktop «Annulla» ed Esc.
- **Giorno di partenza = giorno selezionato** su Oggi (Giorno, Settimana, Mese) se è fra oggi e i 6 giorni successivi, altrimenti oggi: vale per i quattro tipi (orizzonte del todo, data dell'evento, inizio della ricorrenza) e il foglio lo dichiara. Da Crea si creano attività solo per i prossimi 7 giorni; routine e routine di studio atterrano sulla prima occorrenza non ancora conclusa entro quei giorni.
- **Conferma della creazione**: il foglio si rimpicciolisce fino a diventare la card e si posa nel calendario. Giorno mostrato: al suo posto nella lista. Altro giorno: la card scivola a destra, la striscia scorre un giorno alla volta fino alla data, la card entra da sinistra. Settimana: direttamente nella riga del giorno (altra settimana: a destra, cambio di pagina, entrata da sinistra). Mese: la selezione passa al giorno con l'animazione della casella, la card diventa il puntino nel colore del tipo e si posa nella casella; 1 s dopo entra da sinistra nell'elenco del giorno. Nessuno scorrimento fra i mesi. Poi il toast «… creato» con «Annulla». Con Celebrazioni off o riduzione animazioni la card compare al suo posto.
- Testo sui fill del tipo sempre `#0A0D13`, CTA di Crea compresa.

## Sessione
- Fine sessione (S15 `done`): «Giorni di fila 13 · +1» per Completata o Continua che contano nel piano; «Torna a Oggi» riporta la card nel mazzo; «Riduci» torna su Oggi con il banner.

## Notifiche e sveglie
- Nessuna sveglia per l'esito: S8 non ha `kind=esito`; l'esito resta notifica (S9) e riga in Notifiche (S21).
- Il tasto principale della sveglia è nel fill del tipo.
- «Segna fatto» da notifica o sveglia su un todo con voci non spuntate apre l'app sul Dettaglio con «Voci rimaste».

## Accessibilità
- Cerchio da fare, checkbox vuota e maniglia di riordino in text-3 `#636975` (3,2:1).
- Ogni gesto ha un'alternativa: riordino con i tasti o le frecce, foglio Crea con «Annulla», archivio raggiungibile anche dalla rotella.

## Scenario dei mock
- Oggi è mercoledì 23 settembre 2026, ore 16:08 (settimana 21–27); corso importato il 16 set.
- Todo senza orario di oggi: «Prepara la valigia» e «Prenota il treno» (alta), «Chiama Marco» (normale).
- M0 6/9 con Go/No-Go 7/7 · Go, puntatore 0.7, M1 aperto, M2–M4 bloccati.
- Informazioni (Impostazioni → Avanzate) mostra la versione dalla build; i mock non riportano il numero.

## Globale
- Nessun pulsante o voce «Cerca», in nessuna schermata, specimen compreso.
- Tablet: nessuna struttura dedicata; sotto 1024 px struttura mobile, da 1024 sidebar e pannello (D-UI-1).
- Percentuali con lo spazio: «38 %».
- I collegamenti fra le schermate dei mock e i parametri dell'indirizzo servono solo a percorrere i mock: non sono prodotto.

## Documenti da tenere allineati
`HANDOFF.md`, `docs/` (BLOCCHI, IMPLEMENTAZIONE, COMPONENTI, NAVIGAZIONE, STATI, CONTROLLI, DATI-UI, TESTI, COPERTURA), `design/DESIGN.md`, `design/tokens.css`, `design/ASSET.md` e le quattro spec in `spec/`.
