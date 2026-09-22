# RoutForge — istruzioni per agenti non-Claude (Codex, OpenCode)

Leggi e applica **`CLAUDE.md`**: vale identico per te. In sintesi:

- Fonti di verità: `docs/spec/*` (precedenza: SCENARI > FORMATO_CORSO > MECCANISMI > FUNZIONALITA > CONTESTO); aspetto → `design/`.
- Non modificare `docs/spec/`. Non inventare requisiti. Ambiguità → decisione annotata in `docs/01_DECISIONI.md`.
- `src/domain` è puro (niente I/O, niente `Date.now()`): il "now" è sempre un parametro.
- Gate unico: `npm run verify` (typecheck + test) verde prima di ogni commit.
- Ruolo tipico di Codex/OpenCode in questo repo: **revisione** (`docs/05_LOOP_AGENTICO.md` §4) e task meccanici
  esplicitamente delegati; non prendere task dal backlog senza indicazione.
- Non inviare a modelli "free/trial" dati personali dell'utente, chiavi o materiali dei corsi (vedi `docs/04_STRUMENTI.md`).
