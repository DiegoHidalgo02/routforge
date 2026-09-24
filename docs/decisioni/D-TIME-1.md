# D-TIME-1 — Istanti assoluti in epoch ms, giorno locale via `time.ts`

**Stato**: applicata (22/09/2026). Riga nel registro: `docs/01_DECISIONI.md`. Vedi anche D-TIME-2 (aperta).

## Contesto

MECC §1: ogni istante è assoluto, il giorno di un blocco è il giorno locale dell'inizio; i blocchi senza orario hanno
ancore fisse (todo 12:00–23:59, evento 00:00–23:59). CONTESTO §3: fuso e ora legale non devono spostare i blocchi di
giorno. Le soglie sono in minuti (30', 10', 2 h) e in giorni locali (28, 14, 3).

## Decisione

- Ogni istante è un `number` in epoch ms.
- Il giorno locale si calcola solo con `src/domain/time.ts` (`localDayKey`, `startOfLocalDay`, `endOfLocalDay`,
  `addLocalDays`), che usa il costruttore `Date(y, m, d, …)` locale: un giorno può durare 23 o 25 ore.
- La fine di un blocco «senza fine» è 23:59:00 locale del giorno d'inizio; da qui le marcature alle 00:29 (A1, B4).
- Nessuna libreria di date.

## Motivazione

L'aritmetica locale nativa è corretta attraverso il cambio d'ora ed è testata (`time.test.ts`; la CI ripete la suite in
quattro fusi). Una libreria aggiungerebbe una dipendenza senza risolvere il problema aperto di D-TIME-2.

## Alternative considerate

- date-fns o luxon: dipendenza non necessaria oggi; utile solo se D-TIME-2 sceglierà l'ora di parete con fuso esplicito.
- Giorni come stringhe `YYYY-MM-DD` nel modello: ambigue per i blocchi a cavallo di mezzanotte (B3).

## Conseguenze

- Nei test le date si costruiscono con `local(y, m, d, h, min)`: mai `Date.UTC`, mai costanti a 24 ore per i confini
  di giorno (le durate in ms, come gli intervalli SM-2, vanno bene).
- Il fuso del processo è un globale implicito: il dominio è puro rispetto all'orologio, non rispetto al fuso. Per questo
  la CI esegue la suite in fusi diversi, incluso uno a mezz'ora.
- Se D-TIME-2 sceglierà l'ora locale di parete, ricorrenze e blocchi dovranno memorizzare anche ora di parete e fuso:
  schema (T-004) e occorrenze (T-011) dipendono da quella scelta.

## Verifica

`src/domain/time.test.ts`; `.github/workflows/ci.yml` con `TZ` Europe/Rome, America/Los_Angeles, Asia/Kolkata,
Pacific/Auckland più il fuso del runner.
