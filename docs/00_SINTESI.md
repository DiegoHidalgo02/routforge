# RoutForge — Sintesi operativa

*Fonte operativa derivata dai cinque file di `docs/spec/`. Se qui e nelle spec c'è differenza, vincono le spec (precedenza: SCENARI > FORMATO_CORSO > MECCANISMI > FUNZIONALITA > CONTESTO). Questo documento serve a orientarsi in una pagina, non a sostituirle.*

---

## 1. Cosa si costruisce

Un'app personale (un utente, i suoi dispositivi) di **organizzazione e studio**:

| Area | In una riga | Spec |
|---|---|---|
| Calendario "Oggi" | Giorno/Settimana/Mese, quattro tipi di attività, blocco "Adesso/prossimo", trascinamento dei todo senza orario | FUNZ §2–§4, MECC §14–§15, §24 |
| Quattro attività | **Todo** (orizzonte giorno/settimana/mese, checklist), **Evento** (fasi, mai "perso"), **Routine** (fasi, senza durata possibile), **Routine di studio** (agganciata a un corso, riceve l'unità dal puntatore) | FUNZ §3, MECC §2 |
| Scheduler | A ogni avvio/primo piano/cambio giorno (con l'app aperta ogni minuto, e a ogni modifica delle routine: D-SCHED-1): riancora al cambio di fuso (D-TIME-2), estende le occorrenze (28 gg), sposta i todo, azzera gli orfani, marca i persi, ricalcola il puntatore, riconcilia le notifiche, aggiorna la streak — in quest'ordine, idempotente | MECC §6–§9 |
| Sessione di studio | Setup (cosa/quanto/modalità), timer persistente, pomodoro, tempo extra, iperfocus, quattro esiti (Completata/Continua/Indietro/Salta) | FUNZ §11, MECC §10–§11 |
| Corsi | Import da ZIP di markdown (Corso → Moduli → Unità → 4 sezioni → risorse), puntatore dell'unità, moduli bloccati dai criteri Go/No-Go | FORMATO_CORSO, MECC §16 |
| Notifiche | Default per tipo, override per istanza, sveglie a schermo intero, finestra 14 gg, riconciliazione, digest mattutino, azioni rapide, one-shot; nessuna fascia silenziosa dell'app (D-NOTIF-3) | FUNZ §7, MECC §13 |
| Materiali e AI | Link/nota/PDF per unità, file di codice (solo contesto AI), chat Gemini contestuale, quiz, flashcard (SM-2), DevSwipe, Bug Hunter, Audio Flash-Trivia | FUNZ §10, §14–§16, MECC §17–§19 |
| Statistiche | Panoramica, comportamenti, studio, pratica; periodi 7/30/90/tutto | FUNZ §17, MECC §20 |
| Widget, Notifiche, Backup, Sync | Widget Android; schermata esiti pendenti; backup file unico; sync attività+impostazioni con account email+codice | MECC §21–§25 |

**Piattaforme**: Android, iOS, web installabile — stesse funzioni, con eccezioni note (widget, sveglie/DND, notifiche in background, cartella documenti). **Offline** salvo AI e sync. **Tempo locale** ovunque. **Sei lingue** UI (it/en/es/pt/fr/de) dal dispositivo. **AI: Gemini** con chiave dell'utente.

## 2. Modello dei dati (MECC §1)

- **Blocco** = una voce sul calendario (todo, evento, occorrenza di routine, occorrenza di studio). Stati: `programmato` · `in corso` (aperti) · `completato` · `parziale` · `indietro` · `saltato` · `perso` (terminali). Un `perso` di routine/studio è recuperabile; un `perso` todo resta spuntabile. L'evento non è mai `perso` (mostra `concluso`).
- **Ricorrenza** = definizione di una routine (giorni, orari, fasi, promemoria, date); non compare mai da sola.
- **Unità**: `non iniziata` · `parziale` · `da rivedere` (pendenti → puntatore) · `completata` · `saltata`.
- **Sessione**: esecuzione del timer (avvio, fine, focus, pause, segmenti, esito) — sorgente delle statistiche.
- Altri: Log fasi, Mazzo→Carta (SM-2), Quiz/Pratica, Conversazione→Messaggio, Materiale (+binario PDF), File di codice, Registro notifiche (derivato, mai nel backup/sync), Preferenze e stato.
- Blocchi senza orario: ancore fisse todo 12:00–23:59, evento 00:00–23:59, che **non** valgono come tempo pianificato.

## 3. I numeri che governano tutto

| Regola | Valore | § |
|---|---|---|
| Marcatura `perso` / "non fatto" | fine effettiva + **30'** (senza fine: 23:59 → 00:29 del giorno dopo) | §6, §8 |
| Scadenza di recupero (notifica di verifica) | fine − 50% durata; senza durata: inizio + 30' | §8 |
| Notifica "blocco perso" | solo se fine entro le ultime **2 h**, una volta, ~10 s dopo | §8 |
| Esiti pendenti (schermata Notifiche) | studio persi negli ultimi **3 giorni** o programmati con fine passata; max **5** | §8 |
| Orfani `in corso` | tornano `programmato` se fine passata da > 30' senza sessione attiva | §8 |
| Occorrenze routine | da oggi a oggi + **28 giorni**, idempotenti | §7 |
| Slot libero per todo spostati | finestra **08:00–22:00**, stessa durata; ripiego sull'orario originale | §6 |
| Notifiche armate | scattano entro **14 giorni**; blocchi che iniziano entro 14+31 gg; niente entro 5 s o nel passato | §13.3 |
| Anticipi di default | todo 30' · studio 5' · routine 10' · evento 15' (tutto il giorno: 08:00) | §13.1 |
| Trigger studio | pre · inizio · verifica (scadenza di recupero) · esito a fine + **10'** | §13.2 |
| Posticipa | +10', stessa chiave, solo se lo stato è coerente | §13.2 |
| Ore silenziose | nessuna fascia dell'app: il silenzio è del Non disturbare del sistema (D-NOTIF-3) | §13.4 |
| Abbandono oltre soglia | focus ≥ **65%** della durata pianificata → esito Continua invece dell'abbandono (D-SESS-2) | §10.5 |
| Intervallo non verificato | > **30'** dall'ultimo battito della sessione: non conta nel focus, sessione aperta, avviso alla riapertura (D-TIMER-2) | §10.4 |
| Sveglie a schermo intero | solo per istanza, anticipi ≤ **7 h**, blocchi con orario | §13.1 |
| Digest | orario configurabile (default 08:00), fino a 3 titoli, vuoto → nessun digest | §13.5 |
| Contesto "anticipo" | adesso < inizio − 5' | §10.1 |
| Pomodoro | 25/5 · 50/10 · 90/20; ultimo troncato; senza durata: 4 cicli | §10.3 |
| Progresso "Continua" | min(0,95; minuti / (ore stimate × 60, o 180)) | §11 |
| Streak | +1 una volta al giorno per Completata/Continua che conta; ieri → +1, altrimenti riparte da 1 | §12 |
| SM-2 | facilità 2,5 (min 1,3); Niente −0,20 → 10'; Difficile −0,15 → ×1,2; Bene → ×facilità; Facile +0,15 → ×facilità×1,3; min 1 g | §19 |
| Checklist | max 60 voci, 120 caratteri | §4 |
| PDF | ≤ 20 MB; testo fino a 40 pagine / 60.000 caratteri | §17 |
| File di codice | ≤ 500 KB l'uno; esclusi cartelle tecniche, `.env*`, lock, log | §17 |
| Generazione AI | 5–25 (passo 5); difficoltà dove prevista; lingua del materiale | §18 |
| Bug Hunter | 2 / 1 / 0 punti; totale = punti / (2 × esercizi) | §18 |
| DevSwipe | destra = corretto; errori riproposti una volta; punteggio = giuste al primo passaggio / totali | §18 |
| Mappa di calore | 84 giorni; minimo scala 60' | §20 |
| Import corso | avvisi mostrati max 5; ogni import = corso nuovo | §16 |
| Durate todo | gradini 5,10,15,20,25,30,40,45,50,60,75,90,105,120,150,180,210,240 | §2 |
| Widget | mini mese, agenda di oggi (le righe che entrano nel 4×2), «Prossima», «+»; aperture duplicate entro 1,5 s ignorate | §21 |
| Ritorno dopo assenza | ≥ 2 giorni e almeno un corso → messaggio una tantum | §9 |
| Crea | giorno di partenza = giorno selezionato in Oggi se entro oggi + **6**, altrimenti oggi; da Crea solo i prossimi **7 giorni** (D-DESIGN-3) | §2 |
| Riordino | solo todo senza orario, solo nella stessa priorità; niente orari, giorni, aggancio o «Annulla» (D-DESIGN-3) | §15 |
| Reattività | Oggi con la card Adesso pronta entro 0,5 s | CONTESTO §3 |

## 4. Le due regole strutturali da non dimenticare

1. **Ordine dei cicli dello scheduler (MECC §9, vincolante)**: estensione ricorrenze → spostamento todo → reset orfani → marcatura persi → riconciliazione notifiche → avvisi "perso"/"in ritardo" → streak.
2. **Puntatore (MECC §11 + FORMATO §4)**: unità in ordine modulo → unità; le occorrenze future `programmate` ricevono la i-esima pendente; l'utente non sceglie mai l'unità della prossima occorrenza; il puntatore non entra in un modulo bloccato.

## 5. Decisioni già prese dalle spec (CONTESTO §5)

Niente lettura vocale dei corsi (voce solo per Trivia) · niente servizi musicali · niente ricerca internet per i corsi · niente lista attività separata · niente schermata di benvenuto · niente selettore lingua · Gemini con chiave utente (senza chiave: errore leggibile, tutto il resto funziona) · account email + codice · pratiche nuove generate dall'unità nella lingua del materiale · corso di esempio incluso · backup file unico che sostituisce i dati locali · dal nuovo design (D-DESIGN-3, 05/10/2026): nessuna ricerca, nessun trascinamento su orari o giorni (solo il riordino dei todo senza orario nella stessa priorità), nessun blocco Adesso separato né chiusura, l'esito non è mai una sveglia.

## 6. Contraddizioni e ambiguità rilevate → come sono state risolte

| # | Dove | Problema | Risoluzione (vedi `01_DECISIONI.md`) |
|---|---|---|---|
| 1 | FORMATO §4 vs MECC §11 | Il puntatore §11 non menziona i moduli bloccati | D-PTR-1: il puntatore non entra in un modulo bloccato; senza criteri tutti aperti (coerente con C1) |
| 2 | FORMATO §2 | Criterio "auto" soddisfatto dal "quiz del modulo", ma i quiz si generano per unità (FUNZ §14) | D-QUIZ-1 (applicata col default del CP5, T-027): qualsiasi quiz sulle unità del modulo o ad ambito modulo ≥ soglia |
| 3 | MECC §19 | "Facile": facilità prima o dopo l'aggiornamento | D-SM2-1: dopo (imposto da I1) |
| 4 | MECC §19 | "Niente": intervallo successivo non definito | D-SM2-2: azzerato |
| 5 | MECC §10.3 | "senza durata: 4 cicli" | D-POMO-1: 8 segmenti (studio+pausa ×4) |
| 6 | MECC §14 | "Adesso" per routine senza durata | D-NOW-1: fine effettiva = 23:59 |
| 7 | FUNZ | Rimandi ai paragrafi sfalsati di uno (§8→§7, §10→§9, §12→§11, §13→§12, §16→§15, §23→§8.7) | Cosmetico; rimandi rinumerati dalla spec del nuovo design (D-DESIGN-3, 05/10/2026) |
| 8 | MECC §25 | La chiave Gemini viene sincronizzata sul servizio remoto | Raccomandazione (non requisito): cifrarla lato client prima dell'invio — decisione al Checkpoint 4 |
| 9 | CONTESTO §1 | Lo Studio deve poter generalizzare Corso→Modulo→Unità | Il dominio usa `moduloNumero`/`ordine` generici sull'unità; la gerarchia a tre livelli resta il caso di riferimento (D-STUDIO-1) |
| 10 | CONTESTO §3 vs MECC §1 | "Fuso orario non deve spostare i blocchi di giorno" vs "ogni istante è assoluto": in viaggio le due regole divergono | D-TIME-2: **ora locale di parete**, decisa dall'utente al CP0 il 24/09 (`docs/decisioni/D-TIME-2.md`) |
| 11 | `CLAUDE.md`, `AUDIT_FOUNDATION.md` §12 (nella storia git) | Dichiaravano «45 scenari»; SCENARI ne contiene 54 | Corretto (24/09; 55 dal 30/09/2026 con D7; **60 dal 05/10/2026** con A6, A7, C10, F7 e G5 del nuovo design, D-DESIGN-3); `docs/TRACCIABILITA.md` li elenca tutti e il gate verifica la corrispondenza (D-TRACC-1) |
| 12 | `STATO.md` vs `TASKS.md`, `06_SUPERVISIONE.md` | T-011 e T-012 «possono partire subito», ma T-011 è marcato CP0 | Corretto: attendono il CP0 |
| 13 | `02_ARCHITETTURA.md` §1, §3 | Parser «in arrivo» sebbene esista; carte con `ease`/`intervalDays`/`dueAt` contro D-NAMING-1 | Corretto: nomi italiani (`facilita`, `intervalloGiorni`, `scadenza`) |
| 14 | `02_ARCHITETTURA.md` §2 vs `ci.yml` | Quattro fusi con Kolkata nel documento, tre nella CI | CI con Kolkata (fuso a mezz'ora); INV-11 |
| 15 | `.gitignore` vs guida Fase 4 / T-000 | Versionare o no l'export del design: mai deciso | D-DESIGN-1: si versiona; ignorati solo gli ZIP |
| 16 | `.claude/settings.json` vs guida Fase 5, `06_SUPERVISIONE.md` | `npm install` auto-approvato, ma la supervisione ferma l'agente sulle dipendenze non previste | D-DEP-1: registro `docs/DIPENDENZE.md` verificato dal gate; senza riga il gate è rosso. Dal 05/10/2026 `npm install` chiede anche conferma (D-DESIGN-4) |
| 17 | `04_STRUMENTI.md` §5 vs ambiente reale | Plugin previsti con ambito progetto, abilitati a livello utente | Azione dell'utente (`STATO.md`, problemi aperti) |
| 18 | `parser.ts`, `sm2.ts` | Campi `module`/`course`/`warnings`/`schedule` rimasti in inglese dopo D-NAMING-1 | Corretto (`modulo`, `corso`, `avvisi`, `sm2`) |
| 19 | MECC §22 con §1 | Il file di backup (“tutto tranne il registro notifiche”) conterrebbe la chiave Gemini in chiaro | D-BACKUP-1 **aperta**: decisione al CP4 |
| 20 | MECC §25 | Sorgente dell'istante di `updatedAt` per «ultimo vince» non specificata: orologi sfasati invertono l'esito | D-SYNC-1: decisione al CP4 |
| 21 | FORMATO §1 | Numeri di modulo o unità duplicati nello ZIP: la spec tace, gli id del parser collidono | D-PARSE-3 (T-003): il duplicato successivo è saltato con avviso, il primo vince |
| 22 | `TASKS.md` vs `06_SUPERVISIONE.md` | CP2 e CP6 erano marcati sul task che il checkpoint **segue** (T-008, T-035): con il blocco meccanico dei task CPn il loop non li avrebbe mai avviati | Corretto: marcatori spostati sui task successivi (T-009, T-010); il checkpoint che segue un task è scritto nel testo del task |
| 23 | FUNZ §14.6 vs MECC §18 (e MECC §18 al proprio interno) | Il riepilogo dell'Audio Flash-Trivia «con punteggio ed elenco delle sbagliate» (FUNZ §14.6 e paragrafo «Fine della pratica» di MECC §18) contro «Nessun punteggio», risultato = ascoltate/totali (tabella e paragrafo Trivia di MECC §18; MECC §20 e FUNZ §17.4 contano le playlist ascoltate) | D-TRIVIA-1, poi sostituita da D-DESIGN-1 n. 10 (25/09/2026): punteggio giuste/totali, «Salta» = sbagliata; spec allineata (D-DESIGN-3), applicata in T-028 (D-PRATICA-1) |
| 24 | FORMATO §0 vs FORMATO §2–§3 | §0 dichiara `course-data.js` «risultato atteso della lettura» di M0/M1, ma il fixture si discosta dalle regole in quattro campi: intestazione «Teoria (Fondamenta)» (§3 mostra «Fondamenta»), «· mini-modulo» preso dalla parentesi della finestra di M1 (§2 la rimuove), intro ridotta al primo paragrafo più la riga guida degli obiettivi (§2 conserva i paragrafi introduttivi), link del test di fit ridotti al titolo | D-DESIGN-1: vince il fixture; il parser produce `course-data.js` senza differenze (`scripts/corso-esempio.test.mjs`) (T-000); tutto il resto coincide |
| 25 | MECC §4, §5; FUNZ §5, §6; SCENARI E1 vs scelta dell'utente (25/09/2026) | La spec non dice cosa fa «Segna come fatto» con voci non spuntate e dà al follow-up di una fase saltata «orizzonte mese» e «titolo dato dall'utente» | D-DETT-2: il todo derivato (voci rimaste o fase saltata) eredita la scadenza dell'attività da cui nasce, mai prima di oggi; titolo = etichetta della fase (D-DESIGN-1). Spec allineata il 25/09/2026 su richiesta esplicita dell'utente (INV-5) |
| 26 | SCENARI B2 vs MECC §24 (e §1) | B2: l'occorrenza di routine è spuntabile per tutto il suo giorno, anche dopo la marcatura «persa» delle 08:30; §24: nel calendario «i persi/saltati non sono spuntabili salvo i todo» | Lettura che le tiene entrambe (D-DETT-1, D-DETT-3; 28/09/2026): §24 vale per il cerchio della card (nessuna spunta diretta su una routine persa), B2 è soddisfatto dal Dettaglio, un tocco più in là, dove «Fatta» e «Saltata» restano fino alle 23:59. Alternativa scartata il 02/10/2026 (chiusura dei punti aperti delegata dall'utente): §24 è esplicito e ammetterla sarebbe una modifica di spec (INV-5); resta D-DETT-3; dal 05/10/2026 MECC §24 lo scrive (spec del nuovo design, D-DESIGN-3) |
| 27 | MECC §6 vs MECC §15 | §6: l'orizzonte di un todo conta «a partire dal giorno di creazione»; §15 sposta un todo su un altro giorno della striscia senza dire se la scadenza lo segue | D-DRAG-1 n. 8 (T-015, 28/09/2026), con la lettura di D-HOR-1 n. 6 (il giorno del todo è `giornoLocale`): l'orizzonte riparte dal giorno nuovo (di sabato un todo «entro la settimana» portato a lunedì scade la domenica dopo). Alternativa scartata il 02/10/2026 (delega dell'utente): richiederebbe un campo nuovo e renderebbe «non fatto» un todo appena spostato; resta D-DRAG-1 n. 8. **Superata il 05/10/2026** (D-DESIGN-3): il trascinamento non cambia più giorno né orario (MECC §15) |
| 28 | MECC §8 vs D-ESITO-1 (e SCENARI C8) | §8: la notifica «blocco perso» parte per ogni routine o studio perso con la fine entro le ultime 2 ore, «una volta per blocco», senza condizioni sulla sessione; D-ESITO-1 (T-018) chiede che con «conta nel piano» spento il blocco tornato `programmato` e rimarcato perso **non** riceva l'avviso, e C8 riporta a `programmato` (poi perso) uno studio la cui sessione è stata abbandonata o interrotta da un crash | D-NOTIF-2 n. 2 (T-020, 29/09/2026): nessun avviso «perso» per un blocco su cui era partita una sessione (`minutiRitardo`), perché l'utente lo ha già gestito e lo ritrova negli esiti pendenti; nemmeno per un blocco nato dopo la propria fine (D-OCC-1); avviso di nuovo per un perso riprogrammato e perso di nuovo. **Confermato dall'utente il 30/09/2026** (council); l'alternativa letterale di §8 è scartata; dal 05/10/2026 MECC §8 lo scrive (D-DESIGN-3) |
| 29 | MECC §13.4, FUNZ §7.4, SCENARI F3 vs scelta dell'utente (30/09/2026) | La spec prevede le ore silenziose dell'app; l'utente le ha giudicate inutili (il Non disturbare del sistema basta) | D-NOTIF-3: rimosse da codice e impostazioni (T-045); spec allineata il 30/09/2026 su richiesta esplicita dell'utente (INV-5) |
| 30 | MECC §10.5 e SCENARI D4 vs scelte dell'utente (30/09/2026) | La spec abbandona senza esito qualunque sessione e conta come focus tutto il tempo ad app chiusa (D4); l'utente vuole l'esito Continua oltre il 65% e un intervallo non verificato oltre 30 minuti | D-SESS-2 e D-TIMER-2: task T-046 e T-047; spec allineata il 30/09/2026 su richiesta esplicita dell'utente (nuovo scenario D7, D4 esteso: 55 scenari) |
| 31 | FORMATO intro e §5 vs repository | M0/M1 «in questa cartella» e `course-data.js` «alla radice del progetto»: posizioni del progetto di design, mai valide alla lettera nel repository | D-SAMPLE-1 e D-DESIGN-2 (04/10/2026): i tre file stanno in `src/data/sample-course/`; spec invariata (INV-5) |
| 32 | Nuovo design (05/10/2026) vs codice e decisioni | Il pacchetto di Claude Design (`claude-design/`, con `CLAUDE.md` vincolante e la sua `spec/`) contraddice il codice costruito sul vecchio design: blocco Adesso separato con chiusura (T-010, D-NOW-2), trascinamento su orari e giorni (T-015, D-DRAG-1), ricerca (T-039), data libera in Crea (D-CREA-1), «Voci non spuntate» (D-DETT-2), cerchio solo per todo e routine (D-DETT-3) | D-DESIGN-3: spec sostituita dalla `spec/` del pacchetto su richiesta dell'utente (INV-5), 60 scenari; task T-048–T-051, T-044 riscritto, T-039 annullato; divergenze codice ↔ design in `docs/03_HANDOFF_DESIGN_CODE.md` §2 |
| 33 | MECC §25 vs S22 `account` e D-SYNC-3 | §25 e il mock («Cosa viaggia: … chiave AI») sincronizzano la chiave AI; il CP4 l'ha tenuta sul dispositivo | D-SYNC-3: «Cosa viaggia» senza chiave AI, «Cosa resta qui» la aggiunge; allineamento della spec e del mock all'utente |
| 34 | S22 `account-conflict` vs D-SYNC-2 | Il mock mostra un conflitto da confermare con «Ok»; «ultimo vince» lo risolve da sé e nessun evento lo produce | Non costruito (piano di T-033 §6 n. 1); decide l'utente |
| 35 | MECC §25 vs S22 notifiche | §25 sincronizza le notifiche; S22 dice che l'interruttore generale le spegne «su questo dispositivo» | Vince il design: l'interruttore generale resta sul dispositivo, il resto viaggia (D-SYNC-4 n. 5) |
| 36 | MECC §8 vs SCENARI B2, B4, B7, D7 | §8 marca perso con la fine passata da «> 30 minuti»; gli scenari danno l'istante esatto («dalle 08:30», «alle 00:29», «alle 20:30», «alle 10:30 è perso») | Vince lo scenario: perso da fine + 30' compresa (D-PERSO-1, audit P3-6); allineamento di §8 all'utente |

## 7. Informazioni mancanti (non deducibili dalle spec)

| Cosa | Impatto | Gestione |
|---|---|---|
| Stack tecnologico | Architettura | **Deciso** in T-000 (D-STACK-1, 24/09/2026): React 19 + Vite PWA + Capacitor; CP1 chiuso senza veto (25/09/2026), applicato da T-006 |
| Servizio di sincronizzazione (backend) | Passo 10 | **Checkpoint 4** — candidata: Supabase (auth email OTP) |
| Design (export di Claude Design) | Aspetto UI | Vecchio export (24/09/2026) **rimosso** il 04/10/2026 (D-DESIGN-2; storia git `3c60512`); il corso di esempio con `course-data.js` è in `src/data/sample-course/`. Il **nuovo design** arriva via MCP in `claude-design/` e vale dopo il suo handoff (`docs/03_HANDOFF_DESIGN_CODE.md`) |
| Identificatori app (bundle id, nome, icona) | Capacitor | Default `com.routforge.app` / "RoutForge" (D-APP-1), modificabile |
| Modello Gemini "più economico" di default | Impostazioni AI | Letto dalla lista modelli dell'API; ripiego al nome noto più economico |
| Sorgente dell'istante di `updatedAt` per «ultimo vince» (orologio del dispositivo o del servizio) | Passo 10 | **Checkpoint 4** — D-SYNC-1 |
| Chiave Gemini nel file di backup (in chiaro per MECC §22) | Passo 9 | **Checkpoint 4** — D-BACKUP-1 |
| Numeri di modulo/unità duplicati nello ZIP del corso | Passo 1 (T-003) | **Deciso** in T-003 (D-PARSE-3): duplicato saltato con avviso |

## 8. Priorità (ordine di costruzione, CONTESTO §6)

1 Dati e import corso → 2 Attività e calendario → 3 Scheduler → 4 Sessione → 5 Notifiche → 6 Card Adesso/riordino/Notifiche/widget → 7 Materiali e AI → 8 Statistiche → 9 Backup/lingua/impostazioni/diagnostica → 10 Sync. Ogni passo supera i propri scenari prima del successivo. Il dettaglio dei task è in `docs/TASKS.md`.

## 9. Stato del contesto

Sufficiente per procedere: tutte le regole necessarie ai passi 1–9 sono nelle spec; i punti aperti sono confinati ai checkpoint sopra.
