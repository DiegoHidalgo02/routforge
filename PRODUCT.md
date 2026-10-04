# Product

<!-- impeccable:product-schema 1 -->

*Record di prodotto per il lavoro di design (impeccable). Deriva da `docs/spec/` e dalle risposte dell'utente del
24/09/2026; in caso di differenza vincono le spec (ordine in `CLAUDE.md` §1). L'aspetto viene dal design importato in
`claude-design/`, valido dopo il suo handoff (`docs/03_HANDOFF_DESIGN_CODE.md`).*

## Platform

web

Un solo linguaggio visivo su Android, iOS e web installabile (confermato dall'utente): quello del design, mobile-first
con variante desktop (da 1024 px, D-UI-1), dentro una shell nativa. Le eccezioni di piattaforma sono funzionali, non
visive: widget Home (Android; iOS se disponibile), sveglie a schermo intero e Non Disturbare (mobile), notifiche in
background (mobile; web solo a scheda aperta), backup nella cartella documenti (mobile).

## Stack

Deciso in T-000 (D-STACK-1, `docs/decisioni/D-STACK-1.md`): TypeScript + React 19 + Vite (PWA) + Capacitor. Il
dominio è TypeScript puro e non dipende dalla scelta.

## Users

Studenti in generale (confermato): scuola superiore, università, ITS, corsi online, formazione personale. Il caso di
partenza è uno studente autodidatta che segue un corso strutturato Corso → Modulo → Unità ("Syllabus Software Engineer
2026"); il modello deve generalizzarsi senza un sistema separato per ogni tipo di studente (CONTESTO §1).

Ogni installazione ha **un solo utente** con i suoi dispositivi: nessuna condivisione, nessun ruolo. Il lavoro che fa:
organizzare la propria giornata e far avanzare il proprio percorso di studio nello stesso posto, anche quando il piano
salta.

## Product Purpose

App di organizzazione e studio: calendario con quattro tipi di attività (todo, evento, routine, routine di studio),
scheduler che ripianifica da solo, timer di studio i cui esiti fanno avanzare il corso, promemoria configurabili,
pratica generata dall'AI, statistiche sul comportamento di studio, sincronizzazione fra dispositivi.

Successo: aprendo l'app lo studente vede subito cosa fare adesso (blocco "Adesso" pronto entro 0,5 s) e il calendario
resta vero senza manutenzione manuale.

## Positioning

**Studio e vita in un unico calendario** (scelto dall'utente come tratto centrale). Todo, eventi, routine e sessioni di
studio convivono sulla stessa giornata: non esiste una lista attività separata (CONTESTO §5), e lo studio non vive in
un'app a parte. La routine di studio è un'attività del calendario come le altre, ma riceve da sola l'unità successiva
dal puntatore del corso.

Meccanismi che lo rendono possibile (dalle spec, non indicati come centrali dall'utente): scheduler che sposta i todo,
marca i persi ed estende le routine; esiti di sessione che muovono il puntatore; pratica AI generata dalle unità.

## Operating Context

- Uso quotidiano su telefono (mobile-first), con variante desktop; la stessa persona passa da un dispositivo all'altro
  (sync di attività e impostazioni).
- Tutto offline salvo AI e sincronizzazione; tempo e giorno sempre **locali** del dispositivo (al cambio di fuso vale
  l'ora di parete, D-TIME-2).
- Rituali: apertura su Oggi, sessione di studio con timer (pomodoro, tempo extra, iperfocus a schermo intero), chiusura
  con uno dei quattro esiti (Completata / Continua / Indietro / Salta), digest mattutino, sveglie a schermo intero,
  schermata Notifiche con gli esiti pendenti.
- Corsi importati come ZIP di markdown (`docs/spec/RoutForge_FORMATO_CORSO.md`); ogni import è un corso nuovo.
- AI: Gemini con chiave dell'utente, inserita nelle Impostazioni; senza chiave un errore leggibile, tutto il resto
  funziona.

## Capabilities and Constraints

- Regole esatte (stati, soglie, algoritmi) in `docs/spec/RoutForge_MECCANISMI.md`; criteri di accettazione (55
  scenari) in `docs/spec/RoutForge_SCENARI.md`; numeri in una pagina in `docs/00_SINTESI.md`.
- Vocabolario del dominio in italiano come nelle spec (D-NAMING-1): blocco, occorrenza, perso ("non fatto" per i todo),
  recupero, esito, puntatore, unità pendente, fasi, checklist, iperfocus, tempo extra, digest.
- Cose che l'app **non** fa (CONTESTO §5): lettura ad alta voce dei corsi (voce solo per Audio Flash-Trivia), servizi
  musicali, ricerca di risorse su internet, lista attività separata, schermata di benvenuto, selettore di lingua.
- Sei lingue dell'interfaccia (it, en, es, pt, fr, de) prese dal dispositivo, ripiego inglese; ogni testo visibile,
  notifiche incluse, passa da un dizionario.
- Dati sul dispositivo; nulla esce se non verso il servizio di sync scelto e il fornitore AI (solo il contesto della
  richiesta).
- Decisioni aperte che il design non deve anticipare: D-QUIZ-1 (CP5), D-BACKUP-1 e D-SYNC-1 con il backend di sync
  (CP4), identificatori app (default `com.routforge.app` / "RoutForge", D-APP-1).

## Brand Commitments

- Nome: **RoutForge**.
- Voce dei testi dell'app (presa dal vecchio design e applicata nelle sei lingue di `src/ui/i18n/`; da riconfermare
  con il nuovo design): diretta e concreta, seconda persona, frasi brevi, niente punto esclamativo, niente emoji. Esiti
  e stati al participio ("Completata", "Persa · era alle 14:30"), azioni all'imperativo ("Inizia", "Registra esito").
  Formati: `16:00`, `45m` / `3h 45m`, `ven 18 set`, `6 / 13`, `46 %`.
- L'aspetto si decide in Claude Design: il design importato in `claude-design/` diventa la fonte visiva dopo il suo
  handoff (oggi nessuno è attivo, il nuovo arriva via MCP). Si cambia in Claude Design e si reimporta, non a mano.

## Evidence on Hand

- Corso di esempio: `src/data/sample-course/M0-Riattivazione_JavaScript.md` (9 unità) e `M1-Tooling_Moderno.md`
  (4 unità), letti dal parser come in `course-data.js` della stessa cartella. M2–M4 esistono solo come numero e
  titolo.
- Assenti e da non inventare: testimonianze, utenti, metriche d'uso, titoli, conteggi, ore o carte non presenti nei
  file del corso.

## Product Principles

1. **Una giornata sola.** Tutto ciò che occupa il tempo dello studente sta nello stesso calendario; nessuna vista che
   separi lo studio dal resto.
2. **Il piano resta vero da solo.** Quando la giornata salta, l'app ripianifica e chiede solo l'esito; lo studente non
   fa manutenzione.
3. **Il corso avanza per esiti, non per scelte.** L'utente non sceglie mai l'unità della prossima occorrenza: la porta il
   puntatore.
4. **Generale senza essere astratto.** Deve servire lo studente di scuola, università, ITS o autodidatta, partendo dalle
   capacità reali dello Studio; Corso → Modulo → Unità resta il caso di riferimento pienamente supportato.
5. **Offline e locale per default.** Nessuna funzione dipende dall'essere online, tranne AI e sync.

## Accessibility & Inclusion

- Rispetto della riduzione animazioni (`prefers-reduced-motion`: solo dissolvenze) e della scala del testo di sistema
  (CONTESTO §3).
- Focus visibile su ogni controllo.
- Sei lingue: il layout deve reggere stringhe più lunghe dell'italiano (de, fr, pt).
