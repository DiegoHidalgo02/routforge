---
paths:
  - "src/app/**"
---
# Regole per `src/app` (servizi applicativi)

- Importa da `data` e `domain`; mai da `ui` o `platform`. La piattaforma entra solo tramite le interfacce di
  `src/app/ports/`, iniettate nel costruttore del servizio (INV-1, D-ARCH-1).
- Un servizio orchestra: legge dai repository, chiama funzioni pure del dominio, scrive il risultato. Se una regola di
  business compare in un servizio, va spostata nel dominio (INV-13).
- `SchedulerService.run(now)` esegue i cicli nell'ordine vincolante di MECC §9 ed è idempotente: il test «seconda
  esecuzione senza cambiamenti non scrive nulla» è obbligatorio (INV-15).
- Il tempo arriva da una porta `Clock` o come parametro: mai `Date.now()` diretto, così i test usano istanti fissi.
- Gli scenari che coinvolgono servizi si verificano a questo livello con repository in memoria e porte finte; una riga
  di `docs/TRACCIABILITA.md` passa a `coperto` quando tutte le affermazioni dello scenario sono verificate al livello
  più basso che le contiene (dominio, servizio o UI).
- I fallimenti delle porte non fanno fallire il servizio: esito registrato in Diagnostica, mai eccezione verso la UI
  (CONTESTO §3, INV-16).
- Il contesto per l'AI e i file dell'utente si costruiscono qui con le esclusioni di MECC §17; la chiave AI passa solo
  alla porta del client AI (INV-17). Per questi servizi, e per backup e sync: `/security-review` prima di chiudere.
- Porta nuova, servizio nuovo o cambio di firma di una porta = alto impatto: revisione indipendente
  (`docs/05_LOOP_AGENTICO.md` §7).
