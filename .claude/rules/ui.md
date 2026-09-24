---
paths:
  - "src/ui/**"
---
# Regole per `src/ui` (schermate e componenti)

- Importa da `app` e `domain`; mai da `data` o `platform` (INV-1).
- Nessuna regola di business nei componenti: stati, soglie e transizioni arrivano dai servizi o dal dominio. Il
  comportamento viene dalle spec, l'aspetto dal design: se divergono vince la spec e la divergenza va in
  `docs/03_HANDOFF_DESIGN_CODE.md` §10 (conteggio in `docs/STATO.md`).
- Colori, tipografia, spaziature, raggi e ombre solo dai token di `src/ui/styles/tokens.css` (copia non modificata di
  `claude-design/design/tokens.css`); nessun valore hardcoded.
- Stack (D-STACK-1): React 19 + Vite; componenti `.tsx` con CSS Modules che usano solo `var(--…)`; niente Tailwind né
  stili inline con valori (i mock li hanno solo per l'anteprima); icone da `lucide-react` (tratto 1.75); font locali
  (`@fontsource`); rotte con `react-router`. Ogni schermata si ricrea come Panel + cornice mobile/desktop, come nell'export.
- Ogni testo visibile è una chiave i18n nelle sei lingue (FUNZ §22), notifiche incluse; i valori del dominio
  (`in_corso`) non si mostrano mai direttamente.
- Riduzione animazioni e scala del testo di sistema sempre rispettate; nessun numero di versione in nessuna
  schermata (FUNZ §23).
- Test UI solo dove uno scenario lo richiede (es. G3); gli altri scenari si verificano a livello di servizio.
- Prima di chiudere una schermata: subagent `design-checker` per l'aspetto, `spec-reviewer` per il comportamento.
