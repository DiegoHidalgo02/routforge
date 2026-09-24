---
paths:
  - "docs/**"
  - "CLAUDE.md"
  - "AGENTS.md"
  - ".claude/**"
---
# Regole per la documentazione e la governance

- `docs/spec/**` non si modifica mai (INV-5). Se una spec è ambigua o contraddittoria: decisione in
  `docs/01_DECISIONI.md`, contraddizione registrata in `docs/00_SINTESI.md` §6.
- Una decisione nuova = una riga in `docs/01_DECISIONI.md` (`D-AREA-n`: decisione, motivo, alternative, stato). Se è ad
  alto impatto (confini, modello dei dati, tempo, persistenza, sicurezza, sync, stack) anche la scheda
  `docs/decisioni/D-AREA-n.md` con contesto, decisione, motivazione, alternative, conseguenze, verifica. Una decisione
  che ne cambia un'altra aggiorna la riga vecchia (stato «sostituita da …»): mai due righe in contraddizione.
- Un invariante nuovo o cambiato = riga in `docs/INVARIANTI.md` con la sua verifica; se può essere un test, il test si
  scrive nello stesso task.
- Un task nuovo nasce da uno scenario o da un § non coperto (`docs/TASKS.md`) e aggiorna la riga dello scenario in
  `docs/TRACCIABILITA.md`.
- Una dipendenza nuova = riga in `docs/DIPENDENZE.md` prima di `npm install` (INV-8).
- `docs/STATO.md` si aggiorna a ogni chiusura di task con la struttura fissa: Fatto · In corso · Problemi aperti ·
  Divergenze design ↔ spec · Prossimo task · Checkpoint in attesa. È contesto tecnico, non un diario.
- `CLAUDE.md` resta sotto le 120 righe e contiene solo ciò che ogni sessione deve sapere; le regole di strato stanno in
  `.claude/rules/`. Una regola nuova è imperativa, verificabile e non ripete `CLAUDE.md` se non per precisarlo.
- I documenti citano paragrafi (§) e identificatori (`D-…`, `INV-…`, `T-0nn`, scenari) invece di riscrivere le regole.
