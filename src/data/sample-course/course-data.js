// Fixture del corso dei mock, letto da ../spec/M0-Riattivazione_JavaScript.md e ../spec/M1-Tooling_Moderno.md secondo ../spec/RoutForge_FORMATO_CORSO.md. Testi verbatim; i moduli in `locked` sono segnaposto (titoli non nei file).
export const COURSE = {
 "title": "Syllabus Software Engineer 2026",
 "importedOn": "16 set",
 "modules": [
  {
   "n": 0,
   "nn": "00",
   "title": "Riattivazione JavaScript & Protocollo di Verifica",
   "type": "CONSOLIDAMENTO",
   "prereq": "nessuno (è il punto di partenza)",
   "window": "settimane 1–8",
   "transversal": "SOLO due — ciclo esegui-osserva-commenta + error handling dentro ogni esercizio (veto Learning Scientist: niente tooling, niente testing, niente TypeScript fino alla settimana 4).",
   "intro": [
    "Questo modulo non insegna JavaScript da zero: riattiva ciò che c'è già (diagnosi §2.1: DOM 4/5, array methods 3–4, Grid come ancora di fiducia) e sostituisce il processo che ha prodotto i bug spediti in tutti e 6 i progetti Techdegree. Le 12 misconcezioni documentate (diagnosi §2.3) rientrano qui come *esperimenti con previsione scritta* — il formato in cui Diego eccelle — mai come \"questo l'avevi capito male\".",
    "Al termine Diego sarà in grado di:"
   ],
   "objectives": [
    "Applicare il ciclo esegui → osserva → commenta a ogni frammento di codice, scrivendo la previsione PRIMA dell'esecuzione e il commento DOPO l'output osservato",
    "Prevedere il valore di espressioni con coercizione, confronti e truthiness, motivando la previsione con la regola (non a memoria)",
    "Analizzare il comportamento di scope, closure, hoisting e `this` con lo schema decisionale ricostruito su esperimenti propri",
    "Prevedere l'ordine di esecuzione di codice sincrono/asincrono (event loop, microtask) con ≥80% di accuratezza",
    "Costruire ogni chiamata di rete con gestione errori completa (controllo dello stato della risposta + cattura dei fallimenti) — zero eccezioni",
    "Costruire e deployare due progetti DOM pubblici su GitHub Pages, difendibili riga per riga",
    "Valutare i propri 6 repository GitHub e bonificarli a standard leggibile da recruiter"
   ],
   "units": [
    {
     "n": "0.1",
     "title": "Il Protocollo di Verifica (la nuova abitudine, prima di tutto)",
     "core": {
      "title": "eseguire prima di dichiarare",
      "text": "La diagnosi ha documentato il difetto strutturale n.1: commenti scritti su ciò che il video spiega, mai verificati contro ciò che il codice fa (previsioni errate lasciate agli atti, `darknes()` spedito in produzione). Questa unità installa il protocollo che governa TUTTO il resto del percorso: ogni previsione si scrive sul quaderno prima, si esegue, si osserva, e solo dopo si commenta ciò che è realmente successo. La console DevTools diventa il banco di prova permanente."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Console overview — Chrome DevTools",
         "url": "https://developer.chrome.com/docs/devtools/console/",
         "host": "developer.chrome.com"
        }
       ],
       "description": "panoramica ufficiale della console come ambiente di sperimentazione (non solo log di errori). Da questa pagina servono: come eseguire espressioni riga per riga, la cronologia dei comandi e le live expression. Ignora per ora le sezioni su framework e network: ti serve solo il ciclo scrivi-esegui-osserva. Si collega direttamente al formato-esperimento con cui affronterai ogni misconcezione delle unità successive."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "Chrome Dev Tools Console Super Powers — Steve Griffith",
         "url": "https://www.youtube.com/watch?v=TqPrpglfE9c",
         "host": "youtube.com"
        }
       ],
       "description": "dimostrazione dal vivo di come usare la Console non solo per leggere log ma per valutare espressioni, ispezionare oggetti e testare ipotesi al volo. Vederlo in azione toglie l'intimidazione dello strumento: guardi qualcuno usare la console come un tavolo da laboratorio, poi lo replichi. Ti serve prima di iniziare a sperimentare, così sai già quali tasti premere."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "Exercism — JavaScript track",
         "url": "https://exercism.org/tracks/javascript",
         "host": "exercism.org"
        }
       ],
       "description": "piattaforma con editor e test automatici integrati; iscriviti e completa i primi 3 esercizi del percorso \"Learning Mode\". Exercism è il complemento perfetto del protocollo: ogni esercizio ha test che DEVONO passare — è la prima volta nel percorso in cui \"finito\" lo decide l'esecuzione, non la sensazione. Regola d'oro da qui in avanti: prima di far girare i test, scrivi sul quaderno cosa ti aspetti che facciano."
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"Il processo alla mia calcolatrice\"",
       "links": [
        {
         "title": "Number Guessing Game — roadmap.sh",
         "url": "https://roadmap.sh/projects/number-guessing-game",
         "host": "roadmap.sh"
        }
       ],
       "description": "un brief pubblico e semplice — il computer sceglie un numero e l'utente prova a indovinarlo, con suggerimenti \"più alto/più basso\" e conteggio dei tentativi. ⚠️ Runtime: eseguilo NELLA CONSOLE DEL BROWSER (usando `prompt()` per l'input e `console.log` per l'output), NON da terminale: Node e il terminale arrivano solo in M1, e in M0 il tuo unico ambiente è la console DevTools. Perfetto per rimettere in moto logica, condizionali e input senza toccare ancora il DOM. Vincolo del comitato: PRIMA di scrivere ogni funzione, scrivi sul quaderno la previsione del suo comportamento; DOPO l'esecuzione, annota cosa è successo davvero. È il tuo primo artefatto costruito col protocollo nuovo."
      }
     ]
    },
    {
     "n": "0.2",
     "title": "Bonifica GitHub (settimana 1, trasversale)",
     "core": {
      "title": "i recruiter leggono i tuoi repo OGGI",
      "text": "I 6 progetti Techdegree sono pubblici con bug noti, 1 solo `.gitignore`, zero README (diagnosi §2.2). Un recruiter milanese che cerca il tuo profilo oggi trova questo. La bonifica non è estetica: è il primo atto del binario employability e insegna la Git hygiene minima (commit quotidiani con messaggi sensati) che continuerà per tutto il percorso."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Make a README",
         "url": "https://www.makeareadme.com/",
         "host": "makeareadme.com"
        }
       ],
       "description": "la pagina definisce le sezioni minime di un README professionale (cosa fa il progetto, come si avvia, tecnologie usate, stato). È volutamente breve: leggila tutta e usa il suo template come scheletro. Si collega alla bonifica: ogni repo Techdegree riceve questo trattamento."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "How to Write a Good README File — freeCodeCamp",
         "url": "https://www.freecodecamp.org/news/how-to-write-a-good-readme-file/",
         "host": "freecodecamp.org"
        }
       ],
       "description": "articolo con esempi concreti di README ben fatti per progetti piccoli, con la logica di \"cosa vuole sapere chi apre il repo in 30 secondi\". Ti serve per calibrare il tono: onesto sullo stato del progetto (\"progetto didattico 2024, bug noti: X\") vale più di silenzio o marketing."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "Learn Git Branching — livelli introduttivi",
         "url": "https://learngitbranching.js.org/",
         "host": "learngitbranching.js.org"
        }
       ],
       "description": "mentre bonifichi i repo devi fare molti commit; questo visualizzatore interattivo ti fa esercitare `commit`, `branch` e la cronologia VEDENDO il grafo muoversi a ogni comando. Fai i primi livelli della sezione \"Introduction Sequence\" per rendere sicuri i gesti Git di base che userai su ogni repo. (In M1 lo riprenderai in profondità.)"
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"Profilo GitHub leggibile\"",
       "links": [
        {
         "title": "Managing your profile README — GitHub Docs",
         "url": "https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme",
         "host": "docs.github.com"
        }
       ],
       "description": "la guida ufficiale spiega come creare il README speciale di profilo (repo con lo stesso nome del tuo username). Costruisci il tuo: chi sei, cosa stai studiando (questo percorso, con onestà), 2 progetti in evidenza — 20 righe sobrie, niente badge-mania. Applica lo stesso standard README ai 6 repo Techdegree (con `.gitignore` dove manca e archiviazione motivata dei progetti con bug). Criterio: un adulto non tecnico capisce in 30 secondi chi sei e cosa sai fare."
      }
     ]
    },
    {
     "n": "0.3",
     "title": "Tipi, coercizione, confronti, truthiness (esperimenti 1–6)",
     "core": {
      "title": "i confronti non funzionano come credevi",
      "text": "Qui cadono le misconcezioni più pericolose della diagnosi: \"100 < 'Apple' è vero perché un numero è minore di qualsiasi lettera\" (in realtà: coercizione a numero → NaN → sempre false) e la truthiness confusa con il controllo di tipo (lo 0 e la stringa vuota sono valori legittimi che il tuo vecchio codice trattava come assenti). Ogni regola si ricostruisce con un esperimento: previsione scritta di 6 casi, esecuzione, confronto."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Comparisons — javascript.info",
         "url": "https://javascript.info/comparison",
         "host": "javascript.info"
        }
       ],
       "description": "il capitolo copre esattamente il meccanismo che le tue previsioni sbagliavano: la coercizione verso numero nei confronti relazionali, il confronto lessicografico solo stringa-vs-stringa, i casi speciali di null/undefined. javascript.info è il riferimento testuale di tutto M0: ogni capitolo termina con task a difficoltà crescente CON soluzione nascosta — fai i task prima di guardare le soluzioni."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "Watch This If You Don't Understand Type Coercion — Web Dev Simplified",
         "url": "https://www.youtube.com/watch?v=GKJh3vdat8A",
         "host": "youtube.com"
        }
       ],
       "description": "video che smonta la coercizione JavaScript mostrando i risultati \"assurdi\" uno dopo l'altro con la spiegazione del perché (perché `100 < 'Apple'` è false, perché `'' == 0` è true). È il formato che ti accende: vedi il fenomeno sorprendente e senti il bisogno di capirlo. Guardalo dopo aver letto il capitolo teorico, come conferma visiva delle regole."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "JSchallenger — JavaScript Basics",
         "url": "https://www.jschallenger.com/",
         "host": "jschallenger.com"
        }
       ],
       "description": "micro-esercizi con validazione automatica nel browser, sezione \"Basics\" (tipi, confronti, condizioni). Per ogni esercizio: PREVEDI il risultato sul quaderno, poi esegui e confronta. È la palestra a feedback immediato per far sedimentare le regole di coercizione appena studiate, senza dover configurare nulla."
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"La tabella della verità di Diego\"",
       "links": [
        {
         "title": "Temperature Converter — roadmap.sh",
         "url": "https://roadmap.sh/projects/temperature-converter",
         "host": "roadmap.sh"
        }
       ],
       "description": "brief pubblico semplice — un convertitore di temperatura (Celsius/Fahrenheit/Kelvin). ⚠️ In questa unità costruisci solo la LOGICA di conversione come funzioni pure e testala in console (`prompt()` restituisce SEMPRE una stringa → è qui che la coercizione morde, e \"0 gradi\" deve funzionare — la lezione truthiness); l'interfaccia DOM con form la aggiungerai come estensione DOPO l'unità 0.5, quando il DOM è riattivato. Documenta nel README 5 casi limite previsti e verificati (input vuoto, \"0\", testo non numerico). Così il concetto-core (coercizione) resta a fuoco senza dipendere dal DOM non ancora ripassato."
      }
     ]
    },
    {
     "n": "0.4",
     "title": "Scope, closure, hoisting, strict mode (esperimenti 7–8)",
     "core": {
      "title": "dove vivono le variabili (e perché \"Hosting\" non esiste)",
      "text": "Il lessico va bonificato (hoisting, non \"Hosting\") e il modello va sdoppiato: `var` viene inizializzata a undefined, `let`/`const` entrano in Temporal Dead Zone — comportamenti DIVERSI che il tuo modello unificava in \"errore generico\". Strict mode entra qui come concetto autonomo (mai visto prima) perché è la chiave che sbloccherà la regola su `this` nell'unità dopo. Le closure si sganciano dallo scaffolding ColorCode: le hai già capite, ora devi saperle spiegare senza quei file."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Variable scope, closure — javascript.info",
         "url": "https://javascript.info/closure",
         "host": "javascript.info"
        },
        {
         "title": "The old \"var\" — javascript.info",
         "url": "https://javascript.info/var",
         "host": "javascript.info"
        }
       ],
       "description": "il primo capitolo ricostruisce lexical environment e closure con i diagrammi memoria-per-passo — la versione formale delle tracce manuali che già fai sul quaderno. Il secondo isola i tre comportamenti di var (hoisting con undefined, niente block scope, aggancio a window) come reperto storico: nel tuo codice nuovo var non esiste più."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "JavaScript Visualized: Closures — Lydia Hallie",
         "url": "https://www.youtube.com/watch?v=6Ixyltr8_R0",
         "host": "youtube.com"
        }
       ],
       "description": "la serie \"JavaScript Visualized\" è motion graphics didattica pura — qui closure e scope chain sono animate frame per frame, con un piccolo quiz incorporato, il formato che massimizza la tua resa (sei un ragionatore spaziale). Guardalo DOPO la teoria: l'animazione deve confermare il modello che hai già tracciato a mano, non sostituirlo."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "Scrimba — Learn JavaScript (sezione scope e funzioni)",
         "url": "https://scrimba.com/learn-javascript-c0v",
         "host": "scrimba.com"
        }
       ],
       "description": "corso interattivo dove metti in pausa lo screencast e scrivi codice nell'editor del docente dentro il browser. Usa i moduli su scope e funzioni per esercitare closure e hoisting con feedback immediato: il formato \"pausa-e-modifica\" è ideale per il tuo apprendimento riflessivo. Esperimento chiave: la stessa variabile letta prima della dichiarazione, con var e con let, con e senza strict mode — 4 previsioni, 4 esecuzioni, 4 esiti diversi."
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"Closure senza rete\" (factory in console)",
       "links": [
        {
         "title": "Exercism — JavaScript track (esercizi su closure/scope)",
         "url": "https://exercism.org/tracks/javascript",
         "host": "exercism.org"
        }
       ],
       "description": "lab guidato IN CONSOLE (nessun terminale, nessun file). Costruisci una factory `creaTotalizzatore()` (o `creaContatore()`) che restituisce metodi (`aggiungi`, `totale`, `reset`) i quali condividono uno stato privato tramite closure — senza variabili globali. ⚠️ Precisazione concettuale che ti salva da una misconcezione: lo stato incapsulato dalla closure vive DENTRO UNA SINGOLA ESECUZIONE del programma (una variabile \"prigioniera\" della funzione), NON tra esecuzioni diverse — la persistenza tra sessioni è un'altra cosa (file/localStorage, che vedrai dopo). Nel README spiega, a parole tue, DOVE vive quello stato e perché sopravvive tra una chiamata di metodo e l'altra (ma non tra due avvii del programma). Su Exercism trovi esercizi mirati su closure/scope per consolidare con test automatici."
      }
     ]
    },
    {
     "n": "0.5",
     "title": "DOM riattivato + PRIMO DEPLOY (settimane 3–4 — non negoziabile)",
     "core": {
      "title": "risultato visibile precoce (difesa anti-drop n.1)",
      "text": "Il DOM è il tuo terreno più sicuro (4/5 in diagnosi): qui non impari — RIATTIVI, e usi la riattivazione per produrre il primo risultato pubblico entro la settimana 4. È la difesa anti-drop imposta dal Learning Scientist: un profilo con \"voglia subito di risultati\" non regge 2 mesi di soli esperimenti. Dentro il progetto rientrano due misconcezioni: la delegation (\"il listener non si estende ai figli: sono gli EVENTI che risalgono\") e HTMLCollection (non è un array)."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Introduction to the DOM — MDN",
         "url": "https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Introduction",
         "host": "developer.mozilla.org"
        }
       ],
       "description": "la pagina introduttiva ufficiale che definisce cos'è il DOM (un albero di nodi che rappresenta la pagina) e come JavaScript lo manipola. Deep-link mirato: leggi solo l'introduzione e la sezione \"DOM interfaces\", ignora il resto per ora. Ti serve per avere il modello mentale corretto — nodi, non \"elementi HTML\" — prima di manipolarlo."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "Event bubbling, capturing & delegation — Web Dev Simplified",
         "url": "https://www.youtube.com/watch?v=F1anRyL37lE",
         "host": "youtube.com"
        }
       ],
       "description": "video che mostra visivamente come un evento \"risale\" dal figlio al genitore (bubbling) e come questo rende possibile la delegation. È la correzione diretta della tua misconcezione n.2: vedrai che il listener resta sul genitore e sono gli eventi a muoversi. Guardalo prima di costruire il progetto, così riconosci il meccanismo quando lo implementi."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "JavaScript30 — 30 progetti DOM in vanilla JS (Wes Bos)",
         "url": "https://javascript30.com/",
         "host": "javascript30.com"
        }
       ],
       "description": "30 mini-esercizi DOM reali (drum kit, orologio, filtri array sul DOM) con starter file, senza framework. Scegline 2–3 sui temi eventi e selezione di elementi: qui pratichi la manipolazione DOM su casi concreti col feedback più immediato che esista (l'effetto appare o non appare). Esperimento delegation: un solo listener sul contenitore, tre `console.log` annidati con `event.target` vs `event.currentTarget` per VEDERE il bubbling."
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"Interactive Rating Component — deployato\"",
       "links": [
        {
         "title": "Interactive rating component — Frontend Mentor",
         "url": "https://www.frontendmentor.io/challenges/interactive-rating-component-koxpeBUmI",
         "host": "frontendmentor.io"
        },
        {
         "title": "guida ufficiale",
         "url": "https://docs.github.com/en/pages/quickstart",
         "host": "docs.github.com"
        }
       ],
       "description": "la challenge fornisce design professionale, assets e specifiche — un ordine di lavoro realistico. Costruisci un componente di rating con due viste (selezione 1–5 e ringraziamento): feedback su hover e selezione, submit gestito con messaggio se nulla è selezionato, la vista di ringraziamento mostra il voto scelto, layout responsive fedele al design. Vincoli: JS vanilla, event delegation sul gruppo di rating, zero librerie. Consegna: repo pubblico con README + deploy su GitHub Pages ([guida ufficiale](https://docs.github.com/en/pages/quickstart)), URL verificato dal telefono. Difesa: sai spiegare ogni listener e ogni stato senza guardare il codice."
      }
     ]
    },
    {
     "n": "0.6",
     "title": "`this` ricostruito (esperimenti 9–10)",
     "core": {
      "title": "il valore di this si decide al call-site",
      "text": "Il tuo schema decisionale su `this` era il segnale cognitivo più alto del corpus (esperimenti con metodi statici per dedurre il binding di forEach e setTimeout) — ma è fragile e contiene la misconcezione \"undefined se la funzione è creata da una classe\" (la causa vera è strict mode, che ora conosci dall'unità 0.4). Qui lo schema si ricostruisce completo: binding di default, implicito, esplicito, new, arrow function."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Understanding this in JavaScript — The Complete Guide (Medium)",
         "url": "https://medium.com/codex/understanding-this-in-javascript-the-complete-guide-c4c21fe15ff8",
         "host": "medium.com"
        }
       ],
       "description": "la guida scompone i quattro binding a partire dal call-site — studia in particolare la sezione sullo strict mode (che trasforma i bug silenziosi in errori espliciti) e quella sulla perdita di contesto nelle callback: è esattamente il fenomeno che avevi indagato da solo con gli esperimenti su setTimeout."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "\"this\" keyword in JavaScript — Full Course (Gordon Zhu)",
         "url": "https://www.youtube.com/watch?v=q0N6Dzu-Jl8",
         "host": "youtube.com"
        }
       ],
       "description": "il video da cui avevi già imparato `this` — rivederlo ORA, con strict mode e call-site nel bagaglio, è un esperimento su te stesso: annota cosa capisci oggi che la prima volta ti era scivolato addosso. Gordon Zhu insegna con il rigore \"leggi il codice come lo legge l'interprete\" — la versione parlata del tuo protocollo di verifica."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "Codewars — kata JavaScript (filtra per OOP / Fundamentals)",
         "url": "https://www.codewars.com/kata/search/javascript",
         "host": "codewars.com"
        }
       ],
       "description": "piattaforma con editor e suite di test integrata; cerca kata di livello 8–7 kyu su oggetti e classi ES (`class`, `constructor`, metodi) — è anche l'occasione per riattivare la sintassi delle classi, che ti serve per capire perché `this` in un metodo di classe può risultare `undefined` (la causa è la strict mode automatica dei corpi di classe, vista in 0.4). Ricostruisci il TUO esperimento storico (il metodo passato a setTimeout che perde il contesto) in 5 varianti con previsione scritta: metodo sull'oggetto, riferimento estratto, callback, arrow, bind. Cinque previsioni, cinque esecuzioni, i test confermano."
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"Lo schema decisionale di this — versione 2\"",
       "links": [
        {
         "title": "`this` — MDN (riferimento operatore)",
         "url": "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/this",
         "host": "developer.mozilla.org"
        }
       ],
       "description": "lab guidato IN CONSOLE su dati locali (nessuna rete, nessun terminale — fetch e async arrivano solo in 0.8). Crea un oggetto con metodi che leggono una sua proprietà (es. un `report` con `.nome` e un metodo `saluta()`), poi passa quei metodi a `setTimeout`, `forEach` e come callback: OSSERVA dove `this` si perde e ricostruiscilo con arrow o `bind`. Usa la pagina MDN solo per confermare la regola di ciascun caso. Consegna: repo con README che include il tuo diagramma di flusso a 5 domande su `this`, validato eseguendo 10 casi in console."
      }
     ]
    },
    {
     "n": "0.7",
     "title": "Event loop visualizzato (l'esperimento che ripara il file rotto)",
     "core": {
      "title": "una sola corsia, e le code che la alimentano",
      "text": "Nel tuo file ColorCode sull'event loop il codice chiama la funzione sbagliata e rende false tutte le annotazioni — nessuno l'ha mai eseguito. È il caso di studio perfetto del modulo: qui l'asincronia smette di essere magia e diventa un modello meccanico (call stack, task queue, microtask queue) che sai girare a mano. Senza questo modello, promises e async/await (unità 0.8) restano sintassi vuota — è la priorità alta dichiarata in diagnosi."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Event loop: microtasks and macrotasks — javascript.info",
         "url": "https://javascript.info/event-loop",
         "host": "javascript.info"
        }
       ],
       "description": "il modello completo con le regole di priorità (i microtask vengono svuotati TUTTI prima del prossimo task). Traccia a mano gli esempi del capitolo col tuo formato stato-per-iterazione: stack | coda task | coda microtask, riga per riga. È la traccia manuale che in diagnosi risulta il tuo strumento più efficace."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "What the heck is the event loop anyway? — Philip Roberts, JSConf EU",
         "url": "https://www.youtube.com/watch?v=8aGhZQkoFbQ",
         "host": "youtube.com"
        }
       ],
       "description": "IL talk di riferimento mondiale sull'event loop (26 minuti, tutto animato). Philip Roberts costruisce il modello mentale della singola corsia e delle code visivamente, dal vivo. È la spiegazione che rende il concetto tuo per sempre; guardalo con il quaderno accanto e ferma il video per anticipare la prossima mossa."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "Loupe — visualizzatore live dell'event loop (Philip Roberts)",
         "url": "http://latentflip.com/loupe/",
         "host": "latentflip.com"
        }
       ],
       "description": "lo strumento che esegue codice VERO mostrando stack, coda e Web API in movimento. Flusso di lavoro: scrivi un frammento (log sincroni, setTimeout a zero, catene), PREVEDI l'ordine dei log sul quaderno, premi play, osserva. È il tuo formato-esperimento elevato a laboratorio. Poi l'atto riparatore: riapri il TUO file event loop di ColorCode, eseguilo com'è, osserva perché le annotazioni sono false, correggi con la data."
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"Batteria di previsioni: 10 su Loupe\"",
       "links": [
        {
         "title": "JavaScript Visualized: Event Loop — Lydia Hallie (dev.to)",
         "url": "https://dev.to/lydiahallie/javascript-visualized-event-loop-3dif",
         "host": "dev.to"
        }
       ],
       "description": "usando l'articolo animato di Lydia Hallie come riferimento delle regole, crea un documento nel repo di studio con 10 frammenti a difficoltà crescente. ⚠️ Nota sugli strumenti: Loupe visualizza solo call stack + Web API + coda dei task (`setTimeout`) — non le promise/microtask; quindi i frammenti sincroni e con `setTimeout` si verificano su Loupe, mentre i casi con `.then()`/microtask si verificano in console (o sul simulatore promise dell'unità 0.8). In questa unità la batteria è solo macrotask (sincroni + setTimeout); i frammenti con promise si aggiungono DOPO l'unità 0.8, quando conoscerai la sintassi. Registro degli errori: ogni previsione sbagliata è una crepa del modello da rispiegare."
      }
     ]
    },
    {
     "n": "0.8",
     "title": "Promises, async/await, error handling (esperimenti 11–12 + il gap squalificante)",
     "core": {
      "title": "fetch non fallisce quando credi tu — e lo zero error handling finisce oggi",
      "text": "Le due misconcezioni asincrone della diagnosi cadono qui: `response.json()` non \"converte una promise\" (legge il body e restituisce una NUOVA promise che risolve in un oggetto JS), e fetch rigetta SOLO su errore di rete — un 404 è un fulfillment con `ok: false`. In ~1.900 righe dei tuoi progetti non esiste UNA gestione errori: per l'industria 2026 è squalificante. Da questa unità in poi, ogni chiamata asincrona del percorso nasce con il suo ramo di errore, per sempre."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Promise — javascript.info",
         "url": "https://javascript.info/promise-basics",
         "host": "javascript.info"
        },
        {
         "title": "Async/await — javascript.info",
         "url": "https://javascript.info/async-await",
         "host": "javascript.info"
        }
       ],
       "description": "i due capitoli centrali della sezione asincrona: stati della promise (pending → fulfilled/rejected — e il glossario IT→EN qui è d'obbligo: fulfilled, non \"fullfield\"), catene, e async/await come zucchero sintattico sopra lo stesso modello dell'unità 0.7. Disegna le 4 stazioni della catena fetch sul quaderno: chiamata → response → lettura body → oggetto JS."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "JavaScript Visualized: Promises & Async/Await — Lydia Hallie",
         "url": "https://www.youtube.com/watch?v=Xs1EMmBLpn4",
         "host": "youtube.com"
        }
       ],
       "description": "l'animazione della microtask queue applicata alle promise — collega visivamente questa unità alla 0.7: STESSO modello, nuova sintassi. Lydia Hallie mostra la promise che attraversa gli stati e la callback che finisce nella coda dei microtask. Guardalo dopo i primi task di teoria, prima degli esperimenti fetch."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "Promises & Async/Await Simulator — DevOps Daily",
         "url": "https://devops-daily.com/games/javascript-promises-async-await-simulator",
         "host": "devops-daily.com"
        }
       ],
       "description": "un simulatore interattivo che visualizza call stack, microtask queue e task queue mentre esegui scenari asincroni, con \"step backward\" e predizione dell'ordine di output. È il banco di prova ideale per le promise: prevedi quale callback esce prima, verifica, capisci perché il microtask precede setTimeout(0). Complementare a Loupe, focalizzato sulle promise."
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"La fetch a prova di 404\"",
       "links": [
        {
         "title": "Weather App con API — roadmap.sh",
         "url": "https://roadmap.sh/projects/weather-app",
         "host": "roadmap.sh"
        },
        {
         "title": "Open-Meteo",
         "url": "https://open-meteo.com/",
         "host": "open-meteo.com"
        },
        {
         "title": "Using the Fetch API — sezione checking response — MDN",
         "url": "https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#checking_that_the_fetch_was_successful",
         "host": "developer.mozilla.org"
        }
       ],
       "description": "brief pubblico — un'app meteo che chiama una API pubblica e mostra le condizioni per una città (fetch funziona anche nella console del browser o in una pagina HTML semplice — nessun terminale). È il caso reale dove l'error handling diventa obbligatorio: città inesistente (404), API down (errore di rete), input vuoto. Costruiscila con UNA sola richiesta (non 12 in loop, come nel tuo vecchio codice), controllo dello stato della risposta, e — pattern professionale — una guard clause con early return in cima alla funzione per gli input non validi (uscire subito invece di annidare `if`). ⚠️ Usa [Open-Meteo](https://open-meteo.com/), che NON richiede chiave API — così eviti il rischio di committare un segreto in un repo pubblico (regola d'oro: una chiave API non si committa MAI; i segreti li gestirai col tooling in M1). Consultazione mirata: [Using the Fetch API — sezione checking response — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#checking_that_the_fetch_was_successful). Nel README, il confronto prima/dopo con la peggiore fetch dei tuoi progetti Techdegree."
      }
     ]
    },
    {
     "n": "0.9",
     "title": "JS moderno quotidiano + consolidamento (destructuring, optional chaining, ??)",
     "core": {
      "title": "colmare il JS del 2020+ mai visto",
      "text": "Destructuring, rest/spread completo, optional chaining e nullish coalescing non sono \"feature avanzate\": sono il JavaScript quotidiano di ogni codebase 2026 e di tutto ciò che leggerai da M6 in poi. Il nullish coalescing chiude il cerchio con la truthiness dell'unità 0.3: è NATO per distinguere null/undefined dai falsy legittimi come 0 e stringa vuota."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Destructuring assignment — javascript.info",
         "url": "https://javascript.info/destructuring-assignment",
         "host": "javascript.info"
        },
        {
         "title": "Optional chaining '?.' — javascript.info",
         "url": "https://javascript.info/optional-chaining",
         "host": "javascript.info"
        }
       ],
       "description": "i due capitoli con i task finali. Il collegamento all'unità 0.3 va esplicitato sul quaderno: quali dei tuoi 3 bug di truthiness sarebbero spariti col nullish coalescing? (Risposta da costruire eseguendo, non da intuire.)"
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "JavaScript Object Destructuring, Spread Syntax, and the Rest Parameter — A Practical Guide (freeCodeCamp)",
         "url": "https://www.freecodecamp.org/news/javascript-object-destructuring-spread-operator-rest-parameter/",
         "host": "freecodecamp.org"
        }
       ],
       "description": "guida pratica ricca di esempi di codice affiancati (prima senza, poi con la sintassi moderna) che rende visibile QUANTO codice si risparmia e quanto diventa leggibile. Ti serve per vedere questi costrutti in azione su casi reali prima di praticarli; leggila con la domanda \"dove nel mio vecchio codice questo avrebbe aiutato?\"."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "learnjavascript.online — capitoli su ES moderno (parte gratuita)",
         "url": "https://learnjavascript.online/",
         "host": "learnjavascript.online"
        }
       ],
       "description": "piattaforma con micro-lezioni ognuna seguita da una challenge validata da test nel browser, orientata al JS moderno idiomatico. La parte gratuita (77 lezioni, nessun limite di tempo, nessun abbonamento) copre destructuring, spread e le feature ES recenti con feedback immediato. Ogni challenge: previsione prima, esecuzione poi."
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: vedi Progetto del Modulo (Task Tracker)",
       "links": [
        {
         "title": "Build a Task Tracker with JavaScript — roadmap.sh",
         "url": "https://roadmap.sh/projects/task-tracker-js",
         "host": "roadmap.sh"
        },
        {
         "title": "pagina MDN su localStorage",
         "url": "https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage",
         "host": "developer.mozilla.org"
        }
       ],
       "description": "questa unità sfocia direttamente nel progetto finale del modulo, descritto sotto — il JS moderno appena acquisito (destructuring sui dati delle attività, optional chaining sull'accesso, nullish coalescing per i default) è il vincolo tecnico esplicito del progetto. Il progetto usa `localStorage` per la persistenza: prima di iniziarlo, dai un'occhiata mirata alla [pagina MDN su localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) (solo `setItem`/`getItem` + `JSON.stringify`/`parse` sul valore, con `try/catch` — l'error handling di 0.8 applicato allo storage)."
      }
     ]
    }
   ],
   "questions": [
    "Perché una fetch verso un URL che risponde 404 NON finisce nel ramo di errore? Cosa ci finisce davvero?",
    "Cosa restituisce esattamente la lettura del body di una risposta, e perché serve un secondo passaggio asincrono?",
    "In quale ordine escono i log di: codice sincrono, un setTimeout a zero e una promise già risolta? Perché — in termini di code?",
    "Qual è la differenza di comportamento tra var e let lette prima della dichiarazione? Come si chiama la zona in cui vive let?",
    "Perché il confronto tra un numero e una stringa alfabetica è sempre falso, qualunque sia il numero?",
    "Elenca i 6 valori falsy e spiega perché usare la truthiness per validare un input numerico è un bug.",
    "Un listener sul genitore riceve i click sui figli: cosa si muove — il listener o l'evento? Con quali due proprietà lo dimostri?",
    "Quando `this` dentro un metodo di classe risulta undefined: qual è la causa vera?",
    "Perché una return a metà funzione non è un errore ma un pattern professionale? Come si chiama?",
    "Cosa distingue il nullish coalescing dall'OR logico su un input che vale 0?"
   ],
   "exercises": [
    "Batteria NUOVA di 10 previsioni event-loop (frammenti mai visti): macrotask su Loupe + microtask/promise in console → ≥8 corrette",
    "I 12 esperimenti-misconcezione completati con previsione scritta + esito osservato + regola in una riga propria",
    "≥10 esercizi tra Exercism e JSchallenger con verifica superata",
    "La Weather App eseguita nei 3 scenari: successo, 404, rete assente — comportamento corretto osservato in tutti e tre"
   ],
   "criteria": [
    {
     "text": "Interactive Rating Component deployato su GitHub Pages, raggiungibile da un telefono",
     "auto": false
    },
    {
     "text": "Task Tracker (progetto del modulo) deployato, con gestione errori su ogni input utente",
     "auto": false
    },
    {
     "text": "6 repo Techdegree bonificati (README + gitignore + archiviazione motivata) + README di profilo",
     "auto": false
    },
    {
     "text": "Batteria event-loop: ≥8/10 al primo tentativo (macrotask su Loupe + microtask in console)",
     "auto": false
    },
    {
     "text": "12/12 esperimenti-misconcezione core agli atti sul quaderno (le 3 su DOM/event-loop di 0.5 e 0.7 sono esperimenti supplementari, fuori dal conteggio dei 12)",
     "auto": false
    },
    {
     "text": "Domande socratiche: ≥8/10 a quaderno chiuso",
     "auto": true
    },
    {
     "text": "Commit quotidiani nei giorni di studio delle ultime 3 settimane (si guarda la cronologia GitHub)",
     "auto": false
    }
   ],
   "noGo": "qualsiasi \"no\" su un'area CORE → si resta in M0 sulla sola area rossa, con carico ridotto. Un \"no\" residuo SOLO su code elastiche (con tutte le core verdi) ammette il Go con piano di coda scritto: le code si chiudono nelle prime 2 settimane di M1. In ogni altro caso non si apre M1.",
   "summary": "Il modulo ha riattivato il JavaScript esistente correggendo il processo che lo aveva prodotto: ogni concetto fragile (coercizione, scope, this, event loop, async) è stato ricostruito con esperimenti a previsione scritta; l'error handling è diventato un riflesso; due progetti pubblici deployati e sei repo bonificati hanno acceso il binario employability. Da qui in avanti \"finito\" significa \"eseguito, osservato, difendibile\".",
   "project": {
    "title": "Task Tracker — versione professionale deployata",
    "description": "applicazione DOM per la gestione di attività. Requisiti funzionali: aggiunta con validazione dell'input (input vuoto o di soli spazi → messaggio utile, non silenzio; e attenzione — un titolo \"0\" è valido: qui si paga la lezione truthiness); completamento e cancellazione con event delegation su UNA sola registrazione; filtro attive/completate; persistenza in localStorage con gestione del caso \"storage corrotto o disabilitato\" (try/catch con fallback dichiarato all'utente); contatore attività aggiornato a ogni mutazione. Vincoli: JS vanilla ES2022+, destructuring e nullish coalescing dove naturali, zero librerie, zero innerHTML con dati utente (prima lezione di sicurezza: si usa la creazione di nodi — il perché completo arriva in M8). Consegna: repo pubblico con README che dichiara scelte e limiti + URL GitHub Pages + demo difendibile riga per riga.",
    "resource": {
     "title": "Build a Task Tracker with JavaScript — roadmap.sh",
     "url": "https://roadmap.sh/projects/task-tracker-js",
     "host": "roadmap.sh"
    }
   },
   "fit": {
    "text": "- Watch and Code — Programming Foundations (gratuito)\n- Come da divergenza n.1 del comitato (v. mappa §6): DOPO la settimana 6, a riattivazione avviata, puoi testare il corso gratuito di Gordon Zhu come verifica esterna del tuo livello di rigore. NON sostituisce le unità di questo modulo; è un test di fit per l'eventuale (e costosa) membership, decisione che si prende solo con i dati di questo test. Se il formato ti risucchia in modalità video-passiva, il test ha dato il suo responso: negativo.",
    "links": [
     {
      "title": "Watch and Code — Programming Foundations (gratuito)",
      "url": "https://watchandcode.com/",
      "host": "watchandcode.com"
     }
    ]
   },
   "file": "M0-Riattivazione_JavaScript.md"
  },
  {
   "n": 1,
   "nn": "01",
   "title": "Tooling Moderno: Terminale, Git, npm, Moduli ES, Vite",
   "type": "NUOVO CONTENUTO",
   "prereq": "M0 settimane 1–4 completate (protocollo di verifica attivo, primo deploy fatto)",
   "window": "settimane 8–11 · mini-modulo",
   "transversal": "",
   "intro": [
    "Nella diagnosi questo mondo è assente del tutto: npm, package.json, bundler, build step — zero occorrenze in tutta la codebase (§2.2). Senza questo strato nessun progetto 2026 esiste: è il ponte obbligato tra \"file HTML aperto nel browser\" e lo sviluppo professionale di M2, M6, M10. Il modulo è volutamente corto e operativo: ogni concetto viene installato usandolo sul Task Tracker di M0, non in astratto.",
    "Al termine Diego sarà in grado di:"
   ],
   "objectives": [
    "Applicare i comandi shell fondamentali (navigazione, manipolazione file, pipe) senza cercarli, dentro Git Bash su Windows",
    "Costruire un flusso Git completo: staging selettivo, commit atomici con messaggi sensati, branch, merge, risoluzione di un conflitto semplice, push/pull",
    "Analizzare un package.json: dipendenze vs devDependencies, script, versionamento semantico — e spiegare cosa fa npm install",
    "Spiegare cosa sono i moduli ES (import/export usati finora \"meccanicamente\", diagnosi §2.2) e perché un progetto si spezza in moduli",
    "Costruire un progetto Vite da zero e migrare il Task Tracker dentro la toolchain: dev server, build, deploy del risultato",
    "Valutare cosa fa davvero un bundler e perché esiste (il \"perché\" prima del \"come\", come da tuo stile)"
   ],
   "units": [
    {
     "n": "1.1",
     "title": "Il terminale come casa (shell)",
     "core": {
      "title": "la riga di comando è l'interfaccia del mestiere",
      "text": "Ogni strumento da qui in avanti (git, npm, vite, i test, il deploy, e in futuro Docker e gli agent AI) vive nel terminale. L'obiettivo non è memorizzare comandi: è perdere la paura, capire il modello (comandi, argomenti, flag, pipe, exit code) e sapersi orientare. Su Windows userai Git Bash, così i comandi coincidono con quelli di ogni tutorial e di ogni server Linux che incontrerai."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "The Missing Semester — The Shell (MIT)",
         "url": "https://missing.csail.mit.edu/2020/course-shell/",
         "host": "missing.csail.mit.edu"
        }
       ],
       "description": "la lezione di apertura del corso MIT nato esattamente per questo buco formativo (\"le cose che i corsi di CS non insegnano\"). Copre il modello mentale della shell: cosa succede quando digiti un comando, PATH, redirezione, exit code. Leggi il testo della lezione; è il riferimento concettuale su cui poggia tutta la pratica di questa unità."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "Command Line Crash Course For Beginners — Traversy Media",
         "url": "https://www.youtube.com/watch?v=uwAqEzhyjtw",
         "host": "youtube.com"
        }
       ],
       "description": "un attraversamento video dei comandi del terminale mostrati dal vivo (navigazione, file, permessi, pipe). Vedere qualcuno muoversi fluido nel terminale toglie l'intimidazione e ti mostra il ritmo di lavoro reale. Guardalo prima di iniziare gli esercizi, poi replica ogni comando nel tuo Git Bash."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "cmdchallenge — sfide shell nel browser",
         "url": "https://cmdchallenge.com/",
         "host": "cmdchallenge.com"
        }
       ],
       "description": "sfide a obiettivo singolo (\"scrivi il comando che...\") con terminale nel browser e feedback immediato — zero setup, esecuzione reale. È la palestra ideale per i comandi shell: leggi la sfida, PREVEDI il comando sul quaderno, provalo, verifica. Completa la prima serie di sfide; poi replica i comandi vinti nel tuo Git Bash su file veri del repo di studio."
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"Il mio cheat-sheet eseguito\"",
       "links": [
        {
         "title": "learnshell.org — Free Interactive Shell Tutorial",
         "url": "https://www.learnshell.org/",
         "host": "learnshell.org"
        }
       ],
       "description": "usa questo tutorial interattivo (editor con Run/Solution nel browser) sui capitoli Basic per costruire, comando dopo comando, un cheat-sheet personale nel repo di studio. Regola: ogni riga del cheat-sheet è ammessa SOLO se il comando è stato eseguito e l'output osservato (protocollo M0 applicato alla shell). Formato: comando, cosa mi aspettavo, cosa ha fatto, quando lo userò. Obiettivo: 20 comandi padroneggiati."
      }
     ]
    },
    {
     "n": "1.2",
     "title": "Git vero (non solo add-commit-push)",
     "core": {
      "title": "Git è un grafo di snapshot, non una cartella sincronizzata",
      "text": "Nei 6 progetti Techdegree: 1 solo gitignore, zero branch, zero merge (diagnosi §2.2). Git usato come \"salvataggio\" invece che come strumento di lavoro. Qui si costruisce il modello mentale (commit = snapshot, branch = puntatore, merge = ricongiungimento del grafo) e la pratica quotidiana che i recruiter leggono nella cronologia."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Pro Git — Git Basics (cap. 2)",
         "url": "https://git-scm.com/book/en/v2/Git-Basics-Getting-a-Git-Repository",
         "host": "git-scm.com"
        },
        {
         "title": "Pro Git — Branches in a Nutshell (cap. 3.1)",
         "url": "https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell",
         "host": "git-scm.com"
        }
       ],
       "description": "il libro ufficiale, gratuito, con i diagrammi del grafo che sono lo standard con cui tutti disegnano Git. Dal capitolo 2 servono: il ciclo di vita dei file (untracked/staged/committed), lo staging selettivo, la storia. Dal 3.1: cosa È un branch (un puntatore mobile, non una copia) — la pagina con i diagrammi più importanti del libro. Ignora per ora rebase e workflow avanzati."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "Learn Git Branching — visualizzatore interattivo",
         "url": "https://learngitbranching.js.org/",
         "host": "learngitbranching.js.org"
        }
       ],
       "description": "il visualizzatore dove ogni comando che digiti muove il grafo SOTTO I TUOI OCCHI — motion graphics didattica applicata a Git, il tuo formato ideale. Completa le sequenze \"Introduction\" e \"Ramping Up\". Prima di ogni comando: previsione di come si muoverà il grafo (il tuo protocollo, ancora). Questo è insieme visualizzazione E gioco, ma la pratica su repo reale la fai nel punto successivo."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "Git Exercises — esercizi git reali con verifica automatica",
         "url": "https://gitexercises.fracz.com/",
         "host": "gitexercises.fracz.com"
        },
        {
         "title": "git-katas",
         "url": "https://github.com/eficode-academy/git-katas",
         "host": "github.com"
        }
       ],
       "description": "qui usi il tuo terminale git VERO (non una simulazione): ogni esercizio è uno stato del repo da risolvere committando e facendo `git push` a un verificatore remoto che valida automaticamente la soluzione. Copre esattamente il workflow reale — commit, branch, merge, fix della storia. È il complemento perfetto a Learn Git Branching: lì vedi il grafo, qui lo manovri sul serio con feedback automatico. (Alternativa offline: [git-katas](https://github.com/eficode-academy/git-katas), con script `test.ps1` per Windows.)"
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"Feature branch reale sul Task Tracker\"",
       "links": [
        {
         "title": "Pro Git — Basic Branching and Merging (cap. 3.2)",
         "url": "https://git-scm.com/book/en/v2/Git-Branching-Basic-Branching-and-Merging",
         "host": "git-scm.com"
        }
       ],
       "description": "il teatro è il TUO Task Tracker di M0 (nessun progetto nuovo: usi codice che già esiste e capisci, coerente col titolo dell'unità). Seguendo il flusso descritto in questo capitolo, sviluppa una piccola feature (es. modifica di un'attività esistente) su un branch dedicato con 3+ commit atomici e messaggi in inglese decente, poi merge su main SOLO a feature funzionante e verificata; poi simula e risolvi un conflitto creando due branch che toccano la stessa riga. La cronologia risultante è l'artefatto: chiunque deve poter ricostruire cosa hai fatto leggendo solo i messaggi di commit. *(Perché non un progetto roadmap.sh qui: quelli a portata sarebbero API/backend, fuori dalle competenze di M1 — il feature-branch si allena meglio su codice che già padroneggi.)*"
      }
     ]
    },
    {
     "n": "1.3",
     "title": "npm, package.json e i moduli ES capiti davvero",
     "core": {
      "title": "da \"file che si includono\" a \"progetto con dipendenze dichiarate\"",
      "text": "import/export li hai già digitati, mai capiti (diagnosi: \"usati meccanicamente, mai spiegati\"). Qui il salto: un progetto moderno dichiara le sue dipendenze (package.json), le installa riproducibilmente (npm install, lockfile) e organizza il proprio codice in moduli con confini espliciti. È il prerequisito assoluto di M2 (Vitest arriva da npm) e di tutto il percorso."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Modules, introduction — javascript.info",
         "url": "https://javascript.info/modules-intro",
         "host": "javascript.info"
        }
       ],
       "description": "cosa cambia quando uno script diventa modulo (scope proprio, strict mode automatico — collegamento diretto alla tua unità 0.4 —, caricamento deferito, un'istanza sola per modulo). I task e gli esempi vanno eseguiti: metà delle sorprese di questo capitolo si vede solo eseguendo."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "Modern JavaScript Explained For Dinosaurs — Peter Jang",
         "url": "https://peterxjang.com/blog/modern-javascript-explained-for-dinosaurs.html",
         "host": "peterxjang.com"
        }
       ],
       "description": "il racconto-storia che ricostruisce PERCHÉ esistono npm, i bundler e i build step, partendo da \"un file HTML con uno script\" (esattamente dove sei tu) e aggiungendo un problema alla volta. È storytelling tecnico nel senso pieno: ogni strumento entra in scena quando il dolore che risolve è già chiaro. La risposta definitiva al tuo \"voglio il perché prima del come\"."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "ES Modules Fundamentals — moduli reali eseguibili nel browser",
         "url": "https://esmodules.com/fundamentals/",
         "host": "esmodules.com"
        }
       ],
       "description": "piattaforma dove scrivi ed esegui veri moduli ES nel browser (non simulazioni), con output console live e \"Edit in CodePen\": pratichi named/default export, import rinominati e aggregati con feedback immediato. È mirata ESATTAMENTE su import/export, il concetto che finora usavi alla cieca. In parallelo, sul tuo computer: crea una cartella, `npm init`, installa una libreria a caso, osserva `node_modules` e il lockfile, cancella `node_modules` e ricostruiscilo con un solo comando — quel ciclo È il concetto npm."
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"Task Tracker spezzato in moduli\"",
       "links": [
        {
         "title": "package.json — riferimento campi (npm Docs)",
         "url": "https://docs.npmjs.com/cli/v11/configuring-npm/package-json",
         "host": "docs.npmjs.com"
        }
       ],
       "description": "riorganizza il Task Tracker di M0 in 3+ moduli ES con confini sensati (es. storage, logica attività, interfaccia DOM) e import/export espliciti, e scrivi a mano il suo `package.json` consultando questa pagina SOLO per i campi che ti servono (name, scripts, dependencies vs devDependencies). Criterio: ogni modulo si può spiegare in una frase; nessun modulo conosce i dettagli interni degli altri. È il primo esercizio di architettura del percorso (da 1.5/10 si parte così, non dai design pattern)."
      }
     ]
    },
    {
     "n": "1.4",
     "title": "Vite: la toolchain che vedi funzionare",
     "core": {
      "title": "dev server + build = i due mondi di ogni progetto moderno",
      "text": "Vite è lo standard 2026 per i progetti frontend/full-stack ed è la toolchain di M6 e M10. I due concetti da possedere: in sviluppo un server locale serve i tuoi moduli così come sono (con hot reload); in produzione una build li impacchetta ottimizzati. Chi confonde i due mondi non capisce mai cosa sta deployando."
     },
     "sections": [
      {
       "type": "teoria",
       "label": "Teoria",
       "heading": "Teoria (Fondamenta)",
       "links": [
        {
         "title": "Why Vite — vite.dev",
         "url": "https://vite.dev/guide/why",
         "host": "vite.dev"
        }
       ],
       "description": "la pagina \"filosofica\" della documentazione: il problema storico (bundle a ogni modifica, tempi morti) e la soluzione (moduli ES nativi in dev, bundle solo in produzione). Da leggere DOPO l'articolo dei dinosauri della 1.3: è il capitolo finale della stessa storia."
      },
      {
       "type": "studio",
       "label": "Studio",
       "heading": "Studio (Visualizzazione)",
       "links": [
        {
         "title": "Vite in 100 Seconds — Fireship",
         "url": "https://www.youtube.com/watch?v=KCrXgy8qtjM",
         "host": "youtube.com"
        }
       ],
       "description": "panoramica visiva e rapidissima di cosa fa Vite e perché è diventato lo standard, con la demo del dev server istantaneo. Ti dà il colpo d'occhio d'insieme prima di mettere le mani sulla guida operativa: capisci la forma del bosco prima di camminare tra gli alberi."
      },
      {
       "type": "pratica",
       "label": "Pratica",
       "heading": "Pratica (Testing & Debugging)",
       "links": [
        {
         "title": "Getting Started — vite.dev",
         "url": "https://vite.dev/guide/",
         "host": "vite.dev"
        }
       ],
       "description": "la guida operativa ufficiale: crea un progetto dal template vanilla, esplora la struttura delle cartelle, prova i tre script fondamentali (dev, build, preview). Pratica chiave: esegui la build, apri la cartella di output e CONFRONTALA coi sorgenti — la differenza tra i due mondi (sviluppo e produzione) si impara con gli occhi. Fermati alla fine di \"Getting Started\"; il resto è consultazione."
      },
      {
       "type": "progetto",
       "label": "Mini progetto",
       "heading": "Mini Progetto Finale: \"Task Tracker dentro Vite, deployato dalla build\"",
       "links": [
        {
         "title": "Deploying a Static Site → GitHub Pages — vite.dev",
         "url": "https://vite.dev/guide/static-deploy.html#github-pages",
         "host": "vite.dev"
        }
       ],
       "description": "migra il Task Tracker (già modulare dalla 1.3) dentro un progetto Vite e deploya la BUILD di produzione su GitHub Pages seguendo la sezione dedicata di questa guida (che spiega anche perché serve configurare il percorso base). Dev server per lo sviluppo, build per la consegna, deploy della build al posto della versione vecchia. Il README si aggiorna con le istruzioni di avvio in locale — da qui in poi ogni tuo repo le avrà."
      }
     ]
    }
   ],
   "questions": [
    "Cosa fa esattamente npm install quando lo lanci in un progetto clonato? Che ruolo ha il lockfile?",
    "Qual è la differenza tra dependencies e devDependencies — e in quale delle due andrà Vitest, e perché?",
    "Un branch Git è una copia dei file? Cosa si muove davvero quando committi su un branch?",
    "Perché uno script caricato come modulo è automaticamente in strict mode e ha scope proprio? Cosa c'entra con la tua unità 0.4?",
    "Cosa contiene la cartella di build che NON c'è nei sorgenti, e viceversa?",
    "Perché in sviluppo Vite non fa il bundle? Quale problema storico risolve questa scelta?",
    "Racconta la catena: modifichi un file → salvi → cosa succede nel dev server → cosa vede il browser?",
    "Come risolvi un conflitto di merge: cosa ti mostra Git, e cosa decide lui vs cosa decidi tu?"
   ],
   "exercises": [
    "cmdchallenge: prima serie di sfide completata; poi gli stessi comandi replicati in Git Bash su file veri",
    "Learn Git Branching (Introduction + Ramping Up) + Git Exercises (i primi esercizi con push verificato)",
    "Ciclo completo npm: cancella node_modules del Task Tracker e riportalo funzionante con un comando",
    "Conflitto simulato creato e risolto sul repo di studio, con spiegazione scritta della risoluzione"
   ],
   "criteria": [
    {
     "text": "Task Tracker migrato in Vite: dev server funzionante + build deployata su GitHub Pages",
     "auto": false
    },
    {
     "text": "Codice organizzato in 3+ moduli ES con confini spiegabili in una frase ciascuno",
     "auto": false
    },
    {
     "text": "Feature branch con 3+ commit atomici mergiata su main",
     "auto": false
    },
    {
     "text": "Un conflitto di merge risolto e documentato",
     "auto": false
    },
    {
     "text": "Domande socratiche: ≥7/8 a quaderno chiuso",
     "auto": true
    }
   ],
   "noGo": "",
   "summary": "Terminale, Git come grafo, npm come contratto di dipendenze, moduli ES capiti (non solo digitati) e Vite come toolchain: il Task Tracker di M0 è diventato un progetto professionale con dev server, build e deploy. Ora esiste l'infrastruttura per testare (M2) e per tutto il resto.",
   "project": {
    "title": "Task Tracker — migrazione a toolchain moderna",
    "description": "il progetto M0 va portato a standard di consegna 2026 senza cambiarne le funzionalità: repository con struttura Vite (sorgenti, output di build ignorato da Git), codice riorganizzato in moduli con responsabilità dichiarate nel README, script npm documentati (avvio sviluppo, build, anteprima), deploy aggiornato che serve la build di produzione, cronologia Git con feature branch e commit atomici. Criterio di accettazione del cliente: uno sviluppatore che clona il repo lo avvia in locale in meno di 2 minuti seguendo solo il README.",
    "resource": {
     "title": "Getting Started — vite.dev",
     "url": "https://vite.dev/guide/",
     "host": "vite.dev"
    }
   },
   "fit": null,
   "file": "M1-Tooling_Moderno.md"
  }
 ],
 "locked": [
  {
   "n": 2,
   "nn": "02",
   "title": "Testing con Vitest"
  },
  {
   "n": 3,
   "nn": "03",
   "title": "Fondamenti di Computer Science"
  },
  {
   "n": 4,
   "nn": "04",
   "title": "TypeScript"
  }
 ]
};
