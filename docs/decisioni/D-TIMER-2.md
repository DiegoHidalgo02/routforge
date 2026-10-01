# D-TIMER-2 — Continuità della sessione: battiti, intervallo non verificato, timer con app chiusa

**Stato**: decisa dall'utente il 30/09/2026 (council con Codex e Claude, `.claude/council-cache/council-1790757466.md`);
**applicata** con T-047 il 30/09/2026 (battiti, intervallo non verificato, avviso alla riapertura); **da applicare** con
T-021 (servizio Android in primo piano con la notifica-cronometro) e T-036 (Live Activity iOS); **spec allineata il
30/09/2026** con il testo in fondo (`deny` su `docs/spec` tolto e rimesso dall'agente su richiesta esplicita
dell'utente, INV-5). Riga nel registro: `docs/01_DECISIONI.md`. Estende D-TIMER-1 (D4 e il punto 8).

## Contesto
D-TIMER-1 salva solo istanti e riprende il timer dopo la chiusura contando tutto il tempo come focus (D4: riaperta 12'
dopo → 12' di focus); nulla chiude una sessione dopo un crash e una sessione terminata giorni dopo conta tutto quel
tempo. L'utente vuole che il timer continui anche ad app chiusa, con una notifica del tempo che scorre, e che, se
l'app viene arrestata, il tempo si ricalibri sul tempo mancante mostrando quando ci si è fermati e per quanto. Il
council ha chiarito i limiti: Android può tenere il timer vivo con un servizio in primo piano; iOS non consente un
timer in background (al più una Live Activity e la notifica di fine); il web non ha processi. Dopo il fatto non si
distingue «app in background», «processo ucciso» e «telefono spento»: si osserva solo l'ultima continuità verificata.

## Decisione
1. **Battiti**: la sessione attiva registra un istante di continuità (`ultimoBattito` in `preferenze.sessioneAttiva`)
   ogni minuto finché l'app è in primo piano e, su Android, finché il servizio in primo piano della sessione è attivo.
   Lo scrive il servizio della sessione con la porta `Clock`, fuori dalla transazione del ciclo (INV-15 non cambia).
2. **Intervallo non verificato**: alla riapertura, se dall'ultimo battito sono passati più di **30 minuti** (la
   soglia degli orfani, §8), l'intervallo [ultimo battito, riapertura] non conta nel focus né come pausa volontaria; la
   sessione resta aperta; l'app mostra quando si è fermata (ora dell'ultimo battito, dichiarata approssimativa), per
   quanto e il tempo residuo; l'utente può attribuire a mano l'intervallo al focus. Entro 30 minuti vale D4: il tempo
   conta come focus.
3. **Ancoraggio**: per le sessioni ancorate all'orologio la fine resta quella del blocco (§10.2): un'interruzione non
   allunga lo slot; a fine passata si registra l'esito o si avvia un recupero. Per quelle ancorate al focus la ripresa
   usa il focus confermato e il tempo residuo.
4. **Piattaforme**: Android → servizio in primo piano con notifica persistente che mostra il cronometro (T-021); iOS →
   Live Activity con il conto alla rovescia e la notifica «tempo scaduto» (T-036); web → solo Wake Lock a scheda
   aperta (D-SESS-1). Uscire dall'interfaccia non mette in pausa. Riavvio, arresto forzato e assenza del servizio sono
   intervalli non verificati, senza attribuzione di causa: l'interfaccia dice «non verificato», non «l'app si è fermata
   alle 14:23».
5. **Modello**: `SessioneAttiva` guadagna `ultimoBattito` e `intervalliNonVerificati: { da, a, contato: boolean }[]`;
   `domain/timer.ts` esclude dal focus gli intervalli non contati; D4 si estende (scenario D4, seconda parte).

## Testo per la spec (applicato il 30/09/2026)
- MECC §10.4, nuovo paragrafo dopo «Iperfocus»: «**Continuità** (D-TIMER-2, 30/09/2026): la sessione attiva registra
  un **battito** (istante di continuità) ogni minuto finché l'app è in primo piano e, su Android, finché il servizio in
  primo piano della sessione è attivo, con una notifica persistente che mostra il cronometro; su iOS e sul web nessuna
  continuità in background è garantita. Uscire dall'interfaccia non mette in pausa. Alla riapertura, se dall'ultimo
  battito sono passati più di **30 minuti**, l'intervallo è **non verificato**: non conta nel focus né come pausa
  volontaria, la sessione resta aperta e l'app mostra quando si è fermata, per quanto e il tempo residuo; l'utente può
  attribuire a mano l'intervallo al focus. Entro 30 minuti il tempo conta come focus. Per le sessioni ancorate
  all'orologio la fine non si sposta; per quelle ancorate al focus la ripresa usa il focus confermato e il tempo
  residuo. Riavvio del dispositivo, arresto forzato e assenza del servizio sono intervalli non verificati, senza
  attribuzione di causa.»
- FUNZ §11.2, primo punto: «Timer persistente: si può navigare altrove e rientrare da un banner; sopravvive alla
  chiusura dell'app. Su Android continua anche con l'app chiusa, con una notifica persistente che mostra il
  cronometro; su iOS e sul web no. Un'assenza di più di 30 minuti diventa un intervallo non verificato, mostrato al
  rientro con l'ora in cui ci si è fermati, la durata e il tempo residuo: non conta come studio finché non lo si
  attribuisce (MECC §10.4).»
- SCENARI D4: «**D4 — Persistenza e continuità** — Sessione avviata, app chiusa, riaperta 12' dopo: il timer riprende
  con 12' in più di focus (non in pausa) e il banner permette di rientrare. Riaperta 45' dopo l'ultimo battito: la
  sessione è ancora aperta; i 45' sono un intervallo non verificato, mostrato alla riapertura con l'ora dell'ultimo
  battito, la durata e il tempo residuo, e non contano nel focus finché l'utente non li attribuisce; per una sessione
  ancorata all'orologio la fine resta quella del blocco.»

## Alternative scartate
Contare tutto come focus (D-TIMER-1: sessioni di giorni); mettere in pausa a ogni uscita dall'interfaccia (su iOS ogni
cambio d'app sarebbe una pausa); chiudere da soli la sessione dopo N ore (soglia inventata); promettere il timer in
background anche su iOS e web.

## Conseguenze
- T-047: battiti, intervallo non verificato e avviso in S15 (divergenza 37 bis: il mock non lo disegna); D4 esteso.
- T-021: servizio in primo piano Android, notifica-cronometro, Doze; T-036: Live Activity.
- T-029: il focus esclude gli intervalli non contati; «uscite» e interruzioni restano come in D-TIMER-1.
- D-SESS-2: la soglia del 65% si calcola sul focus confermato.

## Precisazioni di T-047 (30/09/2026)
- L'intervallo non verificato lo **registra il battito** (`beat`): il servizio batte subito all'avvio dell'app, al
  ritorno in primo piano e ogni minuto. Il dominio non lo deduce a ogni lettura dall'ultimo battito: così una sessione
  senza battiti (test, consumatori esterni) conta tutto come focus, come prima, e la classificazione avviene «alla
  riapertura» come dice il testo. Fra la riapertura e la scrittura del battito il timer può mostrare per un istante il
  tempo intero come focus.
- Una **pausa rimasta aperta** è verificata solo fino all'ultimo battito: il battito che registra l'intervallo la chiude
  lì, così l'intervallo non conta né nel focus né come pausa volontaria (§10.4) e «Conta nel focus» ha effetto; alla
  riapertura la sessione non è in pausa (uscire dall'interfaccia non mette in pausa, n. 4).
- L'avviso resta finché l'intervallo non è attribuito (non c'è «lascia fuori»: la spec non lo prevede) e compare anche
  nell'iperfocus, dove l'ora di sblocco di una sessione ancorata al focus dipende dall'attribuzione.
- **Solo in primo piano** (n. 1, 01/10/2026): la porta `Clock` ha `inForeground()` (sul web `document.visibilityState`,
  lo stesso criterio di `onForeground`) e `startHeartbeat` salta il battito quando l'app non è in primo piano; il
  battito torna con `onForeground`. Una scheda nascosta per più di 30' produce quindi un intervallo non verificato al
  ritorno, come su iOS; entro 30' il tempo conta come focus. L'adapter Android di T-021 risponde vero anche a WebView
  nascosta finché il servizio in primo piano della sessione è attivo, e batte per conto suo.

## Verifica
Fatta con T-047: `src/domain/timer.test.ts` («Persistenza e continuità — SCENARI D4»: intervallo registrato dal
battito ed escluso dal focus, attribuzione manuale, 30 minuti esatti inclusi e 30'01" esclusi, fine ancorata
invariata, focus confermato per la soglia di D7, pausa sovrapposta), `src/app/session.test.ts` (battito subito, ogni
minuto e al primo piano con l'orologio finto; D4 seconda parte dal database; righe vecchie), `src/ui/Session.test.tsx`
(avviso alla riapertura e «Conta nel focus»).
