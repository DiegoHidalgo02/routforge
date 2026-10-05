# RoutForge — Stati

Come lo stato di dominio diventa ciò che si vede. Per ogni oggetto: stati salvati, transizioni, stati mostrati e la prop del mock che li disegna. Regole in MECCANISMI (M§).

## 1. Blocco

**Salvati** (M§1): `programmato` · `in corso` (aperti) · `completato` · `parziale` · `indietro` · `saltato` · `perso` (terminali). I persi di routine e studio restano recuperabili; i todo persi restano spuntabili.

| Evento | Da → a | Condizione | M§ |
|---|---|---|---|
| Spunta todo | programmato · perso → completato | sempre | 3 |
| Riapri (todo, routine) | completato → programmato | azzera la checklist, elimina il log fasi, ri-arma le notifiche | 3 |
| Fatta (routine) | programmato → completato | solo nel giorno; con fasi passa dalla revisione | 3, 5 |
| Saltata (routine) | programmato → saltato | solo nel giorno | 3 |
| Completa evento | programmato → completato | con fasi passa dalla revisione; l'evento non è mai perso | 3 |
| Avvio sessione (routine, recupero) | programmato · perso → in corso | contesto deciso dall'orologio | 10.1 |
| Anticipa sessione | programmato → programmato, spostato ad adesso | poi il setup | 10.1 |
| Esito | in corso · programmato · perso → completato · parziale · indietro · saltato | Completata · Continua · Indietro · Salta | 11 |
| Abbandono | in corso → programmato (focus < 65 %) · parziale con Continua (≥ 65 %) | solo sessioni con blocco e durata | 10.5 |
| Ciclo dello scheduler | programmato → perso | fine effettiva + 30' passata; non eventi; todo solo con orizzonte giorno o scaduto | 6, 8 |
| Ciclo dello scheduler | in corso orfano → programmato | non legato alla sessione attiva, fine + 30' passata | 8 |
| Ciclo dello scheduler (todo) | giorno passato → oggi | orizzonte settimana o mese non scaduto | 6 |
| Elimina | → record cancellato | routine: solo questa o tutta | 7 |

**Mostrati** (prop `state` di S5):

| Stato mostrato | Tipi | Regola | Azioni nel Dettaglio |
|---|---|---|---|
| `oggi` | tutti | programmato, giorno = oggi (studio: da 5' prima dell'inizio) | studio Avvia sessione · routine Fatta · todo Segna come fatto · evento Completa evento |
| `anticipo` | studio | programmato e adesso < inizio − 5' | Anticipa sessione · Sessione libera |
| `in corso` | studio | sessione attiva sul blocco | Riprendi sessione |
| `parziale` | studio | esito Continua | Riprendi |
| `completato` | tutti | | studio Ripasso · sessione libera; todo e routine Riapri |
| `indietro` · `saltato` | studio (`saltato` anche routine) | | Ripasso · sessione libera |
| `recupera` | studio (routine: solo nella card Adesso) | fine passata da meno di 30', non gestito | Recupera · Registra esito |
| `perso` | todo («Non fatto»), routine, studio | M§6, M§8 | todo spuntabile; routine di oggi Fatta o Saltata fino alle 23:59, di altri giorni nessuna; studio Registra esito · Recupera |
| `concluso` | evento | fine passata, non completato | Completa evento |
| `altro-giorno` | routine, studio | giorno diverso da oggi | routine Fatta spenta con il motivo; studio Sessione libera sull'unità |

**Sulla card di S1**: da fare (cerchio vuoto) · in corso (pallino con alone, ora bianca, bordo `#334156`) · Card Adesso · completata (nell'archivio) · persa o saltata (in secondo piano) · sollevata (`drag=lift`, solo todo senza orario).

## 2. Card Adesso e giornata (S1)

- **Scelta** (M§14): candidati non completati, saltati o persi, con orario, con adesso fra inizio − 30' e fine + 30'. In corso = `in corso`, oppure adesso fra inizio e fine (fine esclusa: al confine vince chi inizia); altrimenti il primo candidato in ordine di tempo. Routine senza durata: fine 23:59 (D-NOW-1).
- **Tipo → prop `nowKind`**: `study` (play) · `todo` · `routine` · `event` (cerchio 28). Con `now=recupera` solo studio e routine diventano hero.
- **Stato → prop `now`**: `mancanti` «Tra poco» · `adesso` «Adesso» · `recupera` «Da recuperare» (routine, studio) · `passato` (todo o evento con fine passata): nessuna card diventa hero.
- **Resa**: su mobile la card cresce `strikeDelay` ms dopo l'apertura (900); su desktop è già hero. Non si chiude.
- **Giornata** (`variant`): `default` · `empty` nessuna attività nel giorno · `done` tutte le attività del giorno chiuse, «Giornata chiusa» come card di pagina sotto il mazzo. Si raggiunge anche dal vivo: l'ultima spunta del giorno apre la stessa card.
- **Archivio** (`archive`): `stacked` completate impilate in testa · `open` aperte con un trascinamento in giù, richiuse con uno in su.
- **Spunta dalla lista** (cerchio della card, ogni tipo; i passaggi richiesti compaiono prima: voci rimaste `sheet=voci`, revisione fasi `sheet=fasi`, esito dello studio `sheet=esito`): `da fare` → `spunta` (cerchio success, spunta disegnata, 560 ms) → `chiusura` (la riga si chiude, 260 ms) → `nel mazzo` (la card atterra davanti, «Completate» +1, toast «Fatto · …» con «Annulla» per 5 s). «Annulla» riporta a `da fare`. Con voci aperte: `da fare` → foglio «Voci rimaste» (`sheet=voci`) → `spunta`; tocco fuori dal foglio → `da fare`. Celebrazioni (`celebration`): `sobria` · `piena` (coriandoli) · `off` (nessuna animazione, stessi stati).
- **Creazione** (S1 `crea`, foglio aperto): `aperto` → (trascinamento > 110 px o «Annulla») `chiuso` · (CTA) `rimpicciolimento` → giorno mostrato: `atterrata` · altro giorno: `verso destra` → `scorrimento` (un giorno alla volta) → `entrata da sinistra` · Settimana: `atterrata` nella riga (altra settimana: `verso destra` → `pagina` → `entrata da sinistra`). Mese: `selezione del giorno` → `puntino` → 1 s → `entrata da sinistra`; fuori dal mese `verso destra`. Poi toast con «Annulla» (`annullata` toglie la card). Senza animazioni: `aperto` → `atterrata`.
- **Ritorno da altre schermate** (solo prototipo): `?dopo=sessione&esito=…` card della sessione nel mazzo e toast «Esito registrato» · `?nuovo=…&prio=…` todo nuovo in fondo al gruppo · `?creato=…` toast · `?sessione=1` banner. Il saluto non riparte.
- **Riordino** (solo todo senza orario, solo nella stessa priorità): `drag` `no` · `lift` (mobile e desktop; lo slot d'arrivo resta nel gruppo) · `move` `no` · `hover` · `focus` `attivo` (mobile: tocco sulla maniglia, barra «Sposta su» · «Sposta giù» · «Fine») · (desktop: frecce su e giù con il puntatore sopra la riga o con il fuoco da tastiera; «Sposta su» spenta sul primo del gruppo, «Sposta giù» sull'ultimo).
- **Ritorno dopo assenza** (`absence`): almeno 2 giorni dall'ultima apertura e almeno un corso (M§9), una volta.

## 3. Todo: checklist e voci rimaste

- Voci `fatte / totali`; tutte spuntate → completato; una voce despuntata su un todo completato → riaperto (M§4).
- Segna come fatto con voci aperte → S5 `view=remaining`: «Tutte fatte» completa con tutte le voci; «Crea todo con le voci rimaste» completa l'originale e crea il todo derivato; poi un toast con Annulla. Dal cerchio su Oggi lo stesso foglio si apre sopra Oggi (S1 `sheet=voci`; desktop: pannello 440) e il todo nuovo entra in fondo al suo gruppo di priorità.
- Da notifica o sveglia: con voci aperte si apre `view=remaining`; senza, il todo si completa senza aprire l'app.

## 4. Fasi di routine ed eventi

- Fatta (routine) o Completa evento → `view=review` (fasi nate fatte, si toccano le saltate) → Conferma → completato con il log (`view=done`: «Fatta · N fasi su M»).
- Evento con fasi saltate → `view=followup`: un todo per fase saltata → toast con Annulla.
- Riapri elimina il log.

## 5. Eliminazione

- Todo ed evento: Elimina → toast «Eliminata» con Annulla per 5 s (nelle tavole `view=deleted`).
- Routine e routine di studio: Elimina → `view=delete` (Solo questa · {giorno} / Tutta la routine / Annulla) → toast «Occorrenza eliminata» o «Routine eliminata» con Annulla.

## 6. Unità, modulo, corso

- **Unità** (M§1, M§11): `non iniziata` · `parziale` · `da rivedere` · `completata` · `saltata`; le prime tre sono pendenti. L'esito cambia lo stato come nella tabella di M§11. Prop di S12: `unitState`.
- **Puntatore**: la prima unità pendente dei moduli aperti è «Prossima»; le occorrenze future ricevono le pendenti in ordine.
- **Modulo**: aperto o bloccato (Go/No-Go del modulo precedente incompleto). Contatore Go/No-Go `n / N` in warning, `N / N · Go` in success; il criterio automatico non si spunta a mano.
- **Import** (S10 `view`): `empty` → `importing` → `warnings` (fino a 5 avvisi) → `list`; `error` → «Scegli un altro file» → `importing`. Eliminazione: S11 `confirmDelete` → elenco.
- **Routine di studio senza unità** (S5 `course`): `syllabus` unità dal puntatore · `none` senza corso (SCENARI C9) · `missing` corso non importato su questo dispositivo (J3).

## 7. Sessione (S15)

- **Fine** (`done`): «Giorni di fila» = streak dopo l'esito (M§12); badge «+1» solo per Completata o Continua che contano nel piano, altrimenti il valore resta. «Torna a Oggi» riporta la card nel mazzo; «Riduci» lascia la sessione attiva con il banner.

```text
setup ──Inizia──▶ timer (in corso) ⇄ pausa
timer ──fine pianificata (ancorata all'orologio)──▶ tempo extra, conteggio in positivo
timer ──riapertura dopo più di 30' dall'ultimo battito──▶ intervallo non verificato
      ──Conta come studio | Lascia fuori──▶ timer
iperfocus ──Esci──▶ uscita tentata ──Resta──▶ iperfocus
                                  └──Esci comunque──▶ uscita registrata (interruzione «iperfocus»)
timer ──Termina──▶ debrief      iperfocus ──fine──▶ debrief
debrief ──Registra esito──▶ fatto (esito, streak)
debrief ──Abbandona──▶ sotto il 65 %: abbandonata, blocco programmato
                     └ dal 65 %: terminata prima con Continua → fatto
```

| Prop | Valori | Significato |
|---|---|---|
| `view` | setup · timer · iperfocus · debrief · done | fase della sessione |
| `timerState` | running · paused · overrun · unverified | in corso · in pausa · tempo extra · intervallo non verificato |
| `exit` | no · tentativo · registrata | solo con `view=iperfocus` |
| `source` | routine · free · recovery · nocourse | contesto d'avvio (M§10.1): routine · libera · recupero · routine di studio senza corso |
| `mode` | continuous · p25 · p50 · p90 | continua o pomodoro 25/5 |
| `hyper` | sì · no | iperfocus scelto nel setup |
| `tab` | material · ai · notes | scheda del timer su mobile |

Regimi (M§10.2): ancorata all'orologio (routine, recupero con fine: la pausa non sposta la fine) · ancorata al focus (libera con durata: le pause allungano) · cronometro. Unità bloccata in routine e recupero; la libera e quella senza corso scelgono, anche «Nessuna unità». Una sola sessione attiva.

## 8. Notifiche e sveglie

- **Ciclo**: desiderata → armata (registro: chiave = trigger + anticipo + blocco → id nativo) → consegnata → risposta (tocco o azione registrati) · cancellata (riconciliazione, stato cambiato) · posticipata (+10', stessa chiave). Finestra di 14 giorni (M§13.3).
- **Sveglia**: solo anticipi fino a 7 h di blocchi con orario; «verifica», «esito» e avvisi una tantum restano notifiche.
- **Esiti da registrare** (S21 `view` list · empty): entra un blocco di studio perso negli ultimi 3 giorni o programmato con fine passata (al massimo 5, dal più recente); esce quando l'esito è registrato. «Segna tutte lette» toglie solo il segno di novità.
- **Permesso di sistema**: non chiesto → concesso · negato (S22 `notifications-denied`).

## 9. Materiali e pratica (S12, S13, S19)

- **Link e nota**: «+ Link» o «+ Nota» → form in linea (`material=link|note`) → salvato nei Tuoi oppure annullato.
- **PDF**: scelta del file → oltre 20 MB rifiutato (`material=pdf-big`) · estrazione → groundabile (`pdf`) o passivo, scansionato (`pdf-scan`).
- **Generazione** (`genState`): idle → loading → la pratica in S19 · error (nessun elemento valido, nulla salvato) → Riprova.
- **Pratiche**: flashcard fronte → retro → valutazione → … → `flashcard-done` · quiz → quiz-answered → … → `quiz-done` · devswipe (errore: `devswipe-wrong` con spiegazione) → errori riproposti → `devswipe-done` · bughunter (secondo tentativo) → `bughunter-solved` → `bughunter-done` · trivia → `trivia-explain` → … → `trivia-done`.
- **Chat**: risposta in streaming con «Interrompi»; errori `chat-nokey` (chiave assente) · `chat-error` (limite di richieste) · `chat-error-key` (chiave non valida) · `chat-error-model` (modello fuori piano) · `chat-error-safety` (blocco di sicurezza) · `chat-offline` (messaggio in attesa, invio spento); elenco `chat-history` · `chat-history-vuota`.

## 10. Account, sincronizzazione, backup (S22)

- **Accesso**: `login` (email) → `login-code` (codice di 6 cifre) → `account`.
- **Sincronizzazione**: in pari ⇄ in corso («Sincronizza ora») · `account-offline` (modifiche in coda, «Sincronizza ora» spento) · `account-conflict` (conflitto risolto, vince la modifica più recente) · Esci → `login` · Cancella i dati remoti → `account-erase` → `account`.
- **Backup**: Esporta → `backup-export` · Importa → conferma «Sostituisci e ricarica» → ricarica · Elimina tutti i dati → `backup-erase` → app azzerata.
- **Modello AI**: `ai` · `ai-nokey`.

## 11. Stati che si escludono

- `exit` esiste solo con `view=iperfocus`; `timerState=unverified` solo con una sessione aperta.
- `view=delete` solo per routine e routine di studio; `course=none|missing` solo con `kind=study`.
- `source=nocourse` è sempre ancorata all'orologio.
- `now=passato` e `variant=done` non hanno hero; `variant=empty` non ha né archivio né hero.
- In S12 generazione e form dei materiali sono indipendenti: si compila un link mentre la pratica si genera.
- S15 Desktop non disegna `view=iperfocus` né `timerState=unverified`: valgono le stesse regole, con la resa del Panel `wide`.
