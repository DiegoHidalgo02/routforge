# RoutForge — Blocchi da risolvere

Gli unici punti non definiti del pacchetto. Tutto il resto è definitivo. Nessuno di questi blocchi va risolto inventando: serve una decisione o un file mancante.

## BLOCCO 1 · Creazione su desktop
- **Definito**: `CLAUDE.md` «Crea → Conferma della creazione» (il foglio si rimpicciolisce nella card e si posa nel calendario) non è limitato al mobile. `design/DESIGN.md` §6 «Creazione» descrive la resa mobile.
- **Rappresentato**: `S1 Oggi Mobile` (foglio sopra Oggi, animazione completa in Giorno, Settimana, Mese). `S4 Crea Desktop` alla conferma torna a `S1 Oggi Desktop` con il toast «… creato», senza animazione.
- **Manca**: la resa desktop (forma di partenza: pannello 440 a destra). Fino alla decisione: desktop come nel mock, toast senza animazione.

## BLOCCO 2 · «Registra esito» dal cerchio su desktop
- **Definito**: `CLAUDE.md` «Cerchio di completamento»: il cerchio conferma per ogni tipo, su mobile e desktop; lo studio apre «Registra esito» sopra Oggi.
- **Rappresentato**: mobile (`S1 Oggi Mobile` `sheet=esito`). Su desktop il cerchio di una card di studio non ha azione e il pannello non è disegnato (nel mock l'unico studio da fare è la card Adesso, che ha il play).
- **Manca**: il pannello desktop. Gli altri pannelli desktop sopra Oggi («Voci rimaste», «Revisione fasi») sono pannelli 440 a destra.

## BLOCCO 3 · File del corso non presenti nel pacchetto
- `spec/RoutForge_FORMATO_CORSO.md`, `spec/M0-Riattivazione_JavaScript.md`, `spec/M1-Tooling_Moderno.md` sono citati da `spec/RoutForge_CONTESTO.md` §2, `design/DESIGN.md` §7 e `HANDOFF.md`, ma non sono nel pacchetto.
- Presente: `design/course-data.js`, il corso dei mock già letto (moduli, unità, sezioni, risorse, criteri Go/No-Go). Basta per i mock; per il parser dell'import (MECCANISMI §16) servono i file originali dal repository.

## BLOCCO 4 · Decisioni di prodotto aperte (non di design)
- **D-SYNC-1**: sorgente dell'istante di ultima modifica per i conflitti (orologio del dispositivo o del servizio). MECCANISMI §25.
- **D-BACKUP-1**: la chiave Gemini finisce in chiaro nel file di backup. MECCANISMI §22.
- **Cifratura lato client della chiave Gemini** nella sincronizzazione. MECCANISMI §25.
- **D-QUIZ-1**: il criterio Go/No-Go automatico («Domande socratiche») si spunta quando un quiz del modulo raggiunge la soglia scritta nel criterio. MECCANISMI §16.

Nessuno dei quattro cambia schermate o stati: cambiano solo logica e dati.
