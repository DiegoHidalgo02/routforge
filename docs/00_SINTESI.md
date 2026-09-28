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
| Notifiche | Default per tipo, override per istanza, sveglie a schermo intero, finestra 14 gg, riconciliazione, ore silenziose, digest mattutino, azioni rapide | FUNZ §7, MECC §13 |
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
| Posticipa | +10', stessa chiave, rispetta le ore silenziose | §13.2 |
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
| Widget | agenda max 6 + "+N"; 3 todo alta priorità; aperture duplicate entro 1,5 s ignorate | §21 |
| Ritorno dopo assenza | ≥ 2 giorni e almeno un corso → messaggio una tantum | §9 |
| Reattività | Oggi con blocco Adesso pronto entro 0,5 s | CONTESTO §3 |

## 4. Le due regole strutturali da non dimenticare

1. **Ordine dei cicli dello scheduler (MECC §9, vincolante)**: estensione ricorrenze → spostamento todo → reset orfani → marcatura persi → riconciliazione notifiche → avvisi "perso"/"in ritardo" → streak.
2. **Puntatore (MECC §11 + FORMATO §4)**: unità in ordine modulo → unità; le occorrenze future `programmate` ricevono la i-esima pendente; l'utente non sceglie mai l'unità della prossima occorrenza; il puntatore non entra in un modulo bloccato.

## 5. Decisioni già prese dalle spec (CONTESTO §5)

Niente lettura vocale dei corsi (voce solo per Trivia) · niente servizi musicali · niente ricerca internet per i corsi · niente lista attività separata · niente schermata di benvenuto · niente selettore lingua · Gemini con chiave utente (senza chiave: errore leggibile, tutto il resto funziona) · account email + codice · pratiche nuove generate dall'unità nella lingua del materiale · corso di esempio incluso · backup file unico che sostituisce i dati locali.

## 6. Contraddizioni e ambiguità rilevate → come sono state risolte

| # | Dove | Problema | Risoluzione (vedi `01_DECISIONI.md`) |
|---|---|---|---|
| 1 | FORMATO §4 vs MECC §11 | Il puntatore §11 non menziona i moduli bloccati | D-PTR-1: il puntatore non entra in un modulo bloccato; senza criteri tutti aperti (coerente con C1) |
| 2 | FORMATO §2 | Criterio "auto" soddisfatto dal "quiz del modulo", ma i quiz si generano per unità (FUNZ §14) | D-QUIZ-1 (**da confermare**): qualsiasi quiz sulle unità del modulo o ad ambito modulo ≥ soglia |
| 3 | MECC §19 | "Facile": facilità prima o dopo l'aggiornamento | D-SM2-1: dopo (imposto da I1) |
| 4 | MECC §19 | "Niente": intervallo successivo non definito | D-SM2-2: azzerato |
| 5 | MECC §10.3 | "senza durata: 4 cicli" | D-POMO-1: 8 segmenti (studio+pausa ×4) |
| 6 | MECC §14 | "Adesso" per routine senza durata | D-NOW-1: fine effettiva = 23:59 |
| 7 | FUNZ | Rimandi ai paragrafi sfalsati di uno (§8→§7, §10→§9, §12→§11, §13→§12, §16→§15, §23→§8.7) | Cosmetico; spec non modificate |
| 8 | MECC §25 | La chiave Gemini viene sincronizzata sul servizio remoto | Raccomandazione (non requisito): cifrarla lato client prima dell'invio — decisione al Checkpoint 4 |
| 9 | CONTESTO §1 | Lo Studio deve poter generalizzare Corso→Modulo→Unità | Il dominio usa `moduloNumero`/`ordine` generici sull'unità; la gerarchia a tre livelli resta il caso di riferimento (D-STUDIO-1) |
| 10 | CONTESTO §3 vs MECC §1 | "Fuso orario non deve spostare i blocchi di giorno" vs "ogni istante è assoluto": in viaggio le due regole divergono | D-TIME-2: **ora locale di parete**, decisa dall'utente al CP0 il 24/09 (`docs/decisioni/D-TIME-2.md`) |
| 11 | `CLAUDE.md`, `AUDIT_FOUNDATION.md` §12 | Dichiaravano «45 scenari»; SCENARI ne contiene 54 | Corretto (24/09); `docs/TRACCIABILITA.md` li elenca tutti e il gate verifica la corrispondenza (D-TRACC-1) |
| 12 | `STATO.md` vs `TASKS.md`, `06_SUPERVISIONE.md` | T-011 e T-012 «possono partire subito», ma T-011 è marcato CP0 | Corretto: attendono il CP0 |
| 13 | `02_ARCHITETTURA.md` §1, §3 | Parser «in arrivo» sebbene esista; carte con `ease`/`intervalDays`/`dueAt` contro D-NAMING-1 | Corretto: nomi italiani (`facilita`, `intervalloGiorni`, `scadenza`) |
| 14 | `02_ARCHITETTURA.md` §2 vs `ci.yml` | Quattro fusi con Kolkata nel documento, tre nella CI | CI con Kolkata (fuso a mezz'ora); INV-11 |
| 15 | `.gitignore` vs guida Fase 4 / T-000 | Versionare o no l'export del design: mai deciso | D-DESIGN-1: si versiona; ignorati solo gli ZIP |
| 16 | `.claude/settings.json` vs guida Fase 5, `06_SUPERVISIONE.md` | `npm install` auto-approvato, ma la supervisione ferma l'agente sulle dipendenze non previste | D-DEP-1: registro `docs/DIPENDENZE.md` verificato dal gate; senza riga il gate è rosso |
| 17 | `04_STRUMENTI.md` §5 vs ambiente reale | Plugin previsti con ambito progetto, abilitati a livello utente | Azione dell'utente (`STATO.md`, problemi aperti) |
| 18 | `parser.ts`, `sm2.ts` | Campi `module`/`course`/`warnings`/`schedule` rimasti in inglese dopo D-NAMING-1 | Corretto (`modulo`, `corso`, `avvisi`, `sm2`) |
| 19 | MECC §22 con §1 | Il file di backup (“tutto tranne il registro notifiche”) conterrebbe la chiave Gemini in chiaro | D-BACKUP-1 **aperta**: decisione al CP4 |
| 20 | MECC §25 | Sorgente dell'istante di `updatedAt` per «ultimo vince» non specificata: orologi sfasati invertono l'esito | D-SYNC-1: decisione al CP4 |
| 21 | FORMATO §1 | Numeri di modulo o unità duplicati nello ZIP: la spec tace, gli id del parser collidono | D-PARSE-3 (T-003): il duplicato successivo è saltato con avviso, il primo vince |
| 22 | `TASKS.md` vs `06_SUPERVISIONE.md` | CP2 e CP6 erano marcati sul task che il checkpoint **segue** (T-008, T-035): con il blocco meccanico dei task CPn il loop non li avrebbe mai avviati | Corretto: marcatori spostati sui task successivi (T-009, T-010); il checkpoint che segue un task è scritto nel testo del task |
| 23 | FUNZ §14.6 vs MECC §18 (e MECC §18 al proprio interno) | Il riepilogo dell'Audio Flash-Trivia «con punteggio ed elenco delle sbagliate» (FUNZ §14.6 e paragrafo «Fine della pratica» di MECC §18) contro «Nessun punteggio», risultato = ascoltate/totali (tabella e paragrafo Trivia di MECC §18; MECC §20 e FUNZ §17.4 contano le playlist ascoltate) | D-TRIVIA-1: prevale il paragrafo specifico; riepilogo con ascoltate/totali e le due azioni, senza punteggio né sbagliate |
| 24 | FORMATO §0 vs FORMATO §2–§3 | §0 dichiara `course-data.js` «risultato atteso della lettura» di M0/M1, ma il fixture si discosta dalle regole in quattro campi: intestazione «Teoria (Fondamenta)» (§3 mostra «Fondamenta»), «· mini-modulo» preso dalla parentesi della finestra di M1 (§2 la rimuove), intro ridotta al primo paragrafo più la riga guida degli obiettivi (§2 conserva i paragrafi introduttivi), link del test di fit ridotti al titolo | D-DESIGN-1: vince il fixture; il parser produce `course-data.js` senza differenze (`scripts/corso-esempio.test.mjs`) (T-000); tutto il resto coincide |
| 25 | MECC §4, §5; FUNZ §5, §6; SCENARI E1 vs scelta dell'utente (25/09/2026) | La spec non dice cosa fa «Segna come fatto» con voci non spuntate e dà al follow-up di una fase saltata «orizzonte mese» e «titolo dato dall'utente» | D-DETT-2: il todo derivato (voci rimaste o fase saltata) eredita la scadenza dell'attività da cui nasce, mai prima di oggi; titolo = etichetta della fase (D-DESIGN-1). Spec allineata il 25/09/2026 su richiesta esplicita dell'utente (INV-5) |
| 26 | SCENARI B2 vs MECC §24 (e §1) | B2: l'occorrenza di routine è spuntabile per tutto il suo giorno, anche dopo la marcatura «persa» delle 08:30; §24: nel calendario «i persi/saltati non sono spuntabili salvo i todo» | Lettura che le tiene entrambe (D-DETT-1, D-DETT-3; 28/09/2026): §24 vale per il cerchio della card (nessuna spunta diretta su una routine persa), B2 è soddisfatto dal Dettaglio, un tocco più in là, dove «Fatta» e «Saltata» restano fino alle 23:59. Alternativa da confermare con l'utente: il cerchio accetta anche la routine persa nel suo giorno |
| 27 | MECC §6 vs MECC §15 | §6: l'orizzonte di un todo conta «a partire dal giorno di creazione»; §15 sposta un todo su un altro giorno della striscia senza dire se la scadenza lo segue | D-DRAG-1 n. 8 (T-015, 28/09/2026), con la lettura di D-HOR-1 n. 6 (il giorno del todo è `giornoLocale`): l'orizzonte riparte dal giorno nuovo (di sabato un todo «entro la settimana» portato a lunedì scade la domenica dopo). Alternativa da confermare con l'utente: orizzonte fisso al giorno di creazione, con un campo nuovo sul blocco; un todo spostato oltre la sua scadenza diventerebbe «non fatto» il giorno stesso |

## 7. Informazioni mancanti (non deducibili dalle spec)

| Cosa | Impatto | Gestione |
|---|---|---|
| Stack tecnologico | Architettura | **Deciso** in T-000 (D-STACK-1, 24/09/2026): React 19 + Vite PWA + Capacitor; CP1 chiuso senza veto (25/09/2026), applicato da T-006 |
| Servizio di sincronizzazione (backend) | Passo 10 | **Checkpoint 4** — candidata: Supabase (auth email OTP) |
| Export del progetto Claude Design | Aspetto UI, corso di esempio (M0/M1) | **Importato e versionato** in `claude-design/` (24/09/2026): `npm run design:check` verde; divergenze design↔spec in `docs/03_HANDOFF_DESIGN_CODE.md` §10 |
| Identificatori app (bundle id, nome, icona) | Capacitor | Default `com.routforge.app` / "RoutForge" (D-APP-1), modificabile |
| Modello Gemini "più economico" di default | Impostazioni AI | Letto dalla lista modelli dell'API; ripiego al nome noto più economico |
| Sorgente dell'istante di `updatedAt` per «ultimo vince» (orologio del dispositivo o del servizio) | Passo 10 | **Checkpoint 4** — D-SYNC-1 |
| Chiave Gemini nel file di backup (in chiaro per MECC §22) | Passo 9 | **Checkpoint 4** — D-BACKUP-1 |
| Numeri di modulo/unità duplicati nello ZIP del corso | Passo 1 (T-003) | **Deciso** in T-003 (D-PARSE-3): duplicato saltato con avviso |

## 8. Priorità (ordine di costruzione, CONTESTO §6)

1 Dati e import corso → 2 Attività e calendario → 3 Scheduler → 4 Sessione → 5 Notifiche → 6 Adesso/trascinamento/Notifiche/widget → 7 Materiali e AI → 8 Statistiche → 9 Backup/lingua/impostazioni/diagnostica → 10 Sync. Ogni passo supera i propri scenari prima del successivo. Il dettaglio dei task è in `docs/TASKS.md`.

## 9. Stato del contesto

Sufficiente per procedere: tutte le regole necessarie ai passi 1–9 sono nelle spec; i punti aperti sono confinati ai checkpoint sopra.
