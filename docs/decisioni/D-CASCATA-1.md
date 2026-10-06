# D-CASCATA-1 — Eliminazione di un corso a cascata

*Registro: `docs/01_DECISIONI.md`. Task: T-037. Fonti: MECCANISMI §16, §20, §25; SCENARI H3; S11 Corso, conferma.*

## Contesto

MECC §16 dice che l'eliminazione di un corso è «una cascata completa (moduli, unità, sezioni, risorse, blocchi e
ricorrenze del corso, mazzi e carte, quiz e pratiche, conversazioni, materiali e PDF, log fasi, notifiche)». H3 fa
sparire anche le occorrenze di oggi con le notifiche armate. Il foglio di conferma del mock promette che «le sessioni
completate restano nelle statistiche». La spec non dice che cosa fare dei blocchi che portano il corso ma appartengono a
una routine che resta, né di una sessione attiva sul corso.

## Decisione

1. In una sola transazione, con tombstone per la sync (§25): il corso con moduli, unità, sezioni e risorse; le routine
   di studio del corso con tutte le loro occorrenze, qualunque corso abbiano adesso e in qualunque stato; gli altri
   blocchi di studio del corso senza routine (i retroattivi delle sessioni libere); mazzi e carte, pratiche, materiali
   con i file binari, file di codice delle unità, log fasi delle routine del corso.
2. Un blocco del corso che appartiene a una routine che resta (una routine senza corso, a cui l'esito ha scritto il
   corso dell'unità scelta, C9; o una routine che ha cambiato corso) e un blocco che non è di studio si staccano dal
   corso (`corsoId` e `unitaId` a null).
3. Le sessioni restano; i blocchi completati e persi del corso no.
4. Una sessione attiva sul corso eliminato, chiusa con un esito che conta, crea il blocco retroattivo senza unità né
   corso.
5. Conversazioni, materiali e file a livello di corso, quiz ad ambito modulo entrano nella cascata con T-026, T-024,
   T-025, T-027 (obbligo scritto nelle loro righe di `docs/TASKS.md`).

## Motivazione

§16 elenca i blocchi del corso senza eccezioni e H3 li fa sparire. Un blocco di una routine viva non può sparire: la
generazione delle occorrenze lo ricreerebbe al ciclo successivo con lo stesso id (lo slot è deterministico, D-DATA-2),
come un programmato fantasma che poi diventerebbe perso con l'avviso. Un blocco retroattivo che punta a un'unità
eliminata sarebbe un orfano in calendario e nelle statistiche.

## Alternative scartate

- Tenere completati e persi come fa `deleteRecurrence` (§7): contraddice §16 e H3.
- Eliminare per `corsoId` anche i blocchi delle routine che restano (prima stesura): rilievo della revisione
  indipendente, lo slot tornava al ciclo.
- Impedire l'eliminazione con una sessione attiva sul corso: nessuna spec né mock lo prevede.

## Conseguenze

Le metriche costruite sui blocchi (disciplina, giorni con attività, persi, esiti, puntualità, §20) perdono la storia
del corso eliminato; le statistiche di focus no, perché vengono dalle sessioni. Il punto 3 va confermato dall'utente.

## Verifica

`src/app/courses.test.ts`, «Eliminazione corso — SCENARI H3»: l'altro corso, i todo, le altre routine e le sessioni
restano; le righe eliminate hanno la tombstone; il blocco di una routine senza corso si stacca e resta; una sessione
attiva sul corso eliminato si chiude senza blocchi orfani.
