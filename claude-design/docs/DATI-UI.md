# RoutForge — Dati della UI

Da dove viene ogni valore che le schermate mostrano. Definizioni in MECCANISMI (M§) e FUNZIONALITA (F§); quando il design mostra un valore che la spec non definisce in modo esplicito, la formula è segnata «derivato» e va confermata se il codice ne ha già una.

## S1 Oggi

| Valore | Da dove viene | Rif. |
|---|---|---|
| Saluto | «Ciao, {nome}» (nome facoltativo dell'account) o «Ciao»; poi la data lunga del giorno scelto | F§2 |
| Striscia dei giorni | settimana del giorno scelto, dall'inizio settimana delle Impostazioni; puntino = tipo prevalente del giorno (a parità studio, routine, todo, evento) | M§21, M§24 |
| Ordine della lista | mobile: fascia senza orario, poi blocchi con orario; desktop: il contrario; nella fascia per priorità e, dentro la stessa priorità, nell'ordine scelto dall'utente; un todo che entra in un gruppo va in fondo | M§6, M§15, M§24 |
| Sub delle card | contesto del tipo: luogo, «Unità {n} · {titolo}», «checklist {fatte}/{totali}», fasi, orizzonte | M§2 |
| Card Adesso | scelta e stato M§14; tipo dell'attività (`nowKind`). Sub: studio corso · unità; todo checklist e orizzonte; routine categoria · fasi; evento luogo. Numero: Tra poco = minuti all'inizio; Adesso = durata e fascia; Da recuperare = ultimo avvio possibile (fine + 30'), con «ultimo avvio» (studio) o «poi risulta persa» (routine) | M§14 |
| Archivio | completati del giorno in ordine di completamento: l'ultimo spuntato davanti | M§24 |
| Toast di Oggi | «Fatto · {titolo}» · «Completato · {n} voci in un nuovo todo» · «Todo creato · {titolo}» · «Esito registrato · {titolo} · {esito}» | TESTI §6 |
| Giornata chiusa | «La tua giornata · {primo inizio} – {ultima fine}» (blocchi con orario); un segmento per attività (con orario in ordine, poi senza), largo quanto i minuti, nel colore del tipo; legenda per tipo con i minuti; «Domani · {ora} · {titolo}» = prima attività del giorno dopo | DESIGN §5 (derivato) |
| Il tuo progresso oggi · Completate | completati / blocchi di oggi, con la percentuale; si aggiorna a ogni spunta e a ogni «Annulla» (anche dalla lista); un todo nato da «Voci rimaste» o da Crea entra nel totale | F§2 |
| · Focus | focus delle sessioni concluse oggi, con il delta in percentuale su ieri | F§2, M§20 (derivato) |
| · Attività completate | completati della settimana corrente, con l'andamento per giorno | F§2 (derivato) |
| Colore dei grafici della terna | il tipo che pesa di più in quella statistica | DESIGN §1 |
| Prossime attività | i prossimi due giorni con attività dopo oggi: orario, titolo, tipo | F§2 |
| Badge «Esiti da registrare» | numero degli esiti pendenti (al massimo 5) | M§8 |
| Banner «Sessione in corso» | tempo del timer e titolo dell'unità della sessione attiva | M§10 |
| Ritorno dopo assenza | almeno 2 giorni dall'ultima apertura e almeno un corso | M§9 |

## S4 Crea

| Valore | Da dove viene | Rif. |
|---|---|---|
| Default | todo; senza orario; orizzonte giorno; priorità normale; promemoria Auto; inizio della ricorrenza oggi; titolo dello studio «Studio» | M§2 |
| Scadenze del todo | Giorno «solo {oggi}» · Settimana «rotola fino a {ultimo giorno della settimana}» · Mese «rotola fino al {ultimo del mese}» | M§6 |
| Durate | gradini da 5 a 240 min | M§2 |
| CTA | attiva quando i campi obbligatori del tipo sono compilati | M§2 |
| Nota di modifica | routine e studio in modifica: valgono dalle prossime occorrenze | M§7 |

## S5 Dettaglio

| Valore | Da dove viene | Rif. |
|---|---|---|
| Meta | todo: scadenza e priorità; routine: fascia, durata, ricorrenza; evento: data, fascia, luogo; studio: corso, giorni, fascia | M§2 |
| OutcomeRow | esito o stato con l'ora, per esempio «Completata · confidenza 4/5 · 45 min» | M§11 |
| Checklist | voci e `fatte / totali` | M§4 |
| Fasi | il template, o il log congelato dell'occorrenza chiusa | M§5 |
| Unità proposta | unità assegnata dal puntatore; progresso del modulo «{fatte} / {totali} unità» | M§11 |
| Suggerimento sotto il footer | secondo lo stato mostrato | STATI §1 |

## S10–S13 Corsi

| Valore | Da dove viene | Rif. |
|---|---|---|
| CourseCard | titolo; numero di moduli e unità; percentuale di unità completate; tempo dedicato (mobile) = minuti accreditati alle unità del corso (derivato); badge «Esempio» per il corso incluso | F§9.3 |
| Corso | per modulo: numero, titolo, tipo, finestra; unità completate su totali; bloccato; Go/No-Go `n / N` | M§11, FORMATO |
| Modulo | «{fatte} / {totali} unità · {%} %»; «Prossima» = unità corrente; criteri | M§11 |
| Unità | «Modulo {nn} · Unità {n}»; stato; «Prossima dal puntatore» se è l'unità corrente; ultima sessione (data, minuti, esito) o «Nessuna sessione»; materiali Tuoi; file di codice e saltati; pratiche recenti | M§11, M§17 |
| PDF | nome, dimensione, pagine; groundabile o passivo | M§17 |

## S15 Sessione

| Valore | Da dove viene | Rif. |
|---|---|---|
| Origine | contesto d'avvio con l'ora (routine 16:00 · libera · recupero · senza corso 20:00) | M§10.1 |
| Unità | dal puntatore, bloccata in routine e recupero; a scelta altrimenti | M§10.1 |
| Durata | della routine (fine − inizio) o preset; «finisce alle {fine}» per le ancorate all'orologio | M§10.2 |
| Timer | tempo residuo, poi tempo extra in positivo; pausa | M§10.4 |
| Segmenti | dal preset del pomodoro | M§10.3 |
| Intervallo non verificato | ora dell'ultimo battito, durata dell'assenza, tempo residuo | M§10.4 |
| Debrief | focus, tempo extra, pause, interruzioni, minuti per unità, segmenti; effetto di «Abbandona» secondo la soglia del 65 % | M§10.5 |
| Fatto | esito e streak | M§12 |
| Giorni di fila (fine sessione) | streak dopo l'esito: +1 una volta al giorno per Completata o Continua che conta nel piano; nei mock 12 → 13 (Statistiche · Costanza 12) | M§12 |

## S19, S20, S21, S22, widget

| Valore | Da dove viene | Rif. |
|---|---|---|
| Ripasso trasversale | carte scadute di tutti i mazzi, dalle più scadute | M§19 |
| Punteggi delle pratiche | quiz, DevSwipe, Bug Hunter, Trivia | M§18 |
| Conversazioni | per ultimo messaggio, in gruppi oggi · ieri · questa settimana · prima, con ambito, messaggi e data | M§18 |
| Statistiche | ogni definizione | M§20 |
| Notifiche | esiti pendenti (tipo, titolo, giorno e ora, motivo) e «Ieri · gestite» dal registro | M§8 |
| Impostazioni | valori a destra delle righe: stato della sincronizzazione, modello AI, data dell'ultimo backup, spazio dei materiali; versione dell'app dalla build in Informazioni | M§17, M§22, M§23 |
| Widget | mini mese, agenda, «Prossima», + | M§21 |

## Scenario dei mock (fixture)

Oggi mercoledì 23 settembre 2026, settimana 21–27. Corso «Syllabus Software Engineer 2026» importato il 16 set: 0.1–0.6 completate, puntatore 0.7; M0 6 / 9 con Go/No-Go 7 / 7 · Go; M1 aperto 0 / 4; M2–M4 bloccati. Tre esiti da registrare. Giornata di S1: Lezione di UI/UX 09:00, Riunione progetto 11:00, Palestra 14:30, Ripasso Modulo 0 16:00–16:45, Leggere 20 pagine 19:00–19:30; senza orario Prepara la valigia e Prenota il treno (alta) e Chiama Marco (normale). Completate 3 / 8. Dati del corso in `design/course-data.js`.
