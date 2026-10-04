---
paths:
  - "src/ui/**"
---
# Regole per `src/ui` (schermate e componenti)

- Importa da `app` e `domain`; mai da `data` o `platform` (INV-1).
- Nessuna regola di business nei componenti: stati, soglie e transizioni arrivano dai servizi o dal dominio. Il
  comportamento viene dalle spec, l'aspetto dal design dopo il suo handoff (`docs/03_HANDOFF_DESIGN_CODE.md`; oggi
  nessun design attivo: le schermate si implementano o si ritoccano dopo l'handoff del nuovo). Se design e spec
  divergono vince il design (D-DESIGN-1) e la divergenza va nell'handoff.
- Colori, tipografia, spaziature, raggi e ombre solo dai token di `src/ui/styles/tokens.css` (copia non modificata dei
  token dell'export del design: oggi del vecchio, finché il nuovo handoff non la sostituisce); nessun valore hardcoded.
- Stack (D-STACK-1): React 19 + Vite; componenti `.tsx` con CSS Modules che usano solo `var(--…)`; niente Tailwind né
  stili inline con valori; icone da `lucide-react` (tratto 1.75); font locali (`@fontsource`); rotte con `react-router`.
- Ogni testo visibile è una chiave i18n nelle sei lingue (FUNZ §22), notifiche incluse; i valori del dominio
  (`in_corso`) non si mostrano mai direttamente. La chiave va in tutti e sei i file di `src/ui/i18n/` (un dizionario
  senza una chiave non compila) e si legge con `t()`; la lingua viene solo da `pickLanguage` (MECC §23).
- Mobile sotto 1024 px, desktop da 1024 px (D-UI-1). I keyframe `rf-…` stanno in `tokens.css`, globali: in un CSS
  Module si citano con `global(rf-in)`, altrimenti vengono rinominati e l'animazione sparisce senza errori.
- Il focus è `:root :focus-visible` in `src/ui/styles/global.css` (`--ring-focus`, sopra le ombre dei componenti). Un
  componente che cambia `box-shadow` in `:hover` o `:active` pareggia quella specificità e copre l'anello: gli serve un
  suo `:focus-visible` con `var(--ring-focus)`.
- Riduzione animazioni e scala del testo di sistema sempre rispettate; nessun numero di versione nelle schermate,
  salvo Impostazioni → Informazioni (FUNZ §23, D-DESIGN-1 n. 12).
- Test UI solo dove uno scenario lo richiede (es. G3); gli altri scenari si verificano a livello di servizio.
- Prima di chiudere una schermata: subagent `design-checker` per l'aspetto, `spec-reviewer` per il comportamento.
