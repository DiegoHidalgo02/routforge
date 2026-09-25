# RoutForge — Tracciabilità degli scenari

*Una riga per ciascuno dei 54 scenari di `docs/spec/RoutForge_SCENARI.md`: regole che lo governano, dove vive
nel codice, task che lo realizzano, test che lo verificano, stato. È la mappa requisito → architettura → task → test.
Verificata dal gate (`scripts/tracciabilita.test.mjs`, invarianti INV-6 e INV-7): ogni scenario ha una riga con
almeno un task esistente; un test che nomina uno scenario ("SCENARI B2") deve comparire nella sua riga; una riga
`parziale` o `coperto` deve citare test esistenti che lo nominano.*

**Colonne.** *Regole*: paragrafi di MECCANISMI (MECC) o FORMATO_CORSO. *Dove*: strato/modulo previsto da
`docs/02_ARCHITETTURA.md`, esistente o da creare nel task indicato (nomi di file in inglese, D-NAMING-1; le schermate con il nome del design). *Stato*: `nessuno` (nessun test) ·
`parziale` (alcune affermazioni verificate, di norma solo a livello di dominio) · `coperto` (tutte le affermazioni
dello scenario verificate, dichiarato alla chiusura del task che lo completa).

**Come si aggiorna.** Chi chiude un task aggiorna le righe dei suoi scenari: aggiunge i file di test, alza lo stato.
Un test nuovo che cita uno scenario obbliga ad aggiornare la riga (il gate lo ricorda).

| Scenario | Regole | Dove | Task | Test | Stato |
|---|---|---|---|---|---|
| A1 | MECC §6, §13.6 | domain/lost (marcatura) · domain/scheduler/horizon · app/notifications (one-shot) · ui Oggi | T-001, T-012, T-020 | src/domain/lost.test.ts | parziale |
| A2 | MECC §4, §6 | domain/scheduler/horizon (slot libero) · domain/lost · app/scheduler | T-001, T-012 | src/domain/lost.test.ts | parziale |
| A3 | MECC §3, §4 | domain/checklist · app/notifications · ui Dettaglio | T-009 | — | nessuno |
| A4 | MECC §13.5 | domain/notifications/digest · app/notifications | T-020 | — | nessuno |
| A5 | MECC §2, §6, §21, §24 | domain/ordering · ui Oggi · platform/widget | T-007, T-008, T-023 | — | nessuno |
| B1 | MECC §7 | domain/scheduler/occurrences · app/scheduler | T-011, T-013 | — | nessuno |
| B2 | MECC §3, §8 | domain/lost (finestra di spunta, marcatura) · ui Dettaglio | T-001, T-009 | src/domain/lost.test.ts | parziale |
| B3 | MECC §3, §7, §8, §14 | domain/lost · domain/scheduler/occurrences (fine ≤ inizio → giorno dopo) | T-001, T-011 | src/domain/lost.test.ts | parziale |
| B4 | MECC §7, §8, §20 | domain/lost · domain/scheduler/occurrences · domain/stats | T-001, T-011, T-029 | src/domain/lost.test.ts | parziale |
| B5 | MECC §5 | domain/phases · data (tabella logFasi) · ui Dettaglio | T-009 | — | nessuno |
| B6 | MECC §7, §13.3 | domain/scheduler/occurrences (modifica) · app/notifications | T-011, T-019 | — | nessuno |
| B7 | MECC §8, §13.2, §13.6, §20 | domain/lost (scadenza di recupero) · app/scheduler · app/notifications · domain/stats | T-001, T-013, T-020, T-029 | src/domain/lost.test.ts | parziale |
| C1 | MECC §11, FORMATO §4 | domain/pointer | T-001 | src/domain/pointer.test.ts | parziale |
| C2 | MECC §11, §12 | domain/pointer (progresso) · domain/streak · app/session | T-001, T-018 | src/domain/pointer.test.ts, src/domain/streak.test.ts | parziale |
| C3 | MECC §11 | domain/pointer · app/session | T-001, T-018 | src/domain/pointer.test.ts | parziale |
| C4 | MECC §10.1 | app/session (setup, anticipo) | T-016 | — | nessuno |
| C5 | MECC §10.1, §20 | app/session (recupero, ritardo) · domain/stats | T-016 | — | nessuno |
| C6 | MECC §8, §11 | domain/lost (esiti pendenti) · app/session (Registra esito) · ui Notifiche | T-001, T-018, T-022 | src/domain/lost.test.ts | parziale |
| C7 | MECC §11 | app/session (blocco retroattivo) · domain/pointer | T-018 | — | nessuno |
| C8 | MECC §8, §9 | app/scheduler (orfani) · app/session (abbandono) | T-013 | — | nessuno |
| C9 | MECC §7, §10.1, §11, §12 | app/session (setup senza corso) · domain/pointer | T-016, T-018 | — | nessuno |
| D1 | MECC §10.2, §13.6 | domain/session/timer (ancorata all'orologio) | T-017 | — | nessuno |
| D2 | MECC §10.2 | domain/session/timer (ancorata al focus) | T-017 | — | nessuno |
| D3 | MECC §10.3 | domain/pomodoro · app/session (cambio unità) | T-001, T-017 | src/domain/pomodoro.test.ts | parziale |
| D4 | MECC §10.4, FUNZ §11.2 | app/session (persistenza in preferenze) · platform/widget | T-017 | — | nessuno |
| D5 | MECC §10.4, §20 | app/session (iperfocus) · platform/doNotDisturb · domain/stats | T-017, T-029 | — | nessuno |
| D6 | MECC §10.1 | app/session (una sola sessione) | T-016 | — | nessuno |
| E1 | MECC §3, §5 | domain/phases (follow-up) · ui Dettaglio | T-009 | — | nessuno |
| E2 | MECC §3, §8, §20 | domain/lost (evento mai perso) · domain/stats | T-001 | src/domain/lost.test.ts | parziale |
| E3 | MECC §13.2, §14, §24 | domain/nowBlock · domain/notifications (08:00) | T-001, T-010 | src/domain/nowBlock.test.ts | parziale |
| F1 | MECC §13.1–§13.3 | domain/notifications/desiredSet · app/notifications | T-019 | — | nessuno |
| F2 | MECC §13.1, §13.2, §21 | domain/notifications (sveglie) · platform/alarms | T-019, T-021 | — | nessuno |
| F3 | MECC §13.4, §13.6 | domain/notifications/quietHours | T-020 | — | nessuno |
| F4 | MECC §13.3 | domain/notifications (finestra 14 gg) · app/notifications | T-019 | — | nessuno |
| F5 | MECC §13.2, §13.4 | domain/notifications (posticipa) · app/notifications | T-020 | — | nessuno |
| F6 | MECC §3, §13.1, §13.3 | app/notifications (riconciliazione) | T-019 | — | nessuno |
| G1 | MECC §14 | domain/nowBlock · ui Oggi | T-001, T-010 | src/domain/nowBlock.test.ts | parziale |
| G2 | MECC §14 | domain/nowBlock (chiusura) · ui Oggi | T-001, T-010 | src/domain/nowBlock.test.ts | parziale |
| G3 | MECC §15 | ui Oggi (trascinamento) · domain/scheduler/horizon (slot) · app/notifications | T-015 | — | nessuno |
| G4 | MECC §9 | app/scheduler (cambio giorno ogni 60 s) · ui Oggi | T-013 | — | nessuno |
| H1 | MECC §16, FORMATO §1 | domain/course/parser · app/courseImport (ZIP) · ui Corsi S10 (import salvato, avvisi) | T-002, T-003, T-038 | src/domain/course/parser.test.ts, src/app/courseImport.test.ts | coperto |
| H2 | MECC §17, §18 | app/materials (PDF) · app/ai (contesto) | T-024 | — | nessuno |
| H3 | MECC §16, §21 | app/courses (eliminazione a cascata) · platform/widget | T-037, T-023 | — | nessuno |
| H4 | MECC §18 | app/ai (lingua della risposta e della pratica) | T-026 | — | nessuno |
| H5 | MECC §18 | domain/ai/validation · app/ai | T-027 | — | nessuno |
| I1 | MECC §19 | domain/sm2 · ui flashcard | T-001, T-027 | src/domain/sm2.test.ts | parziale |
| I2 | MECC §18 | domain/practice (DevSwipe) · ui pratica | T-001, T-028 | src/domain/practice.test.ts | parziale |
| I3 | MECC §18 | domain/practice (Bug Hunter) · ui pratica | T-001, T-028 | src/domain/practice.test.ts | parziale |
| I4 | MECC §18 | app/trivia · platform/tts | T-028 | — | nessuno |
| J1 | MECC §25 | domain/sync/merge · app/sync · app/notifications | T-033 | — | nessuno |
| J2 | MECC §7, §25 | domain/sync/merge (ultimo-vince) · app/scheduler dopo la ricezione | T-033 | — | nessuno |
| J3 | MECC §25 | app/sync (impronta del corso) · domain/pointer | T-033, T-034 | — | nessuno |
| J4 | MECC §25 | domain/sync/merge (primo accesso) · app/sync | T-033 | — | nessuno |
| J5 | MECC §25 | app/sync (uscita dall'account) | T-033 | — | nessuno |
