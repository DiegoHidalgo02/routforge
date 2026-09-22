---
description: Codifica uno scenario di accettazione (docs/spec/RoutForge_SCENARI.md) in test e verifica che passi
argument-hint: "<ID scenario, es. B3>"
---
Scenario `$ARGUMENTS` di `docs/spec/RoutForge_SCENARI.md`.
1. Cita lo scenario e i paragrafi di MECCANISMI che lo governano.
2. Individua il modulo di dominio responsabile (o proponi dove crearlo, seguendo `CLAUDE.md` §3).
3. Scrivi il test (`describe('… — SCENARI $ARGUMENTS')`) usando date locali con `local(...)` di `src/domain/time.ts`.
4. Se il test è rosso perché la funzionalità manca, implementala in modo minimale; se rivela un bug, correggilo.
5. `npm run verify` verde. Aggiorna `docs/STATO.md` se lo scenario chiude un task.
