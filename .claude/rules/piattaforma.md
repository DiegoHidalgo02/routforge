---
paths:
  - "src/platform/**"
---
# Regole per `src/platform` (adapter nativi e web)

- Implementa le porte di `src/app/ports/`; importa da `app` (solo le porte) e da `domain`; mai da `ui` o `data` (INV-1).
- Nessuna regola di business: un adapter traduce una chiamata di porta in una chiamata di plugin o di API del browser,
  e basta.
- Ogni porta ha almeno un adapter web e uno nativo (Capacitor, se D-STACK-1 lo conferma); il web degrada senza errori
  dove la capacità manca: notifiche solo a scheda aperta, niente sveglie, niente Non Disturbare
  (`docs/02_ARCHITETTURA.md` §6).
- Un adapter non lancia eccezioni verso i servizi: registra l'errore per la Diagnostica e restituisce un esito
  (CONTESTO §3, INV-16).
- Vincoli noti da rispettare: id delle notifiche interi a 32 bit su Android, permesso «sveglie esatte» revocabile,
  Doze, archiviazione del browser rimovibile (`docs/02_ARCHITETTURA.md` §8).
- Codice nativo (Kotlin, Swift) e plugin nuovi sono task **R**: snapshot prima, checkpoint CP3, revisione indipendente.
