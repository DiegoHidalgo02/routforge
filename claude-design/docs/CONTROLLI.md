# RoutForge — Inventario dei controlli (bottoni e input)

Ogni controllo interattivo di ogni schermata `S*.dc.html`: cosa fa, quando compare, che stato tocca. Complementare a `HANDOFF.md` (mappa schermate), `design/DESIGN.md` (aspetto dei primitivi), `docs/NAVIGAZIONE.md` (destinazioni e collegamenti diretti) e `docs/STATI.md` (stati). I riferimenti `§N` puntano a `spec/RoutForge_FUNZIONALITA.md`; `MECC §N` a `RoutForge_MECCANISMI.md`.

Convenzioni
- **Tipo**: `primary` (blu, uno per vista) · `secondary` (surface-2 con bordo) · `ghost` (trasparente) · `danger` (rosso) · `icon` (IconButton circolare, `aria-label` obbligatoria) · `chip` (pill selettore, selezionato = bianco) · `toggle` (44×26) · `row` (riga navigabile 44–56) · `input` / `textarea`.
- **Mock**: nei `.dc.html` l'handler cambia solo lo stato locale del mock. "Prodotto" descrive cosa deve fare l'app reale. Il mock collega solo una parte dei controlli: «Cosa fa» descrive sempre il prodotto.
- Ogni controllo ha focus visibile (`--ring-focus`) e touch target ≥ 44 px anche quando misura 32–40.
- Tutte le stringhe passano dal dizionario (sei lingue).

---

## Cornici comuni (Mobile / Desktop)

| Controllo | Tipo | Dove | Cosa fa |
|---|---|---|---|
| Nav "Oggi" · "Statistiche" | tab nav | BottomNav mobile · sidebar desktop | Naviga alla schermata. Attiva = bianco (mobile) / primary-soft (desktop). |
| FAB "+" (`aria-label="Crea"`) | primary 44 circolare | centro della BottomNav | Apre la CreateSheet (S4) sul tipo predefinito `todo`. Unico primary della vista. Su mobile il foglio si apre sopra Oggi e parte dal giorno selezionato (entro oggi + 6, altrimenti oggi). |
| "Crea" | primary | sidebar desktop | Apre il pannello Crea (S4 Desktop, 440 px). |
| Avatar / account (`aria-label="Account"`) | icon 40 | HeaderRoot mobile · fondo sidebar | Apre il menu account: in testa nome (se c'è), email e stato della sincronizzazione; voci Corsi (→ S10) · Esiti da registrare con badge (→ S21) · Account e sincronizzazione (→ S22 `account`) · Impostazioni (→ S22). Tocco fuori dal menu lo chiude. |
| "Indietro" (chevron-left) | icon 40–44 | testa di ogni pannello mobile | Torna al livello precedente della pila (Panel → `onBack`). |
| "Riprendi" (SessionShell) | pill in banner · carta nella sidebar | Mobile: banner "Sessione in corso · 12:41" sotto l'header di ogni schermata quando un timer è attivo (S1, S10, S20 Shell: prop `session`). Desktop: carta "Sessione in corso" sotto "Crea" nella sidebar (S1, S10, S20, come S15 Desktop) | Riapre S15 in `view=timer`. |

---

## S1 — Oggi (`S1 Oggi Mobile`, `S1 Oggi Desktop`) · §2, §13 · MECC §14, §15, §24

| Controllo | Tipo | Cosa fa |
|---|---|---|
| Vista Giorno · Vista Settimana · Vista Mese (`viewGiorno/viewSettimana/viewMese`, aria-label) | icon 32 / segmento | Cambia `view` sulla stessa schermata. Sul mobile il segmentato Giorno|Settimana compare sotto la striscia; Mese cambia il corpo in griglia. Desktop: segmentato `{{ v.pick }}` con etichetta periodo. |
| `‹` / `›` (`prevLabel`/`nextLabel`) | icon | Desktop: periodo precedente / successivo (giorno, settimana o mese secondo la vista). |
| Giorno della WeekStrip (`d.pick`) | chip 30 circolare | Seleziona il giorno: la timeline mostra quel giorno. Selezionato = cerchio bianco, oggi non selezionato = anello. Puntino del tipo dominante sotto. Non è un bersaglio del trascinamento. |
| Cella del MonthGrid (`c.pick`) | cella r12 (desktop) | Seleziona il giorno e torna alla vista Giorno su quella data. |
| Card Adesso (hero, `it.open`) | card r18 nella lista | Mobile e desktop: la card dell'attività in corso cresce a hero nella lista (mobile: scatto `strikeDelay` ms dopo l'apertura, 900; desktop: già hero). Non si chiude. Tocco = S5 Dettaglio. |
| Play 48 sulla card Adesso (`aria-label` = Inizia · Anticipa · Recupera) | primary circolare nel fill del tipo | Solo studio, secondo `now`: `Inizia` apre S15 `setup` (source=routine) sull'unità del puntatore; `Anticipa` sposta l'occorrenza ad adesso e apre il setup (stato `mancanti`, oltre 5 min prima); `Recupera` apre S15 `setup` con `source=recovery` (stato `recupera`, entro 30 min dalla fine). Navigazione non mockata. |
| Cerchio 28 sulla card Adesso (`it.check`, `aria-label` «Segna come fatto» · «Segna come fatta» · «Completa evento») | cerchio bordato nell'ink, target 48 | Todo con orario, routine, evento (`nowKind`): spunta sul posto con il ciclo della lista e toast con «Annulla» («Fatto · …», «Fatta · …», «Evento completato · …»). Todo con voci aperte → «Voci rimaste»; routine o evento con fasi → «Revisione fasi» sopra Oggi («Annulla», «Conferma»: toast «Fatta · 2 fasi su 3»). |
| «Oggi» nella BottomNav (`navToday`) | tab nav | Riporta al giorno di oggi e in cima alla lista; sostituisce il tasto «Oggi» dell'intestazione, eliminato. |
| Cerchio di completamento sulla card (`u.check` · `it.check`, `aria-label="Segna come fatto"`) | button 22 pill (20 su desktop), bordo text-3, area di tocco 44 | Todo senza voci aperte e routine senza fasi: spunta disegnata (250 ms), poi la riga si chiude e la card atterra davanti al mazzo delle completate (desktop: la riga resta al suo posto in secondo piano); «Completate» sale; toast «Fatto · titolo» con «Annulla» per 5 s. Todo con voci non spuntate: apre «Voci rimaste» sopra Oggi. Routine o evento con fasi → «Revisione fasi» sopra Oggi; evento senza fasi → completato; studio → «Registra esito» sopra Oggi (quattro esiti, primary spento finché non si sceglie; senza sessione conta la durata pianificata). Routine e studio di un altro giorno: cerchio spento (.4, «Si segna nel giorno previsto»). L'ultima spunta del giorno apre la card Giornata chiusa. Animazioni secondo Celebrazioni (prop `celebration`: sobria · piena · off). |
| Card attività (tocco) | card 64 (compatta su desktop) | Apre S5 Dettaglio (`kind` = tipo della card, `state` derivato da MECC §1). |
| Maniglia ⋮⋮ sui todo senza orario | button 36×44, sei punti 16 in text-3 | **Unici trascinabili** (MECC §15), **solo per riordinarli** e **solo fra todo con la stessa priorità**: press-and-hold solleva la card (`drag=lift`), uno slot tratteggiato mostra la posizione d'arrivo, che resta dentro il gruppo (rilasciato fuori, il todo torna al suo posto); il rilascio cambia solo l'ordine. Il todo resta senza orario e nel suo giorno: orario, orizzonte e priorità si cambiano solo da Modifica (S4). Un tocco senza trascinare (`u.toggleMove`, `aria-pressed`) solleva la card e apre la barra di riordino (`move=attivo`, WCAG 2.5.7). La card fuori dalla maniglia è il tocco del Dettaglio. |
| «Sposta su» · «Sposta giù» (`it.moveUp` · `it.moveDown`) | icon 28×26 r8 impilate, a destra della card | Solo desktop, solo todo senza orario (WCAG 2.5.7). Compaiono con il puntatore sopra la riga o con il fuoco da tastiera (nelle tavole `move=hover` · `move=focus`). Scambiano il todo con il vicino della stessa priorità; spente (opacità .4, `not-allowed`) sul primo e sull'ultimo del gruppo. Il fuoco segue il todo spostato; una regione live annuncia la nuova posizione. |
| Archivio completate (swipe verticale `archDown/Move/Up`, rotella `archWheel`) | mazzo in testa al giorno | Swipe giù (> 28 px) apre il mazzo (`rf-deal`); swipe su (> 28 px) o rotella verso il basso lo richiude. Durante il gesto il mazzo segue il dito a metà velocità (−20…+35 px). Aperto mostra tutte le completate; si richiude solo con il gesto (nessun tasto «Raccogli», CLAUDE.md). |
| Riga "Domani · 09:00 · …" sulla card Giornata chiusa (`goTomorrow`) | row 48 con chevron | Variante `done`: seleziona il giorno successivo nella striscia. |
| "Crea attività" | secondary 44 | Stato vuoto: apre la CreateSheet. L'unico primary della vista resta il FAB (mobile) o "Crea" (desktop). |
| "Vai ai corsi" | ghost | Stato vuoto senza corso: apre S10. |
| "Chiudi" sull'AbsenceBanner (`dismissAbsence`) | ghost 32 | Chiude il banner "Sei stato via N giorni" (riconciliazione già eseguita). |
| Barra di riordino (`move=attivo`) — «Sposta su» · «Sposta giù» (`moveUp` · `moveDown`) · «Fine» (`moveDone`) | icon 44 r12 · ghost | Solo mobile, solo todo senza orario: scambia il todo con il vicino della stessa priorità; spenti (opacità .4) sul primo e sull'ultimo del gruppo; una regione live annuncia «titolo: posizione 1 di 2, priorità alta». Riordinare non tocca orario, giorno, stato e notifiche. |
| Foglio «Voci rimaste» da Oggi (`sheet=voci`) — «Tutte fatte» (`sheetAll`) · «Crea todo con le voci rimaste» (`sheetSplit`) · tocco fuori (`closeSheet`) | ghost + primary nel fill todo 44 | Come S5 `view=remaining`, senza lasciare Oggi (desktop: pannello 440 a destra). Tutte fatte: il todo si completa con N/N. Crea todo: il todo d'origine si completa e uno nuovo, senza orario, con le voci rimaste, entra in fondo al suo gruppo. Tocco fuori: nessuna scrittura. |
| Toast «Annulla» (`undo`) | ghost 36 nel toast 48 | Annulla l'ultima spunta (la card torna al suo posto con `rf-in`), il todo con le voci rimaste o il todo appena creato da S4. Si chiude da solo dopo 5 s; «Esito registrato» al ritorno dalla sessione non ha «Annulla» (l'esito si corregge dal Dettaglio); registrato dal cerchio sì, come ogni spunta dalla lista. |
| Collegamenti del prototipo | link | FAB → S4 Crea vuoto · Statistiche → S20 · menu → S10, S21, S22 · play della card Adesso → S15 setup · «Riprendi» del banner → S15 timer · card «Prepara la valigia» e card Adesso → S5. Le schermate riportano su Oggi con `?dopo=sessione&esito=…`, `?nuovo=…&prio=…`, `?creato=…`, `?sessione=1` (solo mock, NAVIGAZIONE.md). |
| "Vedi tutte" sulle Prossime attività (`viewSettimana` mobile · `goWeek` desktop) | testuale 12 | Apre la vista Settimana. La terna "Il tuo progresso oggi" non ha link. |
| «Crea attività» negli stati vuoti (settimana libera, mese vuoto; desktop) | secondary 44 | Apre il pannello Crea sul giorno selezionato. |
| Saluto → data | — | Il saluto lascia il posto alla data dopo 2,6 s (`rf-swap`). |

---

## S4 — Crea / Modifica attività (`S4 Crea Panel` + Mobile/Desktop) · §3, §4, §7 · MECC §2

Ordine del form: tipo → titolo → specifiche → scadenza/data → orari → checklist/fasi → promemoria → note → footer. Il CTA nasce al 40 % e passa al fill del tipo quando `ready`.

| Controllo | Tipo | Visibile per | Cosa fa |
|---|---|---|---|
| Tessere del tipo Todo · Studio · Routine · Evento (`t.pick`) | chip 40 con icona | tutti | Cambia il tipo e **reinizializza il form** (`initial({type})`): titolo, orari default, campi specifici. In `mode=edit` il tipo non si cambia. |
| Titolo (`setTitle`) | input underline | tutti | Testo. Placeholder per tipo: "Cosa devi fare?" · "Titolo (facoltativo)" · "Nome della routine" · "Nome dell'evento". Obbligatorio per todo, routine, evento; facoltativo per studio. A fuoco il bordo prende l'ink del tipo. |
| Select "Corso" | select 44 | studio | Sceglie il corso da cui il puntatore propone l'unità. Vuoto = bordo nell'ink del tipo, "Corso" in text-3. apertura elenco non mockata. |
| Priorità Alta · Normale · Bassa (`p.pick`) | chip 32 con pallino | todo **senza orario** | Ordina i todo senza orario in cima al giorno (`priority`). |
| Scadenza Giorno · Settimana · Mese (`d.pick`) | chip 32 con icona + meta | todo | Orizzonte (`due`): "solo mer 15" · "rotola fino a dom" · "rotola fino a fine mese". Sotto compare la meta del selezionato. |
| "Con orario" (`toggleTime`) | toggle 44×26 | todo | On: il todo diventa puntuale (inizio + durata, promemoria puntuali, nascosta la priorità). Off: senza orario, in cima al giorno, solo digest. |
| Durata 5m…4h (`du.pick`, `steps`) | chip 32 scorrevoli | todo con orario | Durata (`todoDur`); la fine calcolata compare a destra (`todoEnd`). |
| Giorni L M M G V S D (`u.pick`) | chip 32 | studio, routine | Set dei giorni di ripetizione (`days`). Riepilogo: "Ogni giorno" · "Lun – ven" · "N giorni a settimana" · "Scegli i giorni". Studio/routine richiedono ≥ 1 giorno per `ready`. |
| "Inizio · Oggi · 14 set" | row 44 | studio, routine | Data di inizio della ripetizione (apre il date picker). |
| "Fine · Per sempre / A termine" (`toggleRecEnd`) | row 44 | studio, routine | Alterna `recEnd`. In `A termine` compaiono i chip `recNs` 1·2·4·8·12 e `recUnits` giorni·settimane·mesi ("termina dopo N …"). Occorrenze generate 28 giorni avanti. |
| "Tutto il giorno" (`toggleAllDay`) | toggle | evento | On: nasconde gli orari; il promemoria diventa "alle 08:00 del giorno". |
| Orario di inizio (`setStart`) | input time 48, cifre 18 font-num | studio, routine, evento, todo con orario | Etichetta "Inizio". |
| Orario di fine (`setEnd`) | input time 48 | studio, evento, routine con fine | Etichetta "Fine". Fine ≤ inizio: per evento errore rosso "La fine deve venire dopo l'inizio" e CTA bloccato; per studio/routine nota "finisce il giorno dopo". Durata calcolata a lato. |
| "Orario di fine" (`addEnd`) · × "Rimuovi orario di fine" (`removeEnd`) | ghost / icon | routine | Aggiunge o toglie la fine. Senza fine la nota sotto gli orari dice "senza durata · resta aperta tutto il giorno" (FUNZ §3.3). |
| "Luogo o link" (`setLocation`) | input 44 | evento | Testo libero; compare nella MetaRow del Dettaglio. |
| Voce checklist (`c.onChange`) · × "Elimina voce" (`c.remove`) | input 44 + icon | todo | Modifica / rimuove la voce. |
| "Checklist" / "Aggiungi voce" (`addChecklist`) | ghost | todo | Aggiunge una voce vuota (etichetta cambia quando la lista non è vuota). |
| Fase (`f.onChange`) · ↑ "Sposta su" (`f.up`) · ↓ "Sposta giù" (`f.down`) · × "Elimina fase" (`f.remove`) | input 44 + 3 icon | routine, evento | Modifica, riordina (opacità .3 agli estremi), rimuove la fase. |
| "Fasi" / "Aggiungi fase" (`addPhase`) | ghost | routine, evento | Aggiunge una fase vuota. |
| Promemoria Auto · Off · Personalizzato (`m.pick`) | chip 32 | tutti tranne todo senza orario | `reminder`. Auto = regole di §7.1 per tipo. |
| Anticipi 1 giorno · 1 ora · 30 min · 15 min · 10 min · 5 min · All'inizio (`o.pick`) | chip 32 multi | reminder=custom | Set `custom`. Disabilitati (opacità .4) con "tutto il giorno". |
| Sveglia a schermo intero per anticipo (`al.pick`) | chip 32 multi | custom, anticipi ≠ "1 giorno" | Per ogni anticipo scelto decide se suona come sveglia (S8) invece che notifica. |
| Note (`setNotes`) | textarea | tutti | Placeholder "Aggiungi una nota". |
| Trascinamento verso il basso dal bordo alto (`sheetDown/Move/Up`) | gesto su maniglia e intestazione (60 px) | mobile | Il foglio segue il dito; oltre 110 px si chiude senza salvare, sotto torna su. Nessuna ×. |
| "Annulla" (`closePanel` → `onClose`) | ghost 44 | tutti | Chiude senza salvare (alternativa al gesto, WCAG 2.5.1; su desktop anche Esc). |
| Giorno di partenza (prop `date`) | — | tutti | Il giorno selezionato su Oggi (Giorno, Settimana, Mese), se fra oggi e oggi + 6; altrimenti oggi. Decide orizzonte del todo, data dell'evento, inizio della ricorrenza e dove atterra la card. |
| Data dell'evento (`toggleDate`, `c.pick`) | campo 56 + chip 52 r12 | evento | Apre i prossimi sette giorni (oltre non si crea da qui); il giorno scelto diventa la data e decide dove atterra la card. |
| CTA "Crea todo" · "Crea routine di studio" · "Crea routine" · "Crea evento" · "Salva" (edit) | primary → fill del tipo | tutti | Abilitato solo con `ready && !durBad` (opacità 1, transizione 450 ms al colore del tipo). Salva e chiude; su giallo (routine) testo scuro. salvataggio non mockato. Testo sempre `#0A0D13` sul fill del tipo. Su mobile (`onCreate`) il foglio si rimpicciolisce nella card e si posa nel calendario (DESIGN §6 Creazione): giorno mostrato → al suo posto; altro giorno → a destra, la striscia scorre fino alla data, la card entra da sinistra; Settimana → direttamente nella riga del giorno; Mese → la selezione passa al giorno, puntino nella casella, 1 s, card da sinistra nell'elenco (nessuno scorrimento fra i mesi). Poi toast «… creato» con «Annulla». Desktop (senza `onCreate`): torna a Oggi con il toast. |

---

## S5 — Dettaglio attività (`S5 Dettaglio Panel` + Mobile/Desktop) · §4, §5, §6 · MECC §3–§5, §8

| Controllo | Tipo | Cosa fa |
|---|---|---|
| × "Chiudi" | icon 44 | Chiude sheet/pannello. |
| "Modifica" | testuale header | Apre S4 in `mode=edit` precompilato. |
| "Elimina" (`askDelete`) | icon header | Todo ed evento: elimina subito e mostra il toast "Eliminata" con "Annulla" (`undoToast`) per 5 s. Routine e routine di studio: apre `view=delete`. |
| Elimina ripetuta (`view=delete`): "Solo questa · mer 23 set" (`deleteOne`) · "Tutta la routine" (`deleteAll`) · "Annulla" | secondary · danger · ghost 44 | "Solo questa" toglie l'occorrenza del giorno; "Tutta la routine" elimina definizione, occorrenze in programma e registro delle fasi, mentre completate e perse restano nelle statistiche (MECC §7). Poi toast "Occorrenza eliminata" / "Routine eliminata" con Annulla (`view=deleted` nelle tavole). |
| Voce checklist (`c.toggle`) | checkbox 20 r5 | Todo: spunta/despunta (`checked`); quando tutte spuntate l'esito diventa "Completato · checklist 7/7" e il titolo si barra. Despuntare riapre. |
| Card unità "Prossima · 0.7" (`toggleUnit`) | accordion | Studio: apre/chiude il concetto core e le 4 sezioni dell'unità del puntatore. |
| × "Rimuovi" su file di contesto (`f.remove`) | icon | Studio: toglie il file (CLAUDE.md, zip…) dal contesto AI del blocco. |
| "+" aggiungi contesto (`addCtx`) | icon 16 in riga | Studio: aggiunge un file (nota / PDF / ZIP) al contesto. |
| "Quiz 10" · "Flashcard 10" · "DevSwipe 10" · "Bug Hunter" · "Audio Flash-Trivia 10 · a voce" | chip 32 | Studio: lancia il generatore sull'unità (S19). |
| Campo chat + "Invia" | input + icon | Studio: domanda rapida all'AI con scope = unità. |
| Footer secondario (`secondaryAction`, `secondaryLabel`) | secondary 44 | Routine: "Saltata" → esito "Saltata", tutte le fasi saltate. Studio `anticipo`: "Sessione libera". Studio `perso`: "Recupera" (setup in recupero). Studio `recupera`: "Registra esito". |
| Footer primario (`primaryAction`, `primaryLabel`) | primary 44 (secondary quando è ripasso/riapri) | **Todo**: "Segna come fatto" (checklist tutta spuntata → completa; con voci non spuntate → `view=remaining`) · "Riapri" quando completo. **Routine**: "Fatta" → apre la ReviewSheet (fasi tutte nate fatte); disabilitato in `altro-giorno`/`perso` ("Solo nel giorno previsto"). **Evento**: "Completa evento" (con fasi → ReviewSheet) · "Chiudi evento" (senza fasi → esito Completato); in `concluso` resta attivo. **Studio** per `state`: `oggi` "Avvia sessione" · `anticipo` "Anticipa sessione" · `in corso` "Riprendi sessione" · `parziale` "Riprendi" · `completato/indietro/saltato` "Ripasso · sessione libera" (secondary, non tocca esito né puntatore) · `perso` "Registra esito" · `recupera` "Recupera" · `altro-giorno` "Sessione libera sull'unità". Tutti aprono S15. |
| ReviewSheet — riga fase (`r.toggle`) | row con pallino | Tocco = alterna fatta/saltata (`skipped`). Riepilogo "N fatte · M saltate". |
| ReviewSheet "Annulla" (`cancelReview`) | ghost | Torna al dettaglio senza esito. Anche il tocco sull'overlay. |
| ReviewSheet "Conferma" (`confirmReview`) | primary | Registra esito "Fatta · N fasi su M" (routine) / "Completato · N fasi saltate" (evento). Evento con fasi saltate → apre `view=followup`. |
| Follow-up — riga fase saltata (`k.toggle`) | checkbox | Seleziona le fasi per cui creare un todo (`followSel`). |
| Follow-up "Non ora" (`skipFollowup`) | ghost | Chiude senza creare todo. |
| Voci rimaste (`view=remaining`, solo todo) — "Tutte fatte" (`markAllDone`) · "Crea todo con le voci rimaste" (`createRemaining`) | ghost + primary 44 | Compare quando "Segna come fatto" trova voci non spuntate (FUNZ §6, MECC §4). "Tutte fatte" spunta tutta la checklist; il CTA completa il todo lasciando le voci com'erano e crea un solo todo con le voci rimaste (stessa priorità e scadenza, senza orario). Esito "Completato · N/M · K voci in un nuovo todo", toast "Todo creato · K voci rimaste" con Annulla. |
| Follow-up CTA (`createFollowup`: "Crea 1 todo" / "Crea N todo") | primary | Crea un todo (orizzonte giorno, senza orario) per ogni fase selezionata. |
| Toast "Annulla" (`undoToast`) | ghost nel toast | Annulla la creazione dei todo derivati entro 5 s e riapre il foglio (follow-up o voci rimaste). Il toast si chiude da solo dopo 5 s (`showToast`); se il footer è visibile sale a 92 px dal fondo per lasciare libero "Riapri". |
| × "Chiudi" (`closePanel`) · "Avvia sessione" (studio) | icon 40 · primary 44 | Chiudi torna a Oggi; Avvia sessione apre S15 `setup`. |

---

## S8 — Sveglia a schermo intero (`S8 Sveglia Mobile`) · §7, §19 · MECC §13

| Controllo | Tipo | Cosa fa |
|---|---|---|
| Primario per `kind` — `studio` "Inizia" · `todo` "Segna fatto" · `routine` · `evento` "Apri il blocco" | primary nel fill del tipo | Chiude la sveglia e apre S15 setup (studio) · completa il todo (con voci non spuntate apre il Dettaglio su «Voci rimaste», S5 `view=remaining`) · apre il Dettaglio del blocco. |
| "Posticipa +10 min" | secondary | Riprogramma la sveglia tra 10 minuti. |
| "Chiudi" | ghost | Chiude senza azione; resta la notifica in S21. |

---

## S9 — Notifiche di sistema (`S9 Notifiche di sistema Mobile`) · §7.5, §7.6, §11.2 · MECC §13.2, §13.5, §13.6

Scenografia del sistema operativo: l'app decide titolo, testo e azioni, non l'aspetto. `group` studio · todo · routine · sessione.

| Controllo | Tipo | Cosa fa |
|---|---|---|
| Tocco sulla notifica | — | Registra l'istante di risposta al trigger. Studio → S12 (esito e perso → debrief); sessione e "Tempo scaduto" → S15 timer; digest → S1; altro → S5. |
| "Inizia" | azione | Studio (anticipo, inizio, verifica): apre S15 setup, contesto deciso dall'orologio (MECC §10.1). |
| "Registra esito" | azione | Esito (fine + 10') e blocco perso: apre il debrief; senza sessione minuti = durata pianificata. |
| "Segna fatto" | azione | Todo (anticipo, scadenza, in ritardo): completa con la scrittura unica di MECC §3. Con voci della checklist non spuntate apre l'app sul Dettaglio con «Voci rimaste» (S5 `view=remaining`). |
| "Posticipa" | azione | +10' con la stessa chiave, solo se lo stato è coerente (MECC §13.2). |

---

## S10 — Corsi (`S10 Corsi Mobile`, `S10 Corsi Desktop`) · §9 · MECC §16

| Controllo | Tipo | Cosa fa |
|---|---|---|
| "Impostazioni" (gear) | icon 40 | Mobile: apre S22. |
| "Importa ZIP" (`startImport`) | secondary nello stato vuoto, primary in testa all'elenco | Apre il file picker (ZIP di markdown, formato `RoutForge_FORMATO_CORSO.md`), poi mostra ImportCard `importing`. Con avvisi → stato `warnings`; con errore → `error`. |
| "Carica esempio" (`loadSample`) | primary (solo nello stato vuoto) | Importa il corso di esempio integrato: «Syllabus Software Engineer 2026», M0+M1 con M2–M4 segnaposto bloccati (D-SAMPLE-1); nell'elenco la sua card porta il badge «Esempio». |
| "Annulla" (`cancelImport`) | ghost | Interrompe l'import in corso. |
| "Ok" (`dismissWarnings`) | primary | Chiude la lista avvisi (≤ 5, il corso è comunque importato). |
| "Chiudi" (`dismissError`) · "Scegli un altro file" (`startImport`) | ghost · secondary | Errore: chiude la card / riapre il picker. |
| CourseCard (`c.open`) | card | Apre S11 Corso del corso toccato (mobile: schermata piena `rf-slide`; desktop: colonna). |

---

## S11 — Corso (`S11 Corso Panel`) · §9

| Controllo | Tipo | Cosa fa |
|---|---|---|
| "Indietro" (`back`) | icon | `onBack` → elenco corsi. |
| "Elimina corso" (cestino, `askDelete`) | icon danger | Apre la sheet di conferma con l'elenco di ciò che sparisce. |
| Sheet: "Annulla" (`cancelDelete`) · overlay | ghost | Chiude la conferma. |
| Sheet: "Elimina corso" | danger 44 | Elimina corso, unità, progressi e materiali collegati; torna all'elenco. (Nel mock chiude soltanto.) |
| ModuleGroup riga (`m.toggle`) | accordion 56 | Apre/chiude il modulo (unità + Verifica del modulo). **Bloccato** (M2–M4): nessun click, lucchetto, opacità .6. |
| UnitRow (`u.open`) | row 44 | `onOpenUnit(id)` → S12 Unità. |
| Riga di verifica (`c.open`: Domande socratiche · Esercizi pratici · Criteri Go/No-Go · Progetto) | row 44 | `onOpenModule(n)` → S11 Modulo, scrollato alla sezione. |
| "Apri il modulo 00" (`m.openModule`) | secondary 40 in coda al gruppo aperto | `onOpenModule(n)`. Compare solo se la cornice fornisce la navigazione. |

## S11 — Modulo (`S11 Modulo Panel`) · §9, §10

| Controllo | Tipo | Cosa fa |
|---|---|---|
| "Indietro" (`back`) | icon | `onBack` → corso. |
| "Chiedi all'AI" | pill 36 | Apre S19 chat con scope = Modulo. |
| UnitAccordion riga (`u.toggle`) | accordion 56 | Apre l'unità inline: concetto core + 4 sezioni con LinkRow (aprono il browser, `target=_blank`). Una sola aperta per volta (`open`). |
| "Apri l'unità 0.7" (`u.openUnit`) | secondary 40 | `onOpenUnit(id)` → S12. |
| Criterio Go/No-Go (`c.toggle`) | checkbox 20 r6, riga 48 | **Manuale**: alterna sì/no. **Auto** ("Domande socratiche"): non cliccabile, si spunta quando il quiz del modulo raggiunge la soglia (≥ 8/10 M0, ≥ 7/8 M1). Contatore "3 / 7" giallo → "7 / 7 · Go" verde; a Go si sblocca il modulo successivo. |
| LinkRow "Progetto del modulo" | link 48 | Apre l'URL del progetto nel browser. |
| Footer "Riprendi da 0.7" / "Inizia da 0.1" (`start`) | primary 44 (max 320 desktop) | Apre S15 setup sull'unità del puntatore del modulo (`source=free`). |

## S12 — Unità (`S12 Unità Panel`) · §10, §14 · MECC §17

| Controllo | Tipo | Cosa fa |
|---|---|---|
| "Indietro" (`back`) | icon | `onBack` → modulo. |
| "Chiedi all'AI" | pill 36 | Apre S19 chat con scope = Unità. |
| ResourceRow di sezione | link 48 | Apre nel browser; l'apertura marca la risorsa e contribuisce allo stato della sezione (fatta quando tutte aperte). |
| Play 48 sulla VideoCard (`aria-label="Riproduci"`) | primary circolare | Riproduce il video YouTube della sezione Studio **dentro l'app**, non nel browser. |
| "+ Link" · "+ Nota" · "+ PDF max 20 MB" | pill 32 | Aggiungono materiale "Tuoi" all'unità (URL · nota testuale · PDF con estrazione testo per l'AI). Link e Nota aprono il form in linea; PDF apre il selettore. |
| Form "Nuovo link" (`material=link`): Titolo · Indirizzo · "Annulla" · "Aggiungi link" | input 44 · ghost · secondary 36 | Aggiunge il link ai Tuoi; il protocollo si aggiunge se manca (MECC §17). salvataggio non mockato. |
| Form "Nuova nota" (`material=note`): Titolo · testo markdown · "Annulla" · "Salva nota" | input 44 · textarea · ghost · secondary 36 | Salva la nota nei Tuoi; entra nel contesto dell'AI. |
| PDF troppo grande (`material=pdf-big`): "Chiudi" · "Scegli un altro file" | ghost · secondary 36 | Oltre 20 MB il PDF non si aggiunge (SCENARI H2). |
| "File o ZIP di progetto" | pill 32 | Carica codice (max 500 file; esclusi node_modules, .env, lock, log) come fonte primaria dell'AI. |
| Generatore Quiz · Flashcard · DevSwipe · Bug Hunter · Audio Flash-Trivia (`g.pick`) | chip 40 griglia 2 col | Sceglie il tipo di pratica (`gen`). |
| Quantità 5 · 10 · 15 · 20 · 25 (`q.pick`) | chip 28 | `qty`. |
| Difficoltà Facile · Media · Difficile (`d.pick`) | chip 28 | `diff`. Nascosta per Flashcard e Audio Flash-Trivia. |
| "Genera 10 · Quiz" (`genCta`, `startGen`) | primary 40 | Genera la pratica con l'AI e apre S19 nello stato corrispondente. |
| Generazione in corso (`genState=loading`) | primary con spinner, disabilitato | Etichetta "Genero 10 · Quiz…" al 70 %. |
| Nessun elemento valido (`genState=error`): "Chiudi" (`resetGen`) · "Riprova" | ghost · secondary 36 | Nulla salvato (MECC §18, SCENARI H5); "Riprova" rilancia la generazione. |
| Riga "Recenti" | row | Riapre il riepilogo della pratica passata. |
| Footer "Inizia sessione" · "Riprendi sessione" (parziale) · "Ripasso · sessione libera" (completata) | primary 44 | Apre S15 setup su questa unità (`source=free`). |

---

## S13 — PDF · Widget (`S13 Extra Panel`, `S13 Extra Mobile`) · §10, §18 · MECC §21

| Controllo | Tipo | Cosa fa |
|---|---|---|
| "Indietro" | icon | Chiude il viewer. |
| "Apri con app esterna" | icon | Condivide/apre il PDF nel viewer di sistema. |
| "Apri le pagine · 6,4 MB" (`fetchPdf`) | secondary | PDF scansionato/remoto: scarica e mostra le pagine (`remote=false`). |
| Widget Home | — | Mese e agenda → S1 Oggi; riga di un blocco e «Prossima» → studio S12, altro S5; «+» → S4 Crea (MECC §21). |

---

## S15 — Sessione di studio (`S15 Sessione Panel` + Mobile/Desktop) · §11–§13 · MECC §10–§12 · SCENARI D5

**Setup**

| Controllo | Tipo | Cosa fa |
|---|---|---|
| "Indietro" | icon | Torna senza avviare. |
| "Scegli" / "Chiudi" (`toggleUnits`) | ghost | Apre l'elenco unità (dal puntatore · ripeti · salta avanti). **Bloccato** con `source=routine` e `source=recovery` (l'unità è quella del blocco, MECC §10.1). Con `source=nocourse` (routine di studio senza corso) l'elenco è già aperto. |
| Opzione unità (`u.pick`) | card | Seleziona l'unità e richiude l'elenco. "Nessuna unità" (libera e senza corso): l'esito chiude solo il blocco e la streak conta (SCENARI C9). |
| Durata (`d.pick`) — routine: "Della routine · 45"; libera/recupero: 25 · 50 · 90 · Personalizzata · Cronometro | chip 32 | `duration`. Routine = ancorata all'orologio (finisce all'ora prevista anche in pausa). Libera = ancorata al focus (le pause allungano). Cronometro = nessuna fine. |
| Modalità Continua · Pomodoro 25·5 · 50·10 · 90·20 (`m.pick`) | chip 32 | `mode`; Pomodoro mostra la barra dei segmenti e la nota. |
| "Iperfocus" (`toggleHyper`) | toggle 44×26 | On: schermo intero con uscita bloccata fino alla fine + Non Disturbare. Se il permesso NdD manca compare "Concedi". |
| "Concedi" | secondary compatto | Richiede il permesso Non Disturbare al sistema. |
| "Inizia · 45 min" (`start`) | primary 44 | Avvia il timer (`view=timer`, o `iperfocus` se attivo). |

**Timer**

| Controllo | Tipo | Cosa fa |
|---|---|---|
| "Riduci" (`minimize`) | icon | Torna a Oggi lasciando la sessione attiva: il banner «Sessione in corso» sta sotto l'header (prototipo: S1 `?sessione=1`). |
| "Pausa" / "Riprendi" (`togglePause`, aria-label dinamica) | icon 44 primary | Alterna `paused`: anello text-2 e badge "In pausa". |
| "Termina" (`finish`) | secondary | Apre il debrief. Oltre la durata il timer prosegue "+04:12" (badge "Tempo extra") senza allarme; Termina resta l'unica uscita. |
| "Salta segmento" (`skipSegment`) | ghost | Pomodoro: passa al segmento successivo congelando il focus del segmento corrente. |
| "Interruzione N" (`addInterruption`) | ghost con contatore | Incrementa il contatore delle interruzioni annotate (finisce nelle statistiche). |
| "Cambia unità" | ghost | Pomodoro: assegna un'altra unità al segmento corrente. |
| Avviso "Intervallo non verificato" (`timer-state=unverified`): "Lascia fuori" (`dismissUnverified`) · "Conta come studio" (`countInterval`) | ghost 32 · secondary 32 | Dopo più di 30 minuti senza battito la sessione resta aperta e l'avviso dice da quando, per quanto e il tempo residuo (MECC §10.4, SCENARI D4). "Conta come studio" attribuisce l'intervallo al focus e il timer si aggiorna; "Lascia fuori" lo esclude. |
| Tab Materiale · AI (badge 2) · Note (`t.pick`) | chip 32 | Mobile: cambia il pannello sotto il timer. Desktop: Materiale a sinistra, `sideTabs` AI/Note a destra. |
| Campo chat AI + "Invia" | input + icon | Domanda con scope = unità della sessione. |
| Note (`textarea` "Scrivi mentre studi…") | textarea | Appunti della sessione, salvati nei "Tuoi" dell'unità. |

**Iperfocus (`view=iperfocus`)**

| Controllo | Tipo | Cosa fa |
|---|---|---|
| "Esci" (`askExit`) | ghost | Mostra il dialogo "Uscita bloccata fino alla fine" con "L'uscita si sblocca alle 16:45". |
| "Resta" (`stay`) | primary | Chiude il dialogo. |
| "Esci comunque" (`forceExit`) | danger/ghost | Uscita d'emergenza: registrata nelle statistiche ("Registrata"), sessione chiusa. |

**Debrief (sheet)**

| Controllo | Tipo | Cosa fa |
|---|---|---|
| Esito Completata · Continua · Indietro · Salta (`o.pick`) | card selezionabile con icona e sub | `outcome` (MECC §10–11): muove il puntatore (avanti / resta / indietro di una / oltre). |
| Confidenza 1–5 (`c.pick`) | chip 40 | `confidence`, etichetta "per niente … molto sicuro". |
| Nota (`textarea` "Una nota sulla sessione (facoltativa)") | textarea | Nota dell'esito. |
| "Conta nel piano" (`toggleCounts`) | toggle | On: l'esito agisce su unità e puntatore (sessione libera: crea un blocco retroattivo). Off: solo statistiche di focus. |
| "Carica il codice prodotto · file o ZIP, per l'AI" | row | Allega il codice scritto in sessione ai "Tuoi". |
| "Continua a studiare" (`backToTimer`) | ghost | Chiude il debrief e torna al timer. |
| "Registra esito" (`register`) | primary | Disabilitato senza esito (opacità .4). Salva e mostra `done`. |
| "Abbandona · …" (`abandon`) | link ghost 12 sotto il footer | Sotto il 65 % della durata pianificata chiude senza esito e il blocco torna programmato; dal 65 % la sessione si chiude come terminata prima con esito Continua (MECC §10.5, SCENARI D7). L'etichetta dice quale dei due effetti si applica. |
| "Torna a Oggi" (`restart`) | secondary 44 | Schermata `done`: torna a S1 con la card della sessione davanti al mazzo delle completate, «Completate» e «Focus» aggiornati e il toast «Esito registrato · …» (`?dopo=sessione&esito=…`). Sopra, «Giorni di fila» con il badge «+1» quando l'esito è Completata o Continua e conta nel piano (MECC §12). |

---

## S19 — AI e pratica (`S19 AI Panel` + Mobile/Desktop) · §14–§16 · MECC §18, §19

| Controllo | Tipo | Cosa fa |
|---|---|---|
| "Indietro" | icon | Torna all'origine (unità / modulo / dettaglio). |
| Scope "Unità 0.7 ▾" (`toggleScope`) → Unità · Modulo · Corso · Globale (`c.open`) | pill + menu | Cambia il contesto della chat (`scope`). Globale = nessun materiale, nessuna citazione. |
| Campo messaggio + "Invia" | input + icon 40 | Invia alla chat; le risposte citano chip-cite ("Dal corso · Unità 0.7 › Teoria", "Tuoi · …", "Codice · file, riga"). |
| "Interrompi" | ghost | Ferma la generazione in corso. |
| "Impostazioni · Modello AI" | secondary | Stato `chat-nokey`: apre S22 `ai`. |
| "Riprova" | secondary | Stati `offline` / `error`: rinvia l'ultimo messaggio. |
| Chat history: riga conversazione | row | Riapre la conversazione. |
| **Flashcard** — carta (`flip`) · "Mostra risposta" (`flip`) | card r16 con `rf-flip` · secondary | Gira la carta (fronte → retro). |
| Niente · Difficile · Bene · Facile (`g.pick`) | chip 44 | Valutazione SM-2 (MECC §19): pianifica il prossimo ripasso e passa alla carta seguente. |
| **Ripasso finito** (`flashcard-done`) — "Chiudi" | secondary | Nessuna carta scaduta: chiude il ripasso trasversale. |
| Errori della chat: «Impostazioni · Modello AI» · «Riprova» (`chat-error`) · «Apri Impostazioni» (`chat-error-key`, `chat-error-model`) · «Riformula la domanda» (`chat-error-safety`) | secondary · primary | Limite di richieste: riprova la stessa richiesta o apre S22 `ai`. Chiave non valida e modello fuori piano: aprono S22 `ai`. Blocco di sicurezza: torna alla chat con l'ultimo messaggio nel campo, da modificare. |
| **Quiz** — opzione A–D (`o.pick`) | row 56 | Seleziona (bianco). Bloccate dopo la risposta: corretta verde, sbagliata rossa. |
| CTA quiz (`quizCta`: "Rispondi" → "Prossima" / "Vedi il punteggio") | primary 44 | Disabilitato senza selezione; conferma la risposta e mostra la spiegazione, poi avanza. |
| Punteggio: "Rivedi le sbagliate" · "Torna all'unità" | secondary · ghost | Rifà solo le domande sbagliate / chiude. |
| **DevSwipe** — swipe o tap "◀ Sinistra" (`swipeLeft`) · "Destra ▶" (`swipeRight`) | gesto + 2 pill | Destra = codice corretto, sinistra = errato. Dopo il verdetto (bordo verde/rosso, vibrazione se sbagliato) un secondo tocco passa alla prossima. Gli errori tornano una volta a fine mazzo. |
| **Bug Hunter** — riga di codice (`l.pick`) | row numerata | Sceglie la riga con il bug. 1° tentativo giusto = 2 punti, 2° = 1, poi soluzione. Bloccato dopo la soluzione. |
| "Prossimo" (`bugNext`) | primary | Esercizio successivo. |
| **Audio Flash-Trivia** — "Stop" (`triviaStop`) · "Play"/"Pausa" (`triviaToggle`) · "Salta" (`triviaSkip`) | icon 44 · icon 56 primary · icon 44 | Ferma e torna alla domanda · alterna la riproduzione TTS · passa all'elemento successivo. Fasi: Domanda (letta) → Silenzio 5 s → Spiegazione. |
| **Riepilogo `*-done`** — "Rifai la pratica" (`pdRestart`) · "Chiudi" | secondary · ghost | Rigenera lo stesso set / chiude. Il punteggio è salvato in Statistiche → Pratica. |

---

## S20 — Shell + Statistiche (`S20 Shell Mobile/Desktop`, `S20 Statistiche Panel`) · §17 · MECC §20

| Controllo | Tipo | Cosa fa |
|---|---|---|
| Tab Panoramica · Comportamenti · Studio · Pratica (`t.pick`) | tab con riga 2 px | Cambia `tab`. |
| Periodo 7g · 30g · 90g · tutto (`p.pick`) | PeriodSegmented 22 | Cambia `period` per tutte le StatCard. |
| StatCard / heatmap | — | Solo lettura (nessun drill-down nei mock). |
| "Segna tutte lette" | testuale header | Shell su Notifiche: svuota il contatore, le pendenti restano fino all'azione. |

## S21 — Notifiche (`S21 Notifiche Panel`) · §7, §19 · MECC §13

| Controllo | Tipo | Cosa fa |
|---|---|---|
| Azione secondaria per riga (`p.dismiss`: "Recupera" · "Apri unità" · "Apri") | secondary 32 | Apre S15 in recupero / S12 / il Dettaglio; la riga esce dalle pendenti. |
| Azione primaria per riga (`p.dismiss`: "Registra esito" · "Inizia" · "Posticipa" · "Segna fatto") | primary 32 | Apre il debrief dell'esito (studio persa: minuti = durata pianificata) / avvia / posticipa / completa. La riga esce dalle pendenti; a zero pendenti → `view=empty`. |
| Riga "Passate" | row | Solo lettura; il tocco apre l'attività. |

## S22 — Impostazioni (`S22 Impostazioni Panel`) · §23, §7.7, §16, §20, §21, §24 · MECC §22, §23, §25

**Root** — ogni riga (`row 48`) apre la vista omonima: Notifiche · Esiti da registrare (→ S21) · Animazioni (Auto/On/Off) · Celebrazioni (Sobria/…) · Feedback aptico · Inizio settimana · Account e sincronizzazione · Modello e chiave AI · Backup · Spazio dei materiali · **Elimina tutti i dati** (danger, con conferma) · Diagnostica · Informazioni. solo la navigazione mock è dichiarativa.

| Vista | Controllo | Tipo | Cosa fa |
|---|---|---|---|
| notifications | "Notifiche" master (`toggleMaster`) | toggle | Spegne tutte le notifiche su questo dispositivo (righe sotto a opacità .45). |
| notifications | Riga per tipo Routine di studio · Todo con orario · Routine · Eventi (`t.open`) | row 48 accordion | Apre i controlli del tipo (uno alla volta). |
| notifications | Toggle del tipo (`t.toggle`) | toggle | Attiva/disattiva le notifiche del tipo; il valore a destra mostra l'anticipo o "Off". |
| notifications | Anticipo Inizio · 5' · 10' · 15' · 30' · 1 h · 1 g (`l.pick`) | chip 28 | `leads[tipo]`. |
| notifications | "Silenzioso" (`t.toggleSilent`) | toggle | Notifica senza suono per quel tipo. |
| notifications | "Digest del mattino" | row 52 | Orario del digest dei todo senza orario (default 08:00); nel mock è solo lettura. Nessuna fascia silenziosa dell'app: il silenzio è del Non disturbare del sistema (D-NOTIF-3). |
| notifications | "Notifica di prova" | secondary | Invia una notifica di test. |
| notifications-denied | "Apri impostazioni" | secondary 32 | Permesso di sistema negato: apre le impostazioni del sistema; finché manca non arriva nessun promemoria. |
| login | Email (`input type=email`, "tu@esempio.it") | input 44 | Indirizzo per il codice OTP. |
| login | "Inviami il codice" (`loginNext`) | primary | Invia il codice a 6 cifre e passa a `login-code`. |
| login-code | 6 celle codice (font-num) | input OTP | Cella attiva con bordo primary; auto-avanzamento. |
| login-code | "Accedi" (`loginDone`) | primary | Verifica il codice e accede. |
| account | "Sincronizza ora" (`syncNow`) | secondary | Forza la sync; stato "adesso". |
| account-offline | "Sincronizza ora" | secondary disabilitato | Offline: "3 modifiche in coda, partono alla prima connessione" (MECC §25, SCENARI J1). |
| account | "Cancella i dati remoti" (`askRemote`) → "Annulla" · "Cancella dall'account" | row danger → ghost · danger | Conferma in linea (`account-erase`): rimuove tutto dall'account, non dal dispositivo (§21). |
| account | "Scollega" · "Esci" | ghost / danger ink | Scollega il dispositivo · chiude la sessione (dati locali restano). |
| account-conflict | "Ok" (`resolve`) | primary | Accetta la risoluzione del conflitto proposta e sincronizza. |
| ai | Modello Gemini 2.5 Flash · Pro (`m.pick`) | radio row | Sceglie il modello. |
| ai | Chiave API (`input type=password`, "Incolla la chiave AIza…") | input 44 | Chiave dell'utente, salvata solo sul dispositivo. |
| ai | "Verifica" (`saveKey`) | primary | Valida la chiave con una chiamata e la salva (`hasKey=true`). |
| ai | "Rimuovi" (`clearKey`) | ghost danger | Cancella la chiave → stato `ai-nokey` (le funzioni AI si disattivano, S19 mostra `chat-nokey`). |
| ai | "Testo dei PDF all'AI" (`togglePdf`) | toggle | Include il testo estratto dai PDF nel contesto. |
| backup | "Importa backup" (`askImport`) | row | Apre la conferma "Sostituisci e ricarica". |
| backup | "Annulla" (`cancelImport`) · "Sostituisci e ricarica" | ghost · danger | Chiude · sostituisce tutti i dati locali con il backup e ricarica l'app. |
| backup | "Esporta backup" (`exportNow`) | row | Salva il file con tutti i dati; esito "Backup salvato in Documenti" (`backup-export`, §20). |
| backup | "Elimina tutti i dati" (`askErase`) → "Annulla" · "Elimina tutti i dati" | row danger → ghost · danger | Conferma in linea (`backup-erase`): azzera il dispositivo; i dati dell'account restano (MECC §22). |
| backup | "Elimina" su materiale | ghost danger | Elimina il file dallo spazio dei materiali. |
| diagnostics | "Svuota cache" · "Copia diagnostica" · "Reinstalla PWA" | secondary | Manutenzione: pulisce la cache · copia il report negli appunti · reinstalla il service worker. |

---

## Regole trasversali per l'implementazione
1. **Un primary per vista.** Se due azioni contano, la seconda è secondary o ghost.
2. **Disabilitato = opacità .4 + `cursor:not-allowed`**, mai nascosto (CTA del form, "Registra esito", CTA quiz, "Fatta" fuori giorno). Il motivo del blocco va in una nota text-3 sotto il footer (`hint`).
3. **Selezione singola** (chip, tessere, giorni, esiti) = bianco pieno con testo `#0A0D13`; **multi** (giorni L–D, anticipi, follow-up) stessa resa, più elementi attivi.
4. **Toggle**: on = primary (`#6E96F2`) con knob bianco; in S22 il verde `#22C55E` è usato per i toggle di impostazione: rispettare il file.
5. **Testo sui fill del tipo** sempre `#0A0D13` (CTA di Crea, voci rimaste, follow-up, sveglia, play): il bianco sul teal è 2,5:1.
6. **Azioni distruttive** (Elimina corso, Elimina attività, Sostituisci e ricarica, Elimina tutti i dati) chiedono conferma in sheet r24 con "Annulla" ghost + danger; le eliminazioni singole offrono Undo in toast 5 s.
7. **Overlay** delle sheet: il tocco fuori chiude (`cancel*`), il tocco dentro `stopPropagation`.
8. **Accordion**: la riga intera è il bottone; chevron ruota 180° (90° in S22 notifiche). Una sola unità aperta per volta in S11 Modulo; più moduli aperti in S11 Corso.
9. **Link esterni** (`ResourceRow`, `LinkRow`, Progetto) sono `<a target=_blank rel=noopener>`, non bottoni; i video YouTube della sezione Studio si aprono nella VideoCard.
10. Le azioni segnate non hanno logica nel mock: implementarle secondo `spec/` con il comportamento qui descritto.
11. **Tastiera** (desktop): Tab segue l'ordine visivo; Invio e Spazio attivano; Esc chiude menu, fogli e pannelli come il tocco fuori. Nessuna scorciatoia globale (niente «Cerca» ⌘K).
12. **Collegamenti diretti** da notifiche, sveglie e widget: destinazioni in `docs/NAVIGAZIONE.md` §7.
13. **Riordino senza trascinamento** (WCAG 2.5.7): su desktop le frecce «Sposta su» · «Sposta giù» (S1); su mobile la barra «Sposta su» · «Sposta giù» · «Fine» (S1 `move=attivo`).
