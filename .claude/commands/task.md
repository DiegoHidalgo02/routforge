---
description: Esegui un task del backlog (docs/TASKS.md) con il ciclo completo: analisi → test → codice → verify → docs → commit
argument-hint: "[T-0NN | next] [loop]"
---
Argomenti: `$ARGUMENTS`. Il primo è l'ID del task (`T-0NN`), oppure `next` o vuoto = il primo task con stato
`aperto` in `docs/TASKS.md` le cui dipendenze sono `fatto`. Se c'è anche la parola `loop`, sei stato avviato dal
loop semi-autonomo (`scripts/loop.ps1`): il modello l'ha già scelto il loop dalla colonna **Modello**, quindi non
chiedere conferme e non attendere risposte; se serve una decisione umana scrivi `CHECKPOINT:` o `BLOCCO:` in
`docs/STATO.md`, fai commit e termina.

Procedura obbligatoria:
1. Leggi `docs/STATO.md`, la riga del task in `docs/TASKS.md`, i paragrafi di spec e gli scenari che cita.
   Se la colonna **Modello** indica un modello diverso da quello di questa sessione (e non sei in modalità `loop`), dillo in una riga
   ("Questo task è previsto per <modello>: vuoi cambiare con /model prima che inizi?") e attendi la risposta.
   **Task in due fasi** (colonna "Fable 5.1 (piano) → Opus 5.5 (codice)"):
   - se `docs/piani/<ID>.md` NON esiste → fase piano (sessione Fable): scrivi in quel file un piano completo
     (regole di spec coinvolte con §, scenari, casi limite, file da creare, sequenza di test, rischi e decisioni
     da annotare); nessun codice di produzione; commit `docs(piano): <ID>`; poi fermati e scrivi
     "Piano pronto: passa a Opus 5.5 con /model e rilancia /task <ID>".
   - se `docs/piani/<ID>.md` esiste → fase codice (sessione Opus): segui il piano; se devi discostartene,
     annota il motivo in fondo al file del piano. Poi prosegui dal passo 2.
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
