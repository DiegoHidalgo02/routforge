# D-NATIVO-3 — Sveglie a schermo intero e azioni senza aprire l'app

**Stato**: applicata il 07/10/2026 con T-057, revisione indipendente applicata; da collaudare sul telefono. Riga nel
registro: `docs/01_DECISIONI.md`.

## Contesto
MECC §13.1 n. 4 e §21 vogliono le sveglie a schermo intero, persistite al riavvio; §13.2 e lo scenario A6 vogliono che
«Segna fatto» senza voci aperte completi il todo senza aprire l'app, e S8 disegna la sveglia sopra il blocco schermo con
«Posticipa» che non apre l'app. `@capacitor/local-notifications` (T-021, D-NATIVO-2) apre sempre l'app con le azioni e
non ha lo schermo intero. I dati stanno nell'IndexedDB della WebView: il codice nativo non li può scrivere.

## Decisione
1. Le voci con `sveglia` o con l'azione «Segna fatto» (i todo) le arma il plugin locale `PromemoriaNativi`; il resto
   resta al plugin di Capacitor. Una voce che cambia strada (notifica ↔ sveglia) si annulla nell'altra.
2. `PromemoriaReceiver` salva ogni voce (JSON preparato dall'app: id, istante, canale, testi, azioni, extra) nella
   memoria del dispositivo, leggibile anche prima del primo sblocco, e la arma con `setAlarmClock` (sveglie) o
   `setExactAndAllowWhileIdle` (le altre; senza allarmi esatti, `setAndAllowWhileIdle`). All'avvio del telefono riarma le
   future e toglie le passate.
3. Il tocco e le azioni che aprono l'app hanno gli extra del plugin di Capacitor: arrivano come
   `localNotificationActionPerformed`, la stessa strada di T-021.
4. «Posticipa» e «Segna fatto» senza voci aperte (`vociAperte` della voce, `runsInBackground`) tornano al ricevitore: la
   notifica sparisce e il gesto si accoda con il suo istante. Se l'app gira, gli allarmi li cambia lei con la
   riconciliazione, che conosce lo stato del blocco (§13.2); ad app ferma il ricevitore riarma il posticipo solo se la
   voce salvata è ancora quella scattata e, dopo «Segna fatto», toglie le altre voci del todo. L'app applica la coda
   all'avvio, in ordine e prima del primo ciclo dello scheduler (al più 3 s di attesa).
5. La sveglia apre S8 (`/sveglia`, React) sopra il blocco schermo solo per una voce dell'archivio con `sveglia`, con la
   WebView nascosta finché S8 non è disegnata; indietro rimette il blocco. Ciò che porta nell'app (Inizia, Apri il
   blocco, le voci rimaste) chiede prima lo sblocco (`requestDismissKeyguard`); Chiudi, Posticipa e «Segna fatto» in
   sfondo rimettono il telefono al blocco se è bloccato.

## Motivazione
È il minimo che dà lo schermo intero e le azioni senza app con il resto delle notifiche invariato: due strade, la stessa
porta e lo stesso registro (D-NOTIF-1).

## Alternative
- Tutte le notifiche in nativo: più codice, per azioni che aprono comunque l'app.
- Una WebView senza interfaccia per applicare il gesto: stessa origine, ma senza il ponte Capacitor.
- S8 in XML nativo: un secondo disegno della stessa schermata.

## Conseguenze
- Ad app ferma il completamento arriva nei dati alla prossima apertura: fino ad allora widget e Oggi mostrano il todo da
  fare, e un «Posticipa» su un blocco chiuso nel frattempo può suonare una volta (caso raro, notifica rimasta in tendina).
- I gesti in sfondo scrivono `updatedAt` all'istante del gesto, quindi nel passato: la sync (T-033) non deve riconoscere le
  modifiche da inviare con `updatedAt > ultimo invio`.
- Prima del primo sblocco dopo un riavvio la sveglia suona come notifica, senza S8; i titoli delle voci armate stanno
  nella memoria leggibile prima dello sblocco.
- Su Android 14+ le notifiche a schermo intero si possono negare: la sveglia arriva allora in alto. Lo stato è in
  Diagnostica («Sveglie a schermo intero»).

## Verifica
`src/domain/notifications/desiredSet.test.ts` (A6: `vociAperte`, `runsInBackground`, riarmo al cambio della
checklist), `src/ui/Alarm.test.tsx` (S8: completa e chiude, voci rimaste dopo lo sblocco, Posticipa), confronto di S8 con
la tavola 08; il resto è nell'elenco del collaudo sul telefono in `docs/STATO.md`.
