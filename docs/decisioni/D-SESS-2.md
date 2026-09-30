# D-SESS-2 — Abbandono oltre soglia: al 65% del pianificato l'abbandono diventa «Continua»

**Stato**: decisa dall'utente il 30/09/2026 (council con Codex e Claude, `.claude/council-cache/council-1790757466.md`);
**da applicare** con T-046; **spec da aggiornare** con il testo in fondo (cartella `docs/spec` protetta dal `deny`: lo
toglie l'utente). Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto
MECC §10.5: `abbandonata` = nessun esito, blocco → `programmato`; il ciclo lo marca poi `perso` (C8) e, con D-NOTIF-2,
senza avviso. L'utente non vuole che uno studio fatto per gran parte finisca come un blocco perso: «se si è fatto
almeno il 65% del tempo della sessione va dato come fatto; sotto l'attività risulta non completata ma va registrato
nelle statistiche». Un completamento automatico (`Completata`) romperebbe l'unità del corso, il puntatore e la
streak; la lettura coerente con le parole dell'utente è l'esito **Continua**: blocco `parziale`, minuti accreditati,
streak +1, niente «perso». Il council proponeva in alternativa una domanda oltre soglia («Registra esito» o
«Abbandona comunque»); l'utente ha confermato l'automatismo.

## Decisione
1. **Soglia** = focus / durata pianificata del blocco ≥ **65%**, calcolata all'istante dell'abbandono; pause e tempo
   extra esclusi (il focus è già trascorso − pause; il tempo extra oltre la durata non alza il rapporto oltre 1).
2. **Sopra la soglia**: la sessione si chiude come `terminata_prima` con l'esito **Continua** registrato tramite la
   scrittura unica degli esiti (`endSession` → `writeOutcome`, D-ESITO-1): blocco `parziale` con i minuti, unità
   `parziale` con il progresso di §11, streak di §12, puntatore ricalcolato; «conta nel piano» sì; confidenza e nota
   assenti, correggibili dal Dettaglio («Registra esito» sul parziale non è previsto: si usa la ripresa del parziale,
   D-SESS-1 n. 5, o il Dettaglio se T-046 aggiunge la correzione).
3. **Sotto la soglia**: abbandono come oggi (nessun esito, blocco → `programmato`, sessione `abbandonata` nelle
   statistiche).
4. **Ambito**: solo le sessioni collegate a un blocco con durata pianificata (routine di studio, recupero con durata
   scelta: la durata pianificata è quella del blocco; con il cronometro nessuna soglia). Non vale per le sessioni
   libere senza blocco né per le routine generiche, che non hanno un timer.
5. **UI**: il link «Abbandona · nessun esito» (S16, S15 banner) mostra sotto la soglia il testo attuale e sopra la
   soglia «Chiudi come Continua (65%)», così l'utente sa che cosa succede; la schermata finale dice che l'esito è stato
   registrato. Aspetto da confermare con `design-checker` (divergenza 38).

## Testo per la spec (da applicare quando `docs/spec` è sbloccata)
- MECC §10.5, dopo il riepilogo: «**Abbandono oltre soglia** (D-SESS-2, 30/09/2026): se la sessione è collegata a un
  blocco con durata pianificata e al momento dell'abbandono focus / durata pianificata ≥ **65%** (pause e tempo extra
  esclusi), la sessione non si abbandona: si chiude come `terminata prima` con l'esito **Continua** registrato (§11,
  §12; «conta nel piano» sì), correggibile dal Dettaglio. Sotto la soglia: abbandono (nessun esito, blocco →
  `programmato`). Non vale per le sessioni senza blocco né per le routine generiche, che non hanno un timer.»
- FUNZ §11.3, ultima frase: «Un abbandono (avvio sbagliato) non registra esito; se però si è già studiato almeno il
  65% della durata pianificata, la sessione si chiude con l'esito Continua (MECC §10.5).»
- SCENARI, dopo D6: «**D7 — Abbandono oltre soglia** — Sessione in modalità routine sul blocco 09:00–10:00 (unità 1.1),
  avviata alle 09:00. «Abbandona» alle 09:40 con 39' di focus (65%): la sessione si chiude come terminata prima con
  esito Continua, il blocco è `parziale` con 39 minuti, l'unità 1.1 è `parziale`, la streak aumenta. «Abbandona» alle
  09:35 con 35' di focus (58%): abbandono, il blocco torna `programmato` e alle 10:30 è perso.»
- Con D7 gli scenari diventano 55: aggiornare `CLAUDE.md` §1 e l'intestazione di `docs/TRACCIABILITA.md`, e
  aggiungere la riga D7 (T-046, `nessuno`).

## Alternative scartate
`Completata` automatica (avanza il puntatore senza una valutazione); domanda oltre soglia (un tocco in più ogni volta;
l'utente preferisce l'automatismo, correggibile dopo); nuovo stato del blocco «fatto senza esito» (ambiguo per
statistiche e puntatore); soglia sul tempo a orologio (le pause darebbero credito).

## Conseguenze
- T-046: regola pura in `domain/timer.ts` (`abandonThreshold` o simile) e in `abandonSession` di `src/app/session.ts`;
  scenario D7; testi UI nelle sei lingue; T-029 conta la chiusura «terminata prima con Continua» fra le sessioni
  concluse, non fra gli abbandoni.
- Riapre la domanda di D-TIMER-1 n. 8 per una sessione rimasta aperta dopo un crash: con D-TIMER-2 l'intervallo non
  verificato non conta nel focus, quindi la soglia si calcola sul focus confermato.

## Verifica
Con T-046: `src/domain/timer.test.ts` (soglia, pause e tempo extra esclusi, cronometro escluso), `src/app/session.test.ts`
(D7 dal database: esito Continua scritto, streak, puntatore; sotto soglia abbandono e perso), `src/ui/Session.test.tsx`
(testo del link).
