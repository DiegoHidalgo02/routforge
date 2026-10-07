---
paths:
  - "src/data/**"
---
# Regole per `src/data` (persistenza locale)

- Importa solo da `domain`. Nessuna regola di business: i repository leggono e scrivono, le decisioni stanno nel
  dominio e l'orchestrazione in `app` (INV-1, INV-13).
- Ogni tabella ha `id` (UUID v4, o deterministico dove l'identità è logica: occorrenza = slot della ricorrenza, log
  fasi = blocco, preferenze e registro notifiche = chiave, dato dal chiamante; nessun indice univoco), `createdAt`,
  `updatedAt` (epoch ms), `deletedAt | null`; si scrive e si elimina solo con `src/data/repository.ts` (`save`,
  `saveBlock`, `saveCourse`, `remove`): l'eliminazione è una tombstone minima, mai una cancellazione fisica, salvo `registroNotifiche`
  (derivato, mai in backup né sync: T-019) e l'azzeramento di MECC §22 (`replaceAll`: import del backup ed «Elimina
  tutti i dati», T-030) (D-DATA-1, D-DATA-2, INV-14; nel gate: `src/data/db.test.ts`; Dexie diretto solo nei test).
- Nomi di tabelle e campi in italiano come nel dominio (`facilita`, `scadenza`, `giornoLocale`); elenco in
  `docs/02_ARCHITETTURA.md` §3, schema in `src/data/db.ts`.
- Le migrazioni sono versionate (`db.version(n)`) e additive; la versione 1 non si modifica. Una migrazione che perde
  dati è un checkpoint dell'utente, non una scelta dell'agente (`docs/06_SUPERVISIONE.md`).
- `giornoLocale` e ora di parete dei blocchi li deriva `saveBlock` dagli istanti con `src/domain/time.ts` e li
  conserva se gli istanti non cambiano (D-TIME-2); nessun altro li calcola (Oggi in < 0,5 s con l'indice).
- Niente indici su booleani: IndexedDB non li indicizza (D-DATA-2).
- Il registro notifiche è derivato: escluso da backup e sync (MECC §1).
- Test con `fake-indexeddb` (riga in `docs/DIPENDENZE.md`); nessun test contro un browser reale.
- Cambiare lo schema o il modello di persistenza è ad alto impatto: revisione indipendente
  (`docs/05_LOOP_AGENTICO.md` §7).
