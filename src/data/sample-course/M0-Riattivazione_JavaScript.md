# MODULO M0 — Riattivazione JavaScript & Protocollo di Verifica

**Tipo:** CONSOLIDAMENTO
**Prerequisiti:** nessuno (è il punto di partenza)
**Finestra indicativa:** settimane 1–8 (v. `00_Mappa_Syllabus.md` §4)
**Trasversali attivi in questo modulo:** SOLO due — ciclo esegui-osserva-commenta + error handling dentro ogni esercizio (veto Learning Scientist: niente tooling, niente testing, niente TypeScript fino alla settimana 4).

Questo modulo non insegna JavaScript da zero: **riattiva ciò che c'è già** (diagnosi §2.1: DOM 4/5, array methods 3–4, Grid come ancora di fiducia) e **sostituisce il processo che ha prodotto i bug spediti** in tutti e 6 i progetti Techdegree. Le 12 misconcezioni documentate (diagnosi §2.3) rientrano qui come *esperimenti con previsione scritta* — il formato in cui Diego eccelle — mai come "questo l'avevi capito male".

**⚠️ Gerarchia delle unità (correzione post-analisi cognitiva v2 — protegge le 8 settimane più fragili):**
- **Unità CORE, a ritmo pieno:** 0.1 (protocollo), 0.3 (coercizione/truthiness), 0.5 (DOM + primo deploy), 0.7 (event loop), 0.8 (async/error handling). Sono la spina dorsale: senza di esse M1–M2 non stanno in piedi.
- **Unità ELASTICHE, senza colpa se si dilatano:** 0.2 (bonifica GitHub — parte in settimana 1 ma può diluirsi su più settimane), 0.4 (scope/closure), 0.6 (`this`), 0.9 (JS moderno).
- **Percorso minimo del modulo (per le settimane storte):** si proteggono nell'ordine le core. Se al Go/No-Go le core sono tutte solide ma restano code sulle elastiche, il Go si supera dichiarando un piano di coda SCRITTO (le code si chiudono nelle prime 2 settimane di M1, che è volutamente leggero). Il criterio resta binario: nessuna area core può essere "quasi".
- **Abitudini scaglionate:** settimane 1–2 SOLO protocollo + registro (+ glossario come rituale da 5'); Obsidian e NotebookLM entrano dalla settimana 2–4 SOLO se protocollo e registro reggono (v. sistema di studio §7). Ogni strumento nuovo è carico esecutivo: uno alla volta.

### Obiettivi di Apprendimento
Al termine Diego sarà in grado di:
- **Applicare** il ciclo esegui → osserva → commenta a ogni frammento di codice, scrivendo la previsione PRIMA dell'esecuzione e il commento DOPO l'output osservato
- **Prevedere** il valore di espressioni con coercizione, confronti e truthiness, motivando la previsione con la regola (non a memoria)
- **Analizzare** il comportamento di scope, closure, hoisting e `this` con lo schema decisionale ricostruito su esperimenti propri
- **Prevedere** l'ordine di esecuzione di codice sincrono/asincrono (event loop, microtask) con ≥80% di accuratezza
- **Costruire** ogni chiamata di rete con gestione errori completa (controllo dello stato della risposta + cattura dei fallimenti) — zero eccezioni
- **Costruire e deployare** due progetti DOM pubblici su GitHub Pages, difendibili riga per riga
- **Valutare** i propri 6 repository GitHub e bonificarli a standard leggibile da recruiter

---

#### Unità 0.1 — Il Protocollo di Verifica (la nuova abitudine, prima di tutto)

**🎯 Concetto Core: eseguire prima di dichiarare**
La diagnosi ha documentato il difetto strutturale n.1: commenti scritti su ciò che il video spiega, mai verificati contro ciò che il codice fa (previsioni errate lasciate agli atti, `darknes()` spedito in produzione). Questa unità installa il protocollo che governa TUTTO il resto del percorso: ogni previsione si scrive sul quaderno prima, si esegue, si osserva, e solo dopo si commenta ciò che è realmente successo. La console DevTools diventa il banco di prova permanente.

**📖 1. Teoria (Fondamenta)**
- [Console overview — Chrome DevTools](https://developer.chrome.com/docs/devtools/console/)
- Descrizione: panoramica ufficiale della console come ambiente di sperimentazione (non solo log di errori). Da questa pagina servono: come eseguire espressioni riga per riga, la cronologia dei comandi e le live expression. Ignora per ora le sezioni su framework e network: ti serve solo il ciclo scrivi-esegui-osserva. Si collega direttamente al formato-esperimento con cui affronterai ogni misconcezione delle unità successive.

**📺 2. Studio (Visualizzazione)**
- [Chrome Dev Tools Console Super Powers — Steve Griffith](https://www.youtube.com/watch?v=TqPrpglfE9c)
- Descrizione: dimostrazione dal vivo di come usare la Console non solo per leggere log ma per valutare espressioni, ispezionare oggetti e testare ipotesi al volo. Vederlo in azione toglie l'intimidazione dello strumento: guardi qualcuno usare la console come un tavolo da laboratorio, poi lo replichi. Ti serve prima di iniziare a sperimentare, così sai già quali tasti premere.

**🛠️ 3. Pratica (Testing & Debugging)**
- [Exercism — JavaScript track](https://exercism.org/tracks/javascript)
- Descrizione: piattaforma con editor e test automatici integrati; iscriviti e completa i primi 3 esercizi del percorso "Learning Mode". Exercism è il complemento perfetto del protocollo: ogni esercizio ha test che DEVONO passare — è la prima volta nel percorso in cui "finito" lo decide l'esecuzione, non la sensazione. Regola d'oro da qui in avanti: prima di far girare i test, scrivi sul quaderno cosa ti aspetti che facciano.

**🏗️ 4. Mini Progetto Finale: "Il processo alla mia calcolatrice"**
- [Number Guessing Game — roadmap.sh](https://roadmap.sh/projects/number-guessing-game)
- Descrizione del progetto: un brief pubblico e semplice — il computer sceglie un numero e l'utente prova a indovinarlo, con suggerimenti "più alto/più basso" e conteggio dei tentativi. ⚠️ **Runtime: eseguilo NELLA CONSOLE DEL BROWSER** (usando `prompt()` per l'input e `console.log` per l'output), NON da terminale: Node e il terminale arrivano solo in M1, e in M0 il tuo unico ambiente è la console DevTools. Perfetto per rimettere in moto logica, condizionali e input senza toccare ancora il DOM. Vincolo del comitato: PRIMA di scrivere ogni funzione, scrivi sul quaderno la previsione del suo comportamento; DOPO l'esecuzione, annota cosa è successo davvero. È il tuo primo artefatto costruito col protocollo nuovo.

---

#### Unità 0.2 — Bonifica GitHub (settimana 1, trasversale)

**🎯 Concetto Core: i recruiter leggono i tuoi repo OGGI**
I 6 progetti Techdegree sono pubblici con bug noti, 1 solo `.gitignore`, zero README (diagnosi §2.2). Un recruiter milanese che cerca il tuo profilo oggi trova questo. La bonifica non è estetica: è il primo atto del binario employability e insegna la Git hygiene minima (commit quotidiani con messaggi sensati) che continuerà per tutto il percorso.

**📖 1. Teoria (Fondamenta)**
- [Make a README](https://www.makeareadme.com/)
- Descrizione: la pagina definisce le sezioni minime di un README professionale (cosa fa il progetto, come si avvia, tecnologie usate, stato). È volutamente breve: leggila tutta e usa il suo template come scheletro. Si collega alla bonifica: ogni repo Techdegree riceve questo trattamento.

**📺 2. Studio (Visualizzazione)**
- [How to Write a Good README File — freeCodeCamp](https://www.freecodecamp.org/news/how-to-write-a-good-readme-file/)
- Descrizione: articolo con esempi concreti di README ben fatti per progetti piccoli, con la logica di "cosa vuole sapere chi apre il repo in 30 secondi". Ti serve per calibrare il tono: onesto sullo stato del progetto ("progetto didattico 2024, bug noti: X") vale più di silenzio o marketing.

**🛠️ 3. Pratica (Testing & Debugging)**
- [Learn Git Branching — livelli introduttivi](https://learngitbranching.js.org/)
- Descrizione: mentre bonifichi i repo devi fare molti commit; questo visualizzatore interattivo ti fa esercitare `commit`, `branch` e la cronologia VEDENDO il grafo muoversi a ogni comando. Fai i primi livelli della sezione "Introduction Sequence" per rendere sicuri i gesti Git di base che userai su ogni repo. (In M1 lo riprenderai in profondità.)

**🏗️ 4. Mini Progetto Finale: "Profilo GitHub leggibile"**
- [Managing your profile README — GitHub Docs](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme)
- Descrizione del progetto: la guida ufficiale spiega come creare il README speciale di profilo (repo con lo stesso nome del tuo username). Costruisci il tuo: chi sei, cosa stai studiando (questo percorso, con onestà), 2 progetti in evidenza — 20 righe sobrie, niente badge-mania. Applica lo stesso standard README ai 6 repo Techdegree (con `.gitignore` dove manca e archiviazione motivata dei progetti con bug). Criterio: un adulto non tecnico capisce in 30 secondi chi sei e cosa sai fare.

---

#### Unità 0.3 — Tipi, coercizione, confronti, truthiness (esperimenti 1–6)

**🎯 Concetto Core: i confronti non funzionano come credevi**
Qui cadono le misconcezioni più pericolose della diagnosi: "100 < 'Apple' è vero perché un numero è minore di qualsiasi lettera" (in realtà: coercizione a numero → NaN → sempre false) e la truthiness confusa con il controllo di tipo (lo 0 e la stringa vuota sono valori legittimi che il tuo vecchio codice trattava come assenti). Ogni regola si ricostruisce con un esperimento: previsione scritta di 6 casi, esecuzione, confronto.

**📖 1. Teoria (Fondamenta)**
- [Comparisons — javascript.info](https://javascript.info/comparison)
- Descrizione: il capitolo copre esattamente il meccanismo che le tue previsioni sbagliavano: la coercizione verso numero nei confronti relazionali, il confronto lessicografico solo stringa-vs-stringa, i casi speciali di null/undefined. javascript.info è il riferimento testuale di tutto M0: ogni capitolo termina con task a difficoltà crescente CON soluzione nascosta — fai i task prima di guardare le soluzioni.

**📺 2. Studio (Visualizzazione)**
- [Watch This If You Don't Understand Type Coercion — Web Dev Simplified](https://www.youtube.com/watch?v=GKJh3vdat8A)
- Descrizione: video che smonta la coercizione JavaScript mostrando i risultati "assurdi" uno dopo l'altro con la spiegazione del perché (perché `100 < 'Apple'` è false, perché `'' == 0` è true). È il formato che ti accende: vedi il fenomeno sorprendente e senti il bisogno di capirlo. Guardalo dopo aver letto il capitolo teorico, come conferma visiva delle regole.

**🛠️ 3. Pratica (Testing & Debugging)**
- [JSchallenger — JavaScript Basics](https://www.jschallenger.com/)
- Descrizione: micro-esercizi con validazione automatica nel browser, sezione "Basics" (tipi, confronti, condizioni). Per ogni esercizio: PREVEDI il risultato sul quaderno, poi esegui e confronta. È la palestra a feedback immediato per far sedimentare le regole di coercizione appena studiate, senza dover configurare nulla.

**🏗️ 4. Mini Progetto Finale: "La tabella della verità di Diego"**
- [Temperature Converter — roadmap.sh](https://roadmap.sh/projects/temperature-converter)
- Descrizione del progetto: brief pubblico semplice — un convertitore di temperatura (Celsius/Fahrenheit/Kelvin). ⚠️ **In questa unità costruisci solo la LOGICA di conversione come funzioni pure e testala in console** (`prompt()` restituisce SEMPRE una stringa → è qui che la coercizione morde, e "0 gradi" deve funzionare — la lezione truthiness); l'interfaccia DOM con form la aggiungerai come estensione DOPO l'unità 0.5, quando il DOM è riattivato. Documenta nel README 5 casi limite previsti e verificati (input vuoto, "0", testo non numerico). Così il concetto-core (coercizione) resta a fuoco senza dipendere dal DOM non ancora ripassato.

---

#### Unità 0.4 — Scope, closure, hoisting, strict mode (esperimenti 7–8)

**🎯 Concetto Core: dove vivono le variabili (e perché "Hosting" non esiste)**
Il lessico va bonificato (hoisting, non "Hosting") e il modello va sdoppiato: `var` viene inizializzata a undefined, `let`/`const` entrano in Temporal Dead Zone — comportamenti DIVERSI che il tuo modello unificava in "errore generico". Strict mode entra qui come concetto autonomo (mai visto prima) perché è la chiave che sbloccherà la regola su `this` nell'unità dopo. Le closure si sganciano dallo scaffolding ColorCode: le hai già capite, ora devi saperle spiegare senza quei file.

**📖 1. Teoria (Fondamenta)**
- [Variable scope, closure — javascript.info](https://javascript.info/closure)
- [The old "var" — javascript.info](https://javascript.info/var)
- Descrizione: il primo capitolo ricostruisce lexical environment e closure con i diagrammi memoria-per-passo — la versione formale delle tracce manuali che già fai sul quaderno. Il secondo isola i tre comportamenti di var (hoisting con undefined, niente block scope, aggancio a window) come reperto storico: nel tuo codice nuovo var non esiste più.

**📺 2. Studio (Visualizzazione)**
- [JavaScript Visualized: Closures — Lydia Hallie](https://www.youtube.com/watch?v=6Ixyltr8_R0)
- Descrizione: la serie "JavaScript Visualized" è motion graphics didattica pura — qui closure e scope chain sono animate frame per frame, con un piccolo quiz incorporato, il formato che massimizza la tua resa (sei un ragionatore spaziale). Guardalo DOPO la teoria: l'animazione deve confermare il modello che hai già tracciato a mano, non sostituirlo.

**🛠️ 3. Pratica (Testing & Debugging)**
- [Scrimba — Learn JavaScript (sezione scope e funzioni)](https://scrimba.com/learn-javascript-c0v)
- Descrizione: corso interattivo dove metti in pausa lo screencast e scrivi codice nell'editor del docente dentro il browser. Usa i moduli su scope e funzioni per esercitare closure e hoisting con feedback immediato: il formato "pausa-e-modifica" è ideale per il tuo apprendimento riflessivo. Esperimento chiave: la stessa variabile letta prima della dichiarazione, con var e con let, con e senza strict mode — 4 previsioni, 4 esecuzioni, 4 esiti diversi.

**🏗️ 4. Mini Progetto Finale: "Closure senza rete" (factory in console)**
- [Exercism — JavaScript track (esercizi su closure/scope)](https://exercism.org/tracks/javascript)
- Descrizione del progetto: lab guidato IN CONSOLE (nessun terminale, nessun file). Costruisci una **factory** `creaTotalizzatore()` (o `creaContatore()`) che restituisce metodi (`aggiungi`, `totale`, `reset`) i quali condividono uno stato privato tramite closure — senza variabili globali. ⚠️ **Precisazione concettuale che ti salva da una misconcezione:** lo stato incapsulato dalla closure vive DENTRO UNA SINGOLA ESECUZIONE del programma (una variabile "prigioniera" della funzione), NON tra esecuzioni diverse — la persistenza tra sessioni è un'altra cosa (file/localStorage, che vedrai dopo). Nel README spiega, a parole tue, DOVE vive quello stato e perché sopravvive tra una chiamata di metodo e l'altra (ma non tra due avvii del programma). Su Exercism trovi esercizi mirati su closure/scope per consolidare con test automatici.

---

#### Unità 0.5 — DOM riattivato + PRIMO DEPLOY (settimane 3–4 — non negoziabile)

**🎯 Concetto Core: risultato visibile precoce (difesa anti-drop n.1)**
Il DOM è il tuo terreno più sicuro (4/5 in diagnosi): qui non impari — RIATTIVI, e usi la riattivazione per produrre il primo risultato pubblico entro la settimana 4. È la difesa anti-drop imposta dal Learning Scientist: un profilo con "voglia subito di risultati" non regge 2 mesi di soli esperimenti. Dentro il progetto rientrano due misconcezioni: la delegation ("il listener non si estende ai figli: sono gli EVENTI che risalgono") e HTMLCollection (non è un array).

**📖 1. Teoria (Fondamenta)**
- [Introduction to the DOM — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction)
- Descrizione: la pagina introduttiva ufficiale che definisce cos'è il DOM (un albero di nodi che rappresenta la pagina) e come JavaScript lo manipola. Deep-link mirato: leggi solo l'introduzione e la sezione "DOM interfaces", ignora il resto per ora. Ti serve per avere il modello mentale corretto — nodi, non "elementi HTML" — prima di manipolarlo.

**📺 2. Studio (Visualizzazione)**
- [Event bubbling, capturing & delegation — Web Dev Simplified](https://www.youtube.com/watch?v=F1anRyL37lE)
- Descrizione: video che mostra visivamente come un evento "risale" dal figlio al genitore (bubbling) e come questo rende possibile la delegation. È la correzione diretta della tua misconcezione n.2: vedrai che il listener resta sul genitore e sono gli eventi a muoversi. Guardalo prima di costruire il progetto, così riconosci il meccanismo quando lo implementi.

**🛠️ 3. Pratica (Testing & Debugging)**
- [JavaScript30 — 30 progetti DOM in vanilla JS (Wes Bos)](https://javascript30.com/)
- Descrizione: 30 mini-esercizi DOM reali (drum kit, orologio, filtri array sul DOM) con starter file, senza framework. Scegline 2–3 sui temi eventi e selezione di elementi: qui pratichi la manipolazione DOM su casi concreti col feedback più immediato che esista (l'effetto appare o non appare). Esperimento delegation: un solo listener sul contenitore, tre `console.log` annidati con `event.target` vs `event.currentTarget` per VEDERE il bubbling.

**🏗️ 4. Mini Progetto Finale: "Interactive Rating Component — deployato"**
- [Interactive rating component — Frontend Mentor](https://www.frontendmentor.io/challenges/interactive-rating-component-koxpeBUmI)
- Descrizione del progetto (dal software architect): la challenge fornisce design professionale, assets e specifiche — un ordine di lavoro realistico. Costruisci un componente di rating con due viste (selezione 1–5 e ringraziamento): feedback su hover e selezione, submit gestito con messaggio se nulla è selezionato, la vista di ringraziamento mostra il voto scelto, layout responsive fedele al design. Vincoli: JS vanilla, event delegation sul gruppo di rating, zero librerie. Consegna: repo pubblico con README + **deploy su GitHub Pages** ([guida ufficiale](https://docs.github.com/en/pages/quickstart)), URL verificato dal telefono. Difesa: sai spiegare ogni listener e ogni stato senza guardare il codice.

---

#### Unità 0.6 — `this` ricostruito (esperimenti 9–10)

**🎯 Concetto Core: il valore di this si decide al call-site**
Il tuo schema decisionale su `this` era il segnale cognitivo più alto del corpus (esperimenti con metodi statici per dedurre il binding di forEach e setTimeout) — ma è fragile e contiene la misconcezione "undefined se la funzione è creata da una classe" (la causa vera è strict mode, che ora conosci dall'unità 0.4). Qui lo schema si ricostruisce completo: binding di default, implicito, esplicito, new, arrow function.

**📖 1. Teoria (Fondamenta)**
- [Understanding this in JavaScript — The Complete Guide (Medium)](https://medium.com/codex/understanding-this-in-javascript-the-complete-guide-c4c21fe15ff8)
- Descrizione: la guida scompone i quattro binding a partire dal call-site — studia in particolare la sezione sullo strict mode (che trasforma i bug silenziosi in errori espliciti) e quella sulla perdita di contesto nelle callback: è esattamente il fenomeno che avevi indagato da solo con gli esperimenti su setTimeout.

**📺 2. Studio (Visualizzazione)**
- ["this" keyword in JavaScript — Full Course (Gordon Zhu)](https://www.youtube.com/watch?v=q0N6Dzu-Jl8)
- Descrizione: il video da cui avevi già imparato `this` — rivederlo ORA, con strict mode e call-site nel bagaglio, è un esperimento su te stesso: annota cosa capisci oggi che la prima volta ti era scivolato addosso. Gordon Zhu insegna con il rigore "leggi il codice come lo legge l'interprete" — la versione parlata del tuo protocollo di verifica.

**🛠️ 3. Pratica (Testing & Debugging)**
- [Codewars — kata JavaScript (filtra per OOP / Fundamentals)](https://www.codewars.com/kata/search/javascript)
- Descrizione: piattaforma con editor e suite di test integrata; cerca kata di livello 8–7 kyu su oggetti e **classi ES** (`class`, `constructor`, metodi) — è anche l'occasione per riattivare la sintassi delle classi, che ti serve per capire perché `this` in un metodo di classe può risultare `undefined` (la causa è la strict mode automatica dei corpi di classe, vista in 0.4). Ricostruisci il TUO esperimento storico (il metodo passato a setTimeout che perde il contesto) in 5 varianti con previsione scritta: metodo sull'oggetto, riferimento estratto, callback, arrow, bind. Cinque previsioni, cinque esecuzioni, i test confermano.

**🏗️ 4. Mini Progetto Finale: "Lo schema decisionale di this — versione 2"**
- [`this` — MDN (riferimento operatore)](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this)
- Descrizione del progetto: lab guidato IN CONSOLE su **dati locali** (nessuna rete, nessun terminale — fetch e async arrivano solo in 0.8). Crea un oggetto con metodi che leggono una sua proprietà (es. un `report` con `.nome` e un metodo `saluta()`), poi passa quei metodi a `setTimeout`, `forEach` e come callback: OSSERVA dove `this` si perde e ricostruiscilo con arrow o `bind`. Usa la pagina MDN solo per confermare la regola di ciascun caso. Consegna: repo con README che include il tuo diagramma di flusso a 5 domande su `this`, validato eseguendo 10 casi in console.

---

#### Unità 0.7 — Event loop visualizzato (l'esperimento che ripara il file rotto)

**🎯 Concetto Core: una sola corsia, e le code che la alimentano**
Nel tuo file ColorCode sull'event loop il codice chiama la funzione sbagliata e rende false tutte le annotazioni — nessuno l'ha mai eseguito. È il caso di studio perfetto del modulo: qui l'asincronia smette di essere magia e diventa un modello meccanico (call stack, task queue, microtask queue) che sai girare a mano. Senza questo modello, promises e async/await (unità 0.8) restano sintassi vuota — è la priorità alta dichiarata in diagnosi.

**📖 1. Teoria (Fondamenta)**
- [Event loop: microtasks and macrotasks — javascript.info](https://javascript.info/event-loop)
- Descrizione: il modello completo con le regole di priorità (i microtask vengono svuotati TUTTI prima del prossimo task). Traccia a mano gli esempi del capitolo col tuo formato stato-per-iterazione: stack | coda task | coda microtask, riga per riga. È la traccia manuale che in diagnosi risulta il tuo strumento più efficace.

**📺 2. Studio (Visualizzazione)**
- [What the heck is the event loop anyway? — Philip Roberts, JSConf EU](https://www.youtube.com/watch?v=8aGhZQkoFbQ)
- Descrizione: IL talk di riferimento mondiale sull'event loop (26 minuti, tutto animato). Philip Roberts costruisce il modello mentale della singola corsia e delle code visivamente, dal vivo. È la spiegazione che rende il concetto tuo per sempre; guardalo con il quaderno accanto e ferma il video per anticipare la prossima mossa.

**🛠️ 3. Pratica (Testing & Debugging)**
- [Loupe — visualizzatore live dell'event loop (Philip Roberts)](http://latentflip.com/loupe/)
- Descrizione: lo strumento che esegue codice VERO mostrando stack, coda e Web API in movimento. Flusso di lavoro: scrivi un frammento (log sincroni, setTimeout a zero, catene), PREVEDI l'ordine dei log sul quaderno, premi play, osserva. È il tuo formato-esperimento elevato a laboratorio. Poi l'atto riparatore: riapri il TUO file event loop di ColorCode, eseguilo com'è, osserva perché le annotazioni sono false, correggi con la data.

**🏗️ 4. Mini Progetto Finale: "Batteria di previsioni: 10 su Loupe"**
- [JavaScript Visualized: Event Loop — Lydia Hallie (dev.to)](https://dev.to/lydiahallie/javascript-visualized-event-loop-3dif)
- Descrizione del progetto: usando l'articolo animato di Lydia Hallie come riferimento delle regole, crea un documento nel repo di studio con 10 frammenti a difficoltà crescente. ⚠️ **Nota sugli strumenti:** Loupe visualizza solo call stack + Web API + coda dei task (`setTimeout`) — **non le promise/microtask**; quindi i frammenti sincroni e con `setTimeout` si verificano su Loupe, mentre i casi con `.then()`/microtask si verificano **in console** (o sul simulatore promise dell'unità 0.8). In questa unità la batteria è **solo macrotask** (sincroni + setTimeout); i frammenti con promise si aggiungono DOPO l'unità 0.8, quando conoscerai la sintassi. Registro degli errori: ogni previsione sbagliata è una crepa del modello da rispiegare.

---

#### Unità 0.8 — Promises, async/await, error handling (esperimenti 11–12 + il gap squalificante)

**🎯 Concetto Core: fetch non fallisce quando credi tu — e lo zero error handling finisce oggi**
Le due misconcezioni asincrone della diagnosi cadono qui: `response.json()` non "converte una promise" (legge il body e restituisce una NUOVA promise che risolve in un oggetto JS), e fetch rigetta SOLO su errore di rete — un 404 è un fulfillment con `ok: false`. In ~1.900 righe dei tuoi progetti non esiste UNA gestione errori: per l'industria 2026 è squalificante. Da questa unità in poi, ogni chiamata asincrona del percorso nasce con il suo ramo di errore, per sempre.

**📖 1. Teoria (Fondamenta)**
- [Promise — javascript.info](https://javascript.info/promise-basics)
- [Async/await — javascript.info](https://javascript.info/async-await)
- Descrizione: i due capitoli centrali della sezione asincrona: stati della promise (pending → fulfilled/rejected — e il glossario IT→EN qui è d'obbligo: fulfilled, non "fullfield"), catene, e async/await come zucchero sintattico sopra lo stesso modello dell'unità 0.7. Disegna le 4 stazioni della catena fetch sul quaderno: chiamata → response → lettura body → oggetto JS.

**📺 2. Studio (Visualizzazione)**
- [JavaScript Visualized: Promises & Async/Await — Lydia Hallie](https://www.youtube.com/watch?v=Xs1EMmBLpn4)
- Descrizione: l'animazione della microtask queue applicata alle promise — collega visivamente questa unità alla 0.7: STESSO modello, nuova sintassi. Lydia Hallie mostra la promise che attraversa gli stati e la callback che finisce nella coda dei microtask. Guardalo dopo i primi task di teoria, prima degli esperimenti fetch.

**🛠️ 3. Pratica (Testing & Debugging)**
- [Promises & Async/Await Simulator — DevOps Daily](https://devops-daily.com/games/javascript-promises-async-await-simulator)
- Descrizione: un simulatore interattivo che visualizza call stack, microtask queue e task queue mentre esegui scenari asincroni, con "step backward" e predizione dell'ordine di output. È il banco di prova ideale per le promise: prevedi quale callback esce prima, verifica, capisci perché il microtask precede setTimeout(0). Complementare a Loupe, focalizzato sulle promise.

**🏗️ 4. Mini Progetto Finale: "La fetch a prova di 404"**
- [Weather App con API — roadmap.sh](https://roadmap.sh/projects/weather-app)
- Descrizione del progetto: brief pubblico — un'app meteo che chiama una API pubblica e mostra le condizioni per una città (fetch funziona anche nella console del browser o in una pagina HTML semplice — nessun terminale). È il caso reale dove l'error handling diventa obbligatorio: città inesistente (404), API down (errore di rete), input vuoto. Costruiscila con UNA sola richiesta (non 12 in loop, come nel tuo vecchio codice), controllo dello stato della risposta, e — pattern professionale — una **guard clause con early return** in cima alla funzione per gli input non validi (uscire subito invece di annidare `if`). ⚠️ **Usa [Open-Meteo](https://open-meteo.com/), che NON richiede chiave API** — così eviti il rischio di committare un segreto in un repo pubblico (regola d'oro: una chiave API non si committa MAI; i segreti li gestirai col tooling in M1). Consultazione mirata: [Using the Fetch API — sezione checking response — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#checking_that_the_fetch_was_successful). Nel README, il confronto prima/dopo con la peggiore fetch dei tuoi progetti Techdegree.

---

#### Unità 0.9 — JS moderno quotidiano + consolidamento (destructuring, optional chaining, ??)

**🎯 Concetto Core: colmare il JS del 2020+ mai visto**
Destructuring, rest/spread completo, optional chaining e nullish coalescing non sono "feature avanzate": sono il JavaScript quotidiano di ogni codebase 2026 e di tutto ciò che leggerai da M6 in poi. Il nullish coalescing chiude il cerchio con la truthiness dell'unità 0.3: è NATO per distinguere null/undefined dai falsy legittimi come 0 e stringa vuota.

**📖 1. Teoria (Fondamenta)**
- [Destructuring assignment — javascript.info](https://javascript.info/destructuring-assignment)
- [Optional chaining '?.' — javascript.info](https://javascript.info/optional-chaining)
- Descrizione: i due capitoli con i task finali. Il collegamento all'unità 0.3 va esplicitato sul quaderno: quali dei tuoi 3 bug di truthiness sarebbero spariti col nullish coalescing? (Risposta da costruire eseguendo, non da intuire.)

**📺 2. Studio (Visualizzazione)**
- [JavaScript Object Destructuring, Spread Syntax, and the Rest Parameter — A Practical Guide (freeCodeCamp)](https://www.freecodecamp.org/news/javascript-object-destructuring-spread-operator-rest-parameter/)
- Descrizione: guida pratica ricca di esempi di codice affiancati (prima senza, poi con la sintassi moderna) che rende visibile QUANTO codice si risparmia e quanto diventa leggibile. Ti serve per vedere questi costrutti in azione su casi reali prima di praticarli; leggila con la domanda "dove nel mio vecchio codice questo avrebbe aiutato?".

**🛠️ 3. Pratica (Testing & Debugging)**
- [learnjavascript.online — capitoli su ES moderno (parte gratuita)](https://learnjavascript.online/)
- Descrizione: piattaforma con micro-lezioni ognuna seguita da una challenge validata da test nel browser, orientata al JS moderno idiomatico. La parte gratuita (77 lezioni, nessun limite di tempo, nessun abbonamento) copre destructuring, spread e le feature ES recenti con feedback immediato. Ogni challenge: previsione prima, esecuzione poi.

**🏗️ 4. Mini Progetto Finale: vedi Progetto del Modulo (Task Tracker)**
- [Build a Task Tracker with JavaScript — roadmap.sh](https://roadmap.sh/projects/task-tracker-js)
- Descrizione del progetto: questa unità sfocia direttamente nel progetto finale del modulo, descritto sotto — il JS moderno appena acquisito (destructuring sui dati delle attività, optional chaining sull'accesso, nullish coalescing per i default) è il vincolo tecnico esplicito del progetto. Il progetto usa `localStorage` per la persistenza: prima di iniziarlo, dai un'occhiata mirata alla [pagina MDN su localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) (solo `setItem`/`getItem` + `JSON.stringify`/`parse` sul valore, con `try/catch` — l'error handling di 0.8 applicato allo storage).

---

### 📌 Test di fit opzionale (dopo la settimana 6): Watch and Code

- [Watch and Code — Programming Foundations (gratuito)](https://watchandcode.com/)
- Come da divergenza n.1 del comitato (v. mappa §6): DOPO la settimana 6, a riattivazione avviata, puoi testare il corso gratuito di Gordon Zhu come verifica esterna del tuo livello di rigore. NON sostituisce le unità di questo modulo; è un test di fit per l'eventuale (e costosa) membership, decisione che si prende solo con i dati di questo test. Se il formato ti risucchia in modalità video-passiva, il test ha dato il suo responso: negativo.

---

### Verifica della Comprensione

**Domande Socratiche di auto-valutazione** (a quaderno chiuso; se ne sbagli più di 2, il modulo non è finito):
1. Perché una fetch verso un URL che risponde 404 NON finisce nel ramo di errore? Cosa ci finisce davvero?
2. Cosa restituisce esattamente la lettura del body di una risposta, e perché serve un secondo passaggio asincrono?
3. In quale ordine escono i log di: codice sincrono, un setTimeout a zero e una promise già risolta? Perché — in termini di code?
4. Qual è la differenza di comportamento tra var e let lette prima della dichiarazione? Come si chiama la zona in cui vive let?
5. Perché il confronto tra un numero e una stringa alfabetica è sempre falso, qualunque sia il numero?
6. Elenca i 6 valori falsy e spiega perché usare la truthiness per validare un input numerico è un bug.
7. Un listener sul genitore riceve i click sui figli: cosa si muove — il listener o l'evento? Con quali due proprietà lo dimostri?
8. Quando `this` dentro un metodo di classe risulta undefined: qual è la causa vera?
9. Perché una return a metà funzione non è un errore ma un pattern professionale? Come si chiama?
10. Cosa distingue il nullish coalescing dall'OR logico su un input che vale 0?

**Esercizi pratici progressivi:**
1. Batteria NUOVA di 10 previsioni event-loop (frammenti mai visti): macrotask su Loupe + microtask/promise in console → ≥8 corrette
2. I 12 esperimenti-misconcezione completati con previsione scritta + esito osservato + regola in una riga propria
3. ≥10 esercizi tra Exercism e JSchallenger con verifica superata
4. La Weather App eseguita nei 3 scenari: successo, 404, rete assente — comportamento corretto osservato in tutti e tre

**Criteri Go/No-Go (binari):**
- [ ] Interactive Rating Component deployato su GitHub Pages, raggiungibile da un telefono → sì/no
- [ ] Task Tracker (progetto del modulo) deployato, con gestione errori su ogni input utente → sì/no
- [ ] 6 repo Techdegree bonificati (README + gitignore + archiviazione motivata) + README di profilo → sì/no
- [ ] Batteria event-loop: ≥8/10 al primo tentativo (macrotask su Loupe + microtask in console) → sì/no
- [ ] 12/12 esperimenti-misconcezione core agli atti sul quaderno (le 3 su DOM/event-loop di 0.5 e 0.7 sono esperimenti supplementari, fuori dal conteggio dei 12) → sì/no
- [ ] Domande socratiche: ≥8/10 a quaderno chiuso → sì/no
- [ ] Commit quotidiani nei giorni di studio delle ultime 3 settimane (si guarda la cronologia GitHub) → sì/no

**No-Go:** qualsiasi "no" su un'area CORE → si resta in M0 sulla sola area rossa, con carico ridotto. Un "no" residuo SOLO su code elastiche (con tutte le core verdi) ammette il Go con piano di coda scritto: le code si chiudono nelle prime 2 settimane di M1. In ogni altro caso non si apre M1.

#### Riassunto di fine Modulo
Il modulo ha riattivato il JavaScript esistente correggendo il processo che lo aveva prodotto: ogni concetto fragile (coercizione, scope, this, event loop, async) è stato ricostruito con esperimenti a previsione scritta; l'error handling è diventato un riflesso; due progetti pubblici deployati e sei repo bonificati hanno acceso il binario employability. Da qui in avanti "finito" significa "eseguito, osservato, difendibile".

### Progetto del Modulo
- **Titolo:** Task Tracker — versione professionale deployata
- **Descrizione tecnica (ordine del cliente):** applicazione DOM per la gestione di attività. Requisiti funzionali: aggiunta con validazione dell'input (input vuoto o di soli spazi → messaggio utile, non silenzio; e attenzione — un titolo "0" è valido: qui si paga la lezione truthiness); completamento e cancellazione con event delegation su UNA sola registrazione; filtro attive/completate; persistenza in localStorage con gestione del caso "storage corrotto o disabilitato" (try/catch con fallback dichiarato all'utente); contatore attività aggiornato a ogni mutazione. Vincoli: JS vanilla ES2022+, destructuring e nullish coalescing dove naturali, zero librerie, zero innerHTML con dati utente (prima lezione di sicurezza: si usa la creazione di nodi — il perché completo arriva in M8). Consegna: repo pubblico con README che dichiara scelte e limiti + URL GitHub Pages + demo difendibile riga per riga.
- **Risorsa online progetto:** [Build a Task Tracker with JavaScript — roadmap.sh](https://roadmap.sh/projects/task-tracker-js) (brief pubblico completo, senza login)

### Self-Critique del Comitato
- **Prof. universitario:** «Il modulo è volutamente povero di formalismo (niente complessità, niente strutture dati): accetto, perché il rigore qui è di PROCESSO. Ma vigilerò: se in M3 le fondamenta scricchiolano, questo modulo ne porta parte della colpa per non aver introdotto nemmeno la notazione.»
- **Senior SWE:** «Otto settimane di riattivazione sono tante per il mercato. Le accetto solo perché producono artefatti visibili (2 deploy + repo bonificati). Rischio residuo: Diego che rifinisce il Task Tracker all'infinito invece di chiudere — il Go/No-Go binario esiste per questo. La scelta di progetti roadmap.sh con brief reali (non esercizi inventati) è quella giusta: sono spec, non tutorial.»
- **Learning Scientist:** «Il modulo rispetta il veto (2 soli trasversali, deploy precoce, formato-esperimento). Ora ogni unità ha una piattaforma di pratica a feedback immediato (JSchallenger, Scrimba, simulatori) DIVERSA dalla teoria: è la struttura che impedisce il "leggo e credo di aver capito". Il registro degli errori di previsione è il termometro: se le previsioni non migliorano tra settimana 2 e 6, fermarsi e rivedere il metodo, non accelerare.»
- **CEO:** «Nessun contenuto AI qui, ed è corretto: la credibilità futura di Diego come AI engineer dipende dal fatto che queste fondamenta siano vere. Il costo-opportunità è coperto dal binario GitHub.»
- **HR FAANG:** «I repo bonificati e i commit quotidiani sono il primo segnale di professionalità misurabile. Il README di profilo onesto ("sto ricostruendo le fondamenta, ecco come") è più forte di qualsiasi buzzword.»
- **HR italiana:** «Per le medie aziende milanesi questo modulo non produce ancora un profilo assumibile — e va bene: produce il substrato del ritmo. Chiedo solo che il glossario IT→EN parta DAVVERO dalla settimana 1: il lessico attuale in colloquio costa punti.»
- **AI Research Scientist:** «L'unico uso di AI ammesso in M0 — generare casi di test da prevedere e review a posteriori — va rispettato alla lettera. Se l'AI scrive anche una sola soluzione in questo modulo, il protocollo di verifica nasce morto.»

**Riassunto del modulo.** M0 = riattivazione con processo nuovo: esperimenti a previsione scritta sulle 12 misconcezioni, error handling da giorno 1, event loop visualizzato, due deploy pubblici, GitHub presentabile. Ogni unità ha teoria, visualizzazione, pratica interattiva e un progetto online reale, tutti distinti. Go/No-Go eseguibile, poi M1.
