# D-STACK-1 — Stack applicativo (UI, build, shell nativa)

**Stato**: aperta. Decide l'agente in T-000 dopo l'import completo del design; veto dell'utente prima di T-006 (CP1).
Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto

Tre piattaforme con lo stesso codice (CONTESTO §3); l'aspetto è definito dall'export di Claude Design (`tokens.css`,
HTML delle schermate, `support.js`); servono notifiche in background, sveglie a schermo intero, Non Disturbare, widget
Android, sintesi vocale, file system. L'autore è uno sviluppatore front-end web. Il dominio è TypeScript puro e non
dipende dalla scelta.

## Criteri e candidati

Criteri in ordine di peso e candidati A–D in `docs/02_ARCHITETTURA.md` §0: riuso del design, tre piattaforme con un
codice, capacità native disponibili come plugin, testabilità, semplicità, reattività. Candidato principale A:
TypeScript + React + Vite (PWA) + Capacitor.

## Decisione

*(da scrivere in T-000: scelta, motivi per criterio, alternative scartate e perché, data)*

## Conseguenze da registrare con la decisione

- Elenco definitivo dei pacchetti in `docs/DIPENDENZE.md`: le righe «previste» oggi riflettono il candidato A.
- Adattamento di `docs/02_ARCHITETTURA.md` §3, §6, §7 e di `.claude/rules/ui.md` e `.claude/rules/piattaforma.md`.
- `tsconfig` separato per `ui` e `platform` con lib `DOM` (D-TS-1); estensione di ESLint alle regole del framework
  (D-LINT-1).
- Conferma o revisione di D-DATA-1 (persistenza) e D-I18N-1 (i18n).
- Divergenze design ↔ spec annotate in `docs/STATO.md` (`docs/03_HANDOFF_DESIGN_CODE.md` §9).
