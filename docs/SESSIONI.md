# Sessioni di studio — casistica delle chiusure

*Chiesta dall'utente il 02/10/2026 con la conferma di D-SESS-2: ogni modo in cui una sessione finisce e che cosa resta
scritto. Le regole stanno in MECC §10.5 (chiusura), §11 (esiti), §12 (streak), §20 (statistiche) e nelle decisioni
D-SESS-1, D-SESS-2, D-TIMER-1, D-TIMER-2, D-ESITO-1: qui si elencano i casi, non si riscrivono le regole. Ogni riga
della tabella è un test di `src/app/session.test.ts` («Casistica delle chiusure»), eseguito dal database: una riga che
cambia senza il suo test è un errore, e un caso nuovo si aggiunge qui e lì insieme.*

## 1. Definizioni usate nelle righe

- **Durata pianificata della sessione** (§10.2, D-SESS-2 confermata il 02/10/2026): routine → dall'avvio alla fine del
  blocco (avviata in ritardo, i minuti residui); recupero → la durata scelta; cronometro e libera senza durata → nessuna.
- **Focus** = tempo attivo: trascorso − pause dell'utente − intervalli non verificati non attribuiti (D-TIMER-1,
  D-TIMER-2). Il tempo extra oltre la fine è focus (si somma ai minuti del blocco; §20 lo riporta anche a parte).
- **Soglia** (D7): «Abbandona» con focus / durata pianificata ≥ 65 % chiude come `terminata_prima` con l'esito Continua
  registrato; sotto, `abbandonata` senza esito. Mai con il cronometro né senza blocco.
- **Ritardo** = `Blocco.minutiRitardo`, fissato al primo avvio (D-SESS-1 n. 2): adesso − inizio, mai negativo; nel
  recupero di un perso è grande; nessuna chiusura lo cambia (puntualità di §20).
- **Minuti del blocco** = focus arrotondato al minuto; un parziale ripreso somma (D-ESITO-1). Senza sessione («Registra
  esito», C6) minuti = durata pianificata del blocco, 0 con Salta.
- **Riga in `sessioni`**: sempre, anche per gli abbandoni (§20: concluse = con fine; gli abbandoni si contano a parte).
  Porta `chiusura` (`completata` = traguardo raggiunto o cronometro, `terminata_prima`, `abbandonata`), `esito` (`null`
  nell'abbandono), riepilogo, `intervalliNonVerificati`, `chiusaIl`.

## 2. Casi (blocco di studio 09:00–10:00 sull'unità 1.1; ogni numero è un test)

| #   | Caso                                                                                            | Avvio · ritardo | Chiusura | `sessioni`: chiusura · esito              | Blocco                                                                                     | Unità · streak   |
| --- | ----------------------------------------------------------------------------------------------- | --------------- | -------- | ----------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------- |
| 1   | in orario, timer a fine, esito Completata                                                       | 09:00 · 0       | 10:00    | completata · completata                   | completato · 60'                                                                           | completata · +1  |
| 2   | in orario, «Registra esito» prima della fine, Continua                                          | 09:00 · 0       | 09:40    | terminata_prima · continua                | parziale · 40'                                                                             | parziale · +1    |
| 3   | in orario, «Abbandona» al 66 % (D7)                                                             | 09:00 · 0       | 09:40    | terminata_prima · continua (automatico)   | parziale · 40'                                                                             | parziale · +1    |
| 4   | in orario, «Abbandona» al 58 % (D7)                                                             | 09:00 · 0       | 09:35    | abbandonata · —                           | programmato, senza minuti; perso dal ciclo dopo le 10:30 (§8), senza avviso (D-NOTIF-2)    | non_iniziata · 0 |
| 5   | pausa 09:20–09:35, «Abbandona» alle 09:50: 35' di focus (58 %)                                  | 09:00 · 0       | 09:50    | abbandonata · —                           | programmato                                                                                | non_iniziata · 0 |
| 6   | esito Salta prima della fine                                                                    | 09:00 · 0       | 09:40    | terminata_prima · salta                   | saltato · 40'                                                                              | saltata · 0      |
| 7   | esito Indietro a fine (la 1.1 è la prima del percorso)                                          | 09:00 · 0       | 10:00    | completata · indietro                     | indietro · 60'                                                                             | da_rivedere · 0  |
| 8   | Continua con «conta nel piano» spento                                                           | 09:00 · 0       | 09:40    | terminata_prima · continua (non conta)    | programmato (torna), senza minuti; nessun avviso «perso» (D-ESITO-1, D-NOTIF-2)            | non_iniziata · 0 |
| 9   | **in ritardo**, timer a fine, Completata                                                        | 09:30 · 30      | 10:00    | completata · completata                   | completato · 30'                                                                           | completata · +1  |
| 10  | **in ritardo**, «Abbandona» a 20' sui 30' residui (66 %)                                        | 09:30 · 30      | 09:50    | terminata_prima · continua                | parziale · 20'                                                                             | parziale · +1    |
| 11  | **in ritardo**, «Abbandona» a 15' (50 %)                                                        | 09:30 · 30      | 09:45    | abbandonata · —                           | programmato; il ritardo 30 resta                                                           | non_iniziata · 0 |
| 12  | **in ritardo**, oltre la fine fino alle 10:20, Continua                                         | 09:30 · 30      | 10:20    | completata · continua                     | parziale · 50' (20' extra)                                                                 | parziale · +1    |
| 13  | recupero di un perso, 25' scelti, a fine Completata                                             | 10:20 · 80      | 10:45    | completata · completata                   | completato · 25'                                                                           | completata · +1  |
| 14  | recupero 25', «Abbandona» a 17' (68 %)                                                          | 10:20 · 80      | 10:37    | terminata_prima · continua                | parziale · 17'                                                                             | parziale · +1    |
| 15  | recupero 25', «Abbandona» a 10' (40 %)                                                          | 10:20 · 80      | 10:30    | abbandonata · —                           | programmato; il ciclo lo rimarca perso (C8), senza avviso                                  | non_iniziata · 0 |
| 16  | recupero col cronometro, «Abbandona» dopo 40'                                                   | 10:20 · 80      | 11:00    | abbandonata · — (nessuna soglia)          | programmato                                                                                | non_iniziata · 0 |
| 17  | recupero col cronometro, Continua dopo 40'                                                      | 10:20 · 80      | 11:00    | completata · continua                     | parziale · 40'                                                                             | parziale · +1    |
| 18  | battito alle 09:10, riapertura alle 09:50 (40' non verificati), «Abbandona» alle 09:55: 15' (25 %) | 09:00 · 0    | 09:55    | abbandonata · —                           | programmato                                                                                | non_iniziata · 0 |
| 19  | come 18 con «Conta come studio»: 55' (91 %)                                                       | 09:00 · 0       | 09:55    | terminata_prima · continua                | parziale · 55'                                                                             | parziale · +1    |
| 20  | libera sull'unità 1.1 da 50', Continua a fine                                                   | 09:00 · —       | 09:50    | completata · continua                     | retroattivo 09:00–09:50, parziale · 50' (C7)                                               | parziale · +1    |
| 21  | libera, «Abbandona» dopo 50'                                                                    | 09:00 · —       | 09:50    | abbandonata · — (nessuna soglia)          | nessun blocco                                                                              | — · 0            |

Casi coperti da altri test con le stesse regole: libera senza unità (non conta nel piano: nessun blocco, nessuna streak,
§11; `src/app/outcome.test.ts`); pomodoro multi-materia (minuti ripartiti per unità, D3); uscita d'emergenza
dall'iperfocus (interruzione nel riepilogo, D5); ripresa di un parziale (i minuti si sommano, D-ESITO-1); «Registra
esito» senza sessione (C6); pause e tempo extra esclusi dalla soglia (`src/domain/timer.test.ts`, D7).

## 3. Senza chiusura

- **Sessione rimasta aperta** (crash, app chiusa, anche giorni dopo): nulla la chiude da sola (D4, D-TIMER-1 n. 8;
  confermato il 02/10/2026, nessuna proposta automatica di abbandono). Il banner la tiene visibile e l'avviso
  dell'intervallo non verificato dice da quando e per quanto; l'utente chiude con uno dei casi 2–8 sul focus confermato
  (18–19) o abbandona. Per una routine la fine resta quella del blocco: il tempo extra è il focus oltre la fine.
- **Orfano** (`in_corso` senza sessione attiva, §8, C8): il ciclo lo riporta `programmato` e lo giudica con le regole dei
  persi; il ritardo resta.

## 4. Che cosa leggono le statistiche (T-029, §20)

- **Focus** = somma del focus delle sessioni concluse (`chiusura` ≠ `abbandonata`); le `terminata_prima` con il Continua
  automatico (3, 10, 14, 19) sono concluse, non abbandoni. Gli intervalli non contati sono già fuori dal focus;
  `intervalliNonVerificati` resta nella riga per mostrarli.
- **Abbandoni** = righe `abbandonata` (4, 5, 11, 15, 16, 18, 21), anche fra gli indicatori dell'iperfocus.
- **Puntualità** = `Blocco.minutiRitardo` dei blocchi di studio avviati (9–17 lo tengono anche dopo un abbandono);
  T-029 decide se il ritardo dei recuperi di giorni passati (13–17) entra nel ritardo medio (D-SESS-1).
- **Efficienza** = focus / durata pianificata sulle sessioni con piano; **tempo extra** = focus oltre la durata (12).
- **Esiti** = dallo stato del blocco (`completato`, `parziale`, `indietro`, `saltato`) e dalla riga di `sessioni`; con
  «conta nel piano» spento (8) l'esito sta solo in `sessioni`.
