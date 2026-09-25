# RoutForge — Contesto del progetto

*Punto d'ingresso. Da leggere per primo, poi gli altri file nell'ordine indicato.*

---

## 1. Cosa si costruisce

RoutForge: un'app per organizzazione e studio. Unisce un calendario con quattro tipi di attività, uno scheduler che ripianifica da solo, un timer di studio con esiti che fanno avanzare il percorso del corso, promemoria configurabili, pratica generata dall'AI (quiz, flashcard con ripetizione dilazionata, DevSwipe, Bug Hunter, Audio Flash-Trivia), statistiche sul comportamento di studio e sincronizzazione di attività e impostazioni fra dispositivi.

**Utente**: una persona, i suoi dispositivi. Nessuna condivisione fra utenti, nessun ruolo.

**Studio**: Nel file `RoutForge_FUNZIONALITA.md` è descritto come viene gestito lo studio e quali implicazioni ha all'interno dell'applicazione. Tale descrizione rappresenta il **punto di partenza funzionale** del sistema.

RoutForge nasce inizialmente dal caso concreto di uno studente autodidatta che organizza il proprio percorso personale attraverso un corso strutturato in **moduli** e **unità**:

```text
Corso
└── Modulo
    └── Unità
```

Questa struttura è il **modello di riferimento iniziale** utilizzato per definire le funzionalità di RoutForge, ma non costituisce il modello definitivo dello Studio né un vincolo che debba essere mantenuto come unica struttura possibile.

L'obiettivo è **generalizzare il modello di riferimento**, preservandone le capacità funzionali, affinché RoutForge possa rappresentare percorsi di studio appartenenti a diversi tipi di studente e contesti formativi, tra cui scuola superiore, università, ITS, corsi online, formazione personale e altri contesti futuri.

La generalizzazione deve partire dalle **capacità effettivamente necessarie al funzionamento dello Studio** — percorso formativo, contenuti, attività, progresso, completamento, revisione e avanzamento — e non dalla semplice struttura `Corso → Modulo → Unità`.

Il modello deve quindi poter rappresentare strutture formative differenti senza creare un sistema separato per ogni tipo di studente e senza introdurre anticipatamente complessità non richiesta dai casi d'uso concreti.

Il modello `Corso → Modulo → Unità` deve rimanere pienamente supportato come caso di riferimento, mentre la struttura complessiva dello Studio deve poter evolvere progressivamente quando nuovi contesti o requisiti lo rendono necessario.

Le regole operative dello Studio, compresi stati, transizioni, progresso, puntatore, esiti e relative implicazioni, sono definite nei documenti funzionali e meccanici del progetto.

---

## 2. I file e l'ordine di lettura

| Ordine | File | Ruolo |
|---|---|---|
| 1 | `RoutForge_CONTESTO.md` (questo) | Perimetro, piattaforme, vincoli, glossario, decisioni prese |
| 2 | `RoutForge_FUNZIONALITA.md` | **Cosa** fa l'app dal punto di vista dell'utente |
| 3 | `RoutForge_MECCANISMI.md` | **Regole** esatte: stati, soglie, transizioni, algoritmi |
| 4 | `RoutForge_FORMATO_CORSO.md` | Formato del corso importabile e corso di esempio |
| 5 | `RoutForge_SCENARI.md` | Criteri di accettazione end-to-end |

In caso di contraddizione prevale il file più in basso nella tabella (uno scenario vince su un meccanismo, un meccanismo su una funzionalità). Se l'export di Claude Design (schermate, `course-data.js`) diverge da questi file vince il design, e questi file vanno allineati.

---

## 3. Piattaforme e requisiti non funzionali

- **Piattaforme**: Android, iOS, web installabile. Stesse funzioni ovunque, con queste eccezioni: widget della schermata Home (Android; iOS se disponibile), sveglie a schermo intero e Non Disturbare (mobile), notifiche in background (mobile; sul web solo con la scheda aperta), salvataggio backup nella cartella documenti (mobile).
- **Dati sul dispositivo**: tutto funziona offline salvo AI e sincronizzazione (un messaggio di chat scritto offline resta in attesa e parte al ritorno della rete; quiz e flashcard già generati funzionano offline). Nessun dato lascia il dispositivo se non verso il servizio di sincronizzazione (scelto dall'utente con l'account) e il fornitore del modello AI (solo il contenuto del contesto della richiesta).
- **Tempo**: tutte le regole usano il giorno e l'ora **locali** del dispositivo; fuso orario e ora legale non devono spostare i blocchi di giorno.
- **Reattività**: apertura sulla schermata Oggi con il blocco "Adesso" pronto entro mezzo secondo su dati esistenti; scheduler e notifiche in background senza bloccare l'uso.
- **Robustezza**: nessuna operazione di notifica, widget o sincronizzazione può bloccare o far fallire l'app; ogni ciclo dello scheduler è idempotente (rieseguirlo non cambia il risultato).
- **Lingue dell'interfaccia**: italiano, inglese, spagnolo, portoghese, francese, tedesco; ripiego inglese; presa dal dispositivo; ogni testo visibile, notifiche incluse, tradotto in tutte e sei.
- **Accessibilità**: rispetto della riduzione animazioni e della scala del testo di sistema.
- **Test**: i meccanismi puri (scheduler, esiti e puntatore, notifiche, SM-2, checklist, fasi, parser del corso, sincronizzazione) devono essere verificabili in isolamento; gli scenari del file 5 sono i criteri di accettazione.

---

## 4. Glossario

| Termine | Significato |
|---|---|
| **Attività / blocco** | Una singola voce sul calendario (todo, evento, occorrenza di routine, occorrenza di routine di studio) |
| **Ricorrenza / definizione** | La regola che genera le occorrenze di una routine |
| **Occorrenza** | Un blocco generato da una ricorrenza per un giorno preciso |
| **Senza orario** | Todo o evento con solo la data (todo: fascia in cima al giorno; evento: tutto il giorno) |
| **Senza durata** | Routine con solo l'orario d'inizio, aperta tutto il giorno |
| **Orizzonte** | Per i todo: fino a quando si spostano da soli a oggi (giorno / settimana / mese) |
| **Perso** | Blocco non gestito entro 30' dalla fine; per i todo si legge "non fatto" |
| **Recupero** | Avvio tardivo di una routine/sessione dopo l'orario, o esito registrato su un blocco perso |
| **Scadenza di recupero** | Metà della durata: oltre, parte la notifica di verifica |
| **Esito** | Chiusura di una sessione di studio: Completata / Continua / Indietro / Salta |
| **Puntatore** | Il meccanismo che assegna alle occorrenze future di studio la prossima unità pendente |
| **Unità pendente** | Non iniziata, parziale o da rivedere |
| **Fasi** | Sotto-passi di routine ed eventi, segnati in negativo al completamento |
| **Checklist** | Voci di un todo, spuntate in positivo una alla volta |
| **Sessione** | Un'esecuzione del timer di studio, con o senza blocco collegato |
| **Tempo extra** | Minuti di sessione oltre la durata pianificata: il timer prosegue e conta in positivo, senza allarme |
| **Iperfocus** | Modalità della sessione a schermo intero con uscita bloccata fino alla fine e Non Disturbare di sistema; non indica il tempo extra |
| **Conta nel piano** | Scelta a fine sessione: l'esito agisce sull'unità e sul puntatore oppure no |
| **Digest** | Notifica mattutina unica con i todo senza orario del giorno |
| **Riconciliazione** | Ricalcolo delle notifiche armate rispetto allo stato corrente |
| **Ripasso trasversale** | Tutte le flashcard scadute di tutti i mazzi |

---

## 5. Decisioni prese (valide salvo diversa indicazione)

**Cose che l'app non fa**: non legge ad alta voce il contenuto dei corsi (la voce è usata solo dall'Audio Flash-Trivia per domande e spiegazioni generate); non integra servizi musicali; non cerca risorse su internet per arricchire i corsi; non ha lista attività separata dal calendario; non ha una schermata di benvenuto; non ha selettore di lingua.

**AI**: fornitore Gemini; modello scelto dall'utente fra quelli disponibili (default il più economico); chiave inserita dall'utente nelle Impostazioni, conservata sul dispositivo e sincronizzata come impostazione; senza chiave le funzioni AI mostrano un errore leggibile e tutto il resto funziona.

**Sincronizzazione**: account con email + codice di verifica; ambito e regole in `RoutForge_MECCANISMI.md` §25; il servizio remoto conserva solo ciò che è nell'ambito; nessuna funzione dipende dall'essere online.

**Pratiche nuove** (DevSwipe, Bug Hunter, Audio Flash-Trivia): si generano da un'unità come quiz e flashcard, nella lingua del materiale, con validazione prima del salvataggio; punteggi e regole in `RoutForge_MECCANISMI.md` §18; risultati nelle Statistiche → Pratica.

**Corso di esempio**: incluso nell'app, conforme a `RoutForge_FORMATO_CORSO.md`, importabile senza avvisi; mostra anche i moduli successivi come segnaposto bloccati (`RoutForge_FORMATO_CORSO.md` §5).

**Backup**: file unico con tutti i dati locali, PDF inclusi; l'import sostituisce i dati locali dopo conferma.

---

## 6. Ordine di costruzione consigliato (per dipendenze)

1. Dati e import del corso (formato, corso di esempio, albero corso/moduli/unità).
2. Attività: creazione dei quattro tipi, calendario Oggi (giorno/settimana/mese), dettaglio, spunta, checklist, fasi.
3. Scheduler: generazione occorrenze, orizzonte todo, persi, recupero, orfani, cicli.
4. Sessione di studio: setup, timer, pomodoro, iperfocus, esiti, puntatore, streak.
5. Notifiche: default, override, trigger, finestra, riconciliazione, ore silenziose, digest, azioni, sveglie.
6. Blocco Adesso, trascinamento, schermata Notifiche, widget e collegamenti diretti.
7. Materiali, file di codice, AI (chat, quiz, flashcard + SM-2, DevSwipe, Bug Hunter, Audio Flash-Trivia).
8. Statistiche.
9. Backup, lingua, impostazioni, diagnostica.
10. Sincronizzazione.

Ogni passo deve superare gli scenari corrispondenti prima di passare al successivo.
