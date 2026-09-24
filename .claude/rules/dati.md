---
paths:
  - "src/data/**"
---
# Regole per `src/data` (persistenza locale)

- Importa solo da `domain`. Nessuna regola di business: i repository leggono e scrivono, le decisioni stanno nel
  dominio e l'orchestrazione in `app` (INV-1, INV-13).
- Ogni tabella ha `id` (UUID v4), `createdAt`, `updatedAt` (epoch ms), `deletedAt | null`; le eliminazioni dei record
  sincronizzabili sono tombstone, mai cancellazioni fisiche (D-DATA-1, INV-14). Il test dello schema che lo verifica
  nasce con T-004 e da allora fa parte del gate.
- Nomi di tabelle e campi in italiano come nel dominio (`facilita`, `scadenza`, `giornoLocale`); elenco in
  `docs/02_ARCHITETTURA.md` §3.
- Le migrazioni sono versionate e additive; una migrazione che perde dati è un checkpoint dell'utente, non una scelta
  dell'agente (`docs/06_SUPERVISIONE.md`).
- `giornoLocale` dei blocchi si calcola con `src/domain/time.ts` all'inserimento e si indicizza (Oggi in < 0,5 s).
- Il registro notifiche è derivato: escluso da backup e sync (MECC §1).
- Test con `fake-indexeddb` (riga in `docs/DIPENDENZE.md`); nessun test contro un browser reale.
- Cambiare lo schema o il modello di persistenza è ad alto impatto: revisione indipendente
  (`docs/05_LOOP_AGENTICO.md` §7).
