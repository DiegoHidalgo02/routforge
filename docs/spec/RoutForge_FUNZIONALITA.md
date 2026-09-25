# RoutForge — Funzionalità

*Cosa fa l'app e come la usa chi studia. Ogni funzione è descritta dal punto di vista dell'utente: cosa può fare, cosa succede. Le regole precise di ogni meccanismo sono in `RoutForge_MECCANISMI.md`.*

---

## 1. Primo avvio e navigazione

Nessuna schermata di benvenuto: l'app si apre sulla schermata principale. Se non c'è alcun corso, la sezione **Profilo** offre due scelte: caricare il **corso di esempio** incluso, oppure **importare un corso** da un file ZIP di markdown (§10).

Sezioni principali, sempre raggiungibili:

| Sezione | Contenuto |
|---|---|
| **Oggi** | Calendario giorno/settimana/mese; il blocco "adesso / prossimo"; tutte le attività |
| **+ Crea** | Punto unico di creazione di qualsiasi attività |
| **Statistiche** | Analisi del comportamento di studio e delle pratiche |
| **Profilo** | Corsi importati (moduli, unità, materiali), account e stato della sincronizzazione, accesso alle Impostazioni |

Dal logo utente in alto a sinistra si apre un menu con **Corsi**, **Esiti da registrare** (la schermata Notifiche, con badge), **Account e sincronizzazione** e **Impostazioni**; in testa al menu nome (se c'è), email e stato della sincronizzazione. La **Diagnostica** si apre da Impostazioni (§24).

Su desktop la barra laterale ha anche **Cerca** (⌘K / Ctrl+K): un campo che cerca per titolo fra attività, corsi e unità e apre il risultato scelto.

Non esiste una lista separata delle attività: tutte le attività si consultano dal calendario di Oggi.

---

## 2. Oggi: il calendario

Tre viste: **Giorno** (agenda della giornata), **Settimana**, **Mese**. Si passa da un giorno/periodo all'altro scorrendo lateralmente. Nella vista Giorno le attività senza orario compaiono in una fascia dedicata, ordinate per priorità: in cima su mobile, in coda dopo le attività con orario su desktop; le altre seguono in ordine cronologico.

Su mobile, in testa alla vista Giorno, un saluto («Ciao, <nome>», o solo «Ciao» se l'account non ha un nome) lascia il posto alla data dopo pochi secondi; su desktop l'intestazione mostra il periodo e la lista si apre con la data del giorno, senza saluto. Il selettore di vista: su mobile tre icone Giorno · Settimana · Mese in alto a destra; su desktop un segmentato Giorno · Settimana · Mese con le frecce e «Oggi». La **Settimana** mostra i blocchi per giorno, una riga per giorno su mobile e sette colonne su desktop, con il giorno selezionato evidenziato e lo stato vuoto quando non c'è nulla. Il **Mese** mostra la griglia con i puntini dei tipi e, su desktop, l'elenco delle attività del giorno selezionato a lato; un mese senza attività lo dice.

Sotto la giornata la vista Giorno mostra anche:
- **Il tuo progresso oggi**: completate su totali di oggi con la percentuale; focus di oggi con il confronto «vs ieri»; attività completate nella settimana.
- **Prossime attività**: i prossimi due giorni con attività, con orario, titolo e tipo; «Vedi tutte» apre la Settimana; senza nulla in programma: «Niente in programma nei prossimi giorni.».
- Su mobile le attività già completate si **impilano** in testa al giorno come un archivio compatto: scorrendo in giù si aprono tutte con il loro orario, «Raccogli» le richiude.

### Il blocco "Adesso / prossimo"
Mostra cosa è in corso o cosa viene dopo, con uno stato che cambia da solo: minuti mancanti all'inizio; "adesso" durante; "recupera" se una routine o una sessione di studio è passata senza essere gestita; "orario passato" per todo ed eventi. Da qui si avvia direttamente la sessione di studio o si apre l'attività. Può essere chiuso per la giornata: riappare il giorno dopo o se cambia l'attività in corso.

### Ritorno dopo un'assenza
Se l'app viene riaperta dopo almeno due giorni, un messaggio una tantum avvisa che il piano si è già riallineato (nessun conteggio di attività perse).

### Riprogrammare trascinando
Nella vista Giorno, su mobile come su desktop, si trascinano **i todo senza orario e i blocchi persi** di qualsiasi tipo (maniglia a sei punti sulla card; le altre attività non si spostano). Tenuto premuto e trascinato su un orario, il todo si aggancia agli spazi liberi fra le altre attività a passi di 5 minuti e diventa un todo con orario, con la durata già dichiarata o, se manca, quella predefinita del form Crea (30 minuti); trascinato su un altro giorno della striscia settimanale cambia giorno e resta senza orario. L'operazione si può annullare subito dopo. Le notifiche seguono il nuovo orario. Un blocco "perso" trascinato su un altro giorno o orario torna programmato e le sue notifiche vengono ri-armate.

---

## 3. Creare un'attività: "+ Crea"

Quattro tipi, stessa schermata, campi diversi:

| Tipo | Scopo |
|---|---|
| **Todo** | Compito puntuale, con o senza orario |
| **Routine di studio** | Studio ricorrente agganciato a un corso |
| **Routine** | Abitudine ricorrente non di studio |
| **Evento** | Appuntamento puntuale, anche di un giorno intero |

### 3.1 Todo
- Titolo. Nessuna data e nessun corso: il todo parte da oggi.
- **Senza orario** (default) oppure con orario d'inizio e durata (scelta tra gradini da 5 a 240 minuti).
- **Orizzonte**: *giorno* (fisso), *settimana*, *mese*. Con orizzonte diverso da "giorno", il todo non fatto si sposta da solo a oggi, ogni giorno, fino alla fine dell'orizzonte.
- **Priorità** (solo senza orario): alta, normale, bassa. Decide l'ordine nella fascia senza orario.
- **Checklist** opzionale (§7).
- **Promemoria** (§8): solo per i todo con orario; quelli senza orario entrano nel digest mattutino.

### 3.2 Routine di studio
- Corso a cui è agganciata (opzionabile ma consigliato); titolo opzionale.
- Giorni della settimana, orario d'inizio e di fine.
- Data d'inizio (default oggi) e fine: per sempre, oppure a termine dopo N giorni/settimane/mesi.
- Promemoria personalizzabili.
- L'app genera le occorrenze sul calendario per le quattro settimane successive e allunga l'orizzonte da sola. **Non si sceglie l'unità da studiare**: la propone il puntatore dell'unità (§13).

### 3.3 Routine
- Titolo, giorni della settimana, orario d'inizio.
- Orario di fine oppure **senza durata**: la routine resta aperta per tutto il giorno previsto.
- **Fasi** opzionali (§6).
- Data inizio/fine e promemoria come sopra.
- Non produce esiti di studio: si segna Fatta o Saltata.

### 3.4 Evento
- Titolo, data, orario d'inizio e fine (la fine deve venire dopo l'inizio, altrimenti il form lo segnala e non crea l'evento), oppure **tutto il giorno**.
- Luogo opzionale.
- **Fasi** opzionali (§6).
- Promemoria.
- Non si ripete.

---

## 4. Dopo la creazione: come vive ogni attività

Toccando un'attività (dal calendario, dal blocco Adesso o da una notifica) si apre il suo dettaglio, da cui si modifica, si elimina, si completa. Le routine si modificano a livello di definizione: le modifiche valgono per le occorrenze future, il passato resta com'è.

### 4.1 Todo
- Si spunta in qualsiasi momento, da qualsiasi giorno, anche se risulta "non fatto".
- Con orizzonte settimana/mese, se non completato entro la giornata si sposta a oggi (in uno spazio libero se ha un orario). Con orizzonte "giorno", passato il giorno resta nel passato come "non fatto", ma spuntabile.
- Quando diventa in ritardo, una sola notifica "todo in ritardo" con azioni rapide.
- Con checklist, le voci si spuntano dal dettaglio; nelle liste compare "fatte/totali".

### 4.2 Routine di studio
- Toccando un'occorrenza si apre l'**unità** proposta (materiale, risorse, AI) con "Inizia sessione" (§12). Disponibile solo per l'occorrenza di oggi. Se l'occorrenza è già completata si offre un **ripasso** (sessione libera che non tocca l'esito); se è parziale o in corso si **riprende**.
- Prima dell'orario previsto la sessione non parte come routine: c'è l'azione esplicita **Anticipa sessione**, che sposta l'occorrenza ad adesso.
- Si può anche **registrare l'esito senza sessione** ("Registra esito"), ad esempio da una notifica.
- Una sessione libera si avvia anche da qualsiasi unità di un corso.

### 4.3 Routine
- Ogni occorrenza si segna **Fatta** o **Saltata**, solo nel giorno previsto (né prima né dopo).
- Con fasi, prima di segnarla Fatta si passa dalla revisione delle fasi.
- Si può annullare la spunta.

### 4.4 Evento
- Senza fasi: si chiude con "Completa evento". Con fasi: "Completa evento" apre la revisione delle fasi e l'evento risulta completato dopo la conferma.
- Un evento non viene mai marcato "perso": passato l'orario risulta semplicemente "concluso".

### 4.5 Blocchi persi e recupero
- Una routine o sessione di studio non avviata né chiusa entro **30 minuti dopo la fine** viene marcata **persa**. Un todo con orizzonte "giorno" o oltre il suo orizzonte, non completato, diventa "non fatto" con la stessa regola.
- A metà della durata prevista, se non è ancora partita, arriva una notifica di **verifica**. Fino alla marcatura "persa" l'attività si può ancora avviare come **recupero**; anche dopo, un esito registrato la riabilita.
- Le occorrenze perse restano visibili nelle statistiche, in secondo piano nel calendario.
- Se il giorno cambia mentre l'app è aperta, o l'app torna in primo piano, tutto viene ricalcolato.

---

## 5. Le fasi (routine ed eventi)

Una routine o un evento può essere scomposto in **fasi** (es. "Mattina": sveglia, skin-care, meditazione).

- Al completamento **tutte le fasi risultano fatte**: si toccano solo quelle **non** fatte, poi un unico **Conferma**. Giornata normale = zero tocchi sulle fasi.
- Per un **evento**, ogni fase saltata può generare un **todo di follow-up** (per oggi, senza orario, orizzonte mese).
- Le fasi si creano, rinominano, riordinano ed eliminano nella schermata di creazione/modifica. Nel dettaglio di un'occorrenza già chiusa si vede cosa è stato fatto e cosa saltato.
- Le fasi non sono la checklist (§7): le fasi si segnano in negativo (ciò che non è stato fatto), la checklist in positivo (ciò che è stato fatto).

---

## 6. La checklist dei todo

- Solo i todo. Voci create una alla volta (massimo 60).
- Ogni voce nasce non spuntata; si spunta man mano.
- **Spuntare l'ultima voce completa il todo**; togliere una spunta a un todo completato lo **riapre**.
- Nelle liste: indicatore "fatte/totali".
- Se il todo si sposta di giorno, le spunte restano.

---

## 7. Promemoria e notifiche

### 7.1 Comportamento predefinito per tipo
- **Routine di studio**: avviso 5 minuti prima; notifica all'inizio (azione "Inizia"); verifica se la sessione non è partita a metà durata; invito a registrare l'esito 10 minuti dopo la fine.
- **Routine**: avviso 10 minuti prima; notifica all'inizio; verifica a metà durata.
- **Evento**: 15 minuti prima (alle 08:00 del giorno se "tutto il giorno").
- **Todo con orario**: 30 minuti prima e alla scadenza.
- **Todo senza orario**: nessun avviso puntuale; entra nel digest mattutino.

### 7.2 Per ogni attività: Auto / Off / Personalizzato
Personalizzato = più anticipi insieme fra 1 giorno, 1 ora, 30/15/10/5 minuti, all'inizio; oppure un anticipo libero fino a circa un mese. Ogni anticipo fino a 7 ore può essere consegnato come **sveglia a schermo intero** invece che come notifica. La sveglia occupa lo schermo con l'ora, il titolo, l'orario e il tipo del blocco e offre le stesse azioni della notifica corrispondente (Inizia, Segna fatto o Registra esito secondo il tipo; Apri il blocco per gli altri) più Posticipa di 10 minuti.

### 7.3 Digest mattutino
Un unico messaggio al mattino (orario configurabile, default 08:00) che elenca i todo senza orario di oggi, arretrati inclusi.

### 7.4 Ore silenziose
Una fascia (anche a cavallo di mezzanotte) in cui le notifiche non partono: vengono spostate alla fine della fascia.

### 7.5 Azioni rapide dalla notifica
**Inizia** (setup sessione), **Posticipa** (10 minuti), **Segna fatto** (todo), **Registra esito** (routine di studio). Toccando la notifica si apre l'attività corrispondente.

### 7.6 Notifiche una tantum
"Blocco perso" (routine/studio appena persa), "Todo in ritardo", "Tempo scaduto" a fine sessione di routine, notifica di prova dalle Impostazioni.

### 7.7 Impostazioni
Interruttore generale; per tipo: attivo/spento, anticipi di default, canale silenzioso; ore silenziose; digest; notifica di prova; scorciatoia ai permessi di sistema per gli allarmi precisi.

### 7.8 Limiti
Le notifiche sono pronte per i **14 giorni** successivi; la finestra si allunga a ogni apertura. Sul web funzionano solo con la scheda aperta.

---

## 8. Lo scheduler automatico

Senza intervento dell'utente, a ogni avvio, ritorno in primo piano e cambio di giorno, l'app:
- sposta a oggi i todo con orizzonte non ancora scaduto;
- marca "perse" le routine e le sessioni non gestite;
- estende le occorrenze delle routine attive (sempre circa quattro settimane avanti);
- ricalcola il puntatore dell'unità dei corsi;
- riallinea le notifiche;
- gestisce fuso orario locale e routine a cavallo di mezzanotte.

---

## 9. Corsi, moduli e unità

### 9.1 Importare
Da un file ZIP di markdown con struttura a moduli e unità (formato in `RoutForge_FORMATO_CORSO.md`), oppure caricando il corso di esempio. L'app ricostruisce corso → moduli → unità → sezioni e risorse, segnalando eventuali avvisi di lettura. Ogni import crea un corso nuovo; reimportando un corso con lo stesso titolo, i materiali personali passano al corso nuovo (§10).

### 9.2 Struttura
Corso → Moduli → Unità. L'unità è il livello di studio: concetto core, sezioni (teoria, studio, pratica, mini progetto), risorse collegate (link, video YouTube incorporati), materiali personali, file di codice.

### 9.3 Avanzamento
Ogni corso mostra la percentuale di unità completate e, su mobile, il tempo dedicato; ogni unità ha uno stato (non iniziata, parziale, da rivedere, completata, saltata).

### 9.4 Eliminare
Eliminare un corso elimina tutto ciò che gli appartiene: routine di studio e occorrenze, materiali, quiz, flashcard e pratiche, conversazioni, storico delle fasi, notifiche.

---

## 10. Materiali di studio dell'utente e file di codice

In un'unità, distinti ma nello stesso posto: risorse **dal corso** e materiali **tuoi**.

Tipi di materiale personale:
- **Link** con titolo.
- **Nota** in markdown.
- **PDF** (max 20 MB), consultabile in un visualizzatore integrato o con un'app esterna. Se il testo è estraibile, il PDF entra nel contesto dell'AI; se è scansionato resta consultabile ma passivo.

**File di codice**: da un'unità (o da una sessione libera) si caricano file o uno ZIP di progetto. Si vede l'albero delle cartelle, non il contenuto; il contenuto serve solo all'AI, dove ha priorità sul testo del corso. Cartelle tecniche, segreti e file troppo grandi vengono esclusi.

I materiali personali e i file di codice **restano anche se si reimporta** il corso: all'import di un corso con lo stesso titolo passano alle unità con lo stesso numero del corso nuovo; quelli senza corrispondenza restano sul corso nuovo.

Nelle Impostazioni si vede lo spazio occupato dai materiali e si possono eliminare.

---

## 11. La sessione di studio

### 11.1 Avvio
Da un'occorrenza di routine di studio, da un'unità (sessione libera), da un recupero, dall'azione "Inizia" di una notifica. Prima si passa da un **setup**: cosa studiare (unità proposta, corso, o libero), quanto (durata della routine, preset 25/50/90, durata personalizzata, cronometro), modalità (**continua** o **pomodoro** 25/5, 50/10, 90/20), **iperfocus** on/off (la modalità a uscita bloccata, §11.2). Una sola sessione attiva alla volta.

### 11.2 Durante
- Timer persistente: si può navigare altrove e rientrare da un banner; sopravvive alla chiusura dell'app.
- Pausa/ripresa; annotazione di interruzioni; nel pomodoro i segmenti avanzano da soli e si possono saltare; si può cambiare unità a metà (multi-materia).
- Schermo tenuto acceso.
- **Tempo extra**: superata la durata pianificata il timer prosegue e conta in positivo (badge «Tempo extra» e conteggio «+04:12»), senza allarme; il riepilogo lo riporta a parte («49 min · tempo extra +4 min»). Non è l'iperfocus.
- **Iperfocus**: schermo intero, uscita bloccata fino alla fine, Non Disturbare di sistema (se permesso); il timer indica a che ora l'uscita si sblocca. Un tentativo di uscita chiede conferma («Esci comunque» / «Resta»); l'uscita forzata viene registrata come interruzione «iperfocus» e conta come uscita d'emergenza nelle Statistiche.
- Tre schede: **Materiale** (unità, risorse, materiali personali, codice), **AI** (chat già contestualizzata sull'unità), **Note**.

### 11.3 Chiusura: i quattro esiti

| Esito | Effetto |
|---|---|
| **Completata** | unità conclusa; il puntatore avanza |
| **Continua** | stessa unità alla prossima occorrenza |
| **Indietro** | l'unità precedente torna da rivedere |
| **Salta** | l'unità esce dal percorso senza essere completata |

Più **confidenza** 1–5 e **nota** libera. Si sceglie se la sessione **conta nel piano** (default sì se nasce da una routine). Si può caricare il codice prodotto. Un abbandono (avvio sbagliato) non registra esito.

---

## 12. Il puntatore dell'unità

Ogni corso sa a che punto è. Le occorrenze future delle routine di studio ricevono in automatico la prossima unità pendente in ordine di percorso; l'esito registrato a fine sessione fa avanzare, tenere ferma, riportare indietro o saltare l'unità. L'utente non sceglie mai manualmente l'unità della prossima occorrenza (può però studiare qualsiasi unità con una sessione libera).

---

## 13. Streak

Giorni consecutivi con almeno una sessione di studio che conta nel piano con esito Completata o Continua. Si spezza se passa un giorno intero senza.

---

## 14. Pratica generata dall'AI

Da un'unità si genera, scegliendo quantità (5–25) e, dove previsto, difficoltà (facile/media/difficile). Tutto è prodotto **nella lingua del materiale**. Se l'unità ha file di codice, il codice è la fonte primaria. Le pratiche recenti restano riapribili dall'unità.

### 14.1 Quiz
Domande a scelta multipla (4 opzioni, 1 corretta) con citazione della fonte. A fine quiz: punteggio e percentuale.

### 14.2 Flashcard
Carte domanda/risposta con citazione, che entrano nella ripetizione dilazionata (§16).

### 14.3 DevSwipe
Carte con un frammento di codice, un'architettura o un'affermazione. **Swipe a destra** = codice pulito / architettura corretta / best practice; **swipe a sinistra** = code smell / vulnerabilità / pattern errato. Si usa con una mano. Errore → breve vibrazione e spiegazione di due righe. A fine sessione: punteggio; gli errori vengono riproposti una volta.

### 14.4 Bug Hunter
Un blocco di codice di 5–10 righe con una riga sbagliata (es. query con SQL injection, async senza gestione errori, re-render inutile). Si **tocca la riga** che si ritiene sbagliata: se è quella, punti e versione corretta mostrata con spiegazione; altrimenti si ha un secondo tentativo, poi la soluzione. Nessuna tastiera.

### 14.5 Audio Flash-Trivia
Modalità a mani libere: l'app **legge a voce** una domanda secca, lascia **5 secondi** di silenzio, poi legge una spiegazione di circa 15 secondi e passa alla successiva da sola. Funziona con schermo spento; comandi essenziali play/pausa/salta/stop. Nessuna interazione visiva richiesta. Chi non sa la risposta preme **Salta**: l'elemento conta come sbagliato e torna una volta nella playlist successiva.

### 14.6 Fine della pratica
DevSwipe, Bug Hunter e Audio Flash-Trivia chiudono con un riepilogo: punteggio (per la Trivia giuste su totali con la percentuale, es. «8 / 10 · 80 %»), elenco delle risposte sbagliate (per DevSwipe dopo che sono state riproposte una volta; per la Trivia gli elementi saltati) e due azioni, **Rifai la pratica** e **Torna all'unità**. Il quiz mostra punteggio e percentuale (§14.1).

---

## 15. Ripetizione dilazionata (flashcard)

Dopo aver visto la risposta si valuta: **Niente**, **Difficile**, **Bene**, **Facile**. L'app calcola quando riproporre la carta (SM-2); sui bottoni c'è solo l'etichetta del grado. "Niente" ripropone la carta nella stessa sessione. Il **ripasso trasversale** raccoglie tutte le carte scadute di tutti i mazzi, dalle più scadute.

---

## 16. L'assistente AI

- **Chat globale**, senza contesto.
- **Chat contestuale** su unità, modulo o corso (granularità a scelta), dalla sessione o dall'unità: risponde basandosi sul materiale, sui file di codice e sui materiali personali (note, link, PDF con testo).
- Cita sempre le fonti (teoria, codice, nota, link, PDF) e dichiara quando integra con conoscenza esterna o quando il materiale non copre la domanda.
- Risponde nella **lingua del messaggio** dell'utente (ripiego: lingua del materiale), oppure nella lingua fissata in Impostazioni → «Lingua delle risposte» (default Automatica).
- Risposte in streaming, interrompibili. Cronologia conservata per contesto.
- Le conversazioni restano in un elenco, raggruppate per età (oggi, ieri, questa settimana, prima) con ambito, numero di messaggi e data; una conversazione si riapre e continua con lo stesso ambito. L'elenco vuoto mostra lo stato vuoto.
- **Offline** il messaggio scritto resta in attesa e parte da solo al ritorno della rete; finché è in attesa non se ne inviano altri. Quiz e flashcard già generati funzionano anche senza rete.
- Modello Gemini selezionabile nelle Impostazioni; errori spiegati in modo leggibile (chiave assente, quota…).

---

## 17. Statistiche

Periodo selezionabile: 7 / 30 / 90 giorni / tutto.

### 17.1 Panoramica
**Focus** (ore di focus nel periodo, confronto col periodo precedente, andamento per settimana); **Costanza** (giorni di fila con studio = streak, e il record); **Sessioni** (numero e durata media); **Disciplina** (quota di attività completate sul totale delle programmate, globale e per tipo); **Giorni con attività** (sugli ultimi 84, con mappa di calore); **Per corso** (unità completate su totali e percentuale).

### 17.2 Comportamenti
Fasce orarie di rendimento (mattina/pomeriggio/sera/notte); minuti per giorno della settimana; costanza settimanale; blocchi persi (tasso, andamento, giorno e tipo peggiori); risposta ai trigger di verifica (recuperi dopo l'avviso); routine senza durata; fasi (tasso per fase, le più saltate, andamento dei salti).

### 17.3 Studio
Focus, iperfocus e puntualità in evidenza; esiti (distribuzione); focus reale vs pianificato (efficienza del focus) e pause; ritmo (pomodoro, segmenti, pause, interruzioni); minuti per unità; iperfocus (sessioni, minuti, uscite d'emergenza, abbandoni) con il tempo extra accumulato; puntualità (ritardo medio, % puntuali, ritardi maggiori, anticipi).

### 17.4 Pratica
Quiz: media dei punteggi. DevSwipe e Bug Hunter: accuratezza. Audio Flash-Trivia: playlist completate. Flashcard: carte ripassate e carte scadute.

---

## 18. Widget della schermata Home (Android)

Un widget calendario 4×2: a sinistra il mese con weekend attenuati, giorno corrente in bianco e un pallino nel colore del tipo di attività prevalente del giorno; a destra l'agenda di oggi, «Prossima: …» con il prossimo blocco e "+" che apre direttamente «+ Crea». Ogni voce apre direttamente la schermata giusta.

---

## 19. La schermata Notifiche

Raccoglie in un unico posto le cose che aspettano l'utente: le sessioni di studio degli ultimi giorni ancora senza esito, con accesso diretto a "Registra esito". Un badge segnala quante sono. Sotto, la sezione **Ieri · gestite** elenca le notifiche del giorno prima già consegnate o gestite; **Segna tutte lette** toglie il segno di novità dalle voci (gli esiti restano finché non si registrano).

---

## 20. Backup

Esportazione e importazione di un file con tutti i dati: corsi, attività, routine, eventi, sessioni, materiali (PDF inclusi), pratiche, chat, impostazioni. L'importazione sostituisce i dati locali dopo conferma. Su mobile il file va nella cartella documenti del dispositivo.

---

## 21. Sincronizzazione fra dispositivi

Con un **account** (email + codice di verifica), le **attività** (todo, eventi, routine, routine di studio, con stati, esiti, checklist, fasi) e le **impostazioni** sono condivise fra i dispositivi dell'utente. Serve internet: offline si continua a lavorare e le modifiche si allineano alla prima connessione. Corsi, materiali, file di codice, sessioni, pratiche e chat restano locali e si trasferiscono con il backup; una routine di studio compare su un altro dispositivo con la sua unità solo se lo stesso corso è stato importato anche lì.

In Account e sincronizzazione: nome facoltativo (usato nel saluto e nel menu) ed email, stato dell'account, ultima sincronizzazione, "Sincronizza ora", cosa viaggia e cosa resta sul dispositivo, **dispositivi** collegati con «Scollega» (revoca l'accesso di un altro dispositivo, che deve rientrare), uscita dall'account, cancellazione dei dati remoti.

---

## 22. Lingua

Nessun selettore: l'interfaccia segue la lingua del dispositivo fra italiano, inglese, spagnolo, portoghese, francese, tedesco; altrimenti inglese. Contenuti AI e pratiche seguono invece la lingua del materiale o del messaggio, salvo la «Lingua delle risposte» fissata nelle Impostazioni (§16).

---

## 23. Impostazioni

Notifiche (§7.7); **inizio settimana** (lunedì o domenica: decide la settimana del calendario e la fine dell'orizzonte «settimana»); modello AI, chiave e **lingua delle risposte** (Automatica o una delle sei lingue); backup; account e sincronizzazione; spazio occupato dai materiali; animazioni (auto/sempre/mai), celebrazioni scelte per nome (piena / sobria / off), feedback aptico; in **Avanzate** la diagnostica e **Informazioni**, che mostra la versione dell'app; eliminazione di tutti i dati.

---

## 24. Diagnostica

Rapporto copiabile sullo stato del dispositivo: margini dello schermo, scala del testo, riduzione animazioni, permessi (notifiche, allarmi precisi, Non Disturbare), coda delle notifiche programmate, ultimo errore e ultima sincronizzazione delle notifiche, stato dell'account; spazio locale con **Svuota cache** (elimina solo dati rigenerabili, come la cache dell'app web e le anteprime, mai dati dell'utente) e, sul web, **Reinstalla PWA** (aggiorna l'app installata e ricarica).

---

## Riepilogo: le quattro attività

| | Todo | Evento | Routine | Routine di studio |
|---|---|---|---|---|
| Si ripete | no | no | sì | sì |
| Orario | opzionale | opzionale (tutto il giorno) | inizio + fine, o senza durata | inizio + fine |
| Si sposta da solo se non fatto | sì (orizzonte settimana/mese) | no | no | no |
| Può diventare "perso" | sì ("non fatto", ma spuntabile) | no | sì | sì |
| Completamento | spunta, sempre | "Completa evento" | Fatta/Saltata nel giorno previsto | esito a fine sessione |
| Sotto-elementi | checklist | fasi | fasi | — |
| Legato a un corso | no | no | no | opzionale (consigliato) |
| Promemoria | sì (digest se senza orario) | sì | sì | sì |
