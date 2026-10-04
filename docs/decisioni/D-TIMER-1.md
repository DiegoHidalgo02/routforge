# D-TIMER-1 — Timer della sessione di studio: istanti persistiti, pomodoro, iperfocus, chiusura

**Stato**: applicata il 29/09/2026 (T-017): `src/domain/timer.ts`, campi del timer in `SessioneAttiva`
(`src/domain/session.ts`), `editActiveSession`, `endSession` e `readSessionView` in `src/app/session.ts`, tabella
`sessioni` con `SessioneChiusa` (`src/data/db.ts`, nessun indice nuovo), porte `ScreenAwake` e `DoNotDisturb`
(`src/app/ports/device.ts`, adapter web in `src/platform/device.ts`, `src/app/sessionDevice.ts`), timer S15, banner e
card nella sidebar. Revisioni indipendenti `spec-reviewer` (conforme con rilievi) e `design-checker` (fedele con
rilievi): rilievi applicati, gli altri qui sotto e in `docs/03_HANDOFF_DESIGN_CODE.md` §10 n. 33 (storia git,
`3c60512`). Riga nel registro:
`docs/01_DECISIONI.md`.

## Contesto
MECC §10.2–§10.5 dà i regimi (orologio, focus, cronometro), il pomodoro, il tempo extra, l'iperfocus e i campi del
riepilogo; D4 vuole un timer che sopravviva alla chiusura dell'app. La spec non dice come si persiste il timer, che
cosa succede dopo un «salta», a un cambio d'unità a metà segmento, a una sessione rimasta aperta dopo un crash, né a un
iperfocus senza fine. D-SCHED-1 e D-SESS-1 fissano il contratto con il ciclo: `preferenze.sessioneAttiva` scritta
nella stessa transazione del blocco.

## Decisione
Le dieci regole della riga del registro. In sintesi: solo istanti nella sessione attiva; focus = trascorso − pause
dell'utente; pomodoro sul tempo attivo che tassella la durata anche dopo un salto; minuti per unità per istante;
chiusure (anche gli abbandoni) in `sessioni` con tipo e riepilogo; iperfocus solo con una fine; nessuna chiusura
automatica; «Termina» senza esito fino a T-018; porte del dispositivo iniettate dal punto di composizione.

## Motivazione
- Istanti assoluti (§10.2 «durate sempre derivate da istanti assoluti»): nessun contatore da ripristinare (D4), stesso
  risultato in ogni fuso.
- Le statistiche di §20 contano abbandoni, uscite d'emergenza, tempo extra e segmenti: servono le sessioni chiuse con
  il loro riepilogo, abbandonate comprese.
- Un iperfocus col cronometro resterebbe bloccato fino all'uscita forzata: ogni sua chiusura diventerebbe un'uscita
  d'emergenza (rilievo della revisione).
- Segmenti fissi dopo un salto lasciavano gli ultimi minuti della sessione senza segmento, attribuiti allo studio
  mentre il timer mostrava una pausa (rilievo della revisione).

## Alternative scartate
Contatori salvati ogni secondo; minuti per unità per segmento pianificato (la vecchia `minutesByUnit`); chiusura
automatica dopo N ore (soglia inventata); iperfocus bloccato senza fine; porte passate come props alla UI.

## Conseguenze
- **T-018** sostituisce il ramo «blocco → `programmato`» di `endSession` con l'esito nella stessa transazione. Fino ad
  allora una routine terminata oltre 30' dalla sua fine il ciclo la marca persa (test in `src/app/session.test.ts`).
- **T-019** arma il one-shot «tempo scaduto» a `sessioneAttiva.fine` (solo sessioni ancorate all'orologio), lo
  cancella a «Termina» e ad «Abbandona» e riconcilia dopo `endSession` e `abandonSession`.
- **T-021**: adapter nativi di schermo acceso e Non Disturbare, e tasto indietro di Android (`@capacitor/app`) durante
  l'iperfocus.
- **T-029** legge la fine reale da `chiusaIl` e decide se le abbandonate contano fra le «concluse».
- **T-032** mostra gli errori degli adapter, oggi ignorati.
- **Da decidere con l'utente**: una sessione rimasta aperta per giorni conta tutto quel tempo come focus quando la si
  termina; una proposta d'abbandono alla riapertura oltre la fine richiede una soglia che la spec non dà.

## Verifica
`src/domain/timer.test.ts` (D1–D5, §10.5), `src/app/session.test.ts` (D3, D4, D5, chiusura, abbandono, ponte fino a
T-018), `src/app/sessionDevice.test.ts` (§10.4), `src/ui/Session.test.tsx` (D4 banner, D5 uscita e indietro).
