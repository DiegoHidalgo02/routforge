# RoutForge — Navigazione

Struttura delle schermate, percorsi, fogli e pannelli, collegamenti diretti da notifiche, sveglie e widget. I percorsi sono nomi logici: se il repository ha già un router si mappano su quello; contano schermata, parametri e presentazione. Azioni nel dettaglio: `docs/CONTROLLI.md`.

## 1. Due strutture (D-UI-1)

- **Sotto 1024 px**: struttura mobile. Barra in basso, schermate piene, fogli dal basso.
- **Da 1024 px**: struttura desktop. Barra laterale 240, contenuto, pannello 440 a destra per Crea, Modifica e Dettaglio.
- Nessuna struttura tablet. Sveglia (S8), notifiche di sistema (S9) e widget (S13) esistono solo dove il sistema li offre (CONTESTO §3).

## 2. Cornice mobile

- **BottomNav**, fissa in basso e centrata: Oggi · **+ Crea** (FAB al centro) · Statistiche.
- **HeaderRoot** (Oggi): avatar che apre il menu account, saluto e poi data, tre pulsanti di vista Giorno · Settimana · Mese.
- **Menu account**: in testa nome (se c'è), email e stato della sincronizzazione; voci Corsi · Esiti da registrare (badge) · Account e sincronizzazione · Impostazioni.
- **HeaderDetail** (schermate interne): indietro, titolo, al massimo un'azione testuale.
- **Banner «Sessione in corso»**: sotto l'header e sopra la striscia dei giorni, fisso con lo scroll, su ogni schermata quando una sessione è attiva, tranne la sessione stessa e la sveglia.
- I livelli dei corsi (Corsi → Corso → Modulo → Unità) sono schermate piene che entrano da destra (`rf-slide`); la BottomNav resta visibile.

## 3. Cornice desktop

- **Sidebar 240**: logo, Oggi, Statistiche, pulsante **Crea**, carta «Sessione in corso» quando una sessione è attiva, account in fondo (stesso menu del mobile).
- **Contenuto**: Oggi con la colonna destra 360 («Il tuo progresso oggi», «Prossime attività») in vista Giorno e l'elenco del giorno scelto in vista Mese; Statistiche con larghezza massima 980; Corsi con i Panel `wide`; Notifiche e Impostazioni nella stessa shell, le Impostazioni con l'elenco delle sezioni a sinistra.
- **Pannello 440** a destra per Crea, Modifica e Dettaglio.

## 4. Percorsi

| Schermata | Percorso | Parametri | Mobile | Desktop | Mock |
|---|---|---|---|---|---|
| S1 Oggi | `/oggi` | `vista` giorno · settimana · mese; `data` | schermata principale | contenuto | S1 Oggi Mobile · Desktop |
| S4 Crea | `/crea` | `tipo` (default todo) · `data` (giorno di partenza: il giorno selezionato se entro oggi + 6, altrimenti oggi) | foglio sopra Oggi | pannello 440 | S4 Crea |
| S4 Modifica | `/attivita/:id/modifica` | — | foglio dal basso | pannello 440 | S4 `mode=edit` |
| S5 Dettaglio | `/attivita/:id` | `vista` review · followup · remaining · delete | foglio da 56 px dal top | pannello 440 | S5 Dettaglio |
| S15 Sessione | `/sessione` | `blocco`, `unita`, `origine`; la fase (setup, timer, iperfocus, debrief, fatto) è stato della sessione | schermata piena | contenuto | S15 Sessione |
| S10 Corsi | `/corsi` | — | schermata | contenuto | S10 Corsi |
| S11 Corso | `/corsi/:corso` | — | schermata da destra | contenuto (Panel `wide`) | S11 Corso Panel |
| S11 Modulo | `/corsi/:corso/moduli/:n` | `unita` aperta nell'accordion | schermata da destra | contenuto | S11 Modulo Panel |
| S12 Unità | `/corsi/:corso/unita/:unita` | — | schermata da destra | contenuto | S12 Unità Panel |
| S13 PDF | `/materiali/:id` | — | schermata piena | contenuto | S13 `pdf` · `pdf-scan` |
| S19 Pratica | `/pratica/:id` | — | schermata piena | contenuto | S19 quiz · flashcard · devswipe · bughunter · trivia |
| S19 Ripasso | `/ripasso` | — | schermata piena | contenuto | S19 `flashcard-*` |
| S19 Chat | `/chat` | `ambito` unità · modulo · corso · globale; `rif`; `conversazione` | schermata piena | contenuto | S19 `chat*` |
| S19 Conversazioni | `/chat/conversazioni` | — | schermata | contenuto | S19 `chat-history*` |
| S20 Statistiche | `/statistiche` | `tab` panoramica · comportamenti · studio · pratica; `periodo` 7 · 30 · 90 · tutto | schermata principale | contenuto (max 980) | S20 Shell `screen=stats` |
| S21 Notifiche | `/notifiche` | — | schermata dal menu | contenuto | S20 Shell `screen=notif` |
| S22 Impostazioni | `/impostazioni/:sezione?` | notifiche · account · accesso · ai · backup · diagnostica · informazioni | schermata dal menu | contenuto con elenco delle sezioni | S20 Shell `screen=settings` |
| S8 Sveglia | fuori dall'app | blocco, trigger | schermo intero di sistema | — | S8 Sveglia |
| S9 Notifiche di sistema | fuori dall'app | — | sistema | sul web solo a scheda aperta | S9 |

## 5. Livelli

Dal basso verso l'alto: schermata → banner sticky → foglio o pannello → menu account → toast; la sveglia sta sopra l'app.
- Un foglio alla volta. Le sotto-viste del Dettaglio (revisione fasi, follow-up, voci rimaste, eliminazione) sostituiscono il contenuto del foglio, non ne aprono un secondo.
- Le conferme distruttive sono un foglio r24 (Elimina corso) o un riquadro in linea (Impostazioni).
- Tocco fuori o Esc chiudono foglio, pannello e menu; il tocco dentro non si propaga. Eccezione: il foglio Crea su mobile si chiude solo trascinandolo in basso dal bordo alto o con «Annulla» (su desktop anche Esc); il tocco fuori non lo chiude.
- I toast stanno sopra il footer del foglio o sopra la BottomNav, uno alla volta; con «Annulla» per 5 s quando la scrittura si può annullare.

## 6. Indietro

- Chiude l'elemento più in alto (menu, foglio, pannello), poi torna al livello precedente (Unità → Modulo → Corso → Corsi). Da Oggi e Statistiche esce dall'app (mobile).
- Dalla sessione l'indietro non ferma il timer: torna alla schermata precedente e compare il banner (MECCANISMI §10.4).
- In iperfocus l'indietro non esce: mostra «Uscita bloccata fino alla fine» e porta alla conferma (`exit=tentativo`).

## 7. Collegamenti diretti

| Da | Azione | Apre | Note |
|---|---|---|---|
| Notifica studio (anticipo, inizio, verifica) | tocco | S12 Unità del blocco | MECC §13.2 |
| | Inizia | S15 setup sul blocco | contesto deciso dall'orologio (MECC §10.1) |
| Notifica esito · blocco perso (studio) | tocco o Registra esito | S15 debrief senza sessione | minuti = durata pianificata (MECC §11) |
| Notifica routine · evento | tocco | S5 Dettaglio | |
| Notifica todo (anticipo, scadenza, in ritardo) | tocco | S5 Dettaglio | |
| | Segna fatto | nessuna apertura; con voci non spuntate S5 `view=remaining` | MECC §4 |
| Qualsiasi notifica con Posticipa | Posticipa | nessuna apertura | +10 min, stessa chiave, solo se lo stato è coerente |
| Digest | tocco | S1 Oggi | |
| Notifica persistente della sessione (Android) · Tempo scaduto | tocco | S15 timer | |
| Sveglia S8 | tasto principale | come la notifica corrispondente: Inizia → S15 setup · Segna fatto → come sopra · Apri il blocco → S5 | |
| | Posticipa · Chiudi | nessuna apertura | Chiudi non esegue azioni |
| Widget (MECC §21) | mese, agenda | S1 Oggi | doppie aperture entro 1,5 s ignorate |
| | riga di un blocco, «Prossima» | studio → S12, altro → S5 | |
| | todo | S5 | |
| | + | S4 Crea | |
| | sessione · ripasso | S15 (timer se attiva, altrimenti setup) · S19 ripasso | |
| Menu account | Corsi · Esiti da registrare · Account e sincronizzazione · Impostazioni | S10 · S21 · S22 account · S22 | |
| Banner o carta «Sessione in corso» | Riprendi | S15 timer | |
| Card di Oggi | cerchio | nessuna apertura (spunta dalla lista); i passaggi richiesti si aprono sopra Oggi: «Voci rimaste», «Revisione fasi», «Registra esito» (studio); il tocco sulla card apre S5 | MECC §3–4 |
| BottomNav | Oggi | riporta al giorno di oggi e in cima alla lista (sostituisce il tasto «Oggi» dell'intestazione) | |
| S15 `done` | Torna a Oggi · Riduci | S1 con la card della sessione nel mazzo · S1 con il banner | |
| FAB, «Crea attività» (S1 mobile) | tocco | foglio Crea sopra Oggi, nella stessa schermata | S1 `crea` |
| Foglio Crea (mobile) | Crea · Annulla · trascinamento in basso | la card atterra nel giorno, nella settimana o nel mese mostrati (la striscia scorre se il giorno è un altro) · chiusura senza salvare | DESIGN §6 Creazione |
| S4 Desktop | Crea · Annulla | S1 Desktop con il toast | |
| S21 riga | Registra esito · Recupera · Apri unità | S15 debrief · S15 setup in recupero · S12 | |
| S12 | Inizia sessione | S15 setup libero; con una sessione attiva S15 timer | SCENARI D6 |
| S11 Modulo | Riprendi da · Inizia da | S15 setup sull'unità del puntatore | |
| S19 senza chiave | Apri Impostazioni | S22 ai | |

## 8. Sessione in corso

- Una sola sessione attiva: avviarne un'altra riporta a quella (SCENARI D6).
- Mobile: banner su ogni schermata tranne S15 e S8. Desktop: carta nella sidebar sotto Crea.
- Il timer prosegue fuori dalla schermata della sessione (MECCANISMI §10.4).

## 9. Transizioni

`rf-slide` 300 ms per le schermate che entrano da destra (mobile) · `rf-up` 300 ms per i fogli dal basso · `rf-in` 180 ms per le comparse · `rf-swap` per il saluto che lascia il posto alla data. Valori in `tokens.css`; con riduzione animazioni solo dissolvenze.


## 10. Collegamenti del prototipo

Solo nei mock: le cornici leggono i parametri dell'indirizzo quando la tavola non passa la prop, così le schermate si percorrono in fila (Oggi → setup → timer → debrief → fine → Oggi; Oggi → Crea → Oggi). Nell'app gli stessi passaggi sono navigazione e stato condiviso, non parametri.

| Parametro | Dove | Effetto |
|---|---|---|
| `?dopo=sessione&esito=done\|continue\|back\|skip` | S1 Mobile e Desktop | card della sessione nel mazzo con l'esito, «Completate» e «Focus» aggiornati, toast «Esito registrato» |
| `?nuovo={titolo}&prio=alta\|normale\|bassa` | S1 | todo senza orario in fondo al suo gruppo, toast «Todo creato» con «Annulla» |
| `?creato=todo\|study\|routine\|event\|modifica` | S1 | toast informativo |
| `?sessione=1` | S1 | banner (mobile) o carta (desktop) «Sessione in corso» |
| `?view=…`, `?kind=…`, `?screen=…`, `?filled=false` | S4, S5, S15, S20 (Mobile e Desktop) | stessa prop della tavola |