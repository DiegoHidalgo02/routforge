# D-OCC-1 — Occorrenze delle routine: orizzonte, identità, modifica, riancoraggio

**Stato**: applicata il 25/09/2026 (T-011): `src/domain/scheduler/occurrences.ts`, `src/app/recurrences.ts`;
revisione indipendente `spec-reviewer` conforme. Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto

MECC §7 fissa le regole delle occorrenze (28 giorni, idempotenza, filtri, fine ≤ inizio → giorno dopo, senza durata,
campi ereditati, modifica solo delle future, eliminazione) ma lascia aperti alcuni punti: se il giorno «oggi + 28» è
incluso, se lo slot di oggi si crea quando il suo orario è già passato, il formato dell'id di slot che D-DATA-2 rinvia a
T-011, come realizzare «elimina le future e rigenera» e quali blocchi siano «futuri» per il riancoraggio di D-TIME-2.

## Decisione

1. **Orizzonte** = da oggi a oggi + 28 giorni, ultimo giorno incluso (`ORIZZONTE_OCCORRENZE_GIORNI`); lo slot di oggi
   si crea anche a orario passato, alla creazione come alla modifica.
2. **Id di slot** `<ricorrenzaId>:<YYYY-MM-DD>:<HH:MM>` con l'orario d'inizio della definizione (`occurrenceId`): stabile
   allo spostamento (C4) e al riancoraggio; un orario nuovo è uno slot nuovo (B6). Le esistenti si leggono con una
   query sull'indice `ricorrenzaId` (`listBy`).
3. **Occorrenza**: `programmato`, `conOrario` vero anche senza durata (fine `null`), titolo, note, promemoria e corso
   copiati dalla definizione, nessuna fase, nessuna unità finché il puntatore non la assegna (T-013).
4. **Modifica** = differenza (`editPlan`): future `programmate` (inizio > adesso) non più previste → tombstone; ancora
   previste → riscritte con la definizione nuova, istanti compresi; mancanti → create; il resto resta. La definizione si
   salva con il fuso corrente. **Saltare una singola occorrenza = giorno in `dateSaltate`** via `editRecurrence`.
5. **Eliminazione** (`removableOccurrences`): tombstone di tutte le `programmate`, anche passate, della definizione e
   dei log fasi; completate e perse restano.
6. **Riancoraggio** (`reanchor`): blocchi `programmati` con `giornoLocale` ≥ oggi e fuso memorizzato diverso da quello
   corrente → stessi orari di parete, istanti ricalcolati nel fuso del processo, `fuso` aggiornato. `BloccoAncorato`
   (`types.ts`) è la forma comune a dominio e tabella `blocchi`.
7. **Servizio**: una transazione per operazione tramite `inTransaction` del repository (Dexie resta in `data`); da
   «+ Crea» definizione e occorrenze si scrivono insieme.

## Motivazione

- «Da oggi a oggi+28» (§7) e «fino a quel giorno + 28» (B1) nominano il giorno finale come incluso, come gli «ultimo
  giorno incluso» di §6 e delle date della ricorrenza. «Occorrenze mancanti» non guarda l'orario, e B2 vuole
  l'occorrenza di oggi spuntabile dalle 00:00 alle 23:59: chi crea la routine dopo averla fatta può spuntare oggi.
- La differenza produce lo stesso stato di «elimina le future e rigenera» con una scrittura per slot e `createdAt`
  conservato; la generazione senza cambiamenti non scrive nulla (INV-15). Con l'identità di slot un `remove` del
  singolo blocco verrebbe rianimato: l'unico modo previsto dalla spec per saltare un giorno è `dateSaltate`.
- D-TIME-2 chiede di riancorare «prima di giudicare» (INV-18) e CONTESTO §3 ragiona per giorni: l'occorrenza di
  stamattina non ancora giudicata si riancora, quella di ieri no.

## Alternative scartate

- Orizzonte con la fine esclusa (un giorno meno di quanto dice B1).
- Saltare lo slot di oggi quando nascerebbe già perso (fine effettiva + 30' < adesso), stessa regola per creazione e
  modifica (proposta della revisione): eviterebbe l'occorrenza persa creata da una modifica a orario passato, ma
  toglierebbe la spunta di oggi a chi crea la routine dopo averla fatta. Da riconsiderare con T-013 se il caso disturba.
- Elimina-e-rigenera alla lettera (due scritture per slot, tombstone rianimate nella stessa transazione).
- Riancorare solo `inizio > adesso` (l'occorrenza di stamattina resterebbe all'ora del vecchio fuso).

## Conseguenze

- **T-009** (Dettaglio): «elimina» su una singola occorrenza di routine = giorno in `dateSaltate` con `editRecurrence`.
- **T-013**: il ciclo chiama `reanchor` prima di `missingOccurrences` per ogni ricorrenza, poi il puntatore per le
  occorrenze di studio (`unitaId`).
- **T-019**: dopo `editRecurrence` e `deleteRecurrence` si riconciliano le notifiche (B6).
- **T-033**: stesso id di slot su ogni dispositivo, «ultimo vince» per record (D-DATA-2).
- Una routine creata o modificata dopo l'orario di oggi ha l'occorrenza di oggi, che il primo ciclo giudica «persa»
  (§8) e, se la fine è entro 2 ore, notifica (T-020): da osservare con T-013.

## Verifica

`src/domain/scheduler/occurrences.test.ts` (B1, B3, B4, B6, filtri, differenza mista, eliminazione, id di slot,
riancoraggio, cambio d'ora del 25/10/2026), `src/app/recurrences.test.ts` (creazione, idempotenza, occorrenza spostata,
B6, doppia modifica, `remove` di una singola occorrenza, eliminazione), `src/data/repository.test.ts` (`listBy`,
`inTransaction`). Suite eseguita in Auckland, Los Angeles e Kolkata.
