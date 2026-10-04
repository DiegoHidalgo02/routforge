# RoutForge — Handoff design → codice

*Dove il design entra nel progetto e che cosa deve trovare. Comportamento → `docs/spec/`; aspetto → il design
importato in `claude-design/`, riferimento solo dopo il suo handoff, che si scrive in questo file. Se design e spec
divergono vince il design (D-DESIGN-1): la divergenza si annota qui e l'utente decide come allineare la spec. Regole
d'implementazione della UI: `.claude/rules/ui.md`.*

## 0. Stato (04/10/2026)

- **Nessun design attivo.** Il vecchio export di Claude Design (importato il 24/09/2026: schermate `S*.dc.html`,
  `HANDOFF.md`, `DESIGN.md`, `tokens.css`) è stato rimosso dal repository (D-DESIGN-2): non è un riferimento per
  l'implementazione. Resta nella storia git, con la versione precedente di questo documento (inventario delle
  schermate e 38 divergenze): `git show 3c60512:claude-design/<file>`, `git show 3c60512:docs/03_HANDOFF_DESIGN_CODE.md`.
- **Prossima sessione**: prompt preparativo dell'utente → import del nuovo design via MCP (server `claude-design`) in
  `claude-design/` → confronto con spec, decisioni e codice (§1) → handoff in questo file → implementazione, con la
  prima schermata sottoposta a CP2 (`docs/06_SUPERVISIONE.md`).
- **All'handoff valgono gli invarianti già scritti**: i token del nuovo design entrano in `src/ui/styles/tokens.css` e
  il loro confronto torna nel gate (INV-20); se l'export porta un suo `course-data.js`, sostituisce quello di
  `src/data/sample-course/` (D-DESIGN-1, INV-19).
- **L'export si versiona così com'è** in `claude-design/` (D-DESIGN-1); si cambia in Claude Design e si reimporta, mai
  a mano. `.gitignore`, `.prettierignore` ed `eslint.config.js` lo escludono già (ZIP, formato, lint).

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
