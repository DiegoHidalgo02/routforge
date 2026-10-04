# D-IMPORT-1 — Salvataggio del corso importato

**Stato**: applicata in T-005 (25/09/2026). Codice: `saveCourse` in `src/data/repository.ts`, `importSampleCourse` in
`src/app/courseImport.ts`.

## Contesto

Fino a T-004 il parser produceva l'albero del corso (FORMATO_CORSO §4) e lo schema v1 aveva le tabelle `corsi`,
`moduli`, `unita`, `sezioni`, `risorse`, ma nessun codice salvava un corso. MECC §16 dice che ogni import crea un corso
nuovo e tace su un errore a metà import. Il parser dà un id a corso, moduli, unità e sezioni, ma non alle risorse. Il
design (S10) mostra un badge «Esempio» sulla card del corso di esempio (vecchio 03_HANDOFF §10 n. 1, storia git;
D-SAMPLE-1).

## Decisione

1. `saveCourse` scrive l'albero in **una transazione** su cinque tabelle: tutto o niente.
2. Gli id sono quelli del parser, deterministici dall'id del corso (D-DATA-2, punto 6). Una risorsa ha id = id della
   sezione più la posizione (`…:teoria:R1`). Sezioni e risorse hanno `ordine` a partire da 1, come le unità.
3. I campi che il dominio calcola non si salvano (D-DATA-2, punto 7): stato dei moduli, conteggi, unità corrente.
4. La riga del corso ha `esempio`: `true` per il corso di esempio incluso, `false` per uno ZIP. È un booleano, quindi
   senza indice (D-DATA-2, punto 5).
5. L'id del corso è un UUID v4 nuovo a ogni import (`newId`, MECC §16).
6. I due file del corso di esempio entrano nel bundle con l'import `?raw` di Vite. Oggi lo risolve Vitest; il tipo è
   dichiarato in `src/app/raw.d.ts`, perché la radice non carica `vite/client` (D-TS-1).

## Motivazione

- Un corso salvato a metà è un corso che l'utente non ha importato e non può correggere: meglio un errore e nessuna riga.
- La posizione è l'identità logica di una risorsa nella sua sezione: l'id si ricava dalla struttura, come per il resto
  dell'albero (D-DATA-2, punto 6), quindi lo stesso albero dà sempre gli stessi id. Non serve all'idempotenza: ogni
  import ha un id di corso nuovo, e `saveCourse` non riscrive un corso esistente né pota figli in eccesso.
- Il badge va sul corso di esempio anche dopo il salvataggio: serve un dato, non un'euristica.
- Con `?raw` l'app carica proprio i file verificati dal gate (INV-19).

## Alternative considerate

- Una scrittura per record senza transazione: un import interrotto lascia un corso a metà.
- UUID per le risorse: l'unico nodo dell'albero con id casuali, diversi a ogni lettura dello stesso file.
- Riconoscere l'esempio dal titolo: uno ZIP può avere lo stesso titolo.
- Costanti TypeScript copiate dai file del corso: il gate verificherebbe una copia diversa da quella caricata.

## Conseguenze

- La UI (T-038) legge `corsi.esempio` per il badge e conta moduli e unità dalle righe (2 · 13 per l'esempio).
- L'import da ZIP della UI salva con `saveCourse` e un id nuovo, come l'esempio.
- L'eliminazione a cascata (T-037) trova l'albero con l'indice `corsoId` su ogni tabella.
- ESLint ammette le variabili sorelle del resto (`ignoreRestSiblings`, D-LINT-1): così si omettono i campi calcolati.

## Verifica

- `src/data/repository.test.ts`, «Albero del corso»: forma di ogni riga, id delle risorse, tutto o niente.
- `src/app/courseImport.test.ts`, «Corso di esempio»: nessun avviso, 2 moduli · 13 unità, `esempio`, secondo import =
  corso nuovo che lascia intatto il primo.
