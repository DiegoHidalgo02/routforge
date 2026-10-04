# D-NOTIF-3 — Nessuna fascia silenziosa nell'app

**Stato**: decisa dall'utente il 30/09/2026 (council con Codex e Claude, `.claude/council-cache/council-1790757466.md`, solo locale);
applicata nel codice con T-045 (rimozione di `src/domain/notifications/quietHours.ts`, del campo `oreSilenziose` e
degli spostamenti in `desiredSet`); **spec allineata il 30/09/2026** con il testo in fondo (`deny` su `docs/spec` tolto
e rimesso dall'agente su richiesta esplicita dell'utente, INV-5). Riga nel registro: `docs/01_DECISIONI.md`.
Sostituisce il punto 3 di D-NOTIF-2.

## Contesto
MECC §13.4, FUNZ §7.4 e lo scenario F3 prevedevano una fascia silenziosa dell'app che rinviava alla sua fine i trigger
pianificati, il digest e i posticipi (non gli one-shot); T-020 l'aveva realizzata e testata, spenta per default. L'utente
l'ha giudicata inutile; il council ha confermato: il Non disturbare del sistema copre già il silenzio notturno, e
rinviare un promemoria scelto dall'utente (le 06:00 di un blocco delle 06:30) lo rende tardivo.

## Decisione
1. RoutForge non ha una fascia silenziosa propria: ogni trigger pianificato, il digest e i posticipi si armano
   all'orario calcolato, senza rinvii; le sveglie a schermo intero si richiedono all'orario del trigger.
2. Il silenzio lo governano le impostazioni di notifica e il Non disturbare del sistema operativo, che l'app non
   modifica né aggira (T-021: nessun bypass del Non disturbare per le notifiche ordinarie; le sveglie a schermo intero
   restano soggette ai permessi e alle politiche del sistema).
3. La regola non resta «nascosta» nella spec senza interfaccia: si toglie dalla spec, dal codice, dalle impostazioni
   (T-032) e dal mock S22 (la card «Ore silenziose» sparisce; la riga del digest trova un altro posto, divergenza 37).
4. Il digest mattutino resta: è una funzione distinta (§13.5).
5. Nessuna migrazione: la riga `preferenze.notifiche` con `oreSilenziose` scritta prima di T-045 è ancora leggibile
   (il campo in più si ignora); il registro delle notifiche si riconcilia da solo con gli istanti non rinviati.

## Testo per la spec (applicato il 30/09/2026)
- MECC §13.2, «Posticipa»: togliere «, rispettando le ore silenziose».
- MECC §13.4, al posto del paragrafo: «Non previste (D-NOTIF-3, 30/09/2026): RoutForge non ha una fascia silenziosa
  propria. Ogni trigger pianificato, il digest e i posticipi si armano all'orario calcolato, senza rinvii da parte
  dell'app; le sveglie a schermo intero si richiedono all'orario del trigger. Il silenzio lo governano le impostazioni
  di notifica e il Non disturbare del sistema operativo, che l'app non modifica né aggira.»
- FUNZ §7.4: «Non previste: RoutForge non rinvia le notifiche in una fascia propria; il silenzio notturno è quello del
  Non disturbare del sistema (D-NOTIF-3, 30/09/2026).» FUNZ §7.7: togliere «ore silenziose;» dall'elenco.
- CONTESTO §6 (riga del passo 5): togliere «ore silenziose, ».
- SCENARI F3: «**F3 — Nessuna fascia silenziosa** — Un todo alle 06:30 con anticipo 30' produce la notifica alle
  06:00; il digest arriva alle 08:00; la notifica "blocco perso" alle 23:30 parte. L'app non rinvia mai una notifica
  per l'orario: se il telefono è in Non disturbare, decide il sistema.»
- SCENARI F5: togliere «(spostata fuori dalle ore silenziose se serve)».

## Motivazione
Due politiche di silenzio (app e sistema) confondono; la spec stessa non dava un default; i promemoria rinviati
arrivano dopo l'attività. Meno codice (un modulo, un campo delle impostazioni, dieci test) e una card in meno in S22.

## Alternative scartate
Tenere la regola in spec senza interfaccia (comportamento invisibile); esentare le sole sveglie (eccezione su
un'eccezione); fascia attiva per default come nel mock.

## Conseguenze
- T-045 (fatto): codice e test; F3 e F5 verificano ora l'assenza di rinvii.
- T-032: nessuna card «Ore silenziose»; l'orario del digest va in una riga propria.
- T-021: nessun trattamento speciale del Non disturbare per le notifiche ordinarie.
- Da ritrovare nel nuovo design: Impostazioni senza la card (ex divergenza 37, nell'inventario di
  `docs/03_HANDOFF_DESIGN_CODE.md` §1).

## Verifica
`src/domain/notifications/desiredSet.test.ts` («Nessuna fascia silenziosa — SCENARI F3»: 06:00, 06:30, digest
08:00), `src/app/notifications.test.ts` («Nessuna fascia silenziosa — SCENARI F3»; «Posticipa — SCENARI F5» senza
rinvii); gate verde dopo la rimozione.
