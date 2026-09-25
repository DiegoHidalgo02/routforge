# RoutForge — Scenari di accettazione

*Comportamenti end-to-end verificabili. Ogni scenario incrocia più meccanismi (`RoutForge_MECCANISMI.md`) e vale come criterio di accettazione: se l'app costruita non lo rispetta, non è conforme. Le date sono relative a "oggi".*

---

## A. Todo

**A1 — Todo senza orario, orizzonte giorno, non fatto**
Dato un todo "Chiama Marco" per oggi, senza orario, orizzonte giorno. Il giorno finisce senza spunta. Alle 00:30 del giorno dopo, alla prima apertura, il todo è "non fatto" e resta nel giorno di ieri; è ancora spuntabile; arriva una sola notifica "todo in ritardo"; il giorno dopo ancora, nessuna nuova notifica.

**A2 — Todo con orizzonte settimana che rotola**
Dato un todo "Spesa" creato martedì con orario 18:00, durata 30', orizzonte settimana (fine: domenica). Martedì non viene fatto. Mercoledì all'apertura il todo è a mercoledì: alle 18:00 se lo slot è libero, altrimenti nel primo varco di 30' libero dopo l'ora corrente entro le 22:00. Le voci di checklist già spuntate restano spuntate. Lunedì successivo, se ancora non fatto, il todo resta a domenica come "non fatto".

**A3 — Checklist che completa il todo**
Dato un todo con checklist di 3 voci. Spuntare le prime due non completa il todo (badge 2/3). Spuntare la terza completa il todo e cancella le sue notifiche. Togliere la spunta a una voce riapre il todo e ri-arma le notifiche. Eliminare tutte le voci dall'editor non cambia lo stato del todo.

**A4 — Digest mattutino con arretrati**
Dati due todo senza orario per oggi e uno senza orario di ieri con orizzonte mese non fatto. Alle 08:00 arriva un solo digest: "3 da fare (1 arretrato)" con i tre titoli. Se non ci sono todo senza orario, nessun digest.

**A5 — Priorità nella fascia senza orario**
Tre todo senza orario oggi: bassa, alta, normale. Nella vista Giorno appaiono nell'ordine alta, normale, bassa: su mobile in cima, prima di qualsiasi blocco con orario; su desktop in coda, dopo i blocchi con orario.

## B. Routine

**B1 — Generazione e orizzonte**
Creata una routine "Corsa" lunedì/mercoledì/venerdì 07:00–08:00 a partire da oggi. Nel calendario esistono le occorrenze dei prossimi 28 giorni sui tre giorni, nessuna oltre. Tra 10 giorni, all'apertura, esistono occorrenze fino a quel giorno + 28. Nessun duplicato per la stessa data.

**B2 — Spunta solo nel giorno previsto**
Data l'occorrenza di mercoledì. Martedì non è spuntabile; giovedì non è spuntabile (e risulta persa dalle 08:30 di mercoledì); mercoledì lo è dalle 00:00 alle 23:59.

**B3 — Routine notturna**
Routine 23:00–01:00 il sabato. L'occorrenza inizia sabato 23:00 e finisce domenica 01:00. Domenica alle 00:30 è ancora spuntabile e risulta "adesso". Diventa persa da domenica 01:30.

**B4 — Routine senza durata**
Routine "Meditazione" alle 07:00 senza durata. L'occorrenza è spuntabile tutto il giorno; nessuna notifica di verifica prima di 07:30; diventa persa alle 00:29 del giorno dopo; non contribuisce ai minuti nella mappa di calore; in Statistiche compare nella sezione "routine senza durata" con il tasso di completamento.

**B5 — Fasi a inversione**
Routine "Mattina" con fasi sveglia, skin-care, meditazione. Spuntando l'occorrenza si apre la revisione con tutte e tre fatte. L'utente tocca "meditazione" e conferma: l'occorrenza è completata; il log registra 2 fatte + 1 saltata. Annullando la spunta il log sparisce. Ricompletando senza toccare nulla, il log ha 3 fatte (sovrascritto, non duplicato). Rinominare "skin-care" in "viso" nel template non altera i log passati; in Statistiche la fase compare una sola volta con l'etichetta "viso".

**B6 — Modifica della routine**
Alle 15:00 di oggi si cambia l'orario di "Corsa" da 07:00 a 18:00. L'occorrenza di stamattina (completata alle 07:45) resta com'era; le occorrenze future sono alle 18:00; quella di oggi alle 18:00 esiste; le notifiche di domani sono ricalcolate.

**B7 — Recupero dopo la verifica**
Routine 18:00–20:00 non avviata. Alle 19:00 (metà durata) arriva la notifica di verifica. Alle 19:40 l'utente la spunta: completata, istante registrato dopo la scadenza → in Statistiche conta come "risposto al trigger". Se invece non fa nulla, alle 20:30 diventa persa e riceve una notifica "blocco perso" (una sola, silenziosa).

## C. Routine di studio ed esiti

**C1 — Puntatore iniziale**
Corso con unità 1.1, 1.2, 2.1. Creata una routine di studio lun–ven 09:00–10:00: le occorrenze future puntano, in ordine, a 1.1, 1.2, 2.1, poi a nessuna unità.

**C2 — Continua**
Sessione sull'occorrenza di oggi (1.1) chiusa con "Continua", confidenza 3, 45 minuti. L'occorrenza è `parziale`; l'unità 1.1 è `parziale` con 45 minuti e progresso = min(0,95; 45/180) se le ore non sono stimate; domani punta ancora a 1.1; la streak aumenta di 1 (una sola volta anche con due sessioni oggi).

**C3 — Completata, Indietro, Salta**
Completata su 1.1 → 1.1 completata, domani punta a 1.2, progresso corso 1/3. Poi "Indietro" su 1.2 → 1.1 torna `da rivedere` e, per ordine, è di nuovo la prossima; 1.2 resta `non iniziata`. Poi "Salta" su 1.1 → 1.1 `saltata`, esce dal percorso; prossima = 1.2.

**C4 — Anticipo**
Occorrenza di oggi alle 15:00. Alle 14:40 "Inizia sessione" dall'unità parte come sessione libera senza toccare l'occorrenza. "Anticipa sessione" invece sposta l'occorrenza a 14:40–15:40, registra 20 minuti di anticipo, e il setup la propone come blocco di routine.

**C5 — Recupero tardivo e ritardo**
Occorrenza 09:00–10:00 avviata alle 10:20 dal setup in modalità "recupero" con preset 50': il blocco va `in corso` con ritardo 80'; l'esito registrato lo chiude; in Statistiche la puntualità lo conta come "in ritardo > 5'".

**C6 — Esito su blocco perso**
Occorrenza persa ieri. Compare nella schermata Notifiche (esiti pendenti, entro 3 giorni). "Registra esito → Completata": il blocco diventa completato, la marcatura persa è azzerata, l'unità avanza, i minuti accreditati = durata pianificata.

**C7 — Sessione libera che conta**
Dall'unità 2.1 (nessuna occorrenza) parte una sessione libera di 25'. A fine sessione, "conta nel piano" attivo: viene creato un blocco di studio retroattivo 25' su 2.1 con l'esito scelto; il puntatore si ricalcola. Con "conta nel piano" disattivo: nessun blocco, l'unità non cambia stato, la sessione resta nelle statistiche di focus.

**C8 — Abbandono e orfani**
Sessione avviata su un'occorrenza (blocco `in corso`), poi abbandonata: il blocco torna `programmato`. Se invece l'app viene chiusa a metà e riaperta 40' dopo la fine del blocco senza una sessione attiva: il blocco torna `programmato` e subito dopo viene giudicato perso.

**C9 — Routine di studio senza corso**
Routine di studio creata senza corso, 20:00–21:00. Le occorrenze non hanno unità. Dal setup si sceglie l'unità 1.2 di un corso: l'esito "Completata" chiude il blocco e completa 1.2 (il puntatore di quel corso si ricalcola). Se nel setup non si sceglie nulla, l'esito chiude solo il blocco, la streak aumenta, nessuna unità cambia.

## D. Sessione e timer

**D1 — Ancorata all'orologio**
Occorrenza 09:00–10:00 avviata alle 09:10 in modalità routine. Il timer mostra 50' rimanenti. Una pausa di 5' alle 09:30 non sposta la fine: alle 10:00 la sessione è "finita", focus = 45'. La notifica "tempo scaduto" scatta alle 10:00.

**D2 — Ancorata al focus**
Sessione libera da 50'. Pausa di 10' → la sessione finisce quando il focus arriva a 50', cioè 60' dopo l'avvio.

**D3 — Pomodoro multi-materia**
Sessione libera 90' pomodoro 25/5: segmenti 25/5/25/5/25/5 (tassellano esattamente i 90'; con 80' l'ultimo segmento sarebbe una pausa troncata a 0 e quindi omessa). Al terzo segmento di studio l'utente cambia unità: i minuti per unità nel riepilogo riflettono 50' sulla prima e 25' sulla seconda; l'esito resta sull'unità pianificata; l'altra riceve solo i minuti.

**D4 — Persistenza**
Sessione avviata, app chiusa, riaperta 12' dopo: il timer riprende con 12' in più di focus (non in pausa) e il banner permette di rientrare.

**D5 — Iperfocus**
Sessione iperfocus 50': schermo intero, tasto indietro inattivo fino alla fine, ora di sblocco visibile, Non Disturbare attivo se permesso. Un tentativo di uscita apre la conferma "Esci comunque / Resta"; "Esci comunque" → interruzione "iperfocus" registrata → conta come uscita d'emergenza in Statistiche. Superata la durata senza uscire, il timer segna "Tempo extra +04:12": nel riepilogo compare "54 min · tempo extra +4 min".

**D6 — Una sola sessione**
Con una sessione attiva, aprire il setup da un'altra unità porta al timer in corso, non a un nuovo avvio.

## E. Eventi

**E1 — Evento con fasi e follow-up**
Evento "Dentista" giovedì 10:00 con fasi: stampare analisi, portare documenti. "Completa evento" → revisione; l'utente segna "stampare analisi" saltata e chiede un follow-up "Stampa analisi": viene creato un todo senza orario per oggi, orizzonte mese; l'evento è completato; il log registra 1 fatta + 1 saltata.

**E2 — Evento mai perso**
Evento venerdì 15:00–16:00 non completato. Sabato risulta "concluso", non "perso"; non compare nei persi delle statistiche; non riceve notifiche "perso".

**E3 — Tutto il giorno**
Evento "Scadenza tasse" tutto il giorno: notifica alle 08:00 di quel giorno; non compare nel blocco "Adesso"; non conta minuti.

## F. Notifiche

**F1 — Studio con default**
Occorrenza di studio 09:00–10:00, promemoria Auto: notifiche alle 08:55 (pre), 09:00 (inizio, azione Inizia), 09:30 (verifica), 10:10 (esito). Avviando la sessione alle 09:02, la verifica delle 09:30 è cancellata e l'esito delle 10:10 resta.

**F2 — Personalizzato multiplo con sveglia**
Evento alle 20:00, personalizzato: 1 giorno, 1 ora, all'inizio come sveglia. Notifiche il giorno prima alle 20:00 e alle 19:00; alle 20:00 una sveglia a schermo intero e nessuna notifica ordinaria.

**F3 — Ore silenziose**
Ore silenziose 22:00–07:00. Un todo alle 06:30 con anticipo 30' produce la notifica alle 07:00, non alle 06:00. Il digest delle 08:00 non è toccato. La notifica "blocco perso" alle 23:30 parte comunque.

**F4 — Finestra di 14 giorni**
Routine per sempre: sono armate solo le notifiche che scattano entro 14 giorni. Aprendo l'app dopo 10 giorni, la finestra si estende. Un evento fra 20 giorni con anticipo "1 giorno" non è armato oggi; lo diventa quando lo scatto entra nei 14 giorni.

**F5 — Posticipa**
Notifica "inizio" di una routine, "Posticipa": nuova notifica dopo 10' (spostata fuori dalle ore silenziose se serve). Se nel frattempo la routine è stata completata, il posticipo non produce nulla.

**F6 — Cambio di stato**
Completare, eliminare, spostare o perdere un blocco cancella le sue notifiche pendenti; riaprirlo le ri-arma; spegnere il tipo "todo" nelle Impostazioni cancella tutte le notifiche dei todo alla prossima riconciliazione.

## G. Calendario e "Adesso"

**G1 — Blocchi contigui**
Routine A 09:00–10:00 e B 10:00–11:00. Alle 10:00 in punto "Adesso" è B (A resta raggiungibile fino alle 10:30 ma non è "adesso").

**G2 — Chiusura di Adesso**
L'utente chiude il blocco Adesso su A. Quando B diventa in corso, il blocco riappare. Il giorno dopo riappare comunque.

**G3 — Trascinamento**
Nella vista Giorno il todo senza orario "Leggere 20 pagine" (durata 30') viene trascinato fra due blocchi 15:00–15:40 e 16:00–17:00: la riga di aggancio mostra "15:40 · 30 min", il todo atterra alle 15:40 (snap a 5') e diventa un todo con orario 15:40–16:10. Un todo senza orario perso trascinato a domani nella striscia settimanale torna programmato e riceve le notifiche di domani; allo stesso modo la routine persa "Palestra" trascinata a domani 08:30 torna programmata con le notifiche ri-armate. "Annulla" entro 5 s ripristina giorno, orario e stato "perso". Un evento, una routine o un todo con orario non persi non si trascinano, né su mobile né su desktop.

**G4 — Cambio giorno a app aperta**
App aperta a mezzanotte: entro un minuto i todo rotolanti si spostano, i blocchi di ieri non gestiti diventano persi, il calendario si aggiorna senza riavvio.

## H. Corsi, materiali, AI

**H1 — Import**
Uno ZIP con `00_struttura.md`, `M1-…md`, `M3-…md` e un `note.txt`: il corso ha 2 moduli in ordine 1, 3; il `.txt` è ignorato; un file `M2` senza intestazione modulo genera un avviso e viene saltato. Un secondo import dello stesso ZIP crea un secondo corso identico.

**H2 — PDF groundabile e passivo**
Un PDF testuale da 3 MB aggiunto all'unità entra nel contesto dell'AI (la chat cita "PDF: titolo"). Un PDF scansionato resta apribile ma l'AI non lo cita. Un PDF da 25 MB viene rifiutato.

**H3 — Eliminazione corso**
Eliminando il corso: spariscono routine di studio e occorrenze (incluse quelle di oggi con notifiche armate), materiali e PDF, mazzi, quiz e pratiche, chat, log fasi; le carte del corso escono dal ripasso trasversale.

**H4 — Lingua dell'AI**
Materiale in inglese, app in italiano: quiz, flashcard, DevSwipe, Bug Hunter e Trivia sono in inglese. In chat, un messaggio in italiano riceve risposta in italiano con fonti citate in inglese; "ok?" riceve risposta nella lingua del materiale.

**H5 — Validazione**
Una generazione di 10 domande in cui 2 hanno 3 opzioni e 1 ha indice corretto fuori intervallo salva un quiz da 7 domande. Una generazione con 0 elementi validi mostra un errore e non salva nulla.

## I. Pratica

**I1 — SM-2**
Carta nuova (facilità 2,5, intervallo 0). "Bene" → intervallo 1 g, facilità 2,5. Poi "Facile" → intervallo max(1, 1 × 2,65 × 1,3) ≈ 3,4 g, facilità 2,65. "Niente" → torna in coda nella stessa sessione, scadenza fra 10', facilità 2,45. La facilità non scende mai sotto 1,3.

**I2 — DevSwipe**
Mazzo di 10 carte, 3 errori: dopo la decima le 3 sbagliate vengono riproposte una volta; il punteggio salvato è 7/10; ogni errore ha prodotto vibrazione e spiegazione. Il riepilogo finale mostra 7/10, le 3 carte sbagliate e le azioni "Rifai la pratica" e "Torna all'unità".

**I3 — Bug Hunter**
Esercizio con riga errata 4. Tocco su 4 al primo tentativo: 2 punti, codice corretto mostrato. Tocco su 2, poi su 4: 1 punto. Due errori: 0 punti e soluzione mostrata. Punteggio finale = punti / (2 × esercizi).

**I4 — Audio Flash-Trivia**
Playlist di 10: ogni elemento = domanda letta → 5 s → spiegazione letta → successivo, senza tocchi; continua a schermo spento; "salta" passa al successivo e conta l'elemento come sbagliato. Con 2 elementi saltati, alla fine la playlist risulta completata e il riepilogo mostra "8 / 10 · 80 %", le 2 sbagliate e le azioni "Rifai la pratica" e "Torna all'unità"; le 2 sbagliate tornano una volta nella playlist successiva.

## J. Sincronizzazione

**J1 — Due dispositivi**
Todo creato sul telefono offline, completato 10' dopo sempre offline. Al ritorno online il tablet riceve il todo già completato; le notifiche sul tablet non vengono armate.

**J2 — Conflitto**
Stessa routine modificata alle 10:00 sul telefono (orario 18:00) e alle 10:05 sul tablet (orario 19:00), entrambi offline. Dopo la sincronizzazione entrambi mostrano 19:00; le occorrenze future sono rigenerate su entrambi.

**J3 — Routine di studio senza corso**
Routine di studio sincronizzata su un dispositivo che non ha il corso: le occorrenze compaiono senza unità; "Inizia sessione" apre il setup libero. Dopo l'import dello stesso ZIP, le occorrenze future puntano alle unità.

**J4 — Primo accesso con dati locali**
Dispositivo con 20 attività locali che accede a un account con 30 attività remote: dopo la sincronizzazione entrambi i lati hanno 50 attività (nessuna persa, nessun duplicato).

**J5 — Uscita**
Uscendo dall'account, le attività restano sul dispositivo e nuove modifiche non partono; rientrando, si riallineano.
