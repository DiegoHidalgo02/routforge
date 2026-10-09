---
paths:
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "scripts/**/*.test.mjs"
---
# Regole per i test

- Un `describe` per meccanismo o scenario, con la fonte nel titolo: `'Persi — SCENARI B2'`,
  `'Pomodoro — MECCANISMI §10.3'` (INV-6, verificato dal gate).
- Se un titolo nomina uno scenario («SCENARI B2»), la riga B2 di `docs/TRACCIABILITA.md` deve elencare il file e
  avere stato `parziale` o `coperto` (INV-7, verificato dal gate).
- Date e ore con `local(y, m, d, h, min)` di `src/domain/time.ts`; mai `Date.now()`, mai `new Date()` senza
  argomenti, mai `Date.UTC`: la suite gira in quattro fusi in CI.
- I valori numerici della spec (30', 28 giorni, 0,95, 2,65, …) compaiono nel test come sono scritti nella spec, con il
  § accanto.
- Prima il test rosso, poi il codice. Un test verde non dimostra che la regola sia quella giusta: rileggi lo scenario.
- Non si modificano test o implementazione per far passare il gate senza aver capito la causa; niente snapshot senza
  valore; niente `it.skip` lasciati nel repository.
- I test in `scripts/*.test.mjs` verificano regole del repository (architettura, tracciabilità, dipendenze, segreti):
  ognuno ha un autotest che dimostra di riconoscere una violazione. Fa eccezione `scripts/corso-esempio.test.mjs`, che
  confronta il parser con il fixture del corso di esempio: non ha logica propria da autotestare.
