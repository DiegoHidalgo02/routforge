# RoutForge — Testi

Regole di scrittura, formati, modelli dei testi dinamici (notifiche, sveglie, toast, errori) e convenzione delle chiavi. I testi statici sono verbatim nei mock. Titoli e contenuti dei corsi sono verbatim dai file del corso: non si traducono e non si riscrivono.

## 1. Regole

- Italiano diretto e concreto, seconda persona, frasi brevi, niente punto esclamativo, niente emoji (DESIGN §7).
- Stati al participio («Completata», «Persa · era alle 14:30», «Fatta · 3 fasi su 3»); azioni all'imperativo («Inizia», «Registra esito», «Crea attività»).
- Etichette di gruppo in minuscolo con l'iniziale maiuscola; il maiuscolo solo negli eyebrow e nei badge.
- Un'azione ha lo stesso nome ovunque: notifica, sveglia, Dettaglio, card.

## 2. Dizionario

- Ogni testo visibile, notifiche e sveglie comprese, passa da una chiave. Sei lingue (it, en, es, pt, fr, de), ripiego en, lingua presa dal dispositivo (MECCANISMI §23).
- Chiavi per schermata e pezzo, per esempio `oggi.hero.eyebrow.adesso`, `dettaglio.footer.avviaSessione`, `notifica.studio.verifica.titolo`, `comune.annulla`.
- Segnaposto con nome (`{titolo}`, `{inizio}`, `{fine}`, `{minuti}`, `{unita}`) e plurali con forme separate («1 arretrato» · «2 arretrati»).
- Fuori dal dizionario: contenuti dei corsi, testi generati dall'AI, testi scritti dall'utente.

## 3. Formati (it)

| Dato | Forma | Esempio |
|---|---|---|
| Orario | 24 ore | `16:00` |
| Fascia oraria | spazio, trattino medio, spazio | `16:00 – 16:45` |
| Durata nelle meta | `m` e `h` attaccati | `45m`, `1h 30m`, `3h 45m` |
| Durata come dato | numero in font-num, unità a parte | `45` `min` |
| Data breve | giorno abbreviato minuscolo, numero, mese abbreviato | `mer 23 set` |
| Data lunga | per esteso, giorno con la maiuscola | `Mercoledì 23 settembre` |
| Relativa | | `ieri 21:10`, `Domani` |
| Mese · settimana | | `Settembre 2026` · `21 – 27 settembre` |
| Contatore | spazi attorno alla barra; forma compatta nelle sub delle card | `6 / 13` · `checklist 3/7` |
| Percentuale | spazio prima di % | `46 %` |
| Decimali | virgola | `10,9 MB` |
| Timer · tempo extra | | `12:41` · `+04:12` |
| Numerazione del corso | come nei file | `Modulo 00`, `Unità 0.7` |

Le altre lingue usano le convenzioni locali (Intl) con la stessa struttura.

## 4. Notifiche di sistema (S9)

`{fascia}` = `{inizio} – {fine}`; `{unita}` = `Unità {n} · {titolo dell'unità}`. Azioni come MECCANISMI §13.2. L'etichetta del trigger che i mock mostrano a destra è una didascalia, non testo della notifica.

| Trigger | Titolo | Testo | Azioni |
|---|---|---|---|
| Studio · anticipo | `{titolo} · alle {inizio}` | `{durata} · {unita}` | Inizia · Posticipa |
| Studio · inizio | `{titolo} · adesso` | `Fino alle {fine} · {unita}` | Inizia · Posticipa |
| Studio · verifica | `{titolo} non è partita` | `Si avvia ancora come recupero fino alle {fine + 30'}` | Inizia · Posticipa |
| Studio · esito (fine + 10') | `Registra l'esito · {titolo}` | `{fascia} · {unita}` | Registra esito |
| Studio · blocco perso (silenziosa) | `{titolo} · persa` | `Non avviata entro 30 min dalla fine. Un esito registrato la riabilita.` | Registra esito |
| Routine · blocco perso (silenziosa) | `{titolo} · persa` | `Non segnata entro 30 min dalla fine. Fino alle 23:59 la segni ancora Fatta o Saltata dal blocco.` (la seconda frase solo se il giorno della routine è oggi) | — |
| Routine · anticipo | `{titolo} · alle {inizio}` | `{durata} · {n} fasi` | Posticipa |
| Routine · inizio | `{titolo} · adesso` | `{fascia} · {n} fasi` | Posticipa |
| Routine · verifica | `{titolo} non è ancora segnata` | `{fascia} · si segna Fatta o Saltata dal blocco` | Posticipa |
| Evento · anticipo | `{titolo} · alle {inizio}` | `{fascia} · {luogo}` | Posticipa |
| Evento · tutto il giorno (08:00) | `{titolo} · oggi` | `Tutto il giorno` | Posticipa |
| Todo · anticipo | `{titolo} · alle {inizio}` | `{durata} · checklist {fatte}/{totali}` | Segna fatto · Posticipa |
| Todo · scadenza | `{titolo} · adesso` | `{fascia} · checklist {fatte}/{totali}` | Segna fatto · Posticipa |
| Todo in ritardo, spostato a oggi (silenziosa) | `{titolo} · in ritardo` | `Non fatto ieri: ora è su oggi, rotola fino a {giorno}` | Segna fatto · Posticipa |
| Todo in ritardo, non fatto (silenziosa; orizzonte giorno o scaduto) | `{titolo} · non fatto` | `Era per {giorno}: resta lì e puoi ancora segnarlo fatto.` (orizzonte giorno; `{giorno}` = «ieri» o la data breve) · `Era entro {giorno}: resta lì e puoi ancora segnarlo fatto.` (orizzonte settimana o mese scaduto) | Segna fatto · Posticipa |
| Digest | `{n} da fare ({m} arretrato)` | fino a 3 titoli separati da « · » | — |
| Tempo scaduto | `Tempo scaduto · {titolo}` | `Fine prevista delle {fine}. Il timer prosegue in tempo extra finché non termini.` | — |
| Sessione in corso (persistente, Android) | `Sessione in corso` | `{titolo} · {unita}`, `· tempo extra` quando serve; cronometro a destra | — |
| Prova | `Notifica di prova` | `Le notifiche di RoutForge arrivano su questo dispositivo.` | — |

Le parti senza dato si omettono con il loro separatore (nessun luogo, nessuna checklist).

## 5. Sveglia (S8)

- Eyebrow «Sveglia» con l'anticipo a destra («5 min prima», «10 min prima», «30 min prima», «all'inizio»).
- Ora grande, data lunga, titolo, fascia, contesto (corso e unità, checklist).
- Tasto principale: studio «Inizia» · todo «Segna fatto» · routine ed evento «Apri il blocco»; poi «Posticipa» (+10 min) e «Chiudi».
- Le note sotto i tasti nei mock sono didascalie della regola, non testo di prodotto.

## 6. Toast e conferme

- Eliminazioni: «Eliminata», «Occorrenza eliminata», «Routine eliminata», «Routine di studio eliminata», con «Annulla».
- Routine: «Eliminare «{titolo}»?» con «Solo questa · {data breve}» e «Tutta la routine» (o «Tutta la routine di studio»).
- Impostazioni: «Cancellare i dati dall'account?» con «Cancella dall'account»; «Eliminare tutti i dati di questo dispositivo?» con «Elimina tutti i dati»; «Backup salvato in Documenti» con l'ora.
- Dettaglio: toast con «Annulla» dopo «Crea todo con le voci rimaste» e dopo i follow-up.
- Oggi (spunta dalla lista): «Fatto · {titolo}» · «Fatto · tutte le voci spuntate» · «Completato · {n} voci in un nuovo todo» con «Annulla»; ritorni dalle altre schermate: «Todo creato · {titolo}» con «Annulla», «Esito registrato · {titolo} · {Completata | Continua | Indietro | Salta}», «Routine creata · occorrenze per 4 settimane», «Routine di studio creata · occorrenze per 4 settimane», «Evento creato», «Modifiche salvate».
- Registra esito da Oggi: eyebrow «Registra esito», titolo dell'attività, «Senza sessione · conta la durata pianificata, {n} min»; esiti «Completata · Il puntatore passa alla {unità}» · «Continua · Resta sulla {unità} la prossima volta» · «Indietro · La {unità precedente} torna da rivedere» · «Salta · La {unità} esce dal percorso»; toast «Esito registrato · {titolo} · {esito}». Cerchio spento: «Si segna nel giorno previsto».
- Giornata chiusa: «Giornata chiusa» · «Tutto fatto per oggi» · «La tua giornata» con «{inizio} – {fine}» · legenda «{tipo} {durata}» · «Domani · {ora}» sopra il titolo.
- Card Adesso: «Segna come fatto» (todo) · «Segna come fatta» (routine) · «Completa evento»; toast «Fatto · {titolo}» · «Fatta · {titolo}» · «Evento completato · {titolo}» · «Fatta · {n} fasi su {m}» · «Completato · {n} fasi saltate»; Revisione fasi: eyebrow «Segna come fatta» o «Completa evento», «Risultano tutte fatte. Tocca solo quelle che hai saltato.», «{n} fatte · {m} saltate»; routine da recuperare «{ora} poi risulta persa».
- Creazione: «Todo creato · {titolo}» · «Evento creato · {giorno breve} {n} {mese breve}» · «Routine creata · oggi | {giorno}» · «Routine di studio creata · …», sempre con «Annulla»; zona di presa del foglio con il suggerimento «Trascina in basso per chiudere».
- Voci rimaste da Oggi: eyebrow «Segna come fatto», titolo «{n} voci non spuntate» (o «Una voce non spuntata»), testo ««{titolo}» si completa comunque. Le voci rimaste puoi segnarle fatte o passarle a un nuovo todo.», meta «{n} voci · stessa priorità e scadenza · senza orario».
- Riordino (mobile): maniglia «Riordina «{titolo}»»; barra con il titolo e «Priorità {alta | normale | bassa} · {posizione} di {totale}», «Sposta su», «Sposta giù», «Fine»; stessa regione live del desktop.
- Fine sessione: «Giorni di fila» con il badge «+1».
- Riordino (desktop): «Sposta su» e «Sposta giù» (aria-label delle frecce); regione live «{titolo} · {posizione} di {totale} fra i todo a priorità {alta | normale | bassa}».
- Sessione: «Uscita bloccata fino alla fine» (iperfocus); il link «Abbandona · …» dichiara l'effetto secondo la soglia del 65 %.

## 7. Errori

| Caso | Testo | Dove |
|---|---|---|
| Evento con la fine non dopo l'inizio | «La fine deve venire dopo l'inizio» | S4 (MECCANISMI §2) |
| PDF oltre 20 MB | «PDF troppo grande» · «{file} pesa {MB}, il limite è 20 MB. Non l'ho aggiunto.» | S12 `material=pdf-big` |
| Generazione senza elementi validi | «Nessuna domanda valida» · «La risposta dell'AI non conteneva elementi che superano il controllo: non ho salvato nulla.» Il sostantivo segue la pratica (domanda, carta, esercizio) | S12 `genState=error` |
| Import non riuscito | testo di S10 `error` | S10 |
| AI senza chiave | S19 `chat-nokey`, con «Apri Impostazioni» | S19 |
| AI offline | messaggio in attesa, invio spento | S19 `chat-offline` |
| AI · limite di richieste | «Limite di richieste raggiunto» · «Gemini ha rifiutato la richiesta per quota del tuo piano (429). Riprova tra qualche minuto o scegli un modello più economico nelle Impostazioni.» · «Impostazioni · Modello AI» e «Riprova» | S19 `chat-error` |
| AI · chiave non valida | «Chiave Gemini non valida» · «Gemini non riconosce la chiave salvata. Controllala o incollane una nuova in Impostazioni → Modello e chiave AI.» · «Apri Impostazioni» | S19 `chat-error-key` |
| AI · modello fuori piano | «Modello non incluso nel tuo piano» · «La tua chiave Gemini non dà accesso al modello scelto. Scegline un altro in Impostazioni: la conversazione resta qui.» · «Apri Impostazioni» | S19 `chat-error-model` |
| AI · blocco di sicurezza | «Risposta bloccata» · «I filtri di sicurezza di Gemini hanno fermato la risposta. Riformula la domanda e inviala di nuovo.» · «Riformula la domanda» | S19 `chat-error-safety` |
| Permesso notifiche negato | «Permesso notifiche negato» · «Nessun promemoria arriva finché non lo concedi nelle impostazioni di sistema.» | S22 |
| Sincronizzazione offline | «Offline · {n} modifiche in coda, partono alla prima connessione» | S22 |

## 8. Stati vuoti

«Nessuna attività per oggi» · «Crea la prima, oppure carica un corso per avere una routine di studio.» con «Crea attività» e «Vai ai corsi» (S1 `variant=empty`) · «Settimana libera» · «{Mese} senza attività» · «Niente in programma nei prossimi giorni.» · nessun corso con «Importa un corso» e il corso di esempio (S10) · nessun esito da registrare (S21) · «Nessuna carta da ripassare» (S19) · nessuna conversazione (S19) · nessun dato nel periodo (S20, per riga).
