# claude-design/ — export di Claude Design

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

## Struttura dopo l'import

`claude-design/` riproduce uno a uno il progetto Claude Design: schermate `S*.dc.html`, tappe `01…10 *.dc.html`, `HANDOFF.md`, `support.js` e `RoutForge Design System.dc.html` alla radice; la sottocartella `design/` dell'export con `tokens.css`, `DESIGN.md`, `course-data.js`; la sottocartella `spec/` con i due moduli del corso di esempio (al 24/09/2026 assenti dal progetto: vanno copiati a mano). I percorsi nei documenti sono quindi `claude-design/design/tokens.css`, `claude-design/HANDOFF.md`, `claude-design/S1 Oggi Mobile.dc.html`. La cartella del repository si chiama `claude-design/` proprio per non confondersi con la sottocartella `design/` dell'export.

## Regole
- Questi file sono **fonte per l'aspetto**; per il comportamento valgono `docs/spec/`.
- L'export **si versiona in git** (D-DESIGN-1): è una fonte di verità e deve essere disponibile a ogni agente e a
  ogni sessione, non solo sul PC dell'utente. Restano fuori solo gli ZIP scaricati (`claude-design/export/*.zip`).
- Non si modificano a mano: si cambia il design in Claude Design e si reimporta (`/design-sync`).
- `tokens.css` viene copiato in `src/ui/styles/tokens.css` in T-006 senza modifiche.
