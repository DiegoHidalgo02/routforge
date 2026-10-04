# D-NOTIF-1 — Modello delle notifiche: fusione, stati, finestra, id, registro, inneschi

**Stato**: applicata il 29/09/2026 (T-019): `src/domain/notifications/desiredSet.ts`, `src/app/notifications.ts`,
`src/app/ports/notifications.ts`, `src/app/scheduler.ts`, `src/data/db.ts`, `src/data/repository.ts` (`purge`),
`src/platform/notifications.ts`, `src/ui/notificationTexts.ts`, `src/ui/Create.tsx`, `src/main.tsx`; piano nella
storia git (`git show 3c60512:docs/piani/T-019.md`); revisione indipendente `spec-reviewer`. Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto
MECC §13.1–§13.3 dà livelli, trigger per tipo, finestra di 14 giorni, id deterministico e riconciliazione, ma non dice
come si fondono i livelli quando il tipo ha anticipi vuoti, che cosa resta di un blocco `in_corso` («protette»), da dove
parte la lettura dei blocchi, come un id testuale diventa un intero a 32 bit (vincolo Android), dove vive la sveglia
né chi produce i testi senza che `app` e `platform` importino `ui`.

## Decisione
1. **Fusione** generale → tipo → istanza: Auto = anticipi del tipo; Off = nulla; Personalizzato = i suoi. Le occorrenze
   usano `ricorrenza.promemoria`, letto a ogni riconciliazione. Fusione vuota → nessuna voce. Con fusione non vuota i
   trigger strutturali ci sono sempre (studio: inizio, verifica, esito; routine: inizio, verifica; todo: scadenza);
   «all'inizio» coincide col trigger puntuale e, se sveglia, lo rende sveglia; per l'evento ogni anticipo, 0 compreso, è
   una voce (0 = trigger `inizio`). La sveglia viene solo dal Personalizzato, su blocchi con orario e ≤ 7 h.
2. **Stati**: `programmato` → tutte; `in_corso` → solo «esito» (F1: la verifica è cancellata, l'esito resta, SCENARI >
   MECC); terminali e `perso` → nessuna. Todo senza orario: nessuna (digest, T-020); evento tutto il giorno: 08:00.
3. **Finestra**: scatti in `[now + 5 s, addLocalDays(now, 14)]`; blocchi letti per giorno locale da ieri a oggi + 45.
   Anticipi come durate assolute in minuti.
4. **Chiave e id**: `trigger:anticipo:bloccoId`; tempo scaduto `tempo_scaduto:0:sessione`. Id nativo FNV-1a a 32 bit
   con segno; collisione → +1 in ordine di chiave contro gli id in uso; le chiavi già nel registro tengono il loro id.
5. **Registro**: id = chiave, riga = voce armata + `idNativo`; si riscrive solo la differenza; `purge` fisico (INV-14).
   La prima riconciliazione del processo riarma tutto (web dopo un ricaricamento, permesso revocato su Android).
6. **Inneschi**: `run()` dello scheduler dopo la transazione del ciclo (riuscita o no, stesso `now`); `start()` osserva
   i propri ingressi (blocchi della finestra, ricorrenze, sessione attiva, impostazioni), così ogni mutazione riconcilia
   senza toccare i servizi che scrivono; esecuzioni in coda.
7. **Una porta** `Notifications` (`requestPermission`, `schedule`, `cancel`); la sveglia è un attributo della voce.
   Sul web degrada a notifica con `requireInteraction`.
8. **Testi**: la porta riceve voci semantiche; `TestiNotifica` (tipo nella porta) lo implementa
   `src/ui/notificationTexts.ts` con `t()`, iniettato all'adapter da `main.tsx`.
9. **Permesso**: chiesto una volta per processo alla prima riconciliazione con voci da armare; l'esito non blocca.
10. **Tempo scaduto**: segue solo l'interruttore generale; nessuna voce con `fine: null` o con la fine passata.
11. **Impostazioni** in `preferenze.notifiche` (`ImpostazioniNotifiche`); riga assente o illeggibile = default di §13.1.
12. **Errori**: il servizio non lancia; se la porta fallisce il registro resta com'era e la successiva riprova.
13. **Clic sul web**: mette a fuoco e apre `/attivita/<id>` (o `/sessione`); istante di risposta e azioni: T-020/T-021.
14. **S4**: riga «Altro anticipo» per l'anticipo libero fino a 31 giorni (divergenza 35).

## Motivazione
- Una funzione pura per l'insieme desiderato rende l'idempotenza un test («seconda riconciliazione: nessuna chiamata»).
- Osservare gli ingressi invece di chiamare la riconciliazione da ogni servizio evita di dimenticarne uno (spunta,
  checklist, trascinamento, esito, modifica di T-042) e lascia intatti i servizi esistenti.
- L'hash con +1 dà id stabili fra processi finché le chiavi non collidono, e il registro conserva quelli assegnati.

## Alternative scartate
Porta `Alarms` separata (due code per lo stesso trigger); id progressivi salvati (non deterministici, §13.3); riconciliare
dentro la transazione del ciclo (una porta non sta in una transazione IndexedDB); verifica anche per il blocco `in_corso`
(contraddice F1); testi prodotti in `app` (servirebbe `ui` o una seconda copia dei dizionari).

## Conseguenze
T-020 aggiunge ore silenziose e one-shot **dentro** `desiredSet` (prima della finestra e del registro); T-021 scrive
l'adapter nativo della stessa porta; T-032 scrive `preferenze.notifiche` e legge registro e permesso in Diagnostica;
T-033 lascia il registro fuori dalla sync.

## Verifica
`src/domain/notifications/desiredSet.test.ts`, `src/app/notifications.test.ts`, `src/app/scheduler.test.ts` («Ciclo —
notifiche dopo la transazione»), `src/platform/notifications.test.ts`, `src/data/repository.test.ts` («Registro notifiche»).
