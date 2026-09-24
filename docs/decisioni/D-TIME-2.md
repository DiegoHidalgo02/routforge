# D-TIME-2 — Comportamento dei blocchi al cambio di fuso orario

**Stato**: decisa dall'utente al **CP0** il 24/09/2026: **ora locale di parete** (opzione B). Da realizzare in T-004,
T-011, T-013, T-019 e T-033. Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto

CONTESTO §3: «fuso orario e ora legale non devono spostare i blocchi di giorno». MECC §1: «ogni istante è assoluto;
il giorno di un blocco è il giorno locale dell'inizio». Con l'ora legale le due frasi coincidono (già testato). In
viaggio divergono: una routine delle 07:00 creata a Roma, vista a New York, è alle 01:00 (istante assoluto) oppure alle
07:00 (ora di parete), e un blocco serale può cambiare giorno. La precedenza formale (SCENARI > … > CONTESTO) darebbe
ragione a MECCANISMI, ma CONTESTO esprime un'intenzione diversa: la scelta spettava all'utente.

## Opzioni valutate

| | A. Istante assoluto | B. Ora locale di parete (scelta) |
|---|---|---|
| Modello | `inizio` e `fine` in epoch ms e basta | ricorrenze e blocchi futuri memorizzano anche giorno locale, orario di parete e fuso di calcolo; gli istanti restano derivati |
| Occorrenze (T-011) | generate una volta | riancorate quando il fuso del dispositivo cambia |
| Sync fra dispositivi in fusi diversi | stesso istante ovunque | stessa ora di parete ovunque, istanti diversi |
| Notifiche | nessun ricalcolo | riconciliazione dopo il riancoraggio |
| Costo se scelta dopo T-004 e T-011 | — | migrazione dello schema e rigenerazione |

## Decisione

Le attività pianificate seguono l'**orario locale del dispositivo**. Al cambio di fuso restano alla stessa ora di
parete e si riancorano al nuovo fuso; l'ora legale è già gestita (D-TIME-1) e continua a non spostare nulla di giorno.
Ciò che è già accaduto (blocchi completati, persi, sessioni) conserva i suoi istanti: solo i blocchi futuri
`programmati` e le scadenze derivate si riancorano.

## Conseguenze

- **Modello** (T-004): le ricorrenze memorizzano giorni della settimana, orario di parete d'inizio e di fine e il fuso
  di calcolo; i blocchi futuri memorizzano giorno locale, orario di parete e fuso accanto a `inizio`/`fine`. Gli istanti
  restano epoch ms (D-TIME-1) e il giorno resta quello locale dell'inizio (MECC §1).
- **Dominio** (T-011): la generazione delle occorrenze produce istanti con il costruttore `Date` locale del processo,
  che è il fuso corrente del dispositivo, e conserva l'ora di parete; una funzione pura «riancora» ricalcola gli istanti
  dei blocchi futuri quando il fuso memorizzato differisce da quello corrente. Nessun `Intl` nel dominio: il fuso
  corrente lo legge la porta `Clock` in `app` e lo passa come dato.
- **Ciclo dello scheduler** (T-013): passo «riancoraggio al cambio di fuso» **prima** dell'estensione delle
  ricorrenze di MECC §9, così persi, orizzonte e notifiche vengono giudicati su istanti già corretti.
- **Notifiche** (T-019): la riconciliazione segue il riancoraggio; gli id deterministici usano la chiave logica del
  blocco, non l'istante.
- **Sync** (T-033): i record trasportano giorno locale, orario di parete e fuso di origine; ogni dispositivo deriva
  gli istanti nel proprio fuso. Due dispositivi in fusi diversi mostrano la stessa ora di parete.
- **Test**: la suite in più fusi resta; T-011 e T-013 aggiungono il caso «fuso cambiato fra due esecuzioni» con il
  fuso passato come dato (nessun cambio di `TZ` a runtime).
- **Utente**: il dettaglio di un'attività non deve spiegare nulla: l'orario mostrato è quello di parete ovunque.

## Alternative scartate

Istante assoluto (A): più semplice da implementare, ma in viaggio sposta le routine e contraddice CONTESTO §3.

## Verifica

Da T-011: test «stessa ora di parete, istanti diversi, in due fusi passati come dato». Da T-013: test del passo di
riancoraggio nell'ordine del ciclo. Fino ad allora: nessuna verifica automatica (INV-18).
