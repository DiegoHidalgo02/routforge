---
description: Esegui un task del backlog (docs/TASKS.md) con il ciclo completo: analisi → test → codice → verify → docs → commit
argument-hint: "[T-0NN | next]"
---
Esegui il task `$ARGUMENTS` (se `next` o vuoto: il primo task con stato `aperto` in `docs/TASKS.md`
le cui dipendenze sono `fatto`).

Procedura obbligatoria:
1. Leggi `docs/STATO.md`, la riga del task in `docs/TASKS.md`, i paragrafi di spec e gli scenari che cita.
   Se la colonna **Modello** indica un modello diverso da quello di questa sessione, dillo in una riga
   ("Questo task è previsto per <modello>: vuoi cambiare con /model prima che inizi?") e attendi la risposta.
2. Scrivi un piano di massimo 8 righe: file da creare/modificare, assunzioni, decisioni da annotare.
3. Test rossi che codificano gli scenari (un `describe` per scenario, es. `'Orizzonte — SCENARI A2'`).
4. Implementa il minimo che li fa passare rispettando `CLAUDE.md` §3–§4.
5. `npm run verify` finché è verde. Se tocchi AI, file utente, backup o sync: `/security-review`.
6. Auto-revisione: conformità alla spec, diff limitato al task, niente dipendenze non giustificate.
7. Aggiorna `docs/TASKS.md` (stato `fatto`), `docs/STATO.md` (fatto / problemi aperti / prossimo) e,
   se hai preso decisioni, `docs/01_DECISIONI.md`.
8. Commit convenzionale in italiano. Poi riporta in 5 righe: cosa è stato fatto, come è stato verificato,
   cosa resta aperto.
Se il task richiede una decisione elencata in `docs/06_SUPERVISIONE.md`, scrivi
`CHECKPOINT: <motivo>` in `docs/STATO.md` e fermati.
