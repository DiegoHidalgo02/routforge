# MODULO M1 — Tooling Moderno: Terminale, Git, npm, Moduli ES, Vite

**Tipo:** NUOVO CONTENUTO
**Prerequisiti:** M0 settimane 1–4 completate (protocollo di verifica attivo, primo deploy fatto)
**Finestra indicativa:** settimane 8–11 (mini-modulo, v. mappa §4)

Nella diagnosi questo mondo è **assente del tutto**: npm, package.json, bundler, build step — zero occorrenze in tutta la codebase (§2.2). Senza questo strato nessun progetto 2026 esiste: è il ponte obbligato tra "file HTML aperto nel browser" e lo sviluppo professionale di M2, M6, M10. Il modulo è volutamente corto e operativo: ogni concetto viene installato usandolo sul Task Tracker di M0, non in astratto.

### Obiettivi di Apprendimento
Al termine Diego sarà in grado di:
- **Applicare** i comandi shell fondamentali (navigazione, manipolazione file, pipe) senza cercarli, dentro Git Bash su Windows
- **Costruire** un flusso Git completo: staging selettivo, commit atomici con messaggi sensati, branch, merge, risoluzione di un conflitto semplice, push/pull
- **Analizzare** un package.json: dipendenze vs devDependencies, script, versionamento semantico — e spiegare cosa fa npm install
- **Spiegare** cosa sono i moduli ES (import/export usati finora "meccanicamente", diagnosi §2.2) e perché un progetto si spezza in moduli
- **Costruire** un progetto Vite da zero e migrare il Task Tracker dentro la toolchain: dev server, build, deploy del risultato
- **Valutare** cosa fa davvero un bundler e perché esiste (il "perché" prima del "come", come da tuo stile)

---

#### Unità 1.1 — Il terminale come casa (shell)

**🎯 Concetto Core: la riga di comando è l'interfaccia del mestiere**
Ogni strumento da qui in avanti (git, npm, vite, i test, il deploy, e in futuro Docker e gli agent AI) vive nel terminale. L'obiettivo non è memorizzare comandi: è perdere la paura, capire il modello (comandi, argomenti, flag, pipe, exit code) e sapersi orientare. Su Windows userai Git Bash, così i comandi coincidono con quelli di ogni tutorial e di ogni server Linux che incontrerai.

**📖 1. Teoria (Fondamenta)**
- [The Missing Semester — The Shell (MIT)](https://missing.csail.mit.edu/2020/course-shell/)
- Descrizione: la lezione di apertura del corso MIT nato esattamente per questo buco formativo ("le cose che i corsi di CS non insegnano"). Copre il modello mentale della shell: cosa succede quando digiti un comando, PATH, redirezione, exit code. Leggi il testo della lezione; è il riferimento concettuale su cui poggia tutta la pratica di questa unità.

**📺 2. Studio (Visualizzazione)**
- [Command Line Crash Course For Beginners — Traversy Media](https://www.youtube.com/watch?v=uwAqEzhyjtw)
- Descrizione: un attraversamento video dei comandi del terminale mostrati dal vivo (navigazione, file, permessi, pipe). Vedere qualcuno muoversi fluido nel terminale toglie l'intimidazione e ti mostra il ritmo di lavoro reale. Guardalo prima di iniziare gli esercizi, poi replica ogni comando nel tuo Git Bash.

**🛠️ 3. Pratica (Testing & Debugging)**
- [cmdchallenge — sfide shell nel browser](https://cmdchallenge.com/)
- Descrizione: sfide a obiettivo singolo ("scrivi il comando che...") con terminale nel browser e feedback immediato — zero setup, esecuzione reale. È la palestra ideale per i comandi shell: leggi la sfida, PREVEDI il comando sul quaderno, provalo, verifica. Completa la prima serie di sfide; poi replica i comandi vinti nel tuo Git Bash su file veri del repo di studio.

**🏗️ 4. Mini Progetto Finale: "Il mio cheat-sheet eseguito"**
- [learnshell.org — Free Interactive Shell Tutorial](https://www.learnshell.org/)
- Descrizione del progetto: usa questo tutorial interattivo (editor con Run/Solution nel browser) sui capitoli Basic per costruire, comando dopo comando, un cheat-sheet personale nel repo di studio. Regola: ogni riga del cheat-sheet è ammessa SOLO se il comando è stato eseguito e l'output osservato (protocollo M0 applicato alla shell). Formato: comando, cosa mi aspettavo, cosa ha fatto, quando lo userò. Obiettivo: 20 comandi padroneggiati.

---

#### Unità 1.2 — Git vero (non solo add-commit-push)

**🎯 Concetto Core: Git è un grafo di snapshot, non una cartella sincronizzata**
Nei 6 progetti Techdegree: 1 solo gitignore, zero branch, zero merge (diagnosi §2.2). Git usato come "salvataggio" invece che come strumento di lavoro. Qui si costruisce il modello mentale (commit = snapshot, branch = puntatore, merge = ricongiungimento del grafo) e la pratica quotidiana che i recruiter leggono nella cronologia.

**📖 1. Teoria (Fondamenta)**
- [Pro Git — Git Basics (cap. 2)](https://git-scm.com/book/en/v2/Git-Basics-Getting-a-Git-Repository)
- [Pro Git — Branches in a Nutshell (cap. 3.1)](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell)
- Descrizione: il libro ufficiale, gratuito, con i diagrammi del grafo che sono lo standard con cui tutti disegnano Git. Dal capitolo 2 servono: il ciclo di vita dei file (untracked/staged/committed), lo staging selettivo, la storia. Dal 3.1: cosa È un branch (un puntatore mobile, non una copia) — la pagina con i diagrammi più importanti del libro. Ignora per ora rebase e workflow avanzati.

**📺 2. Studio (Visualizzazione)**
- [Learn Git Branching — visualizzatore interattivo](https://learngitbranching.js.org/)
- Descrizione: il visualizzatore dove ogni comando che digiti muove il grafo SOTTO I TUOI OCCHI — motion graphics didattica applicata a Git, il tuo formato ideale. Completa le sequenze "Introduction" e "Ramping Up". Prima di ogni comando: previsione di come si muoverà il grafo (il tuo protocollo, ancora). Questo è insieme visualizzazione E gioco, ma la pratica su repo reale la fai nel punto successivo.

**🛠️ 3. Pratica (Testing & Debugging)**
- [Git Exercises — esercizi git reali con verifica automatica](https://gitexercises.fracz.com/)
- Descrizione: qui usi il tuo terminale git VERO (non una simulazione): ogni esercizio è uno stato del repo da risolvere committando e facendo `git push` a un verificatore remoto che valida automaticamente la soluzione. Copre esattamente il workflow reale — commit, branch, merge, fix della storia. È il complemento perfetto a Learn Git Branching: lì vedi il grafo, qui lo manovri sul serio con feedback automatico. (Alternativa offline: [git-katas](https://github.com/eficode-academy/git-katas), con script `test.ps1` per Windows.)

**🏗️ 4. Mini Progetto Finale: "Feature branch reale sul Task Tracker"**
- [Pro Git — Basic Branching and Merging (cap. 3.2)](https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging)
- Descrizione del progetto: il teatro è il TUO Task Tracker di M0 (nessun progetto nuovo: usi codice che già esiste e capisci, coerente col titolo dell'unità). Seguendo il flusso descritto in questo capitolo, sviluppa una piccola feature (es. modifica di un'attività esistente) su un branch dedicato con 3+ commit atomici e messaggi in inglese decente, poi merge su main SOLO a feature funzionante e verificata; poi simula e risolvi un conflitto creando due branch che toccano la stessa riga. La cronologia risultante è l'artefatto: chiunque deve poter ricostruire cosa hai fatto leggendo solo i messaggi di commit. *(Perché non un progetto roadmap.sh qui: quelli a portata sarebbero API/backend, fuori dalle competenze di M1 — il feature-branch si allena meglio su codice che già padroneggi.)*

---

#### Unità 1.3 — npm, package.json e i moduli ES capiti davvero

**🎯 Concetto Core: da "file che si includono" a "progetto con dipendenze dichiarate"**
import/export li hai già digitati, mai capiti (diagnosi: "usati meccanicamente, mai spiegati"). Qui il salto: un progetto moderno dichiara le sue dipendenze (package.json), le installa riproducibilmente (npm install, lockfile) e organizza il proprio codice in moduli con confini espliciti. È il prerequisito assoluto di M2 (Vitest arriva da npm) e di tutto il percorso.

**📖 1. Teoria (Fondamenta)**
- [Modules, introduction — javascript.info](https://javascript.info/modules-intro)
- Descrizione: cosa cambia quando uno script diventa modulo (scope proprio, strict mode automatico — collegamento diretto alla tua unità 0.4 —, caricamento deferito, un'istanza sola per modulo). I task e gli esempi vanno eseguiti: metà delle sorprese di questo capitolo si vede solo eseguendo.

**📺 2. Studio (Visualizzazione)**
- [Modern JavaScript Explained For Dinosaurs — Peter Jang](https://peterxjang.com/blog/modern-javascript-explained-for-dinosaurs.html)
- Descrizione: il racconto-storia che ricostruisce PERCHÉ esistono npm, i bundler e i build step, partendo da "un file HTML con uno script" (esattamente dove sei tu) e aggiungendo un problema alla volta. È storytelling tecnico nel senso pieno: ogni strumento entra in scena quando il dolore che risolve è già chiaro. La risposta definitiva al tuo "voglio il perché prima del come".

**🛠️ 3. Pratica (Testing & Debugging)**
- [ES Modules Fundamentals — moduli reali eseguibili nel browser](https://esmodules.com/fundamentals/)
- Descrizione: piattaforma dove scrivi ed esegui veri moduli ES nel browser (non simulazioni), con output console live e "Edit in CodePen": pratichi named/default export, import rinominati e aggregati con feedback immediato. È mirata ESATTAMENTE su import/export, il concetto che finora usavi alla cieca. In parallelo, sul tuo computer: crea una cartella, `npm init`, installa una libreria a caso, osserva `node_modules` e il lockfile, cancella `node_modules` e ricostruiscilo con un solo comando — quel ciclo È il concetto npm.

**🏗️ 4. Mini Progetto Finale: "Task Tracker spezzato in moduli"**
- [package.json — riferimento campi (npm Docs)](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)
- Descrizione del progetto: riorganizza il Task Tracker di M0 in 3+ moduli ES con confini sensati (es. storage, logica attività, interfaccia DOM) e import/export espliciti, e scrivi a mano il suo `package.json` consultando questa pagina SOLO per i campi che ti servono (name, scripts, dependencies vs devDependencies). Criterio: ogni modulo si può spiegare in una frase; nessun modulo conosce i dettagli interni degli altri. È il primo esercizio di architettura del percorso (da 1.5/10 si parte così, non dai design pattern).

---

#### Unità 1.4 — Vite: la toolchain che vedi funzionare

**🎯 Concetto Core: dev server + build = i due mondi di ogni progetto moderno**
Vite è lo standard 2026 per i progetti frontend/full-stack ed è la toolchain di M6 e M10. I due concetti da possedere: in sviluppo un server locale serve i tuoi moduli così come sono (con hot reload); in produzione una build li impacchetta ottimizzati. Chi confonde i due mondi non capisce mai cosa sta deployando.

**📖 1. Teoria (Fondamenta)**
- [Why Vite — vite.dev](https://vite.dev/guide/why)
- Descrizione: la pagina "filosofica" della documentazione: il problema storico (bundle a ogni modifica, tempi morti) e la soluzione (moduli ES nativi in dev, bundle solo in produzione). Da leggere DOPO l'articolo dei dinosauri della 1.3: è il capitolo finale della stessa storia.

**📺 2. Studio (Visualizzazione)**
- [Vite in 100 Seconds — Fireship](https://www.youtube.com/watch?v=KCrXgy8qtjM)
- Descrizione: panoramica visiva e rapidissima di cosa fa Vite e perché è diventato lo standard, con la demo del dev server istantaneo. Ti dà il colpo d'occhio d'insieme prima di mettere le mani sulla guida operativa: capisci la forma del bosco prima di camminare tra gli alberi.

**🛠️ 3. Pratica (Testing & Debugging)**
- [Getting Started — vite.dev](https://vite.dev/guide/)
- Descrizione: la guida operativa ufficiale: crea un progetto dal template vanilla, esplora la struttura delle cartelle, prova i tre script fondamentali (dev, build, preview). Pratica chiave: esegui la build, apri la cartella di output e CONFRONTALA coi sorgenti — la differenza tra i due mondi (sviluppo e produzione) si impara con gli occhi. Fermati alla fine di "Getting Started"; il resto è consultazione.

**🏗️ 4. Mini Progetto Finale: "Task Tracker dentro Vite, deployato dalla build"**
- [Deploying a Static Site → GitHub Pages — vite.dev](https://vite.dev/guide/static-deploy.html#github-pages)
- Descrizione del progetto: migra il Task Tracker (già modulare dalla 1.3) dentro un progetto Vite e deploya la BUILD di produzione su GitHub Pages seguendo la sezione dedicata di questa guida (che spiega anche perché serve configurare il percorso base). Dev server per lo sviluppo, build per la consegna, deploy della build al posto della versione vecchia. Il README si aggiorna con le istruzioni di avvio in locale — da qui in poi ogni tuo repo le avrà.

---

### Verifica della Comprensione

**Domande Socratiche di auto-valutazione:**
1. Cosa fa esattamente npm install quando lo lanci in un progetto clonato? Che ruolo ha il lockfile?
2. Qual è la differenza tra dependencies e devDependencies — e in quale delle due andrà Vitest, e perché?
3. Un branch Git è una copia dei file? Cosa si muove davvero quando committi su un branch?
4. Perché uno script caricato come modulo è automaticamente in strict mode e ha scope proprio? Cosa c'entra con la tua unità 0.4?
5. Cosa contiene la cartella di build che NON c'è nei sorgenti, e viceversa?
6. Perché in sviluppo Vite non fa il bundle? Quale problema storico risolve questa scelta?
7. Racconta la catena: modifichi un file → salvi → cosa succede nel dev server → cosa vede il browser?
8. Come risolvi un conflitto di merge: cosa ti mostra Git, e cosa decide lui vs cosa decidi tu?

**Esercizi pratici progressivi:**
1. cmdchallenge: prima serie di sfide completata; poi gli stessi comandi replicati in Git Bash su file veri
2. Learn Git Branching (Introduction + Ramping Up) + Git Exercises (i primi esercizi con push verificato)
3. Ciclo completo npm: cancella node_modules del Task Tracker e riportalo funzionante con un comando
4. Conflitto simulato creato e risolto sul repo di studio, con spiegazione scritta della risoluzione

**Criteri Go/No-Go (binari):**
- [ ] Task Tracker migrato in Vite: dev server funzionante + build deployata su GitHub Pages → sì/no
- [ ] Codice organizzato in 3+ moduli ES con confini spiegabili in una frase ciascuno → sì/no
- [ ] Feature branch con 3+ commit atomici mergiata su main → sì/no
- [ ] Un conflitto di merge risolto e documentato → sì/no
- [ ] Domande socratiche: ≥7/8 a quaderno chiuso → sì/no

#### Riassunto di fine Modulo
Terminale, Git come grafo, npm come contratto di dipendenze, moduli ES capiti (non solo digitati) e Vite come toolchain: il Task Tracker di M0 è diventato un progetto professionale con dev server, build e deploy. Ora esiste l'infrastruttura per testare (M2) e per tutto il resto.

### Progetto del Modulo
- **Titolo:** Task Tracker — migrazione a toolchain moderna
- **Descrizione tecnica (ordine del cliente):** il progetto M0 va portato a standard di consegna 2026 senza cambiarne le funzionalità: repository con struttura Vite (sorgenti, output di build ignorato da Git), codice riorganizzato in moduli con responsabilità dichiarate nel README, script npm documentati (avvio sviluppo, build, anteprima), deploy aggiornato che serve la build di produzione, cronologia Git con feature branch e commit atomici. Criterio di accettazione del cliente: uno sviluppatore che clona il repo lo avvia in locale in meno di 2 minuti seguendo solo il README.
- **Risorsa online progetto:** [Getting Started — vite.dev](https://vite.dev/guide/) applicato al Task Tracker esistente (migrazione a toolchain). Il workflow Git si allena sul Task Tracker stesso (unità 1.2), senza introdurre progetti backend fuori portata a M1.

### Self-Critique del Comitato
- **Prof. universitario:** «Modulo puramente strumentale: nessuna teoria dei sistemi operativi dietro la shell, nessun modello formale di Git (DAG, content-addressing accennati appena). Scelta giusta per il timing — il conto si salda in M3 con CS50 e nella lezione MIT sul version control, che il modulo cita apposta.»
- **Senior SWE:** «Questo è il modulo con il miglior rapporto costo/valore dell'intero syllabus: 3 settimane che separano un hobbista da qualcuno che può lavorare in un team. La scelta di far praticare Git su un verificatore reale (gitexercises) invece che solo sulla simulazione è quella giusta: la simulazione insegna il grafo, il verificatore insegna il terminale vero. Insisto su una cosa: messaggi di commit in inglese da subito.»
- **Learning Scientist:** «Rischio basso di drop: tutto è operativo e con feedback immediato, e ogni unità ora ha una piattaforma di pratica distinta dalla teoria (cmdchallenge, Git Exercises, ES Modules, la guida Vite operativa). Unico allarme: Learn Git Branching può diventare gamification fine a sé stessa — fermarsi dopo Ramping Up, il resto quando servirà.»
- **CEO:** «Nessuna obiezione. La capacità di consegnare repo professionali dal mese 3 anticipa il binario employability.»
- **HR FAANG:** «Le convention sui commit e il README con istruzioni di avvio sono ciò che guardo per prima cosa in uno screening di portfolio. Bene che siano criteri di accettazione, non consigli.»
- **HR italiana:** «Le medie aziende italiane chiedono "Git" in TUTTI gli annunci junior (diagnosi §4.2): dopo questo modulo Diego può rispondere sì senza mentire. Suggerisco di annotare nel glossario anche il lessico Git inglese parlato: staging, merge, pull request.»
- **AI Research Scientist:** «Nota per il futuro: la fluenza da terminale costruita qui è anche il prerequisito degli strumenti AI seri (CLI, agent, MCP server in M12). Non è un modulo "non-AI": è il pavimento dell'AI engineering.»

**Riassunto del modulo.** M1 = da "file aperti nel browser" a progetto vero: shell (cmdchallenge/learnshell), Git come grafo con branch e merge (Learn Git Branching + Git Exercises su repo reale), npm/package.json, moduli ES compresi ed eseguiti (esmodules.com), Vite con dev/build/deploy. Tre settimane, tutte sul Task Tracker reale.
