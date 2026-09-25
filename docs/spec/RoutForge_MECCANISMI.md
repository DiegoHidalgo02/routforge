# RoutForge — Meccanismi

*Regole, stati, soglie e transizioni che governano ogni funzione descritta in `RoutForge_FUNZIONALITA.md`. Ogni regola è un vincolo di comportamento: l'app costruita deve rispettarla.*

---

## 1. Modello dei dati

**Entità**

| Entità | Cosa rappresenta | Note |
|---|---|---|
| Corso → Modulo → Unità → Sezione → Risorsa | L'albero del materiale importato | Creato a ogni import |
| Ricorrenza | La *definizione* di una routine (giorni, orari, corso, fasi, promemoria, date) | Non compare mai sul calendario da sola |
| Blocco | Una singola occorrenza sul calendario: todo, evento, istanza di routine, istanza di routine di studio | È ciò che si spunta, si perde, si completa |
| Sessione | Una sessione del timer (avvio, fine, focus, pause, segmenti, esito) | Sorgente delle statistiche di studio |
| Log fasi | Fotografia delle fasi al completamento di un'occorrenza | Chiave = occorrenza; riscrittura idempotente |
| Mazzo → Carta | Flashcard con stato SM-2 | |
| Quiz / Pratica | Domande generate (quiz), carte DevSwipe, esercizi Bug Hunter, playlist Trivia, con risultati | |
| Conversazione → Messaggio | Cronologia chat AI | |
| Materiale (+ binario) | Link / nota / PDF dell'utente su un'unità | Il PDF binario sta separato dai metadati |
| File di codice | Sorgenti caricati per un'unità o una sessione libera | Solo contesto AI |
| Registro notifiche | Chiave logica → id nativo delle notifiche armate | Derivato: ricostruito a ogni riconciliazione; mai nel backup né nella sincronizzazione |
| Preferenze e stato | Impostazioni (con inizio settimana e lingua delle risposte), streak, sessione attiva, ultima apertura, modello AI, account (email, nome facoltativo) | |

**Stati di un blocco**: `programmato` · `in corso` · `completato` · `parziale` · `indietro` · `saltato` · `perso`. I primi due sono aperti; gli altri terminali. Un `perso` di routine/studio resta recuperabile (§8); un `perso` todo resta spuntabile (§3).

**Stati di un'unità**: `non iniziata` · `parziale` · `da rivedere` · `completata` · `saltata`. Le prime tre sono "pendenti" e alimentano il puntatore (§11).

**Tempo**: ogni istante è assoluto; il *giorno* di un blocco è il giorno **locale** dell'inizio. I blocchi senza orario hanno ancore fisse — todo 12:00–23:59, evento 00:00–23:59 — che non valgono come tempo pianificato. Ogni record ha un istante di ultima modifica (usato dalla sincronizzazione, §25).

---

## 2. Creazione: campi e vincoli

| | Todo | Evento | Routine | Routine di studio |
|---|---|---|---|---|
| Obbligatorio | titolo | titolo | titolo + ≥1 giorno | ≥1 giorno (titolo default "Studio") |
| Orario | opzionale (default: senza orario) | opzionale (tutto il giorno) | inizio + fine, o senza durata | inizio + fine |
| Durata | gradini 5,10,15,20,25,30,40,45,50,60,75,90,105,120,150,180,210,240 min | fine ≤ inizio ⇒ errore «La fine deve venire dopo l'inizio», l'evento non si crea | fine ≤ inizio ⇒ giorno dopo | idem |
| Data | nessuna: il todo parte da oggi | sì | — | — |
| Orizzonte | giorno / settimana / mese (default giorno) | — | — | — |
| Priorità | solo senza orario: alta / normale (default) / bassa | — | — | — |
| Fasi | — | sì | sì | no |
| Checklist | sì | — | — | — |
| Date ricorrenza | — | — | inizio (default oggi); fine: mai, o dopo N giorni/settimane/mesi | idem |
| Promemoria | override per istanza; **senza orario: nessun override** (solo digest) | override | override sulla definizione, ereditato dalle istanze | idem |
| Luogo | — | sì | — | — |
| Corso | — | — | — | opzionale (consigliato) |

---

## 3. Spunta e completamento

Ogni completamento passa da **un'unica operazione**: scrive lo stato (`completato` + istante, oppure `programmato` + istante azzerato) e, rispettivamente, **cancella** o **ri-arma** le notifiche del blocco.

| Tipo | Spunta diretta | Quando è consentita |
|---|---|---|
| Todo | sì | sempre: qualsiasi giorno, anche se `perso` |
| Routine | sì | solo se il giorno locale dell'inizio è oggi, **oppure** (routine a cavallo di mezzanotte) l'istante corrente è dentro [inizio, fine]. Mai prima, mai dopo |
| Routine di studio | no | solo tramite esito (§10–11) |
| Evento | no | "Completa evento" dal dettaglio, senza vincolo di giorno |

**Flusso todo/routine**: non consentita → nessuna scrittura; routine con fasi nella definizione → si apre la revisione fasi e si scrive solo al Conferma; altrimenti completamento immediato. **Annulla spunta** («Riapri» nel dettaglio, per todo e routine): elimina l'eventuale log fasi dell'occorrenza, torna `programmato`, ri-arma le notifiche; nel todo azzera le spunte della checklist.

**Evento**: con fasi → revisione; senza → completamento immediato. Stato mostrato: `completato` se scritto; altrimenti `concluso` se la fine è passata; altrimenti `programmato`. Mai `perso`.

---

## 4. Checklist (todo)

- Massimo 60 voci, 120 caratteri l'una; voci vuote scartate; ordine per posizione.
- La spunta di una voce inverte solo quella. Poi: tutte spuntate e todo non completato → il todo si **completa** (operazione di §3); una despuntata su todo completato → il todo **si riapre**; lista vuota **non** è "tutto fatto".
- **Spunta diretta** (§3): tutte le voci risultano fatte. Con voci non spuntate si può, a scelta, creare **un solo todo con le voci rimaste**: stesso titolo, note, priorità, corso e orizzonte, senza orario, nel giorno del todo ma mai prima di oggi (stessa scadenza); in quel caso il todo d'origine si completa lasciando le voci com'erano.
- Modificare la lista (aggiungi/rinomina/elimina) non tocca lo stato del todo.
- Lo spostamento di giorno del todo conserva le spunte.

---

## 5. Fasi (routine ed eventi)

- **Template** sulla definizione: voci con identificatore stabile, etichetta, ordine. Rinominare/riordinare non spezza la storia.
- **Completamento a inversione**: tutte `fatte`; l'utente marca le `saltate`; Conferma.
- **Log**: fotografia `[id, etichetta, stato]` di tutte le fasi del template. Chiave dell'occorrenza: routine → `ricorrenza + istante d'inizio`; evento → identificatore dell'evento. Ricompletare **sovrascrive**.
- Occorrenza persa → **nessun log**.
- **Follow-up (solo eventi)**: per ogni fase saltata, a scelta, un todo con il titolo della fase, senza orario, nel giorno dell'evento ma mai prima di oggi, orizzonte giorno.
- Dettaglio di un'occorrenza chiusa: vale il log (etichette congelate); senza log: template corrente, stato nullo.
- Statistiche: aggregazione per identificatore; etichetta = la più recente; tasso = fatte/totali.
- Eliminare la routine/l'evento elimina i log.

---

## 6. Todo: orizzonte, spostamento automatico, ritardo

**Orizzonte** (ultimo giorno incluso), a partire dal giorno di creazione: giorno → quel giorno; settimana → ultimo giorno della settimana (la domenica, o il sabato se in Impostazioni la settimana inizia di domenica); mese → ultimo giorno del mese.

**Spostamento a oggi** (a ogni ciclo, §9): todo `programmato`, orizzonte ≠ giorno, giorno passato, ancora entro l'orizzonte:
- senza orario → ancora 12:00 di oggi;
- con orario → **slot libero** in 08:00–22:00, stessa durata: (1) l'orario originale se libero; (2) il primo varco ≥ durata partendo da *adesso*, scorrendo i blocchi `programmati`/`in corso` con orario; (3) ripiego sull'orario originale anche se sovrapposto, o sull'inizio finestra.

**Diventa "non fatto"** (`perso`): orizzonte giorno, o orizzonte scaduto, non completato → dopo fine + 30' (fine = orario+durata, o 23:59 se senza orario). Resta spuntabile.

**Notifica "todo in ritardo"**: una volta per todo, ~10 s dopo lo spostamento o la marcatura, canale silenzioso, azioni Segna fatto / Posticipa.

**Ordine nella fascia senza orario**: alta → normale → bassa, poi inizio. La fascia senza orario precede sempre i blocchi con orario.

---

## 7. Routine: generazione delle occorrenze

- **Orizzonte 28 giorni**: alla creazione e a ogni ciclo, per ogni ricorrenza attiva (fine assente o ≥ oggi), si creano le occorrenze mancanti da oggi a oggi+28 nei giorni selezionati.
- **Idempotenza**: nessuna occorrenza duplicata per la stessa ricorrenza e lo stesso istante d'inizio; generazioni concorrenti serializzate.
- **Filtri**: data inizio, data fine, date saltate (confronto per giorno locale).
- Fine ≤ inizio → fine il giorno dopo (solo routine e routine di studio; l'evento lo rifiuta, §2). Senza durata (solo routine) → occorrenza senza fine, scade alle 23:59.
- **Ereditati**: titolo (default "Studio"), note, override promemoria. Le fasi restano sulla definizione.
- **Routine di studio senza corso**: le occorrenze sono blocchi di studio senza unità (nessun puntatore); l'unità si sceglie nel setup della sessione, fra quelle di qualsiasi corso o nessuna.
- **Modifica**: elimina solo le occorrenze future `programmate` (inizio > adesso), aggiorna la definizione, rigenera, ricalcola il puntatore se c'è un corso, riconcilia le notifiche. Passato e completato restano.
- **Eliminazione**: rimuove tutte le occorrenze `programmate` (anche passate), la definizione e i log fasi; le occorrenze completate/perse restano nelle statistiche.

---

## 8. Blocchi persi, recupero, orfani

**Marcatura `perso`** (a ogni ciclo): blocco `programmato`, non evento, non todo entro orizzonte, con fine effettiva (fine reale, o 23:59 del giorno se senza durata) passata da **> 30 minuti** → `perso` + istante. Per i corsi coinvolti si ricalcola il puntatore.

**Notifica "blocco perso"**: solo routine/studio, solo se la fine è entro le ultime **2 ore**, una volta per blocco, canale silenzioso, ~10 s dopo; per lo studio con azione Registra esito.

**Scadenza di recupero** = fine − 50% della durata (senza durata: inizio + 30'). A quell'istante scatta la notifica di **verifica** se il blocco non è stato avviato né chiuso. Il blocco resta avviabile in **recupero** finché non è `perso`, e anche dopo: un esito registrato lo riabilita e azzera la marcatura.

**Esiti pendenti** (schermata Notifiche + badge): blocchi di studio `persi` negli ultimi **3 giorni** o `programmati` con fine reale passata; dal più recente; massimo 5. Sotto, **Ieri · gestite**: le notifiche consegnate o gestite il giorno prima (dal registro). **Segna tutte lette** toglie il segno di novità dalle voci; gli esiti pendenti restano finché non si registrano.

**Orfani `in corso`**: un blocco resta `in corso` solo mentre la sessione attiva lo punta. A ogni ciclo, prima di marcare i persi, ogni `in corso` non collegato alla sessione attiva con fine passata da > 30' torna `programmato`. Un abbandono di sessione riporta subito il blocco a `programmato`.

---

## 9. Cicli dello scheduler

**Quando**: avvio dell'app; ritorno in primo piano; cambio di giorno (controllo ogni 60 s sulla data locale); creazione/modifica/eliminazione di routine.

**Ordine (vincolante)**: estensione ricorrenze → spostamento todo → reset orfani → marcatura persi → riconciliazione notifiche → avvisi "perso" e "in ritardo" → aggiornamento streak. Motivo: i todo spostati non vanno giudicati persi; gli orfani vanno riportati a `programmato` prima del giudizio; le notifiche si riconciliano su tutto.

**Ritorno dopo assenza**: se dall'ultima apertura sono passati ≥ 2 giorni e c'è almeno un corso, messaggio una tantum (l'istante di ultima apertura si aggiorna subito).

---

## 10. Sessione di studio

### 10.1 Contesto di avvio (deciso dall'orologio)

| Contesto | Condizione | Effetto |
|---|---|---|
| **anticipo** | blocco `programmato` e adesso < inizio − 5' | sessione libera; il blocco resta intatto. "Anticipa sessione" (dall'unità) sposta il blocco ad adesso con la stessa durata, registra i minuti di anticipo, ri-arma le notifiche, poi si entra nel setup |
| **routine** | adesso < fine | fine ancorata all'orologio; ritardo = adesso − inizio; blocco → `in corso`; notifica di verifica cancellata |
| **recupero** | fine passata, o blocco `perso` | durata scelta (25/50/90, personalizzata, cronometro); ritardo registrato; blocco → `in corso` |
| **libera** | nessun blocco | nessun effetto sui blocchi |

Vincoli: una sola sessione attiva (avviare con una in corso → si rientra in quella). Dall'unità: "Inizia" solo se il blocco è di oggi; blocco `completato` → ripasso (sessione libera senza blocco); `parziale`/`in corso` → ripresa. Materia: blocco con unità puntata → quella; blocco senza corso → scelta libera (corso → unità corrente, o prima non completata/saltata; oppure nessuna); libera → nessuna.

### 10.2 Regimi temporali
Durate sempre derivate da istanti assoluti. Focus = tempo trascorso − pause.
- **Ancorata all'orologio** (routine/recupero con fine): fine = fine del blocco; la pausa non la sposta.
- **Ancorata al focus** (libera con durata): finisce quando il focus raggiunge la durata.
- **Cronometro**: mai finita.

### 10.3 Pomodoro
Preset 25/5, 50/10, 90/20. Segmenti studio/pausa tassellano la durata (ultimo troncato; senza durata: 4 cicli). Segmento scaduto → avanza da solo (non l'ultimo); "salta" congela il focus reale del segmento. Le pause contano nel totale. Ogni segmento di studio può avere un'unità diversa; il tempo si attribuisce per unità, l'esito resta sull'unità pianificata.

### 10.4 Durante
Schermo acceso; interruzioni annotabili; notifica "tempo scaduto" alla fine per le sessioni ancorate all'orologio. **Tempo extra**: oltre la durata pianificata il timer prosegue in positivo senza allarme; i minuti extra contano nel focus reale e vengono riportati a parte nel riepilogo e nelle statistiche. **Iperfocus** (solo la modalità a uscita bloccata): schermo intero, uscita bloccata fino alla fine con l'ora di sblocco visibile, Non Disturbare di sistema se il permesso è concesso (altrimenti l'iperfocus vale comunque); un tentativo di uscita chiede conferma; uscita confermata = uscita forzata = interruzione etichettata "iperfocus".

### 10.5 Chiusura
Tipo: `completata` (traguardo raggiunto) · `terminata prima` · `abbandonata` (nessun esito; blocco → `programmato`). Riepilogo: focus, tempo extra, minuti di pausa-segmento, numero e minuti di pause, interruzioni, minuti per unità, segmenti completati.

---

## 11. Esiti e puntatore

**Registrazione**: "conta nel piano" default sì se la sessione nasce da un blocco; per una libera, sì se è stata scelta un'unità. Se conta senza blocco → si crea un blocco di studio retroattivo (inizio/fine della sessione). Se non conta e il blocco era `in corso` → `programmato`. Da "Registra esito" senza sessione: minuti = durata pianificata (0 se Salta o senza durata); routine generiche senza confidenza.

| Esito | Blocco | Unità | Progresso unità |
|---|---|---|---|
| Completata | `completato` | `completata` | 1 |
| Continua | `parziale` | `parziale` | min(0,95; minuti totali / (ore stimate × 60, o 180 se non stimate)) |
| Indietro | `indietro` | `da rivedere` (l'unità precedente se indicata, altrimenti quella pianificata) | invariato |
| Salta | `saltato` | `saltata` | invariato |

Sempre: minuti accreditati all'unità principale (ripartizione per unità se presente), confidenza 1–5 sull'unità, nota sul blocco, marcatura "perso" azzerata, altre unità toccate ricevono solo minuti. **Blocco di studio senza unità** (routine senza corso e nessuna unità scelta nel setup): l'esito scrive solo stato, nota e confidenza del blocco; nessuna unità e nessun puntatore; la streak conta.

**Puntatore** (dopo ogni esito, ogni marcatura persa di studio, ogni generazione): unità in ordine modulo → unità; pendenti = `non iniziata`/`parziale`/`da rivedere`; i blocchi di studio futuri `programmati` del corso, in ordine cronologico, ricevono la i-esima pendente (oltre le pendenti: nessuna unità); unità corrente = prima pendente; unità fatte = `completate`. Progresso corso = completate / totali.

---

## 12. Streak

+1 una sola volta al giorno, solo per Completata o Continua su un blocco di studio che conta. Se l'ultimo giorno contato è ieri → +1, altrimenti riparte da 1. Vale solo se l'ultimo giorno contato è oggi o ieri; altrimenti 0.

---

## 13. Notifiche

### 13.1 Livelli
1. **Generale**: spento → tutte cancellate.
2. **Per tipo**: attivo/spento, anticipi, canale silenzioso. Default: todo 30', studio 5', routine 10', evento 15'.
3. **Per istanza**: Auto / Off / Personalizzato (anticipi multipli fra 1 g, 1 h, 30/15/10/5', all'inizio; libero fino a 31 giorni). Le istanze di routine ereditano l'override della definizione.
4. **Sveglie a schermo intero**: solo per istanza, solo anticipi ≤ 7 h, solo blocchi con orario; un anticipo è o notifica o sveglia; se "all'inizio" è sveglia, la notifica puntuale è soppressa.

Nessun anticipo né sveglia dopo la fusione → nessun promemoria.

### 13.2 Trigger

| Tipo | Trigger |
|---|---|
| Studio | "pre" per ogni anticipo > 0 · "inizio" · "verifica" alla scadenza di recupero · "esito" a fine + 10' |
| Routine | "pre" · "inizio" · "verifica" |
| Evento con orario | uno per ogni anticipo, incluso "all'inizio" |
| Evento tutto il giorno | alle 08:00 del giorno |
| Todo con orario | "pre" · "scadenza" all'orario |
| Todo senza orario | nessuno (digest) |

Azioni: studio → Inizia, Posticipa; todo → Segna fatto, Posticipa; esito → Registra esito; altro → Posticipa. La sveglia a schermo intero mostra ora, titolo, orario e tipo del blocco con le stesse azioni del trigger e, per i tipi senza azione specifica, "Apri il blocco" (= tocco). **Posticipa** = +10' con la stessa chiave, rispettando le ore silenziose, solo se lo stato è coerente (`programmato`; `in corso` solo per "esito"; `perso` solo per "in ritardo"). Tocco: si registra l'istante di risposta per quel trigger; "esito"/"perso" → registrazione esito; studio → unità; altro → dettaglio.

### 13.3 Finestra e riconciliazione
- Si armano solo le notifiche che **scattano** entro **14 giorni**; si considerano i blocchi che iniziano entro 14 + 31 giorni. Niente entro 5 s o nel passato.
- Identificatore **deterministico** dalla chiave (trigger + anticipo + blocco): ricalcolare = sostituire.
- **Riconciliazione** (ogni ciclo, ogni mutazione di routine, ogni mutazione di singolo blocco): insieme desiderato → cancellazione di ciò che è nel registro ma non desiderato → ri-armatura. Le notifiche dei blocchi `in corso` sono protette.
- Il permesso di sistema viene richiesto al primo ciclo utile. Canali separati per tipo + silenzioso.
- Sul web: solo con la scheda aperta.

### 13.4 Ore silenziose
Fascia anche a cavallo di mezzanotte. Notifica dentro la fascia → spostata alla fine (giorno dopo se scavalca). Vale per trigger pianificati, digest, posticipi; **non** per gli avvisi one-shot.

### 13.5 Digest
Alla prossima occorrenza dell'orario (default 08:00): todo senza orario di quel giorno + arretrati che si sposteranno a quel giorno. Corpo: conteggio (+ arretrati) e fino a 3 titoli. Vuoto → nessun digest.

### 13.6 One-shot
"Blocco perso", "Todo in ritardo" (~10 s), "Tempo scaduto" (fine sessione ancorata), prova (+6 s).

---

## 14. Blocco "Adesso"

- **Candidati**: non completati/saltati/persi, con orario, adesso ∈ [inizio − 30', fine + 30'].
- **In corso** = `in corso`, oppure adesso ∈ [inizio, fine) (fine esclusa: al confine vince il blocco che inizia). Se nessuno, il primo candidato cronologico.
- **Stato**: minuti mancanti; "adesso"; fine passata → "recupera" (routine/studio) o "orario passato" (todo/evento).
- **Chiusura**: memorizzata per giorno e per blocco; riappare il giorno dopo o con un blocco in corso diverso.

---

## 15. Riprogrammazione per trascinamento (vista Giorno)

- Si trascinano **i todo senza orario e i blocchi `persi` di qualsiasi tipo**, su mobile e su desktop (maniglia a sei punti; su desktop il cursore di presa compare solo su quelle card). Le altre attività non si trascinano.
- I todo senza orario possono essere riordinati nell'elenco attività con drag and drop.
- Rilascio su un orario: il todo diventa `con orario`, inizio agganciato agli spazi liberi fra gli altri blocchi a passi di 5', durata = quella dichiarata o 30' (default del form Crea); durante il trascinamento si mostra la riga di aggancio con orario e durata.
- Rilascio su un altro giorno della striscia settimanale: cambia il giorno, resta senza orario.
- Un blocco `perso` rilasciato su un giorno o un orario futuro torna `programmato` (un blocco con orario lo mantiene se rilasciato su un giorno, lo cambia se rilasciato su un orario); le notifiche dell'istanza vengono ri-armate sul nuovo giorno/orario.
- Annullamento entro 5 s dal toast: ripristina giorno, orario e stato precedenti.

---

## 16. Corsi: import

Formato in `RoutForge_FORMATO_CORSO.md`. Regole di lettura:
- Solo file `.md`; percorsi appiattiti al nome file; serve ≥ 1 file modulo `M<n>-…`; ordine per numero.
- File struttura `00_struttura…` opzionale: titolo = primo H1, sottotitolo = primo H2; senza: primo H1 dei moduli o titolo neutro.
- Modulo senza intestazione valida → saltato con avviso. Unità con intestazione non leggibile → saltata con avviso.
- Ore stimate: euristica `~N h/ore` o intervallo `N–M ore` (media). Difficoltà: alta/media/bassa se dichiarata.
- Sezioni per emoji (📖 teoria · 📺 studio · 🛠 pratica · 🏗 mini progetto) o per bullet in grassetto; "Corso online che sostituisce il modulo" = studio. Risorse = link markdown con descrizione (riga "Descrizione:" o primo paragrafo) e meta (segmento fra "·"). Video YouTube incorporati.
- **Ogni import crea un corso nuovo.** Avvisi mostrati (max 5). Se esiste già un corso con lo stesso titolo, i materiali e i file di codice dell'utente passano al corso nuovo: sulle unità con lo stesso numero, altrimenti a livello di corso.
- **Eliminazione**: cascata completa (moduli, unità, sezioni, risorse, blocchi e ricorrenze del corso, mazzi e carte, quiz e pratiche, conversazioni, materiali e PDF, log fasi, notifiche); se era il corso corrente passa al successivo.

---

## 17. Materiali e file di codice

**Materiali** (per unità): link (protocollo aggiunto se manca); nota markdown; PDF ≤ **20 MB**, binario separato, estrazione testo fino a **40 pagine / 60.000 caratteri** → groundabile; scansionato o estrazione fallita → passivo. Eliminare un PDF elimina il binario. Impostazioni: numero materiali, file, byte.

**File di codice**: esclusi cartelle tecniche, file `.env*`, lock file, log, file di sistema; ammesse le estensioni dei linguaggi comuni e i file noti senza estensione; **500 KB** per file; contatori dei saltati. Contenuto usato solo dall'AI, con priorità sulla teoria.

---

## 18. AI

**Contesto per granularità**: unità → intestazione + markdown integrale + indice risorse + codice + materiali groundabili; modulo → tutte le unità + materiali; corso → panoramica (moduli, unità, concetti core) + materiali del corso.

**Regole al modello**: materiale = fonte principale; integrazione esterna dichiarata; copertura mancante dichiarata; citazioni TEORIA / CODICE / NOTA / LINK / PDF; risposta nella lingua dell'ultimo messaggio (ripiego: lingua del materiale), oppure nella «Lingua delle risposte» fissata in Impostazioni (default Automatica = la regola precedente); fonti citate nella loro lingua; markdown conciso. Streaming interrompibile; cronologia come turni. **Elenco delle conversazioni**: ordinato per ultimo messaggio, raggruppato per età (oggi, ieri, questa settimana, prima), con ambito (unità / modulo / corso / globale), numero di messaggi e data; riaprire una conversazione ne mantiene l'ambito.

**Errori** mappati: chiave assente/non valida; modello fuori piano; limite richieste; blocco di sicurezza.

**Offline**: un messaggio di chat inviato senza rete resta **in attesa** sul dispositivo e parte da solo al ritorno della connessione; finché è in attesa l'invio è spento e l'indicatore di scrittura non compare. Un solo messaggio in attesa per conversazione. Quiz, flashcard e pratiche già generati funzionano offline.

**Generazione**: quantità 5–25 (passo 5); difficoltà facile/media/difficile dove prevista; lingua del materiale; codice fonte primaria se presente. Ciò che non supera la validazione non viene salvato; nessun elemento valido → errore.

| Pratica | Elemento generato | Validazione | Risultato salvato |
|---|---|---|---|
| **Quiz** | domanda, 4 opzioni, indice corretto, citazione | testo presente; ≥ 2 opzioni testuali; indice valido (normalizzato se stringa) | punteggio, percentuale, istante |
| **Flashcard** | fronte, retro, citazione | fronte e retro presenti | stato SM-2 per carta (§19) |
| **DevSwipe** | contenuto (codice / architettura / affermazione, ≤ 12 righe), verdetto `corretto`/`errato`, spiegazione ≤ 2 righe, citazione | verdetto fra i due valori; contenuto e spiegazione presenti | risposte giuste/totali, istante |
| **Bug Hunter** | codice 5–10 righe con linguaggio, numero della riga errata, categoria del bug, codice corretto, spiegazione | riga nell'intervallo; codice corretto diverso dall'originale | punti/totali, istante |
| **Audio Flash-Trivia** | domanda breve, spiegazione ~40–60 parole | entrambe presenti | giuste/totali (saltate = sbagliate), istante |

**DevSwipe**: destra = corretto, sinistra = errato. Risposta sbagliata → vibrazione breve + spiegazione. A fine mazzo gli errori vengono riproposti una volta; punteggio = giuste al primo passaggio / totali.

**Bug Hunter**: tocco sulla riga. Primo tentativo giusto = 2 punti; secondo = 1; altrimenti 0 e soluzione mostrata. Dopo la risposta: codice corretto + spiegazione. Punteggio = punti / (2 × esercizi).

**Fine della pratica** (DevSwipe, Bug Hunter, Trivia): riepilogo con punteggio salvato, elenco delle sbagliate (DevSwipe: dopo la riproposizione; Trivia: gli elementi saltati) e azioni "Rifai la pratica" (nuova pratica con gli stessi parametri) e "Torna all'unità".

**Audio Flash-Trivia**: per ogni elemento: lettura vocale della domanda → 5 s di silenzio → lettura della spiegazione → elemento successivo, senza tocchi. Voce di sistema nella lingua del materiale. Continua con schermo spento; comandi play/pausa/salta/stop; termina a fine playlist. **Punteggio**: un elemento saltato con «salta» conta come sbagliato, gli altri come giusti; punteggio = giuste / totali con la percentuale. Le sbagliate tornano una volta nella playlist successiva della stessa unità.

---

## 19. SM-2

| Valutazione | Facilità | Prossimo intervallo |
|---|---|---|
| Niente | −0,20 | 10 minuti; la carta torna in coda nella sessione |
| Difficile | −0,15 | max(1 g, intervallo × 1,2) |
| Bene | 0 | max(1 g, intervallo × facilità) |
| Facile | +0,15 | max(1 g, intervallo × facilità × 1,3) |

Facilità iniziale 2,5, mai sotto 1,3; intervallo iniziale 0 (carta dovuta subito); prima valutazione parte da 1 g. Scadenza = adesso + intervallo. Ripasso trasversale = tutte le carte con scadenza ≤ adesso, dalle più scadute. I quattro bottoni mostrano solo l'etichetta del grado, non l'intervallo calcolato.

---

## 20. Statistiche: definizioni

Periodi 7/30/90/tutto. Blocchi del periodo = inizio nel periodo; sessioni del periodo = avvio nel periodo; concluse = con fine.

**Panoramica**: **focus** = somma del focus delle sessioni concluse (ripiego: minuti accreditati alle unità se non esiste alcuna sessione), con il delta sul periodo precedente di pari durata e le barre per settimana; **costanza** = streak attuale (§12) in giorni, con il record; **sessioni** = numero di sessioni concluse e durata media; **disciplina** = completati / (completati + persi + saltati), globale con il delta sul periodo precedente e per tipo; **giorni con attività** = giorni distinti con blocchi completati/parziali sugli ultimi 84, con la mappa di calore (minuti dei blocchi completati/parziali, senza orario e senza durata = 0, scala relativa al massimo con minimo 60'); **per corso** = unità completate / totali e percentuale.

**Comportamenti**: fasce 06–12 / 12–18 / 18–24 / 00–06 dal focus delle sessioni, altrimenti dalla durata dei blocchi completati/parziali (mai entrambe); minuti per giorno della settimana; costanza = giorni attivi per settimana su 4–12 settimane, media senza la settimana corrente; persi: tasso = persi / (completati + persi), andamento settimanale sul giorno previsto, giorno e tipo peggiori; trigger: blocchi con scadenza di recupero passata senza avvio/chiusura prima; "risposto" = tocco registrato, o avvio/chiusura dopo, o esito Completata/Continua; tasso di recupero; persi dopo l'avviso; routine senza durata: tasso di completamento; fasi: tasso per fase, più saltate, salti per settimana.

**Studio**: focus, iperfocus (sessioni su totali, tempo extra) e puntualità in testa; esiti (Completata / Continua / Indietro / Salta+persa); focus reale vs pianificato (efficienza = focus / durata pianificata sulle sessioni con piano), pause; ritmo (sessioni pomodoro, segmenti, pause, interruzioni); minuti per unità; tempo extra = minuti oltre la durata pianificata, sommati sul periodo; iperfocus (sessioni, minuti, uscite d'emergenza = interruzioni "iperfocus", abbandoni), con il tempo extra delle sessioni in iperfocus come meta; puntualità (ritardo medio, % blocchi di studio avviati con ritardo ≤ 5', ritardi > 5', anticipo medio e conteggio degli anticipi).

**Pratica**: quiz = media delle percentuali; DevSwipe e Bug Hunter = media dei punteggi; Trivia = playlist completate; flashcard = valutazioni date e carte scadute oggi.

---

## 21. Widget e collegamenti diretti

Contenuto ricalcolato a ogni cambiamento di blocchi e al ritorno in primo piano; aggiornato solo se il contenuto cambia:
- mini mese: weekend attenuati, oggi in bianco, un pallino sui giorni con almeno un blocco nel colore del tipo prevalente (a parità: studio, routine, todo, evento);
- agenda di oggi (le prime righe che entrano nel 4×2, completati barrati);
- «Prossima: …»: il prossimo blocco con la regola di §14, altrimenti il primo futuro con orario;
- «+» che apre la creazione.

Collegamenti: sessione (timer se attivo, altrimenti setup); ripasso; oggi; creazione; blocco (studio → unità, altro → dettaglio); todo. Aperture duplicate entro 1,5 s ignorate.

**Sveglie a schermo intero**: insieme desiderato (14 giorni, anticipi ≤ 7 h, blocchi con orario), identificatore deterministico, aggiornate solo se cambiano, persistite al riavvio del dispositivo.

---

## 22. Backup

- **Export**: tutto tranne il registro notifiche; PDF codificati nel file.
- **Import**: conferma → cancellazione notifiche pendenti → azzeramento → scrittura (la sessione attiva del giorno del backup non viene ripristinata) → ricarica. Backup senza PDF importabili.
- Eliminazione di tutti i dati: azzeramento completo (i dati remoti restano finché non si cancellano dall'account).

---

## 23. Lingua e diagnostica

- **Lingua**: prima lingua del dispositivo, in ordine di preferenza, fra it/en/es/pt/fr/de; altrimenti en. Immutabile per la vita del processo.
- **Diagnostica**: permessi, stato notifiche (permesso, allarmi precisi, pendenti, voci nel registro, prossima, ultimo errore, ultima riconciliazione), scala testo, riduzione animazioni, margini schermo, stato account e ultima sincronizzazione; spazio locale per categoria con **Svuota cache** (solo dati rigenerabili: cache dell'app web e anteprime; mai dati dell'utente); sul web **Reinstalla PWA** (deregistra il service worker e ricarica); copiabile. Si apre da Impostazioni → Avanzate.
- **Informazioni**: versione dell'app (dalla build), in Impostazioni → Avanzate.

---

## 24. Ordinamento e visibilità nel calendario

- Giorno: su mobile fascia senza orario (per priorità) → blocchi con orario (cronologici); su desktop blocchi con orario → fascia senza orario in coda. Su mobile i completati si impilano in testa al giorno (archivio compatto apribile).
- Settimana: inizia dal giorno scelto in Impostazioni (lunedì default, o domenica).
- Blocchi terminali (completato, saltato, perso) restano nel giorno, in secondo piano; i persi/saltati non sono spuntabili salvo i todo.
- Settimana/Mese: per ogni giorno, conteggio e tipo dei blocchi; il mese mostra i giorni con carico.
- I blocchi senza orario non occupano "Adesso" e non contano nei totalizzatori di minuti.

---

## 25. Sincronizzazione fra dispositivi

**Account**: email + codice di verifica inviato via email; nessuna password. Un account per utente, più dispositivi.

**Cosa si sincronizza**: blocchi (tutti i tipi, con stati, esiti, note, checklist, override promemoria, istanti di completamento/marcatura), ricorrenze (con fasi e date), log fasi, impostazioni (notifiche, modello AI, chiave AI, preferenze). **Non si sincronizza**: corsi, materiali, file di codice, sessioni, quiz/pratiche, mazzi/carte, conversazioni, registro notifiche, sessione attiva, streak (ricalcolata localmente dai blocchi).

**Identità**: ogni record ha un identificatore univoco globale e un istante di ultima modifica; le eliminazioni sono registrate come record cancellati (non sparizioni) e propagate.

**Conflitti**: vince la modifica più recente, per record. Un blocco completato su un dispositivo e modificato su un altro nello stesso momento → prevale l'istante più recente; la spunta e le notifiche seguono lo stato risultante.

**Corsi e routine di studio**: la ricorrenza porta un'impronta del corso (titolo + contenuto). Sull'altro dispositivo il collegamento si risolve se esiste un corso con la stessa impronta; altrimenti le occorrenze compaiono come blocchi di studio senza unità e "Inizia sessione" apre il setup in modalità libera. Al primo import del corso corrispondente, il collegamento si ristabilisce e il puntatore si ricalcola.

**Quando**: all'avvio, al ritorno in primo piano, dopo ogni modifica (raggruppata entro pochi secondi), e su richiesta ("Sincronizza ora"). Offline: le modifiche si accodano e partono alla prima connessione; nessuna funzione è bloccata.

**Dopo ogni ricezione**: si eseguono i cicli dello scheduler (§9) — le occorrenze ricevute vengono giudicate, le notifiche riconciliate, il widget aggiornato.

**Primo accesso su un dispositivo con dati locali**: i dati locali vengono caricati sull'account e fusi con quelli remoti (stesse regole di conflitto); nulla viene perso.

**Dispositivi**: l'account elenca i dispositivi collegati (nome, piattaforma, ultima attività); «Scollega» revoca l'accesso di un altro dispositivo, che smette di sincronizzarsi finché non rientra con un nuovo codice. Il dispositivo in uso non si scollega da qui (si usa l'uscita).

**Uscita dall'account**: i dati restano sul dispositivo e smettono di sincronizzarsi. **Cancellazione dei dati remoti**: rimuove tutto dall'account, non dal dispositivo.

**Trasporto**: cifrato; l'app non condivide nulla con terzi oltre al servizio di sincronizzazione e al fornitore del modello AI.
