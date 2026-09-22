# RoutForge — Supervisione: pochi checkpoint, ma importanti

*L'agente lavora da solo su tutto ciò che le spec decidono. L'utente interviene solo qui.*

## Checkpoint (l'agente scrive `CHECKPOINT: <id>` in `docs/STATO.md` e si ferma)

| ID | Quando | Cosa decide l'utente | Default se non risponde |
|---|---|---|---|
| **CP1 Stack** (informativo) | Alla chiusura di T-000 (dopo l'import del design) | Nulla da approvare: lo stack lo sceglie l'agente e lo motiva in `docs/01_DECISIONI.md` (D-STACK-1). L'utente legge la decisione in `docs/STATO.md` e può porre il veto prima di T-006 | La decisione dell'agente vale |
| **CP2 Prima schermata** | Dopo T-008 (Oggi) | Approvazione visiva rispetto a S1 Oggi (mobile+desktop) e divergenze design↔spec | Non si passa oltre finché non approvata |
| **CP3 Nativo** | Prima di T-021 (notifiche native/sveglie) e T-023 (widget) | Android Studio installato? Dispositivo di test? iOS rinviato (serve un Mac)? | Solo Android; iOS rinviato |
| **CP4 Sync** | Prima di T-033 | Backend (Supabase o altro), progetto/chiavi, cifratura della chiave Gemini | Nessun default: senza risposta il passo 10 resta fermo |
| **CP5 AI** | Prima di T-026 | Chiave Gemini di test per verificare chat/generazione (mai nel repo) e conferma D-QUIZ-1 | Test con mock; D-QUIZ-1 applicata |
| **CP6 Release** | Dopo T-035 | Firma APK, nome/icona definitivi, deploy della PWA | — |

## Cosa NON richiede intervento

Scelte interne coerenti con le spec (nomi, struttura dei file, ordine dei test), correzioni di bug, refactor entro il diff del task, aggiornamento dei documenti, dipendenze già elencate in `docs/02_ARCHITETTURA.md`.

## Cosa deve fermare sempre l'agente

Perdita di dati possibile (migrazioni distruttive, import/backup), modifiche a `docs/spec/`, dipendenze non previste, comandi git distruttivi, informazioni mancanti non deducibili (`BLOCCO:`), tre fallimenti consecutivi del gate sullo stesso task.

## Ritmo consigliato

- Ogni sessione: 1–3 task, chiusi con `npm run verify` verde e commit.
- Fine passo (CONTESTO §6): revisione indipendente (Codex) + `spec-reviewer` sull'intero passo, poi checkpoint se previsto.
- Ogni ~10 task: `/graphify .` e `/handoff`.
