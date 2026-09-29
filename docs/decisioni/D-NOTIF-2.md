# D-NOTIF-2 — Ore silenziose, digest, posticipi e avvisi one-shot

**Stato**: applicata il 29/09/2026 (T-020): `src/domain/notifications/quietHours.ts`, `src/domain/notifications/digest.ts`,
`src/domain/notifications/desiredSet.ts`, `src/domain/lost.ts` (`lostNotificationDue`), `src/app/notifications.ts`,
`src/platform/notifications.ts`, `src/ui/notificationTexts.ts`, i sei JSON di `src/ui/i18n/`. Revisione indipendente
`spec-reviewer`. Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto
MECC §13.4–§13.6 danno la fascia silenziosa, il digest e gli avvisi one-shot; §13.2 il posticipo; §6 e §8 gli avvisi
«todo in ritardo» e «blocco perso» «una volta». Restano aperti: dove vivono gli one-shot perché ogni riconciliazione li
ritrovi senza rispedirli (D-NOTIF-1 n. 6: il registro è derivato); che cosa conta come «arretrato» nel digest; dove
ricordare un posticipo; i tre casi lasciati aperti da D-SCHED-1, D-OCC-1 e D-ESITO-1 (blocco nato già perso, blocco perso
una seconda volta, studio orfano o «conta nel piano» spento riportato a `programmato` e perso); il default delle ore
silenziose; una voce armata che il desiderato non elenca più perché scatta entro 5 s.

## Decisione
1. **One-shot derivati dalle marcature** (`oneShotNotifications`): «todo in ritardo» = voce `ritardo:0:<id>` a
   `ritardoIl + 10 s` per un todo `programmato` (rotolato) o `perso` («non fatto»); «blocco perso» = `perso:0:<id>` a
   `persoIl + 10 s` se `lostNotificationDue(blocco, persoIl)`. Canale silenzioso, `oneShot`; azioni: in ritardo → Segna
   fatto e Posticipa; perso → Registra esito per lo studio, nessuna per la routine. Seguono l'interruttore generale e
   quello del tipo, non il promemoria dell'istanza. Gli id restituiti da `run()` (`AvvisiCiclo`) descrivono lo stesso
   insieme e restano per la Diagnostica (T-032): nessun servizio «spedisce» avvisi, la riconciliazione dopo il ciclo li
   arma con lo stesso `now` del ciclo (10 s ≥ i 5 s minimi di §13.3).
2. **«Perso» una volta per marcatura**: non parte se sul blocco era partita una sessione (`minutiRitardo`, fissato al
   primo avvio, D-SESS-1: orfano di C8, abbandono, «conta nel piano» spento di D-ESITO-1, che già chiedeva di non far
   ripartire l'avviso) né se il blocco è nato dopo la propria fine effettiva (`createdAt > fine`: routine creata dopo il
   suo orario, D-OCC-1). Un perso riprogrammato dall'utente (trascinamento, D-DRAG-1: `persoIl` azzerato) e perso di
   nuovo riceve un nuovo avviso, come tutte le sue notifiche ri-armate. «In ritardo» resta al più una volta per todo
   (`ritardoIl`, D-HOR-1 n. 9). La revisione segnala che §8 non pone condizioni sulla sessione: la lettura è registrata
   in `docs/00_SINTESI.md` §6 n. 28 e va confermata dall'utente (alternativa: avvisare sempre, con «Registra esito»,
   entro le 2 ore). «Riapri» non è offerto ai blocchi di studio (D-DETT-1 n. 3), quindi `minutiRitardo` non sopravvive
   a una riapertura dalla UI.
3. **Ore silenziose** dentro `desiredSet`, prima della finestra (`quietShift`): fascia di ore di parete con inizio
   incluso e fine esclusa, anche a cavallo di mezzanotte; si spostano i trigger pianificati, il digest e le voci
   posticipate, non gli one-shot. Default **spente**, con 22:30–07:00 del mock S22 già impostati: lo stato «Attive» del
   mock è un dato d'esempio, non una regola (D-DESIGN-1).
4. **Digest**: una voce `digest:0:<giorno>` alla prossima occorrenza dell'orario (`nextDigestInstant`, default 08:00),
   valutata sullo scatto già spostato dalle ore silenziose (un digest delle 06:00 con la fascia fino alle 07:00 resta
   quello di oggi fino alle 07:00: rilievo della revisione), contenuto ricalcolato a ogni riconciliazione
   (`digestContent`): todo senza orario `programmati` del giorno più quelli di giorni passati che rotoleranno (§6,
   `isRollingTodo`); arretrato = rotolerà, o è già rotolato (`ritardoIl`, che A4 impone di contare: alle 08:00 il
   ciclo ha già spostato il todo di ieri); fino a 3 titoli nell'ordine della fascia senza orario (§6, `sortDay`);
   vuoto → nessuna voce; segue l'interruttore generale e il tipo todo, canale del tipo. Sul web il tocco apre Oggi.
   Testi: «3 da fare (1 arretrato)» e i titoli. Conseguenza nota: un todo rotolato e poi trascinato a domani
   (`ritardoIl` conservato, D-DRAG-1 n. 7) conta come arretrato nel digest di domani.
5. **Posticipa**: `preferenze.posticipi` = chiave → istante del tocco (`snoozeNotification`, potata a un giorno);
   `desiredSet` sposta a tocco + 10' le sole voci che esistono ancora e hanno l'azione Posticipa: lo stato coerente di
   §13.2 (`programmato` tutte, `in corso` solo esito, `perso` solo in ritardo) è già deciso da chi produce le voci; poi
   le ore silenziose. Il tocco arriva dall'adapter nativo (T-021); sul web la notifica non ha azioni. Limite noto: un
   tocco sopravvive a uno spostamento manuale del blocco nei 10 minuti seguenti (la voce resta a tocco + 10' se è più
   tardi del nuovo orario); scartarlo a ogni scrittura del blocco lo perderebbe anche spuntando una voce della
   checklist, quindi resta così.
6. **Prova**: `test(now)` del servizio chiede il permesso (gesto dell'utente: il pulsante di T-032, che risolve il
   prompt mai mostrato di D-NOTIF-1 n. 9) e arma `prova:0:prova` a +6 s direttamente sulla porta, fuori dal registro.
7. **Finestra e voci imminenti**: l'insieme desiderato parte da adesso (non più da adesso + 5 s), così «non desiderato»
   significa cambiato o scattato e F6 vale alla lettera; i 5 s di §13.3 sono solo un vincolo d'armatura in
   `reconcilePlan`: una voce desiderata e invariata che scatta entro 5 s resta armata, una nuova o cambiata così vicina
   non si arma e, se la versione vecchia è ancora pendente sulla piattaforma, la si cancella (C4: «Anticipa» porta
   «inizio» ad adesso). Corregge T-019, dove una riconciliazione negli ultimi 5 s prima dello scatto cancellava la voce.
8. **Ingressi**: i blocchi si leggono da 30 giorni fa (`GIORNI_INDIETRO`) a oggi + 45, per gli arretrati del digest.
9. **Istante di risposta al tocco** (§13.2; «risposto» di §20): non in T-020. T-021 lo registra col tocco nativo in un
   campo additivo del blocco (il registro è derivato e potato), T-029 lo legge.

## Motivazione
- Derivare gli one-shot dai campi che il ciclo scrive nella sua transazione rende la consegna idempotente e ripetibile
  (prima riconciliazione del processo, porta guasta che riprova) e li mette nel registro per «Ieri · gestite», senza un
  secondo canale che la riconciliazione cancellerebbe o che il registro non vedrebbe.
- `minutiRitardo` e `createdAt` distinguono i tre casi aperti senza campi nuovi: chi ha avviato una sessione o ha creato
  la routine dopo il suo orario sa già del blocco; un avviso 10 s dopo aver aperto l'app sarebbe rumore.
- I posticipi come tocchi lasciano al dominio il +10' e la coerenza dello stato; una mappa in `preferenze` sopravvive
  al riavvio e non tocca il registro, che si riscrive a ogni differenza.
- Ore silenziose attive per default sposterebbero le routine del mattino di chi non le ha mai configurate.

## Alternative scartate
Spedire gli avvisi dagli id di `run()` con una coda separata (o cancellati dalla riconciliazione, o fuori dal registro e
quindi assenti da «Ieri · gestite»); un campo `avvisoPersoIl` per un solo avviso nella vita del blocco (tacerebbe dopo
una riprogrammazione voluta); ore silenziose attive per default; anche i todo con orario arretrati nel digest (hanno le
proprie notifiche; FUNZ §7.3 parla di todo senza orario); posticipo nel registro; prova nel registro (voce senza blocco
che la riconciliazione dovrebbe ignorare); una riga di `preferenze` per la prova.

## Conseguenze
- **T-021**: azioni native (Posticipa → `snoozeNotification`, Segna fatto, Inizia, Registra esito), tocco con istante di
  risposta, canali per tipo + silenzioso (le voci one-shot sono `silenzioso: true`); il tocco su «perso» e «esito» apre
  la registrazione dell'esito (sul web resta il Dettaglio: `pushState` non porta stato al router).
- **T-022**: «Ieri · gestite» dal registro include digest e one-shot.
- **T-032**: Impostazioni scrivono `oreSilenziose` e `digest`; «Notifica di prova» chiama `test()`.
- **T-029**: «risposto» dal campo di T-021; il ritardo di un recupero resta come in D-SESS-1.

## Da chiedere all'utente
- La lettura di §8 del punto 2 (n. 28 di `docs/00_SINTESI.md` §6).
- Le sveglie a schermo intero seguono le ore silenziose come ogni trigger pianificato (§13.4 non le esenta): una
  sveglia delle 06:00 per un blocco delle 06:30 arriverebbe alle 07:00, dopo il blocco. Se l'utente preferisce che una
  sveglia scelta apposta suoni comunque, la spec va precisata (INV-5) e `desiredSet` esenta `sveglia: true`.

## Verifica
`src/domain/notifications/quietHours.test.ts` (F3), `digest.test.ts` (A4, digest dentro la fascia), `desiredSet.test.ts`
(one-shot B7 e A1 con il valore 10 s, ore silenziose F3 anche a mezzanotte, posticipa F5 anche di un one-shot, digest
A4, prova, voci imminenti e cambiate), `src/domain/lost.test.ts` (esclusioni dell'avviso «perso»),
`src/app/notifications.test.ts` (F3 con il digest dentro la fascia, A4, F5, B7, occorrenza nata persa entro le 2 ore, C8,
A1, prova, impostazioni), `src/platform/notifications.test.ts` (clic), `src/ui/notificationTexts.test.ts` (testi in
inglese di ripiego); suite ripetuta in Auckland, Los Angeles e Kolkata. Revisione `spec-reviewer` non conforme alla
prima stesura (digest dentro la fascia; test di servizio dell'occorrenza nata persa fuori dalle 2 ore; valore dei 10 s
non letterale; deroga dei 5 s a F6): rilievi applicati, la lettura di §8 lasciata all'utente.
