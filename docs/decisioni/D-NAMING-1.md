# D-NAMING-1 — Vocabolario unico del dominio in italiano

**Stato**: applicata (24/09/2026, rename guidato dal compilatore; residui nei tipi di risultato del parser corretti lo
stesso giorno). Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto

Le spec sono in italiano e fissano i nomi: Blocco, Ricorrenza, Sessione, stati `programmato · in corso · …`, unità
`non iniziata · parziale · da rivedere · …`. Il codice iniziale aveva i tipi del calendario in inglese
(`Block{kind,state,start}`) e il parser in italiano: due forme dello stesso concetto e conversioni a ogni strato.

## Decisione

- Tipi, attributi e valori del dominio in italiano come nelle spec: `Blocco{tipo,stato,inizio,fine,conOrario,
  orizzonte,unitaId,corsoId,persoIl}`, `UnitaPercorso`, `StatoCarta{facilita,intervalloGiorni,scadenza}`.
- Un concetto = un nome: nessun sinonimo inglese di un attributo già italiano, neppure nei tipi di risultato
  (`{ corso, avvisi }`, non `{ course, warnings }`).
- Funzioni, verbi tecnici e variabili locali possono restare in inglese (`assignPointer`, `parseCourse`, `review`).
- I valori di spec con spazi diventano identificatori con `_`: `in_corso`, `non_iniziata`, `da_rivedere`, `da_fare`,
  `orario_passato`. Le etichette visibili all'utente sono chiavi i18n, mai questi valori.
- Le tabelle di persistenza usano gli stessi nomi (`facilita`, non `ease`).
- Nomi di file, cartelle, funzioni, servizi e porte sono identificatori tecnici in inglese, come i moduli esistenti
  (`lost.ts`, `nowBlock.ts`, `scheduler/occurrences.ts`, `SchedulerService`, `Clock`): un solo nome per modulo; le
  schermate portano il nome del design (`Oggi`, `Crea`).

## Motivazione

Il codice è scritto da più modelli: due vocabolari raddoppiano i punti di errore e costano di più a ogni strato
aggiunto. Prima dello schema dati (T-004) il costo del rename era basso; dopo sarebbe stato una migrazione.

## Alternative considerate

- Tutto in inglese: contraddice le spec e obbliga a tradurre ogni regola prima di implementarla.
- Misto: lo stato trovato dall'audit, corretto.

## Conseguenze

- Un test lega l'unità importata dal parser all'unità del puntatore senza conversioni (`parser.test.ts`).
- `docs/02_ARCHITETTURA.md` §3 e ogni documento futuro usano i nomi italiani.
- Nessuna verifica automatica (INV-12): i nomi nuovi si controllano in revisione; le modifiche a `types.ts` sono ad
  alto impatto e richiedono la revisione indipendente (`docs/05_LOOP_AGENTICO.md` §7).
