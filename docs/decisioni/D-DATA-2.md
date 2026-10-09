# D-DATA-2 — Schema v1: tombstone, identità delle occorrenze, ora di parete

**Stato**: applicata in T-004 (25/09/2026), rivista nella revisione indipendente dello stesso task (D-REVIEW-1): id
deterministico dello slot al posto dell'indice univoco sulle occorrenze, id = blocco per il log fasi. Riga nel
registro: `docs/01_DECISIONI.md`. Precisa D-DATA-1 e realizza la parte «modello» di D-TIME-2.

## Contesto

`docs/02_ARCHITETTURA.md` §3 elencava tabelle e indici prima della decisione D-TIME-2 (CP0). Scrivendo lo schema
(T-004) sono emersi cinque punti che quell'elenco non reggeva:
- con le tombstone (MECC §25) un indice univoco vede anche i record eliminati: dopo la modifica di una routine
  (MECC §7: si eliminano le occorrenze future e si rigenera) l'occorrenza rigenerata allo stesso orario violerebbe il
  vincolo su quella eliminata;
- `ricorrenzaId+inizio` come identità dell'occorrenza non regge D-TIME-2: l'istante di un'occorrenza futura cambia al
  riancoraggio e differisce fra due dispositivi in fusi diversi. E nessuna chiave letta dal blocco regge gli
  spostamenti: «Anticipa sessione» (C4) porta l'occorrenza delle 15:00 alle 14:40 e la generazione, cercando le 15:00,
  ne creerebbe una seconda;
- IndexedDB non indicizza i booleani: un indice su `ricorrenze.attiva` resterebbe vuoto;
- la chiave del log fasi di MECC §5 («ricorrenza + istante d'inizio», «identificatore dell'evento») con un record per
  occorrenza coincide con l'id del blocco;
- un'impostazione (preferenze) e una voce del registro notifiche hanno un'identità logica, la chiave: con un UUID a
  caso due dispositivi creerebbero due record per la stessa impostazione.

## Decisione

1. **Tombstone minima**: eliminare sostituisce il record con `{id, createdAt, updatedAt, deletedAt}`. Senza gli altri
   campi la tombstone esce dagli indici secondari: gli indici vedono solo i record vivi; salvare di nuovo quell'id la
   rianima conservando `createdAt`. Eccezione: `registroNotifiche` è derivato e solo locale (mai in backup né sync,
   MECC §1): T-019 può cancellarlo fisicamente, una tombstone non avrebbe nulla da propagare.
2. **Identità dell'occorrenza = slot della ricorrenza**: l'id di un blocco generato da una ricorrenza è deterministico,
   ricorrenza + giorno locale + orario di parete *della ricorrenza* (formato fissato da T-011, es.
   `<ricorrenzaId>:<YYYY-MM-DD>:<HH:MM>`). L'id non cambia se l'utente sposta l'occorrenza (C4, B6) né al
   riancoraggio; la generazione la ritrova con `get` e un doppione è impossibile per costruzione. Nessun indice
   univoco: `ricorrenzaId` è indicizzato per modifica ed eliminazione (MECC §7). I blocchi senza ricorrenza hanno un
   UUID v4.
3. **Ancoraggio dei blocchi derivato dal repository**: `saveBlock` calcola `giornoLocale`, `orarioInizio`, `orarioFine`
   con `localDayKey`/`localTimeKey` (fuso del processo) e registra il `fuso` passato dal chiamante (porta Clock di
   `app`). Se `inizio` e `fine` non cambiano conserva i valori memorizzati, tutti o nessuno (un blocco modificato è un
   blocco riancorato); se però il fuso corrente riproduce lo stesso ancoraggio (stesso offset, es. Roma → Berlino)
   registra il fuso corrente, così il riancoraggio di T-013 converge invece di riscrivere il blocco a ogni ciclo
   (INV-15).
4. **Log fasi**: id = id del blocco dell'occorrenza; `ricorrenzaId` indicizzato per eliminare i log con la routine e
   aggregare le fasi. Ricompletare sovrascrive, annullare la spunta lascia la tombstone, ricompletare la rianima.
5. **Nessun indice booleano**: «ricorrenza attiva» (fine assente o ≥ oggi, MECC §7) si calcola nel dominio.
6. **Id**: UUID v4 generato dal repository quando il chiamante non ne dà uno; deterministico dove l'identità è logica:
   albero del corso (id del parser, D-PARSE-2), occorrenze (slot), log fasi (blocco), preferenze (id = chiave),
   registro notifiche (id = chiave logica).
7. **Campi calcolati del corso non salvati**: stato dei moduli, numero di unità, unità completate, unità corrente
   restano funzioni del dominio (`statiModuli`, `completedUnits`, `currentUnit`), non copie da tenere allineate
   (`courseProgress`, tolta il 01/10 come codice morto, è tornata come `completedUnits`: audit P2-18).

## Motivazione

Un id che è la chiave logica del record realizza «nessuna occorrenza duplicata» (MECC §7) e «ultimo vince per record»
(§25) con lo stesso meccanismo: due dispositivi che generano la stessa occorrenza, o completano la stessa routine,
scrivono lo stesso id e convergono senza fusione speciale. L'identità per slot è quella che D-TIME-2 rende stabile:
non cambia al riancoraggio, fra dispositivi, né quando l'utente sposta l'occorrenza; in B6 (07:00 completata e 18:00
nuova, lo stesso giorno) sono due slot. Derivare l'ancoraggio in un solo punto evita che ogni creatore di blocchi
(Crea, generazione, spostamento dei todo, trascinamento, blocco retroattivo) lo calcoli a modo suo, e conservarlo
quando gli istanti non cambiano realizza CONTESTO §3 per il passato. La tombstone minima libera anche i binari dei PDF
(MECC §17) e non lascia chiavi esterne orfane dopo l'eliminazione di un corso (T-037).

## Alternative considerate

- Tombstone completa (tutti i campi più `deletedAt`): vincoli univoci violati alla rigenerazione, PDF trattenuti,
  ogni query per indice da filtrare.
- `[ricorrenzaId+inizio]` univoco come in ARCHITETTURA §3: duplicati o errori dopo un cambio di fuso (sopra).
- Indice univoco `[ricorrenzaId+giornoLocale+orarioInizio]` sull'orario attuale del blocco (prima stesura di T-004):
  l'identità cambia quando l'utente sposta l'occorrenza («Anticipa sessione», C4) e la generazione ne crea una seconda
  che il vincolo non vede; in sync due dispositivi produrrebbero id diversi per la stessa occorrenza
  (`ConstraintError` alla fusione). Rilievo della revisione indipendente.
- Indice non univoco con l'idempotenza affidata solo al dominio: un errore di generazione diventerebbe un duplicato
  silenzioso. Con l'id di slot il duplicato è impossibile, non solo vietato.
- Ancoraggio fornito da chi crea il blocco: nessun punto unico che lo garantisca coerente con gli istanti.

## Conseguenze

- **T-005**: salva l'albero del corso con gli id del parser e `corsoId` su ogni livello; le risorse, che nel parser non
  hanno id, ne ricevono uno.
- **T-011**: fissa il formato dell'id di slot in una funzione pura del dominio e lo usa per riconoscere le occorrenze
  esistenti (`get`, nessuna ricerca per istante); il riancoraggio ricalcola gli istanti e salva con `saveBlock`, che ne
  deriva lo stesso giorno e la stessa ora e registra il fuso nuovo. Le occorrenze copiano titolo e note della
  ricorrenza (MECC §7, «ereditati»): dopo l'eliminazione della ricorrenza (tombstone minima) le statistiche leggono il
  titolo dal blocco.
- **T-009**: un log per blocco, id = id del blocco; ricompletare riscrive lo stesso log, annullare la spunta lo elimina.
- **T-019**: `registroNotifiche` con id = chiave logica e `idNativo` intero a 32 bit; cancellazione fisica ammessa.
- **T-030, T-033**: backup e sync scrivono i record «così come sono» (`updatedAt` di origine, tombstone comprese) e
  l'azzeramento di MECC §22 cancella fisicamente: serve un percorso di scrittura grezzo accanto a `save`/`remove`, da
  decidere in quei task; le tombstone si propagano per id e i record con identità logica convergono per id.
- **T-037**: la cascata usa `corsoId`, indicizzato su moduli, unità, sezioni, risorse, ricorrenze e blocchi; le tabelle
  che oggi hanno solo `unitaId` (materiali, mazzi, pratiche, file di codice) e le conversazioni, che ricevono il
  contesto in T-026, si raggiungono dalle unità del corso o con un indice aggiunto in una versione successiva.
- Chi sposta un blocco cambia `inizio`/`fine` e salva con `saveBlock`: l'ora di parete segue da sola, l'id resta.
- `navigator.storage.persist()` (D-DATA-1) passa a T-006: serve la lib `DOM` e un avvio dell'app.

## Verifica

`src/data/db.test.ts` (tutte le tabelle con chiave `id`; campi comuni e tombstone minima in ogni tabella, INV-14;
versione 1 e riapertura) e `src/data/repository.test.ts` (UUID v4, rianimazione, id deterministico, ancoraggio
derivato, conservato e fuso convergente a parità di offset, giorno in ordine d'inizio, occorrenza spostata con lo
stesso id (C4) e slot diversi nello stesso giorno (B6), log fasi con id = blocco).
