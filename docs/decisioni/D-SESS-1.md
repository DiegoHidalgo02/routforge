# D-SESS-1 — Setup della sessione di studio: sessione attiva, ritardo, ripresa

**Stato**: applicata il 29/09/2026 (T-016): `src/domain/session.ts`, `src/app/session.ts`, `src/ui/Session.tsx`, campi
`Blocco.minutiAnticipo` e `Blocco.minutiRitardo` in `src/domain/types.ts`; revisioni indipendenti `spec-reviewer`
(conforme con rilievi) e `design-checker` (non fedele alla prima stesura): rilievi di comportamento e d'impaginazione
applicati, gli altri in `docs/03_HANDOFF_DESIGN_CODE.md` §10 n. 32. Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto
MECC §10.1 dice come l'orologio sceglie il contesto (anticipo, routine, recupero, libera), che la sessione è una sola e
come si sceglie la materia. Non dice dove stanno ritardo e anticipo, che MECC §20 conta per blocco; che cosa succede a
un parziale o a un blocco `in_corso` rimasto senza sessione quando si riprendono; come si comporta una routine a cavallo
di mezzanotte. D-SCHED-1 fissa il contratto con il ciclo: `preferenze.sessioneAttiva.valore.bloccoId`, scritto nella
stessa transazione dello stato del blocco.

## Decisione
Le nove regole della riga del registro. In sintesi: sessione attiva in `preferenze` con il tipo `SessioneAttiva`, letta
dal ciclo e dal setup con la stessa funzione; ritardo e anticipo sul blocco, fissati una volta; «di oggi» include
l'orario del blocco; parziale e orfano si riprendono senza perdere l'esito; unità bloccata solo nella sessione sul
blocco; abbandono già in T-016.

## Motivazione
- Il ciclo tratta da orfano ogni `in_corso` non puntato: blocco e sessione devono cambiare insieme (D-SCHED-1).
- La puntualità di §20 è «% blocchi di studio avviati con ritardo ≤ 5'»: il dato appartiene al blocco.
- Riscrivere `in_corso` un parziale e poi abbandonarlo lo riportava a `programmato` e il ciclo lo marcava perso: un
  blocco con esito finiva fra i persi (rilievo della revisione indipendente).
- Senza abbandono una sessione avviata dal telefono dell'utente sarebbe rimasta attiva fino a T-017.

## Alternative scartate
Ritardo e anticipo solo nella sessione; ritardo negativo per gli avvii fino a 5' prima dell'inizio; «di oggi» solo per
giorno locale; recupero limitato al giorno del blocco; parziale riscritto `in_corso` alla ripresa.

## Conseguenze
- T-017 costruisce il timer su `SessioneAttiva` (regime dalla `fine` e dalla `durata`) e decide chi chiude una sessione
  rimasta dopo un crash; l'abbandono esiste già.
- T-018 scrive l'esito sul blocco puntato anche se è un parziale ripreso; «Registra esito» diventa il primario del
  perso in S5 e «Recupera» il secondario.
- T-019 riconcilia le notifiche dopo `anticipateSession` (orari nuovi) e `startSession` (niente verifica per un blocco
  in corso), come dopo `moveBlock`.
- T-029 decide se il ritardo di un recupero di giorni passati entra nel ritardo medio.

## Verifica
`src/domain/session.test.ts` (contesti, soglia di 5', azioni, mezzanotte, parziale e orfano, materia),
`src/app/session.test.ts` (transazione blocco + sessione, ciclo, D6, abbandono di un parziale, anticipo con sessione
attiva), `src/ui/Session.test.tsx` (D6 e C5 dal setup).
