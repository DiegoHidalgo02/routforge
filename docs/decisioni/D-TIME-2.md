# D-TIME-2 — Comportamento dei blocchi al cambio di fuso orario

**Stato**: aperta. Decide l'utente al **CP0**, prima di T-004 e T-011 (`docs/06_SUPERVISIONE.md`). Riga nel registro:
`docs/01_DECISIONI.md`.

## Contesto

CONTESTO §3: «fuso orario e ora legale non devono spostare i blocchi di giorno». MECC §1: «ogni istante è assoluto;
il giorno di un blocco è il giorno locale dell'inizio». Con l'ora legale le due frasi coincidono (già testato). In
viaggio divergono: una routine delle 07:00 creata a Roma, vista a New York, è alle 01:00 (istante assoluto) oppure alle
07:00 (ora di parete), e un blocco serale può cambiare giorno. La precedenza formale (SCENARI > … > CONTESTO) darebbe
ragione a MECCANISMI, ma CONTESTO esprime un'intenzione diversa: nessuno può decidere al posto dell'utente.

## Opzioni

| | A. Istante assoluto | B. Ora locale di parete |
|---|---|---|
| Modello | come oggi: `inizio` e `fine` in epoch ms | ricorrenze e blocchi memorizzano ora di parete e fuso IANA; l'istante si ricalcola quando il fuso del dispositivo cambia |
| Occorrenze (T-011) | generate una volta | riancorate al cambio di fuso: passo nuovo nel ciclo dello scheduler |
| Sync fra dispositivi in fusi diversi | stesso istante ovunque | stessa ora di parete ovunque, istanti diversi |
| Notifiche | nessun ricalcolo | riconciliazione al cambio di fuso |
| Dipendenze | nessuna | conversione ora di parete + fuso → istante: `Intl` o una libreria (riga in `docs/DIPENDENZE.md`) |
| Costo se scelta dopo T-004 e T-011 | — | migrazione dello schema e rigenerazione delle occorrenze |

## Cosa non cambia

Il dominio attuale lavora su istanti e resta valido in entrambi i casi. L'ora legale è gestita e testata (D-TIME-1).

## Decisione

*(da scrivere al CP0: «istante assoluto» oppure «ora locale di parete», con la data; poi aggiornare lo stato nel
registro, la riga «Conseguenze» di D-TIME-1 e questo file)*

## Conseguenze attese

- A: nessuna modifica al codice; il dettaglio di un'attività dichiara che l'orario segue il fuso del dispositivo.
- B: campi `fuso` e ora di parete nelle ricorrenze (T-004); funzione di dominio «istante da ora di parete e fuso»;
  passo «riancoraggio al cambio di fuso» nel ciclo di MECC §9 (T-011, T-013); test in più fusi estesi al cambio di fuso a
  runtime.
