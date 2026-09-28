# D-SCHED-1 — Ciclo dello scheduler: transazione, inneschi, puntatore, porta Clock

**Stato**: applicata il 28/09/2026 (T-013): `src/domain/scheduler/cycle.ts`, `src/domain/lost.ts` (`isOrphan`),
`src/domain/pointer.ts` (`pointerPlan`, `criteriaMet`), `src/domain/scheduler/occurrences.ts` (`horizonSlotRange`),
`src/data/repository.ts` (`listKeyRange`), `src/app/scheduler.ts`, `src/app/pointer.ts`, `src/app/ports/clock.ts`,
`src/platform/clock.ts`, `src/ui/clock.ts`, `src/main.tsx`. Piano in `docs/piani/T-013.md`. Riga nel registro:
`docs/01_DECISIONI.md`.

## Contesto

MECC §9 fissa l'ordine del ciclo (estensione ricorrenze → spostamento todo → reset orfani → marcatura persi →
notifiche → avvisi → streak) e i suoi momenti (avvio, primo piano, cambio di giorno «controllo ogni 60 s sulla data
locale», creazione, modifica ed eliminazione di routine); D-TIME-2 aggiunge il riancoraggio in testa. Restano aperti:
come rendere il ciclo atomico e idempotente (INV-15), quando ricalcolare il puntatore (MECC §11 elenca esito, marcatura
persa di studio e generazione; FUNZ §8 lo mette in ogni ciclo), come sapere quale blocco punta la sessione attiva
prima che la sessione esista (T-016, T-017), da dove arrivino tempo, fuso, battito e primo piano senza `Date.now()` né
timer in `app`, e come B7 («alle 20:30 diventa persa e riceve una notifica») valga con l'app aperta.

## Decisione

1. **Una transazione** per i passi sui dati: 0 riancoraggio, 1 estensione, 2 spostamento dei todo, 3 orfani, 4 persi,
   poi il puntatore, sulle tabelle `blocchi`, `ricorrenze`, `preferenze`, `corsi`, `unita`, `moduli` (`runCycle`).
   L'ordine sta nel servizio (ARCHITETTURA §4), ogni giudizio in una funzione del dominio (`reanchor`, `rollPlan`,
   `orphanPlan`, `lostPlan`, `pointerPlan`). Notifiche (T-019), avvisi (T-020) e streak vengono dopo, fuori dalla
   transazione. Due cicli richiesti insieme si serializzano nella transazione di IndexedDB, senza una coda nel servizio.
2. **Puntatore a ogni ciclo, per ogni corso**, dopo l'estensione e la marcatura: ricevono l'unità i blocchi di studio
   `programmati` con inizio > adesso (i «futuri» di `assignPointer` e di ARCHITETTURA §4); si scrivono solo gli
   `unitaId` che cambiano. Le occorrenze appena generate ricevono subito la loro unità; rispetto alla marcatura dei
   persi l'ordine è indifferente, perché un blocco che può essere perso è già iniziato e non è futuro.
3. **Inneschi** (`start()`): all'avvio; al ritorno in primo piano; a ogni minuto **il ciclo intero**, non solo al cambio
   di data; a ogni scrittura sulla tabella `ricorrenze` (creazione, modifica, eliminazione, date saltate, poi la sync).
4. **Sessione attiva per gli orfani**: la riga di `preferenze` con id `sessioneAttiva` e `valore.bloccoId`
   (`CHIAVE_SESSIONE_ATTIVA`); senza riga, o senza `bloccoId` testuale, nessun blocco è collegato.
5. **Avvisi**: `run()` restituisce `avvisiRitardo` (todo spostati e «non fatti» a cui il ciclo scrive `ritardoIl`) e
   `avvisiPerso` (routine e studio marcati adesso con la fine nelle ultime 2 ore). «Una volta» discende dalla marcatura.
6. **Porta `Clock`**: `now()`, `fuso()`, `every(ms, fn)` a ogni multiplo di `ms` dall'epoch (al cambio di minuto) e
   `onForeground(fn)`. Adapter web (`webClock`) con `Date.now`, `Intl`, timer che si riallinea a ogni scatto e
   `visibilitychange`; vale anche nella WebView.
7. **Streak**: il passo non scrive; `currentStreak` dà 0 alla lettura quando l'ultimo giorno contato non è oggi né ieri.
8. **Errori**: un ciclo che fallisce non lascia scritture (transazione annullata) e non arriva alla UI: `run()` risolve
   `undefined` e il battito dopo riprova. Una ricorrenza la cui definizione non si legge (dato rotto, anche arrivato
   dalla sync) non ferma il ciclo: il piano puro si calcola prima di aprire la sua transazione, la ricorrenza si salta e
   il suo id torna in `ricorrenzeSaltate`; gli altri passi scrivono. La registrazione in Diagnostica di entrambi i casi è
   di T-032.
9. **UI**: Oggi prende il giorno da `useOggi()`, il blocco Adesso e il Dettaglio l'istante da `useMinuto()`
   (`src/ui/clock.ts`): al cambio di minuto e al ritorno in primo piano. Le schermate leggono ancora `Date.now()`.
10. **Lettura degli slot per chiave**: la generazione legge solo gli slot dell'orizzonte, per intervallo di chiave
    primaria (`horizonSlotRange` e `listKeyRange`), invece di tutte le occorrenze della routine per `ricorrenzaId`.
    Modifica ed eliminazione restano su `ricorrenzaId` (aggiorna il punto 2 di D-OCC-1).

## Motivazione

- Una transazione rende vero l'ordine anche fra schede: la seconda vede le scritture della prima e non avvisa due
  volte; un ciclo interrotto non lascia metà dei passi.
- FUNZ §8 elenca il ricalcolo del puntatore fra ciò che il ciclo fa; ricalcolare a ogni ciclo contiene i momenti di
  MECC §11 (generazione, marcatura persa) e copre senza codice in più le routine create, modificate o eliminate, la
  ricezione della sync e un'interruzione fra generazione e puntatore.
- Il ciclo a ogni minuto rende vero B7 con l'app aperta e porta alle 00:29–00:30 i blocchi che finiscono alle 23:59
  (A1, B4); il solo cambio di data lo farebbe al ritorno in primo piano o alla mezzanotte dopo. L'idempotenza rende
  gratuite le esecuzioni senza cambiamenti. Il battito al cambio di minuto coincide con l'orologio della UI.
- La sessione attiva è stato dell'app come la streak (MECC §1 «Preferenze e stato», ARCHITETTURA §4): la riga di
  `preferenze` è il posto previsto; il ciclo ne legge solo il blocco.
- Senza `Date.now()` né timer in `app` (regole di `app`, D-TS-1) tempo, battito e primo piano devono arrivare da una
  porta; la porta `Clock` è già in ARCHITETTURA §1 e D-TIME-2 le affida il fuso.
- Misura in Edge con 2.470 blocchi (cinque routine con un anno di storia e 500 blocchi): il ciclo costava 50 ms, metà
  per leggere tutte le occorrenze di ogni routine; con la lettura per chiave costa 17–34 ms e non cresce con la storia.

## Alternative scartate

- Ciclo solo al cambio di data, alla lettera di §9: la routine di B7 resterebbe programmata fino al primo piano.
- Timer esatto sul prossimo istante di giudizio: più codice per lo stesso risultato del ciclo a ogni minuto.
- Puntatore solo agli eventi di §11 dentro `createActivity`, `editRecurrence` e `deleteRecurrence`, con le loro
  transazioni allargate a unità e moduli: più punti da toccare e nessun riallineamento dopo una sync o un'interruzione.
- «Futuri» letti come «aperti» (programmati o in corso, a qualsiasi ora): eviterebbe il salto descritto nelle
  conseguenze, ma riscrive la regola di `assignPointer` (T-001) e di ARCHITETTURA §4.
- Una transazione per passo: scritture a metà se un passo fallisce e un aggiornamento della UI per passo.
- Coda delle esecuzioni nel servizio (prima stesura): la prova di mutazione ha mostrato che la transazione basta.
- Una porta `Lifecycle` a parte per il primo piano: una porta in più per un solo metodo.
- La porta `Clock` anche nelle schermate: iniezione in tutta la UI, fuori da T-013.

## Conseguenze

- **Puntatore durante un blocco iniziato**: fra l'inizio di un blocco di studio e il suo esito (o la marcatura persa)
  il blocco successivo dello stesso corso riceve la stessa unità; torna avanti all'esito (T-018). Si vedrà quando la
  UI mostrerà l'unità (T-016).
- **T-016, T-017**: la sessione attiva scrive `preferenze.sessioneAttiva` con `bloccoId` nella stessa transazione dello
  stato del blocco, altrimenti un ciclo in mezzo tratterebbe il blocco come orfano; l'abbandono riporta il blocco a
  `programmato` (prima metà di C8, §10.5).
- **T-018**: dopo ogni esito `recomputePointer`; lo stato della streak si persiste e si legge con `currentStreak`.
- **T-019**: la riconciliazione va in `run()` dopo la transazione di `runCycle`; con l'app aperta gira ogni minuto, e
  una differenza vuota non chiama la piattaforma.
- **T-020**: spedisce gli avvisi restituiti da `run()`; decide se avvisare un blocco nato già perso (routine creata dopo
  il suo orario, D-OCC-1: il ciclo innescato dalla creazione la marca subito) e un blocco perso una seconda volta.
- **T-021**: adapter nativo del primo piano con `@capacitor/app` se la WebView non emette `visibilitychange`; verificare
  che `Intl` e `Date` seguano insieme un cambio di fuso ad app aperta.
- **T-014** si aggancia all'avvio del servizio; **T-034** chiama `run()` dopo una ricezione (le scritture su
  `ricorrenze` lo innescano già).

## Verifica

`src/domain/lost.test.ts` (orfani, C8), `src/domain/scheduler/cycle.test.ts` (A1, B7, C8, E2),
`src/domain/pointer.test.ts` (`pointerPlan`, `criteriaMet`, C1), `src/domain/scheduler/occurrences.test.ts`
(`horizonSlotRange`), `src/data/repository.test.ts` (`listKeyRange`), `src/app/pointer.test.ts` (C1 e D-PTR-1 dal
database), `src/app/scheduler.test.ts` (ordine dei passi, INV-18, C8, B7, B2, A1, A2, B1, E2, idempotenza INV-15,
atomicità, inneschi con un orologio finto, C1, G4). Prova di mutazione sull'ordine dei passi, sulla sessione, sugli
avvisi, sulla transazione, sugli inneschi e sullo stop: tutte uccise tranne due, equivalenti (puntatore prima dei persi;
coda nel servizio, poi tolta). Suite ripetuta in Auckland, Los Angeles e Kolkata. Nel browser (Edge headless, CDP,
`coverage/cdp-t013.mjs`, orologio della pagina spostato alle 23:59): a mezzanotte Oggi passa al giorno nuovo senza
ricaricare, il todo rotola e la routine della sera è persa; un `visibilitychange` esegue il ciclo senza aspettare il
battito.
