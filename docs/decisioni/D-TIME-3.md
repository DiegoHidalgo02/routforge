# D-TIME-3 — Ora legale: l'orario che non esiste e quello che c'è due volte

**Stato**: applicata il 09/10/2026 (audit P2-22). La spec tace: scelta minima e reversibile dell'agente, da confermare
con l'utente. Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto

CONTESTO §3: «fuso orario e ora legale non devono spostare i blocchi di giorno»; D-TIME-2: le attività pianificate sono
definite dall'ora locale di parete. La notte del cambio d'ora un'ora di parete non esiste (a Roma il 28/03/2027 dalle
02:00 alle 02:59, «buco») e una c'è due volte (il 25/10/2026 dalle 02:00 alle 02:59, «sovrapposizione»). Per le ore che
non esistono il costruttore `Date` di ECMAScript va avanti della durata del buco (02:30 → 03:30); per quelle doppie
prende la prima. Prima di questa decisione una routine 02:30–03:15 generata per il 28/03/2027 aveva inizio 03:30 e fine
03:15 (durata negativa, mai «in corso») e la sua occorrenza risultava «spostata dall'utente» perché l'orario di parete
salvato (03:30) non era quello dello slot nell'id (audit E-10, A-11).

## Decisione

1. **Buco**: l'inizio va dove lo porta l'orologio e il blocco lo segue con la durata di parete della definizione
   (02:30–03:15 → 03:30–04:15). Una fine che cade nel buco va avanti allo stesso modo, e la durata assoluta resta quella
   di parete (01:30–02:30 → 01:30–03:30, un'ora).
2. **Sovrapposizione**: vale la prima delle due ore uguali (02:30 dell'ora legale); la fine resta all'orario di parete.
3. **Slot**: un'occorrenza nel buco non è «spostata» (C4): il confronto con lo slot usa l'orario che l'orologio dà allo
   slot quel giorno (`isMovedOccurrence`).

## Motivazione

È quello che fa già l'orologio del sistema per l'inizio, esteso al blocco intero: nessuna durata negativa o nulla,
nessun dato nuovo, nessuna libreria. Riguarda solo attività fra le 02:00 e le 02:59 (o l'ora del cambio nei fusi che lo
fanno altrove) di due notti l'anno.

## Alternative scartate

- Saltare l'occorrenza nel buco: una routine sparirebbe senza che l'utente l'abbia chiesto.
- Riportare l'inizio alla fine del buco (03:00) e tenere la fine: la durata si accorcerebbe.
- Nella sovrapposizione la seconda ora: contraddice il costruttore `Date` e ogni altro calcolo del dominio.

## Conseguenze

- `wallInstants` (`src/domain/scheduler/occurrences.ts`) e `isMovedOccurrence`; nessun cambio di schema.
- Gli anticipi «in giorni» e le scadenze SM-2 contano ancora 24 ore (A-12): fuori da questa decisione.

## Verifica

Gate: `src/domain/scheduler/occurrences.test.ts` («Ora legale: buco e sovrapposizione»), che trova buco e
sovrapposizione del 2027 nel fuso del processo coi soli getter di `Date` e non ha nulla da provare in un fuso senza ora
legale; eseguito a Roma, Auckland, Los Angeles e Calcutta. Prova di mutazione: con la regola vecchia di
`isMovedOccurrence` il test è rosso.
