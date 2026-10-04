# D-DESIGN-1 — Nelle divergenze fra design e spec vince il design

**Stato**: decisa dall'utente il 25/09/2026 («scelta definitiva non la spec ma il design»). Applicata nel codice già
scritto, nei documenti operativi e in `docs/spec/`, allineata al design lo stesso giorno con il permesso esplicito
dell'utente (INV-5). Riga nel registro: `docs/01_DECISIONI.md`.

**Dal 04/10/2026** (D-DESIGN-2): il vecchio export a cui si riferiscono le divergenze n. 1–25 e le note interne in
fondo è stato rimosso dal repository (storia git, `3c60512`); le regole della tabella stanno nelle spec e nel backlog
come dice la loro riga (la n. 25 resta una differenza di testo con FUNZ §4.4). La decisione (punti 1–3) vale per il
nuovo design dopo il suo handoff (`docs/03_HANDOFF_DESIGN_CODE.md`): le schermate e il testo normativo del punto 1
sono quelli che l'handoff indica, e un `course-data.js` del nuovo export sostituisce quello di
`src/data/sample-course/`. Vale anche la regola del 24/09/2026: l'export si versiona in `claude-design/` così com'è,
ignorati solo gli ZIP.

## Contesto

In T-000, T-007, T-008 e T-038 sono emerse 22 divergenze fra l'export di Claude Design e le spec
(vecchio `docs/03_HANDOFF_DESIGN_CODE.md` §10, nella storia git), più le differenze fra `course-data.js` e FORMATO §2–§3. Fino ad oggi vinceva la
spec. L'utente ha scelto il contrario: il design è la fonte definitiva e le spec vanno allineate al design.

## Decisione

1. In caso di divergenza vince il design: le **schermate** (`S*.dc.html`) e il **fixture** `course-data.js`; dove il
   design contraddice sé stesso vince il suo testo normativo (`HANDOFF.md`, `DESIGN.md`) sui dati di esempio dei mock.
2. Le spec si correggono in modo da non contraddire più il design; finché non sono corrette, questa scheda prevale sui
   paragrafi elencati sotto.
3. Dove il design mostra un elemento senza dirne il comportamento, l'agente sceglie l'interpretazione minima coerente e
   la scrive qui (colonna «Regola»).

## Esito per divergenza (numeri del vecchio `docs/03_HANDOFF_DESIGN_CODE.md` §10, nella storia git)

| n. | Regola da oggi | Paragrafi di spec allineati | Codice |
|---|---|---|---|
| 1 | Il corso di esempio mostra **5 moduli**: M0 e M1 importati più M2–M4 come segnaposto bloccati (solo numero e titolo, da `course-data.js` `locked`), come in S10/S11 e HANDOFF «Dati del corso». Titolo «Syllabus Software Engineer 2026» (fixture e HANDOFF; il titolo della card S10 è dato d'esempio). Card: «5 moduli · 13 unità». | FORMATO §5; CONTESTO §5 | T-041 |
| 2 | Si trascinano i todo senza orario **e i blocchi persi di qualsiasi tipo**: un blocco perso trascinato su un altro giorno o orario torna programmato, con le notifiche ri-armate e «Annulla» (S1 `drag=perso`). | FUNZ §2; MECC §15; SCENARI G3 (ultima frase) | T-015 |
| 3 | Vista Giorno: su mobile la fascia senza orario sta in cima, su **desktop in coda** dopo i blocchi con orario (S1 Desktop). | FUNZ §2; MECC §24 | fatto (`Today.module.css`) |
| 4 | L'account ha un **nome facoltativo** (Account e sincronizzazione): saluto «Ciao, <nome>», nome ed email in testa al menu del logo e nella sidebar desktop; senza nome «Ciao». | FUNZ §2, §21 | T-033 (oggi non c'è un nome: «Ciao») |
| 5 | **Ricerca** «Cerca ⌘K» nella sidebar desktop: apre un campo che cerca per titolo fra attività, corsi e unità; ⌘K / Ctrl+K la apre. | FUNZ §1 (nuovo paragrafo) | T-039 |
| 6 | Nessun cambio di regola: HANDOFF.md («Un modulo bloccato non si apre e non entra nel puntatore; il primo modulo è sempre aperto») coincide con FORMATO §4. M1 «aperto» con M0 a 3/7 è uno stato del fixture, non una regola. | — | invariato (D-PTR-1) |
| 7 | Nessun cambio di regola: S12 («Video della sezione Studio») e DESIGN.md dicono lo stesso di FORMATO §3; la regex dello script del mock non è normativa. | — | invariato |
| 8 | Reimportando un corso con lo **stesso titolo**, i materiali dell'utente (link, note, PDF, file di codice) passano al corso nuovo sulle unità con lo stesso numero; quelli senza corrispondenza restano sul corso nuovo a livello di corso (S12 «restano anche se reimporti»). L'import crea comunque un corso nuovo. | MECC §16, §17; FUNZ §9.1, §10 | T-024 |
| 9 | Flashcard: sui quattro bottoni **solo l'etichetta** del grado, nessuna scadenza accanto (S19). | FUNZ §15 | T-027 |
| 10 | Audio Flash-Trivia con **punteggio**: un elemento saltato con «Salta» conta come sbagliato, gli altri come giusti; riepilogo «8 / 10 · 80 %», elenco delle sbagliate, che tornano una volta nella playlist successiva; azioni «Rifai la pratica» e «Torna all'unità». Sostituisce D-TRIVIA-1. | FUNZ §14.5, §17 (Pratica); MECC §18; SCENARI I4 | T-028 |
| 11 | Chat **offline**: il messaggio scritto resta in attesa e parte al ritorno della rete; finché è in attesa l'invio di altri messaggi è spento; quiz e flashcard già generati funzionano senza rete (S19 `chat-offline`). | CONTESTO §3 (dati sul dispositivo); FUNZ §16; MECC §18 (errore «rete») | T-026 |
| 12 | Impostazioni → **Informazioni** mostra la **versione** dell'app (dalla build), come S20 Shell Desktop («v0.9»). | FUNZ §23 | T-032 |
| 13 | Statistiche · Panoramica come S20: **Focus** (ore e delta sul periodo precedente, barre per settimana), **Costanza** (giorni di fila con attività = streak, e record), **Sessioni** (numero di sessioni concluse e durata media), **Disciplina** (% dei blocchi del periodo completati sul totale dei programmati, anche per tipo), **Giorni con attività** (su 84, con mappa di calore), **Per corso** (unità fatte / totali e %). Efficienza del focus e puntualità d'avvio passano alla scheda Studio («Focus sul pianificato», «Puntualità»). | FUNZ §17.1; MECC §20 | T-029 |
| 14 | Voci aggiunte: **Notifiche** con «Segna tutte lette» (toglie il segno di novità dalle voci) e la sezione «Ieri · gestite» (notifiche del giorno prima già consegnate o gestite); **Impostazioni** con «Inizio settimana» (lunedì o domenica: decide la settimana della vista e la fine dell'orizzonte «settimana»), «Lingua delle risposte» (Automatica = lingua dell'ultimo messaggio, oppure una delle sei), «Svuota cache» (solo dati rigenerabili: cache della PWA e anteprime; mai dati dell'utente), «Reinstalla PWA» (solo web: deregistra il service worker e ricarica), elenco dei **dispositivi** con «Scollega» (revoca l'accesso di un altro dispositivo, che deve rientrare). | FUNZ §19, §21, §23, §24; MECC §6, §8, §18, §25 | T-022, T-026, T-032, T-033 |
| 15 | Su mobile il selettore di vista sono le tre icone Giorno · Settimana · Mese in alto a destra (D-UI-2). | FUNZ §2 | fatto (`Today.tsx`) |
| 16 | Menu del logo utente: Corsi · Esiti da registrare · Account e sincronizzazione · Impostazioni. La Diagnostica si apre da Impostazioni → Avanzate. | FUNZ §1 | fatto (`ProfileMenu.tsx`, rotta `/account`) |
| 17 | Widget Android come S13: mini mese (weekend attenuati, oggi in bianco, pallino del tipo prevalente del giorno), agenda di oggi, «Prossima: …» e «+» che apre «+ Crea». Niente sessione attiva, todo ad alta priorità né carte da ripassare. | FUNZ §18; MECC §21 | T-023 |
| 18 | S10: su desktop la card del corso non mostra il tempo dedicato (su mobile sì); nello stato vuoto desktop «Importa ZIP» sta a sinistra di «Carica esempio», come nel mock. | FUNZ §9.3 | fatto (`Courses.tsx`) |
| 19 | «+ Crea», evento con fine ≤ inizio: errore «La fine deve venire dopo l'inizio» e CTA spenta. Routine e routine di studio restano «finisce il giorno dopo». | MECC §2, §7 | fatto (`validateActivity`, `Create.tsx`) |
| 20 | «+ Crea», todo **senza data né corso**: parte da oggi; l'orizzonte (Giorno · Settimana · Mese) dice fin dove rotola. | MECC §2, §6; FUNZ §3 | fatto (`Create.tsx`) |
| 21 | Oggi mostra anche «Il tuo progresso oggi» (Completate x / y e % di oggi; Focus di oggi con «vs ieri»; Settimana: completate nella settimana), «Prossime attività» (i prossimi due giorni con attività, «Vedi tutte» apre la Settimana; vuoto: «Niente in programma nei prossimi giorni.») e, su mobile, l'archivio impilato delle completate in testa al giorno (si apre scorrendo in giù, «Raccogli» lo chiude). | FUNZ §2; MECC §24 | T-040 |
| 22 | Il saluto c'è solo su mobile; su desktop l'intestazione mostra il periodo e sopra la lista la data del giorno (S1 Desktop). | FUNZ §2 | già così (D-CAL-1) |
| 23 | Dettaglio S5 (T-009): la routine completata torna indietro con «Riapri», lo stesso controllo del todo del mock, senza un «Annulla spunta» a parte (scelta dell'utente del 25/09/2026). | nessuno: FUNZ §4.3 e MECC §3 («annulla spunta») restano soddisfatti da «Riapri»; B5 invariato | fatto (`Detail.tsx`, D-DETT-1) |
| 24 | Dettaglio S5 (T-009), follow-up di una fase saltata: il todo prende il titolo dall'etichetta della fase, senza un campo per l'utente; scade il giorno dell'evento, mai prima di oggi (regola nuova dell'utente, D-DETT-2), con la meta «solo <giorno>» al posto di «Nessuna scadenza · torna ogni giorno». | MECC §5, FUNZ §5 ed E1 allineati il 25/09/2026 su richiesta esplicita (D-DETT-2) | fatto (`Detail.tsx`, D-DETT-1, D-DETT-2) |
| 25 | Dettaglio S5 (T-009): «Modifica» e gli undici stati dello studio del mock; «Chiudi evento» per l'evento senza fasi; nessun tag sulle fasi dopo «Saltata». | FUNZ §4.4 dice «Completa evento» anche senza fasi (copy) | Modifica → T-042; studio → T-016/T-018; il resto fatto (`Detail.tsx`) |

**Fixture `course-data.js`** (FORMATO §0 lo dichiara «risultato atteso»; sostituisce D-PARSE-2): intestazione di
sezione verbatim («Teoria (Fondamenta)»); finestra indicativa con la nota fra parentesi dopo « · » senza i rimandi
«v. …» («settimane 8–11 · mini-modulo»); intro = primo paragrafo senza grassetto più la riga che introduce gli
obiettivi; testo del test di fit con i link ridotti al titolo (gli indirizzi restano nelle risorse). Spec allineata:
FORMATO §2–§3 e §5. Codice: fatto (`parser.ts`; `scripts/corso-esempio.test.mjs` confronta senza differenze annotate).

**Note interne al design** (colore dello studio blu/viola, valori fuori dai token, dati d'esempio inventati, «Quando
capita» in DESIGN.md ma non in S4, prefisso del mini progetto in S15): non contraddicono la spec; restano da segnalare a
Claude Design. Per il prefisso vale S11 Modulo con i dati del fixture (prefisso conservato).

## Modifiche alla spec (fatte il 25/09/2026)

Paragrafi elencati nella colonna «Paragrafi di spec allineati», più CONTESTO §2 (se il design diverge, vince il design)
e §3 (chat offline), e lo scenario D4 (il widget non mostra più la sessione). Scenari toccati:
**G3** (i blocchi persi si trascinano), **I4** (la Trivia ha punteggio e sbagliate), **A5** e **H3** nella parte sul widget (niente todo ad alta priorità né conteggio delle carte). I task elencati applicano le
regole nuove; nessun test esistente cita un paragrafo cambiato come vincolo contrario.

## Alternative scartate

- Seguire la spec e correggere i mock in Claude Design (era la regola fino al 25/09/2026).

## Conseguenze

- Cambiano D-CREA-1 (punti 4 e 5), D-CAL-1 (contenuti di Oggi), D-SAMPLE-1 (segnaposto M2–M4), D-TRIVIA-1 (sostituita),
  D-PARSE-2 (sostituita); nuovi task T-039, T-040, T-041.
- Lacune del design colmate con la scelta minima (n. 5, 10, 13, 14): vanno riviste se Claude Design le precisa.

## Verifica

`npm run verify`: `src/domain/activity.test.ts` (n. 19), `src/domain/course/parser.test.ts` e
`scripts/corso-esempio.test.mjs` (fixture); n. 3, 15, 16, 18 controllati con Edge headless a 390 e 1280.
