# RoutForge — Supervisione: pochi checkpoint, ma importanti

*L'agente lavora da solo su tutto ciò che le spec decidono. L'utente interviene solo qui.*

## Checkpoint (l'agente scrive `CHECKPOINT: <id>` in `docs/STATO.md` e si ferma)

| ID | Quando | Cosa decide l'utente | Default se non risponde |
|---|---|---|---|
| **CP0 Tempo** | **Deciso il 24/09/2026** | Ora locale di parete: al cambio di fuso le attività future restano alla stessa ora e si riancorano (D-TIME-2, `docs/decisioni/D-TIME-2.md`). Marcatori tolti da T-004 e T-011 | — |
| **CP1 Stack** (informativo) | **Decisione scritta il 24/09/2026** alla chiusura di T-000: candidato A (React 19 + Vite PWA + Capacitor), `docs/decisioni/D-STACK-1.md` | Nulla da approvare: l'utente legge la decisione in `docs/STATO.md` e può porre il veto prima di T-006 | La decisione dell'agente vale. **Chiuso il 25/09/2026**: nessun veto, T-006 avviato con D-STACK-1 |
| **CP2 Prima schermata** | **Approvato il 25/09/2026** dall'utente (dopo T-008, provato dal telefono) | Approvazione visiva rispetto a S1 Oggi (mobile+desktop) e divergenze design↔spec. Marcatori tolti da T-009, T-010 e T-040; T-040 cambierà ancora S1 | Non si passa oltre finché non approvata |
| **CP3 Nativo** | **Deciso il 02/10/2026** dall'utente (D-NATIVO-1) | Android Studio con SDK installato, telefono Android di prova e Mac disponibili: si costruiscono **sia Android sia iOS** (default «solo Android, iOS rinviato» scartato). Marcatori tolti da T-021 e T-023; T-036 da `bloccato` ad `aperto`, dopo T-035 come nel backlog | — |
| **CP4 Sync** | Prima di T-033 | Backend (Supabase o altro), progetto/chiavi, cifratura della chiave Gemini, sorgente dell'orologio per `updatedAt` (D-SYNC-1), chiave Gemini nel file di backup (D-BACKUP-1) | Nessun default: senza risposta il passo 10 resta fermo |
| **CP5 AI** | Prima di T-026 | Chiave Gemini di test per verificare chat/generazione (mai nel repo) e conferma D-QUIZ-1 | Test con mock; D-QUIZ-1 applicata |
| **CP6 Release** | Dopo T-035 | Firma APK, nome/icona definitivi, deploy della PWA | — |

Quando l'utente risponde, l'agente registra la decisione in `docs/01_DECISIONI.md` (e nella scheda in `docs/decisioni/`, se esiste), toglie il marcatore **CPn** dalle righe dei task in `docs/TASKS.md`, cancella la riga `CHECKPOINT:` da `docs/STATO.md` e riprende. Il loop semi-autonomo (`scripts/prossimo-task.mjs`) non avvia un task finché il marcatore **CPn** è sulla sua riga.

## Cosa NON richiede intervento

Scelte interne coerenti con le spec (nomi, struttura dei file, ordine dei test), correzioni di bug, refactor entro il diff del task, aggiornamento dei documenti, dipendenze già registrate come `prevista` in `docs/DIPENDENZE.md`.

## Cosa deve fermare sempre l'agente

Perdita di dati possibile (migrazioni distruttive, import/backup), modifiche a `docs/spec/`, dipendenze non registrate in `docs/DIPENDENZE.md` (il gate le segnala), comandi git distruttivi, informazioni mancanti non deducibili (`BLOCCO:`), tre fallimenti consecutivi del gate sullo stesso task.

## Modifiche ad alto impatto (senza checkpoint, ma con revisione)

Confini fra strati, `src/domain/types.ts`, schema di persistenza, porte di `src/app/ports`, modello delle notifiche, sync, sicurezza: prima del commit una revisione indipendente da chi ha scritto il codice (`docs/05_LOOP_AGENTICO.md` §7). Non serve l'utente, serve un secondo paio d'occhi.

## Ritmo consigliato

- Ogni sessione: 1–3 task, chiusi con `npm run verify` verde e commit.
- Fine passo (CONTESTO §6): revisione indipendente (Codex) + `spec-reviewer` sull'intero passo, poi checkpoint se previsto.
- Ogni ~10 task: `/graphify .` e `/handoff`.
