# D-ESITO-1 — Esiti di studio: unità, blocco, streak, «conta nel piano»

**Stato**: applicata il 29/09/2026 (T-018): `src/domain/outcome.ts`, `STATO_ESITO` in `src/domain/pointer.ts`,
`src/app/outcome.ts`, `endSession` in `src/app/session.ts`, campi `Blocco.confidenza`, `Blocco.notaEsito` e
`Blocco.minuti` in `src/domain/types.ts`, `sessioni.esito` in `src/data/db.ts`, sheet S16 e schermata finale in
`src/ui/Session.tsx`, «Registra esito» in `src/ui/Detail.tsx`; revisioni indipendenti `spec-reviewer` (non conforme alla
prima stesura) e `design-checker` (fedele, con rilievi): rilievi applicati, le differenze di resa in
`docs/03_HANDOFF_DESIGN_CODE.md` §10 n. 34 (storia git, `3c60512`). Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto
MECC §11 dà la tabella degli esiti (stato del blocco, stato e progresso dell'unità), il «Sempre» (minuti all'unità
principale con la ripartizione, confidenza sull'unità, nota sul blocco, marcatura azzerata, altre unità solo minuti),
«conta nel piano» con il blocco retroattivo e «Registra esito» senza sessione; §12 la streak. Non dice dove stanno
confidenza, nota e minuti del blocco, quale unità è «la precedente», a che giorno va la streak di un esito registrato
tardi, cosa succede a un blocco eliminato durante la sessione. D-TIMER-1 n. 9 aveva lasciato «Termina» senza esito come
ponte; D-SESS-1 vuole l'esito sul parziale ripreso.

## Decisione
Le dodici regole della riga del registro. In sintesi: esito, unità, blocco (o blocco retroattivo), streak e puntatore
in una transazione con la chiusura; Indietro sulla precedente non saltata; nota dell'esito in un campo suo; streak al
giorno della registrazione; con «conta» spento solo `sessioni` sa dell'esito.

## Motivazione
- Una sola transazione: il ciclo vede o la sessione attiva col blocco `in_corso`, o il blocco chiuso con l'esito, mai
  una via di mezzo che lo farebbe marcare perso (D-SCHED-1).
- Il design fissa la precedente («Ripeti la 2.3»); saltare le `saltate` evita che Indietro annulli un Salta.
- Le `note` del blocco vengono dalla routine (§7): scriverci la nota dell'esito le cancellerebbe.
- Il giorno della registrazione è quello in cui l'utente «ha studiato» per l'app. Dal 12/10/2026 la streak non è più un
  contatore in `preferenze`: si ricalcola dai blocchi di studio completati e parziali nel giorno di `chiusoIl`, come
  vuole MECC §25 («ricalcolata localmente dai blocchi»), così vale anche su un secondo dispositivo (audit P2-2). Un
  esito che arriva entro un giorno dall'inizio del blocco conta per il giorno dell'inizio: una sessione serale chiusa
  dopo mezzanotte non spezza la serie di chi studia la sera (audit A-3); solo i campi del blocco, uguali ovunque.
- Un parziale ripreso è lo stesso blocco: i suoi minuti sono la somma delle sessioni.

## Alternative scartate
Nota dell'esito in `note`; Indietro sulla precedente qualunque stato; scelta manuale della precedente; streak al giorno
del blocco; minuti del blocco solo dell'ultima sessione; confidenza obbligatoria.

## Conseguenze
- T-022 usa `registerOutcome` e lo stesso sheet (`SchedaEsito`) dalla schermata Notifiche; `canRegisterOutcome` è la
  condizione dell'azione, il filtro dei 3 giorni e dei 5 elementi resta della lista (§8).
- T-029 legge `sessioni.esito` (assente nelle righe di T-017) e `Blocco.minuti`; la Costanza usa `readStreak`.
- T-019/T-020: con «conta» spento un blocco passato torna `programmato` e il ciclo lo rimarca perso: l'avviso «perso»
  non deve ripartire (una volta per blocco).
- T-025 aggiunge «Carica il codice prodotto» allo sheet.

## Verifica
`src/domain/outcome.test.ts` (tabella, Indietro, minuti, blocco retroattivo, C9, parziale ripreso),
`src/app/outcome.test.ts` (C2 con la streak, C3 in sequenza col puntatore, C6, C7 con e senza «conta», C9, blocco
eliminato, idempotenza col ciclo, righe vecchie di `sessioni`), `src/app/session.test.ts` (chiusura con l'esito, C5).
