# D-DATA-1 — Persistenza locale con identità pronta per la sincronizzazione

**Stato**: confermata da D-STACK-1 (T-000) e applicata in T-004 (25/09/2026); i dettagli dello schema v1 sono in
D-DATA-2.
Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto

Tutto funziona offline; i dati stanno sul dispositivo (CONTESTO §3). MECC §25: ogni record ha un identificatore
univoco globale e un istante di ultima modifica; le eliminazioni sono record cancellati e propagati; i conflitti si
risolvono con l'istante più recente per record. «Oggi» deve aprirsi in mezzo secondo su dati esistenti. PDF fino a
20 MB come binari separati dai metadati (MECC §17).

## Decisione

- Dexie (IndexedDB) su web e WebView Capacitor; una tabella per entità di MECC §1 (`docs/02_ARCHITETTURA.md` §3).
- Ogni record: `id` UUID v4, `createdAt`, `updatedAt` (epoch ms), `deletedAt | null` (tombstone), fin dal primo
  schema e anche per le entità che non si sincronizzano.
- `blocchi` con `giornoLocale` calcolato all'inserimento con `src/domain/time.ts` e indicizzato.
- Il registro notifiche è una tabella derivata, esclusa da backup e sync.
- Nessuna regola di business nei repository: i servizi leggono, il dominio decide, i repository scrivono.
- Archiviazione persistente richiesta al primo avvio (`navigator.storage.persist()`), stato in Diagnostica.

## Motivazione

Stesso codice su tutte le piattaforme; l'identità dei record decisa ora evita una migrazione al passo 10; l'indice sul
giorno locale copre il requisito di reattività.

## Alternative considerate

- SQLite via plugin: due percorsi di codice (web e nativo) e uno schema SQL da mantenere.
- localStorage: limiti di dimensione, nessun indice, PDF impossibili.

## Conseguenze

- Le migrazioni sono versionate e additive; una migrazione che perde dati è un checkpoint (`docs/06_SUPERVISIONE.md`).
- `updatedAt` viene dall'orologio del dispositivo finché il CP4 non decide una sorgente diversa (rischio in
  ARCHITETTURA §8: due orologi sfasati invertono l'esito di «ultimo vince»).
- I test dei repository usano `fake-indexeddb`; i servizi non toccano Dexie ma i repository.
- Il CP0 ha scelto l'ora di parete (D-TIME-2): ricorrenze e blocchi hanno ora di parete e fuso fin dallo schema v1
  (D-DATA-2).
- La richiesta di archiviazione persistente passa a T-006 (serve la lib `DOM` e un avvio dell'app); stato in T-032.

## Verifica

`src/data/db.test.ts` (ogni tabella ha i campi comuni e lascia una tombstone, INV-14; versione 1 e riapertura) e
`src/data/repository.test.ts`.
