---
description: Alias di /task per il ciclo del nuovo design (analizza → pianifica → implementa → verifica → correggi → registra → continua), sul primo task aperto o su quello indicato
argument-hint: "[T-0NN | next]"
---
Senza argomento il task è il primo `aperto`, con le dipendenze `fatte`, nell'ordine della mappa di
`docs/03_HANDOFF_DESIGN_CODE.md` §4 (il primo è T-052, piano in `docs/piani/T-052.md`). Esegui `/task <quel task>`
con queste aggiunte, valide per ogni task che tocca una schermata:
Ciclo: **analizza → pianifica → implementa → verifica → correggi → registra → continua**; dopo tre tentativi falliti
sullo stesso problema fermati e riporta; «registra» = `docs/TASKS.md`, `docs/TRACCIABILITA.md`, `docs/STATO.md`,
`docs/01_DECISIONI.md`, poi commit; continua col prossimo incremento della mappa.
- **Analizza**: oltre a spec e scenari, la riga della schermata in `docs/03_HANDOFF_DESIGN_CODE.md` §4 (file del
  design, stati, tavola) e `claude-design/CLAUDE.md` (decisioni vincolanti, vincono sulla spec). I `.dc.html` li legge
  il subagent `lettore-mock`, per pezzo (`data-screen-label`) o per stato, non il contesto principale.
- **Verifica**: subagent `design-checker` sugli stati toccati (usa `npm run confronto` sulla tavola `0N`), più
  `spec-reviewer` per il comportamento; controlli trasversali di `claude-design/docs/IMPLEMENTAZIONE.md` §6.
- **Fermati solo per**: una contraddizione che la gerarchia non risolve (`claude-design/CLAUDE.md` > `.dc.html` > docs
  del pacchetto > `docs/spec/`); un punto di `claude-design/docs/BLOCCHI.md` oltre il comportamento provvisorio scritto
  lì; un valore, uno stato, un testo o un'interazione che nessun file definisce; un'azione esterna o irreversibile; una
  scelta tecnica costosa da invertire che i documenti non coprono; tre tentativi falliti. Scrivi la domanda con le
  opzioni e il loro effetto, e prosegui con il lavoro che non ne dipende.
- Alla fine di ogni passo di CONTESTO §6: report breve e attesa dell'utente (checkpoint di `docs/06_SUPERVISIONE.md`).
