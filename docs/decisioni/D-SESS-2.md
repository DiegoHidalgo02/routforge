# D-SESS-2 — Abbandono oltre soglia: al 65% del pianificato l'abbandono diventa «Continua»

**Stato**: decisa dall'utente il 30/09/2026 (council con Codex e Claude, `.claude/council-cache/council-1790757466.md`);
**applicata** con T-046 il 30/09/2026 (con la precisazione in fondo, confermata dall'utente il 02/10/2026); **spec allineata il 30/09/2026** con il testo in
fondo (scenario D7; `deny` su `docs/spec` tolto e rimesso dall'agente su richiesta esplicita dell'utente, INV-5). Riga
nel registro: `docs/01_DECISIONI.md`.

## Contesto
MECC §10.5: `abbandonata` = nessun esito, blocco → `programmato`; il ciclo lo marca poi `perso` (C8) e, con D-NOTIF-2,
senza avviso. L'utente non vuole che uno studio fatto per gran parte finisca come un blocco perso: «se si è fatto
almeno il 65% del tempo della sessione va dato come fatto; sotto l'attività risulta non completata ma va registrato
nelle statistiche». Un completamento automatico (`Completata`) romperebbe l'unità del corso, il puntatore e la
streak; la lettura coerente con le parole dell'utente è l'esito **Continua**: blocco `parziale`, minuti accreditati,
streak +1, niente «perso». Il council proponeva in alternativa una domanda oltre soglia («Registra esito» o
«Abbandona comunque»); l'utente ha confermato l'automatismo.

## Decisione
1. **Soglia** = focus / durata pianificata della sessione ≥ **65%**, calcolata all'istante dell'abbandono; pause e tempo
   extra esclusi (il focus è già trascorso − pause; il tempo extra oltre la durata non alza il rapporto oltre 1). La
   durata pianificata è quella di §10.2, la stessa del tempo extra: fine − avvio se ancorata all'orologio, altrimenti la
   durata scelta (precisazione di T-046, in fondo; prima diceva «del blocco»).
2. **Sopra la soglia**: la sessione si chiude come `terminata_prima` con l'esito **Continua** registrato tramite la
   scrittura unica degli esiti (`endSession` → `writeOutcome`, D-ESITO-1): blocco `parziale` con i minuti, unità
   `parziale` con il progresso di §11, streak di §12, puntatore ricalcolato; «conta nel piano» sì; confidenza e nota
   assenti, correggibili dal Dettaglio («Registra esito» sul parziale non è previsto: si usa la ripresa del parziale,
   D-SESS-1 n. 5, o il Dettaglio se T-046 aggiunge la correzione).
3. **Sotto la soglia**: abbandono come oggi (nessun esito, blocco → `programmato`, sessione `abbandonata` nelle
   statistiche).
4. **Ambito**: solo le sessioni collegate a un blocco e con una durata (routine di studio: il tempo fino alla fine del
   blocco; recupero con durata scelta: quella durata; con il cronometro nessuna soglia). Non vale per le sessioni
   libere senza blocco né per le routine generiche, che non hanno un timer. (Prima di T-046: «la durata pianificata è
   quella del blocco»; con quella lettura un recupero da 25' su un blocco da 60' si fermerebbe al 41% e la soglia non
   scatterebbe mai.)
5. **UI**: il link «Abbandona · nessun esito» (S16, S15 banner) mostra sotto la soglia il testo attuale e sopra la
   soglia «Chiudi come Continua (65%)», così l'utente sa che cosa succede; la schermata finale dice che l'esito è stato
   registrato. Aspetto confermato da `design-checker` il 02/10/2026 (divergenza 38: non nel mock, coerente con i token).

## Testo per la spec (applicato il 30/09/2026)
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
- Con D7 gli scenari sono 55: `CLAUDE.md` §1, l'intestazione di `docs/TRACCIABILITA.md` e la riga D7 (T-046,
  `nessuno`) sono aggiornati.

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

## Precisazione di T-046 (30/09/2026; confermata dall'utente il 02/10/2026)
I n. 1 e 4 dicevano «durata pianificata del blocco». Il codice usa la **durata pianificata della sessione**, la stessa
del tempo extra e dell'avanzamento del timer (§10.2, §10.4): fine − avvio per una sessione ancorata all'orologio (una
routine 09:00–10:00 avviata alle 09:30 conta sui 30' residui: bastano 19,5' invece di 39'), la durata scelta per un
recupero. È la lettura letterale delle parole dell'utente («65% del tempo della sessione»), mantiene coerente il tetto
del 100% con il tempo extra e fa scattare la soglia anche nei recuperi (con la durata del blocco un recupero da 25' su
60' non la raggiungerebbe mai). Il testo di spec («focus / durata pianificata») ammette entrambe le letture: il revisore
`spec-reviewer` lo conferma. Se l'utente preferisce la durata del blocco basta leggerlo in `abandonSession` e passarne
la durata a `focusPercent`.

**Conferma dell'utente (02/10/2026)**: «se si inizia in ritardo vale sempre la regola del 65 %, ma viene registrato il
ritardo per le statistiche e l'attività risulta conclusa, non con il tempo pieno». Letto così: la soglia si calcola sul
tempo residuo della sessione; il ritardo d'avvio resta in `Blocco.minutiRitardo` (D-SESS-1 n. 2, letto da T-029); il
blocco è `parziale` con i minuti effettivi (esito Continua, n. 2: non `completato`, che avanzerebbe il puntatore senza
valutazione). L'utente chiede anche una **casistica completa delle chiusure** (ogni caso → che cosa si registra): da
scrivere come tabella con un test per riga (`docs/STATO.md`, Prossimo task).

## Verifica
Casistica completa delle chiusure (02/10/2026, chiesta dall'utente): `docs/SESSIONI.md`, un test per riga in
`src/app/session.test.ts` («Casistica delle chiusure»: 21 casi fra avvio in orario e in ritardo, recupero, cronometro,
continuità e sessione libera).

Fatta con T-046: `src/domain/timer.test.ts` («Abbandono oltre soglia — SCENARI D7»: 65% e 58%, pause e tempo extra
esclusi, recupero sulla durata scelta, libera e cronometro senza soglia), `src/app/session.test.ts` (D7 dal database:
esito Continua scritto, blocco `parziale` con 39 minuti, unità `parziale`, streak; sotto soglia abbandono e perso),
`src/ui/Session.test.tsx` (testo del link e schermata finale).
