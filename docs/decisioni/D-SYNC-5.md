# D-SYNC-5 — Impronta del corso e collegamento delle routine di studio

*07/10/2026, T-034. Fonti: MECC §25 («Corsi e routine di studio», «Dopo ogni ricezione»), §16 (ogni import crea un corso
nuovo), §11 (puntatore); SCENARI J3; D-SYNC-1…D-SYNC-4, INV-21.*

## Contesto

I corsi non viaggiano con la sync (§25): ogni dispositivo importa il suo ZIP e il corso riceve un UUID nuovo (§16), da
cui derivano gli id di moduli e unità (`<corso>:M1:U1.1`). Una routine di studio creata sul telefono porta l'id del
corso del telefono, che sul tablet non esiste. §25 chiede che la ricorrenza porti un'impronta del corso (titolo +
contenuto) e che sull'altro dispositivo il collegamento si risolva con un corso della stessa impronta; altrimenti
occorrenze senza unità e setup libero; al primo import del corso il collegamento si ristabilisce e il puntatore si
ricalcola. Dopo ogni ricezione girano i cicli dello scheduler.

## Decisione

1. **Impronta** (`courseFingerprint`, dominio): titolo + testo dei file dei moduli in ordine di numero, FNV-1a a 32
   bit più la lunghezza. Si calcola dai moduli salvati: dopo l'import il contenuto non cambia e il titolo non si
   rinomina, quindi niente campo sul corso e niente migrazione.
2. **Chi la scrive**: la sync, nella routine di studio spedita (`pushQueue`), anche in quelle nate prima di T-034. Se il
   corso qui non c'è (routine ricevuta e non ancora collegata) resta l'impronta che la riga ha.
3. **Collegamento** (`relinkPlan`, passo del ciclo prima dell'estensione): una ricorrenza col corso di un altro
   dispositivo passa al corso di qui con la stessa impronta (il primo importato se sono più d'uno). Un blocco
   programmato futuro col corso altrove passa al corso di qui della sua ricorrenza, o a quello con l'impronta del suo
   corso, senza unità: il puntatore assegna le future. Vale anche per un'occorrenza toccata sull'altro dispositivo e
   ricevuta dopo il collegamento, che arriva col corso e l'unità di là (revisione di T-034). Senza un corso di qui il
   blocco perde solo l'unità, che qui non esiste. Passato, completati, persi e saltati restano come sono. È una
   scrittura del ciclo: non entra in coda (INV-21), perché l'id del corso è di questo dispositivo; il servizio tiene
   quello di chi ha scritto per ultimo e ogni dispositivo lo ricollega da sé. La ricorrenza tiene il suo `updatedAt`:
   il collegamento non è un gesto e in una fusione non deve battere una modifica altrui.
4. **Quando**: il ciclo, che ora parte anche a ogni scrittura su `corsi` (l'import collega subito) e dopo ogni giro
   della sync che ha scritto righe ricevute (`dopoRicezione` di `createSyncService`; in `main.tsx` dopo i gesti fatti
   ad app chiusa, come il primo ciclo).
5. **Setup**: un'unità che qui non c'è (un'occorrenza spostata sull'altro dispositivo arriva con la sua unità) vale
   come nessuna: il setup è libero (`setupInputs`).
6. **Ordine del push**: le ricorrenze prima dei blocchi. Chi riceve rigenera le occorrenze dalla definizione e poi
   applica quelle toccate dall'utente; nell'ordine della coda (blocchi prima) la definizione arrivata dopo riscriveva
   uno spostamento appena ricevuto e i dispositivi divergevano (difetto di T-033 trovato dal test di J3).

## Motivazione

È il minimo che soddisfa J3 senza toccare lo schema: l'impronta si ricava da dati che ci sono già, il collegamento è
un passo idempotente del ciclo (nessuna scrittura senza cambiamenti, INV-15), la coda resta delle sole modifiche
dell'utente.

## Alternative scartate

- **Impronta salvata sul corso all'import**: lettura più leggera, ma serve una migrazione per i corsi già importati.
  Resta la strada se il costo del passo 3 pesa (`ponytail:` in `scheduler.ts`).
- **Corso risolto alla lettura** senza riscrivere `corsoId`: ogni lettura del corso di una routine (puntatore, schermate
  del corso, modifica) passerebbe dall'impronta.
- **Hash crittografico**: asincrono (Web Crypto) e fuori dal dominio puro; per distinguere i corsi di un utente basta
  un hash non crittografico con la lunghezza.

## Conseguenze

- Finché il corso non è importato, ogni ciclo con una routine da collegare rilegge il testo dei moduli (pochi corsi:
  accettato).
- **Confermato** (risposta dell'utente del 09/10/2026 all'audit, P1-14): eliminare un corso elimina a cascata le routine collegate (H3); dopo il
  collegamento vale anche per una routine ricevuta, e l'eliminazione raggiunge gli altri dispositivi, dove il corso c'è
  ancora. L'alternativa è staccare la routine dal corso invece di eliminarla quando il corso è solo di qui.
- Un corso importato con un titolo diverso (ZIP senza file struttura, titolo chiesto all'utente) ha un'altra impronta:
  la routine non si collega (§25: titolo + contenuto).
- Le routine di studio nate prima di T-034 prendono l'impronta al primo push.

## Verifica

`src/domain/sync.test.ts` («Corsi e routine di studio»: impronta, piano), `src/sync.test.ts` (J3 fra due dispositivi:
occorrenze senza unità, setup libero, spostamento che arriva com'è, import che collega, nulla in coda,
`dopoRicezione`; col corso su entrambi, l'occorrenza spostata altrove prende corso e unità di qui),
`src/app/scheduler.test.ts` (l'import di un corso esegue il ciclo; idempotenza con routine col corso altrove),
`src/data/repository.test.ts` (una ricorrenza scritta dal ciclo non si accoda).
