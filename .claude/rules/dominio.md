---
paths:
  - "src/domain/**"
---
# Regole per `src/domain` (dominio puro)

- Nessun import da `data`, `app`, `ui`, `platform` e nessun pacchetto esterno; i test importano solo `vitest`.
  Verifica: `scripts/architettura.test.mjs` (INV-1, INV-2).
- Il tempo corrente arriva sempre come parametro `now: number` (epoch ms). Vietati `Date.now()`, `new Date()` senza
  argomenti, `Math.random()`, `console`, timer, `fetch`, API del browser: anche `URL` e simili, perché la lib
  TypeScript della radice è `ES2022` senza `DOM` (D-TS-1).
- Confini di giorno solo con `src/domain/time.ts` (`localDayKey`, `startOfLocalDay`, `endOfLocalDay`,
  `addLocalDays`); nei test le date con `local(y, m, d, h, min)`. Mai costanti a 24 ore per decidere il giorno (D-TIME-1).
- Le attività pianificate sono definite dall'ora locale di parete (D-TIME-2): gli istanti si generano con il
  costruttore `Date` locale del processo, che è il fuso corrente del dispositivo, e si conserva l'ora di parete accanto
  agli istanti; il fuso corrente arriva come dato dalla porta `Clock` di `app`, mai da `Intl` nel dominio.
- Nomi in italiano come nelle spec per tipi, attributi, valori e costanti (`in_corso`, `FACILITA_MINIMA`); in
  inglese per file, cartelle, funzioni e variabili (`lost.ts`, `scheduler/occurrences.ts`, `assignPointer`)
  (D-NAMING-1, INV-12). Nessun sinonimo di un attributo esistente: prima cerca in `types.ts`.
- Una regola di spec è scritta in un solo modulo (D-MODULI-1, INV-13): prima di aggiungere una funzione, cerca se
  esiste (`statiModuli`, `effectiveEnd`, `assignPointer`, `segmentTimeline`, …) partendo da `src/domain/index.ts`.
- Ogni modulo dichiara in testa fonte (§ di MECCANISMI o FORMATO_CORSO) e scenari coperti; ogni modulo nuovo è
  esportato da `src/domain/index.ts` (INV-3).
- Ogni funzione nuova ha un test accanto (`x.test.ts`); ogni `describe` cita § o scenario (INV-6); un test che nomina
  uno scenario aggiorna la riga in `docs/TRACCIABILITA.md` (INV-7).
- Se la spec tace: scelta minima e reversibile, registrata in `docs/01_DECISIONI.md` con id `D-…` citato nel commento.
- `types.ts` è il modello dei dati: rinomine, rimozioni e cambi di semantica di campi o valori esistenti sono ad alto
  impatto e richiedono la revisione indipendente (`docs/05_LOOP_AGENTICO.md` §7); le aggiunte additive coerenti con le
  spec (un tipo o un campo nuovo) passano dall'auto-revisione.
