# D-ARCH-1 — Architettura a strati con dominio puro

**Stato**: applicata (22/09/2026); verificata dal gate dal 24/09/2026. Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto

CONTESTO §3 chiede che i meccanismi (scheduler, esiti e puntatore, notifiche, SM-2, checklist, fasi, parser, sync)
siano verificabili in isolamento e che ogni ciclo dello scheduler sia idempotente. Le stesse regole devono girare su
Android, iOS e web, con capacità native diverse per piattaforma. Il codice è scritto da più modelli in sessioni diverse.

## Decisione

Cinque strati con direzione di dipendenza fissa: `ui → app → data → domain`; `platform` implementa le porte
definite in `src/app/ports` ed è iniettato nei servizi. `domain` non importa nulla, non legge l'orologio, non fa I/O:
il "now" è un parametro. Le capacità native esistono per i servizi solo come interfacce.

## Motivazione

- Le regole si testano con istanti fissi in qualsiasi fuso; i servizi con repository in memoria e adapter finti.
- Lo stack UI e la persistenza possono cambiare senza toccare le regole (D-STACK-1 è ancora aperta).
- Un confine verificato da un test resiste alla deriva fra agenti meglio di un confine solo scritto.

## Alternative considerate

- Logica nei componenti UI: non testabile in isolamento, legata al framework.
- Due soli strati (UI più tutto il resto): la piattaforma contaminerebbe le regole; test lenti, su dispositivo.
- Monorepo con un pacchetto per strato: confini più rigidi, ma costo di build e tooling non giustificato da un solo prodotto.

## Conseguenze

- Ogni capacità nativa nuova nasce come porta in `src/app/ports` più un adapter web e uno nativo (INV-1).
- Gli scenari end-to-end si verificano a livello di servizio con porte finte: è il banco di prova dei 54 scenari.
- Un nuovo strato o un'eccezione alla direzione richiede l'aggiornamento di `DIPENDENZE_AMMESSE` in
  `scripts/architettura.test.mjs` e una decisione registrata.
- Il dominio non usa API di piattaforma neppure «innocue» (`URL`, `TextEncoder`): funzioni pure al loro posto
  (es. `hostOf` del parser). La lib TypeScript della radice è `ES2022` senza `DOM` (D-TS-1).

## Verifica

`scripts/architettura.test.mjs` (INV-1, INV-2, INV-3); `tsconfig.json`.
