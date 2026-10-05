# RoutForge — Handoff design → codice

*Dove il design entra nel progetto e che cosa deve trovare. Comportamento → `docs/spec/`; aspetto → il design
importato in `claude-design/`, riferimento solo dopo il suo handoff, che si scrive in questo file. Se design e spec
divergono vince il design (D-DESIGN-1): la divergenza si annota qui e l'utente decide come allineare la spec. Regole
d'implementazione della UI: `.claude/rules/ui.md`.*

## 0. Stato (05/10/2026)

- **Design importato** (D-DESIGN-3). Il progetto Claude Design «RoutForge product design»
  (`https://claude.ai/design/p/8acfd054-2d68-41a6-8623-3f201d476f98`) è in `claude-design/` così com'è: 59 file di
  testo copiati via MCP (`read_file`) e verificati sui byte dichiarati da `list_files`; `.thumbnail` (binario) non è
  importato. Il pacchetto è scritto per stare alla radice di un repository: qui la sua radice è `claude-design/`, quindi
  i percorsi che cita si leggono con quel prefisso (`HANDOFF.md` → `claude-design/HANDOFF.md`, `docs/BLOCCHI.md` →
  `claude-design/docs/BLOCCHI.md`, `design/tokens.css` → `claude-design/design/tokens.css`). Punto d'ingresso:
  `claude-design/HANDOFF.md`; decisioni vincolanti del design: `claude-design/CLAUDE.md` (vincono sulla spec, CONTESTO
  §2); punti non definiti: `claude-design/docs/BLOCCHI.md`; specifica operativa: `claude-design/docs/`.
- **Spec allineate**: le quattro spec del pacchetto (`claude-design/spec/`) sostituiscono `docs/spec/` (INV-5,
  richiesta dell'utente del 05/10/2026); `RoutForge_FORMATO_CORSO.md`, M0, M1 e `course-data.js` restano quelli del
  repository: il BLOCCO 3 del pacchetto è risolto qui (`docs/spec/`, `src/data/sample-course/`), e
  `claude-design/design/course-data.js` è identico a `src/data/sample-course/course-data.js` (INV-19). Ciò che cambia
  rispetto al codice e alle decisioni è in §2.
- **Prossimo passo**: l'handoff per schermata in questo file (schermata → file del design → task), con il prompt
  preparativo dell'utente adattato al repository; la prima schermata implementata va al CP2 (`docs/06_SUPERVISIONE.md`).
  Finché una schermata non è mappata qui, il suo riferimento visivo non è attivo.
- **All'handoff valgono gli invarianti già scritti**: i token del nuovo design (`claude-design/design/tokens.css`)
  entrano in `src/ui/styles/tokens.css` e il loro confronto torna nel gate (INV-20).
- **L'export si versiona così com'è** in `claude-design/` (D-DESIGN-1); si cambia in Claude Design e si reimporta, mai
  a mano. `.gitignore`, `.prettierignore` ed `eslint.config.js` lo escludono già (ZIP, formato, lint). I `.dc.html`
  caricano React 18 e i font da internet solo per l'anteprima dei mock: non è prodotto.

## 1. Da confrontare con il nuovo design (inventario al 04/10/2026)

Non sono requisiti nuovi: sono fatti del progetto attuale che il confronto deve coprire. Dove il nuovo design li
contraddice decide l'utente (D-DESIGN-1).

**Schermate e rotte del codice** (`src/ui/App.tsx`, costruite sul vecchio design): Oggi `/` (Giorno · Settimana · Mese,
striscia, fascia senza orario, blocco Adesso, trascinamento, ritorno dopo un'assenza) · «+ Crea» `/crea` (quattro tipi)
· Dettaglio `/attivita/:id` (spunta, checklist, fasi, follow-up, esito) · Corsi `/corsi` (elenco, import ZIP, corso di
esempio) · Sessione `/sessione/setup` e `/sessione` (setup, timer, iperfocus, sheet di chiusura con gli esiti, banner e
card nella sidebar) · shell con BottomNav sotto 1024 px e sidebar da 1024 (D-UI-1), menu del logo utente. Con la sola
intestazione: Statistiche, Notifiche, Impostazioni, Account, Diagnostica. «+ Crea» e Dettaglio si aprono anche sopra la
schermata di partenza.

**Schermate senza task nel backlog**: dettaglio del corso, modulo (criteri Go/No-Go manuali) e unità (concetto core,
sezioni, video, «Inizia sessione» dall'unità): FUNZ §4.2, §9.2, §11.1; FORMATO §4. Le schede Materiale · AI · Note del
timer (FUNZ §11.2): Materiale e AI dipendono da T-024 e T-026, Note non ha un task. Rotte previste dal vecchio handoff
e non ancora nel codice: `/corsi/:id`, `/moduli/:id`, `/unita/:id`, `/ai`, `/pratica/:id` (servono anche ai
collegamenti diretti di MECC §21). I task nascono con l'handoff.

**Regole adottate dal vecchio design** (D-DESIGN-1 n. 1–25): per ciascuna la regola e i paragrafi di spec allineati
nella tabella di `docs/decisioni/D-DESIGN-1.md`; la n. 25 resta una differenza di testo con FUNZ §4.4 («Chiudi evento»
nel codice, «Completa evento» nella spec). Le scelte minime dove quel design taceva sul comportamento (n. 5 ricerca, 10
Trivia, 13 Panoramica delle statistiche, 14 voci di Notifiche e Impostazioni) si rivedono se il nuovo design le precisa.

**Scelte dell'utente su aspetto e interazione**, prese contro o accanto al vecchio mock: D-UI-2 (tre icone di vista su
mobile), D-NOW-3 (colori del blocco Adesso dal tipo), D-CAL-2 (aloni dei pallini, card in corso, Mese con la griglia
anche vuoto, periodo che entra dal lato dello scorrimento), D-DETT-1 («Riapri» per la routine completata). D-DETT-3
(spunta diretta dal cerchio della card) è comportamento (MECC §3, §24): il nuovo design deve offrirla. Chiuso sulla spec
contro il mock il 02/10/2026: l'unità del recupero non si cambia nel setup (D-SESS-1 n. 6).

**Elementi che il vecchio design non disegnava**. Fatti con i token esistenti: riga «Altro anticipo · fino a 31
giorni» in «+ Crea» (D-NOTIF-1); avviso dell'intervallo non verificato nel timer con «Conta nel focus» (D-TIMER-2);
«Chiudi come Continua (n%)» nello sheet di chiusura e il testo della schermata finale (D-SESS-2); «Abbandona · nessun
esito» nello sheet di chiusura (D-ESITO-1); «Registra esito» dal Dettaglio nello stesso sheet (D-ESITO-1); sheet «Voci
non spuntate» (D-DETT-2); stati del setup e del timer senza mock («Cambia unità» aperto, «Salta segmento» spento
sull'ultimo segmento, iperfocus spento col cronometro, card della sessione nella sidebar) e iperfocus sopra tutta la
finestra, sidebar compresa (vecchio §10 n. 33, D-TIMER-1); banner del ritorno dopo un'assenza su desktop
(D-ASSENZA-1). Da fare con T-032: digest del mattino in una riga propria di Impostazioni → Notifiche, nessuna card «Ore
silenziose» (D-NOTIF-3).

**Segnalazioni aperte sul vecchio design**: maniglia di trascinamento sotto il contrasto 3:1 dei componenti; «Annulla»
d'azione (Undo) non distinto dall'«Annulla» dei form; nessun token per il fondo della testa del timer nel tempo extra;
focus visibile assente dai mock; il testo del ritorno dopo un'assenza («…, i todo sono a oggi», chiave
`ritornoAssenza`) può essere falso per MECC §6, perché i todo con orizzonte giorno o scaduto restano «non fatti» nel
loro giorno.

**Dipendenze del codice dal vecchio design**: `src/ui/styles/tokens.css` (copia del vecchio export, da non modificare
a mano; INV-20 sospeso), font `@fontsource/manrope` e `@fontsource/ibm-plex-mono`, icone `lucide-react` col tratto
1.75 (D-STACK-1), `src/ui/Logomark.tsx`, voce dei testi (`PRODUCT.md`, `src/ui/i18n/`), eccezione di
`.impeccable/config.json` su `src/ui/Detail.module.css`. Le sigle S1…S22 in commenti, test, task fatti, decisioni e
nella colonna «Dove» di `docs/TRACCIABILITA.md` nominano le schermate del vecchio export: sono storia, finché
l'handoff non dà i nomi nuovi.

**Backlog**: i task aperti di `docs/TASKS.md` descrivono il comportamento; la loro parte visiva arriva con l'handoff,
che mappa le schermate nuove sui task.

## 2. Che cosa cambia rispetto al codice e alle decisioni (confronto delle spec, 05/10/2026)

Dal diff fra le spec del repository (30/09/2026) e quelle del pacchetto, più `claude-design/CLAUDE.md`. Decisione:
D-DESIGN-3. Ogni voce è un task nuovo o ritocca un task esistente; l'handoff per schermata aggiunge il resto.

| Dove | Oggi nel codice | Nuovo design | Task |
|---|---|---|---|
| Adesso (MECC §14, FUNZ §2; G1, G2) | blocco separato `NowBlock` con ×, `preferenze.adessoChiuso`, variante compressa (T-010, D-NOW-2) | la card dell'attività in corso o imminente cresce a hero nella lista, al suo orario, per ogni tipo; nessuna chiusura; «Giornata chiusa» | T-048 |
| Trascinamento (MECC §15, FUNZ §2; G3) | todo senza orario → orario o giorno, persi riprogrammati, aggancio a 5', «Annulla» (T-015, D-DRAG-1) | solo riordino dei todo senza orario nella stessa priorità; frecce su desktop, tasti su mobile; ordine persistito e sincronizzato | T-044 (riscritto); il trascinamento di T-015 si toglie |
| Cerchio della card (MECC §3, §4, §24; A3, A7, C10) | todo e routine (D-DETT-3), sheet «Voci non spuntate» (D-DETT-2) | tutti i tipi: evento, studio con «Registra esito» (minuti = durata pianificata); «Voci rimaste»; archivio col trascinamento senza «Raccogli», «Completate», toast con «Annulla» 5 s | T-049 |
| Crea (MECC §2, FUNZ §3; G5) | data libera, × nel foglio (T-007, D-CREA-1) | giorno di partenza = selezionato entro oggi + 6; attività solo nei prossimi 7 giorni; nessuna ×; animazione di conferma e toast con «Annulla» | T-050 |
| «Segna fatto» da notifica (MECC §4, §13.2; A6) | azione nativa non ancora collegata (T-021) | con voci aperte apre il Dettaglio su «Voci rimaste»; senza, completa in background | T-051 (dopo T-021) |
| Sveglie (MECC §13.1 n. 4, FUNZ §7.3; F7) | `sveglia` è un attributo della voce (D-NOTIF-1): verificare che verifica, esito e one-shot non la ereditino | verifica, esito e avvisi una tantum non sono mai sveglie; tasto principale della sveglia nel fill del tipo | T-019 (test F7), T-021 |
| Ricerca (FUNZ §1, CONTESTO §5) | T-039 aperto (D-DESIGN-1 n. 5) | nessuna ricerca | T-039 annullato |
| Navbar e intestazione (FUNZ §1) | pill «Oggi» nell'intestazione e nel Mese (T-043) | su mobile «Oggi» della barra in basso riporta a oggi; nessun tasto «Oggi» nell'intestazione né nel Mese; su desktop «Oggi» fra le frecce | handoff di S1 |
| Fine sessione (FUNZ §12; S15 `done`) | schermata finale di T-018 e T-046 | «Giorni di fila 13 · +1», «Torna a Oggi», «Riduci» | handoff di S15 |
| Celebrazioni e percentuali (FUNZ §23; `claude-design/CLAUDE.md`) | — | sobria (default) · piena · off; percentuali con lo spazio («38 %») | T-032, i18n |
| Schermate senza codice | — | S8 sveglia, S9 notifiche di sistema, S11 e S12 (corso, modulo, unità), S13 PDF e widget, S19 AI, S20 statistiche, S21 notifiche, S22 impostazioni | i task del backlog (T-021–T-032) e quelli che nascono dall'handoff |

**Blocchi del pacchetto** (`claude-design/docs/BLOCCHI.md`): 1 (creazione su desktop) e 2 («Registra esito» dal
cerchio su desktop) hanno un comportamento provvisorio scritto lì, da seguire; 3 è risolto dai file del repository;
4 sono D-SYNC-1, D-BACKUP-1, la cifratura della chiave (CP4) e D-QUIZ-1 (CP5), già aperte qui.

**Scelte dell'utente da riconfermare sul nuovo design**: D-UI-2 (icone di vista), D-NOW-3 (colori di Adesso dal tipo:
il design ha la card per tipo), D-CAL-2 (aloni, card in corso, Mese vuoto), D-DETT-1 («Riapri»: la spec ora cita anche
«Annulla» nel toast). Il vocabolario italiano dei mock e di `claude-design/docs/TESTI.md` sostituisce quello del
vecchio design nelle sei lingue (T-031).

**Test del vecchio design che restano verdi ma descrivono il comportamento superato** (da riscrivere col loro task):
`src/domain/drag.test.ts`, `src/app/drag.test.ts`, `src/ui/Today.test.tsx` (vecchio G3 → T-044);
`src/domain/nowBlock.test.ts`, `src/app/nowBlock.test.ts` (chiusura del vecchio G2 → T-048).
