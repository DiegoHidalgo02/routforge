# design/ — export di Claude Design

Qui va l'export del progetto Claude Design "RoutForge" (https://claude.ai/design/p/8acfd054-2d68-41a6-8623-3f201d476f98).

## Come portarlo qui (una delle due vie)
1. **Consigliata** — in Claude Code, dentro il repo: `/design` → seleziona il progetto RoutForge → import.
2. **Manuale** — su claude.ai/design: Export → "Download as .zip" → scompatta il contenuto in questa cartella
   (oppure Export → "Handoff to Claude Code" → "Send to local coding agent").

Poi: `npm run design:check` deve stampare `0 file mancanti`.

## File attesi (elenco dal progetto di design)
Vedi `scripts/check-design.mjs` — `tokens.css`, `DESIGN.md`, `HANDOFF.md`, `course-data.js`, `support.js`,
le schermate `S1…S22 *.dc.html`, le tappe `01…10 *.dc.html`, `RoutForge Design System.dc.html` e le spec
in `spec/` (incluse `M0-Riattivazione_JavaScript.md` e `M1-Tooling_Moderno.md` = corso di esempio).

## Regole
- Questi file sono **fonte per l'aspetto**; per il comportamento valgono `docs/spec/`.
- Non si modificano a mano: si cambia il design in Claude Design e si reimporta (`/design-sync`).
- `tokens.css` viene copiato in `src/ui/styles/tokens.css` in T-006 senza modifiche.
