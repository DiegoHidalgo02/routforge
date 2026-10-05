# RoutForge — Componenti

Inventario dei componenti da costruire. Per ciascuno: dove vederlo nei mock (file, stato, `data-screen-label`), varianti e stati, rimando a DESIGN. Misure e colori in DESIGN §5–§6 e `tokens.css`; comportamento in `docs/CONTROLLI.md`; stati in `docs/STATI.md`. I nomi sono di lavoro: se il repository ne ha già, valgono quelli.

## 1. Primitivi

| Componente | Nel mock | Varianti e stati | DESIGN |
|---|---|---|---|
| Button | specimen; footer di S4, S5, S15 | primary · secondary · ghost · danger; 44 e 36; hover, premuto, disabilitato, caricamento | §5, §10 |
| IconButton | header di ogni schermata | 40–44 circolare; variante indietro; `aria-label` obbligatoria | §5 |
| FAB | BottomNav | 44 primary | §5 |
| Chip / Badge | card e liste | badge di tipo (soft + ink), badge primary, chip selettore (selezionato bianco), chip-cite r6 | §5 |
| SectionTag | S11 Modulo, S12 | Teoria · Studio · Pratica · Mini progetto | §5 |
| Checkbox e cerchio di completamento | S5 checklist, S11 Go/No-Go, card di S1 | da fare · spuntato · non interattivo (criterio automatico) | §5 |
| Toggle | S4, S15 setup, S22 | on · off; in S22 on è verde | §5, CONTROLLI regola 4 |
| Field · Select · Textarea | S4, S12 form dei materiali, S22 accesso | a fuoco con l'ink del tipo (S4) o primary; errore | §5 |
| Segmented | S1 desktop (vista), S1 settimana, S20 periodo | selezionato bianco | §6 |
| Row | S22, S11, menu account | 44 · 48 con sub · 56 modulo e unità; valore a destra; chevron; danger | §5 |
| LinkRow / ResourceRow | S11 Modulo, S12 | icona per dominio; link esterno | §5 |
| MetaRow | S5, S12 | icona 14 e testo; cifre in font-num | §5 |
| OutcomeRow | S5, S15 `done` | success-soft; varianti in corso (primary-soft) e grigia | §5 |
| Toast | S5 `view=deleted` e creazioni | con Annulla per 5 s; pallino teal (creazione) o text-2 (eliminazione) | §4 |
| Spinner | S12 `genState=loading` | 16 `rf-spin` nel bottone | §10 |
| Riquadro d'errore | S10 `error`, S12 `material=pdf-big` e `genState=error`, S19 `chat-error` | titolo, dettaglio, azione | §6, §10 |
| InlineConfirm | S22 `account-erase` · `backup-erase` | Annulla ghost + danger | §10 |
| EmptyState | S1 `variant=empty`, settimana e mese vuoti, S10 `empty`, S21 `empty`, S19 `chat-history-vuota` · `flashcard-done` | testo 15 e 13, un'azione | §6 |

## 2. Cornici

| Componente | Nel mock | Varianti e stati | DESIGN |
|---|---|---|---|
| BottomNav | S1 Mobile, S10 Mobile, S20 Shell Mobile | Oggi · FAB Crea · Statistiche; voce attiva bianca | §6 Navigazione mobile |
| Sidebar | S1, S10, S15, S20 Desktop | voce attiva primary-soft; Crea; carta Sessione in corso; account in fondo | §6 Navigazione desktop |
| HeaderRoot | S1 Mobile «Intro greeting» | saluto → data (`rf-swap`); tre pulsanti di vista | §6 |
| HeaderDetail | S5, S10–S12, S20 | indietro, titolo, un'azione | §6 |
| AccountMenu | S1 Mobile `menu`, «Menu account» | voci con icona; badge degli esiti | — |
| SessionShell | «SessionShell banner» (S1, S10, S20 Mobile) · «Sessione in corso (sidebar)» (Desktop) | banner 44 sticky · carta della sidebar | §5 |
| AbsenceBanner | S1 `absence`, «Ritorno dopo assenza» | Chiudi | §5 |
| Sheet | S4 Mobile, S5 Mobile, debrief di S15, conferma di S11 | maniglia, footer fisso con ombra | §6 |
| SidePanel 440 | S4 Desktop, S5 Desktop | r16 | §6 |

## 3. Oggi (S1)

| Componente | Nel mock | Varianti e stati | DESIGN |
|---|---|---|---|
| ActivityCard | timeline di S1 | da fare · in spunta · in corso · completata · persa o saltata · sollevata · in riordino; todo senza orario con priorità e maniglia-controllo 36×44 | §5 Card attività |
| HeroCard (Card Adesso) | «Card Adesso (hero)» | eyebrow Adesso · Tra poco · Da recuperare; studio con play 48, todo · routine · evento con cerchio 28 che si spunta (`nowKind`); titolo max 2 righe; entrata `rf-hero-in` e `rf-hero-ring` | §5 |
| DayClosedCard | «Giornata chiusa» | card di pagina: testa con disco 40, «La tua giornata» con fascia, barra 8 `rf-seg`, legenda a due colonne, riga Domani 60 | §5 |
| EsitoSheet | S1 «Registra esito (da Oggi)» `sheet=esito` | quattro esiti a scelta singola, «Registra esito» spento senza scelta | §6 Cerchio = conferma |
| Timeline | S1 Mobile e Desktop | linea, pallini, ora; fascia senza orario in cima (mobile) o in coda (desktop) | §6 |
| ArchiveDeck | «Archivio completate» · «Completate aperte» | impilato · aperto (`rf-deal`) | §6 Timeline |
| DragLift | «Trascinamento · riordino nella lista» | slot tratteggiato (mobile) · riga originale visibile (desktop); solo nella stessa priorità | §6 Trascinamento |
| ReorderArrows | S1 Desktop `move=hover` · `move=focus`, «Frecce di riordino» | «Sposta su» · «Sposta giù»; spente ai bordi del gruppo di priorità; fuoco visibile | §6 Trascinamento |
| ReorderBar | S1 Mobile `move=attivo`, «Riordino senza trascinamento» | «Sposta su» · «Sposta giù» 44 · «Fine»; posizione nel gruppo; spenti ai bordi; regione live | §6 Trascinamento |
| CheckControl | cerchio delle card di S1 (mobile 22, desktop 20) e della card Adesso (28) | da fare · spunta disegnata (`rf-check`) · coriandoli (`celebration=piena`) · spento fuori giorno (routine, studio) | §6 Ciclo di completamento |
| CreateSheet in Oggi | S1 «Crea (foglio sopra Oggi)», S4 Crea Mobile | aperto · trascinato · rimpicciolito in card · puntino; senza × | §6 CreateSheet, Creazione |
| PhaseReviewSheet | S1 «Revisione fasi (da Oggi)» | foglio r24 (mobile) · pannello 440 (desktop); fasi nate fatte, tocco = saltata; Conferma | §5 Card Adesso |
| RemainingSheet | S1 «Voci rimaste (da Oggi)» `sheet=voci` | foglio r24 (mobile) · pannello 440 (desktop); «Tutte fatte» · «Crea todo con le voci rimaste» | §6 Ciclo di completamento |
| Toast | S1 «Toast», S5 | fatto con «Annulla» · todo nato con «Annulla» · informativo senza azione | §5 Toast |
| WeekStrip | S1 | selezionato · oggi · senza impegni · puntino del tipo | §6 |
| WeekView | «Vista Settimana» | righe (mobile) · sette colonne (desktop) · vuota | §6 |
| MonthGrid | «Vista Mese», S1 Mobile e Desktop `view=mese` | carico dallo sfondo, pallini; vuoto | §6 |
| ProgressTrio | «Il tuo progresso oggi» | tre card (mobile) · griglia 2 + 1 (desktop); grafico nel colore del tipo prevalente | §5 Card di progresso |
| UpcomingCard | «Prossime attività» | gruppi per giorno; vuoto | §5 |

## 4. Attività (S4, S5)

| Componente | Nel mock | Varianti e stati | DESIGN |
|---|---|---|---|
| CreateSheet | S4 | quattro tipi; `mode` create · edit; CTA dal 40 % al fill del tipo | §6 |
| TypeTiles | S4 | quattro tessere; in modifica il tipo non cambia | §6 |
| DueSelector · PrioritySelector · DaysPicker | S4 | pill 32 | §6 |
| TimeRange · DurationSteps | S4 | gradini 5–240 min; errore fine ≤ inizio (evento) | MECC §2 |
| ReminderEditor | S4 `reminder` | Auto · Off · Personalizzato; più anticipi; sveglia per gli anticipi fino a 7 h | §6 |
| PhasesEditor · ChecklistEditor | S4 | aggiungi, rinomina, riordina, elimina | — |
| RecurrenceEditNote | S4 «Modifica di una ricorrenza» | solo `mode=edit` di routine e studio | — |
| DetailPanel | S5 | `kind` × `state`; footer per tipo | §6 |
| ReviewSheet | S5 «Revisione fasi» | fasi nate fatte; Conferma | §6 |
| FollowupList | S5 `view=followup` | un todo per fase saltata | §6 |
| RemainingSheet | S5 «Voci rimaste» | Tutte fatte · Crea todo con le voci rimaste | — |
| DeleteRecurringSheet | S5 «Elimina attività ripetuta» | Solo questa · Tutta la routine · Annulla | — |
| UnitInline | S5 «Unità inline» | chiusa · aperta (`unitOpen`) | — |
| StudyNoUnit | S5 «Studio senza unità» | `course` none · missing | — |

## 5. Corsi (S10–S13)

| Componente | Nel mock | Varianti e stati | DESIGN |
|---|---|---|---|
| CourseCard | S10 `list` | badge Esempio; percentuale | §5 |
| ImportCard | S10 `importing` · `warnings` | barra in movimento; fino a 5 avvisi | §5 |
| CourseHeader | S11, S12 | eyebrow, titolo 22, meta, barra | §5 |
| ModuleGroup | S11 Corso | aperto · bloccato; contatori | §5 |
| DeleteCourseSheet | S11 «Elimina corso · conferma» | elenco di ciò che sparisce | §6 Corsi |
| UnitAccordion | S11 Modulo | una aperta per volta; badge Prossima; check | §5 |
| ModuleObjectives | S11 Modulo | | §5 |
| GoNoGoChecklist | S11 Modulo | criteri manuali · automatico; contatore | §5 |
| CoreConcept · SectionBlock · VideoCard | S12 | quattro sezioni; video incorporato | §5 S12 |
| MaterialList | S12 «Tuoi» | link · nota · PDF; groundabile · passivo | §5 S12 |
| MaterialForm | S12 «Nuovo link» · «Nuova nota» | Annulla · Aggiungi link · Salva nota | — |
| PdfRejected | S12 «PDF rifiutato» | Chiudi · Scegli un altro file | — |
| CodeTree | S12 file di codice | albero, contatori dei saltati | — |
| PracticeGenerator | S12 Pratica | tipo, quantità, difficoltà; `genState` | — |
| PdfViewer | S13 `pdf` · `pdf-scan` | groundabile · scansionato | §6 S13 |

## 6. Sessione (S15)

| Componente | Nel mock | Varianti e stati | DESIGN |
|---|---|---|---|
| SetupPanel | S15 `setup` | origine; unità bloccata o a scelta; durata; modalità; iperfocus | §6 Sessione |
| UnitPicker | S15 setup con l'elenco aperto | dal puntatore · ripeti · salta avanti · unità corrente · Nessuna unità | — |
| TimerRing | S15 `timer` | in corso · pausa · tempo extra | §6 |
| PomodoroSegments | S15 `mode=p25` | studio e pausa; Salta; Cambia unità | — |
| SessionTabs | S15 `tab` | Materiale · AI · Note (desktop su due colonne) | §6 |
| UnverifiedCard | S15 «Intervallo non verificato» | Conta come studio · Lascia fuori | §6 |
| HyperfocusTimer | S15 «Timer iperfocus» · «Uscita bloccata» | `exit` | §5 Timer in iperfocus |
| DebriefSheet | S15 «Debrief» · «Minuti per unità» | esiti, confidenza, nota, conta nel piano, Abbandona | §6 |
| SessionDone | S15 `done` | OutcomeRow, streak | §6 |
| SessionDone | S15 `done` | disco success `rf-done-pop`; «Giorni di fila» con «+1»; durata, sicurezza, puntatore; «Torna a Oggi» | §6 Sessione |

## 7. Pratica e AI (S19)

| Componente | Nel mock | Varianti e stati | DESIGN |
|---|---|---|---|
| ScopePill | S19 | Unità · Modulo · Corso · Globale | §6 |
| ChatThread · ChatComposer | S19 `chat*` | streaming con Interrompi; citazioni; messaggio in attesa offline | §6 |
| ChatError | S19 `chat-error` · `chat-error-key` · `chat-error-model` · `chat-error-safety` | limite di richieste · chiave non valida · modello fuori piano · blocco di sicurezza; azione per caso | §6 AI e pratica |
| ConversationList | «Conversazioni AI» | gruppi per età; vuoto | — |
| Flashcard · GradeButtons | S19 `flashcard-*` | fronte e retro `rf-flip`; quattro gradi | §6 |
| QuizQuestion | S19 `quiz*` | opzioni A–D; corretta · sbagliata; spiegazione | §6 |
| DevSwipeCard | «DevSwipe» | swipe; errore con spiegazione | §6 |
| BugHunterCode | «Bug Hunter» | righe numerate; secondo tentativo; soluzione | §6 |
| TriviaPlayer | «Audio Flash-Trivia» | Domanda · Risposta · Spiegazione; play, pausa, salta, stop | §6 |
| PracticeSummary | «Pratica · riepilogo», «Quiz · punteggio» | punteggio 56; sbagliate; Rifai la pratica · Torna all'unità | §5 Riepilogo |

## 8. Statistiche, Notifiche, Impostazioni (S20–S22)

| Componente | Nel mock | Varianti e stati | DESIGN |
|---|---|---|---|
| StatsTabs · PeriodSegmented | S20 | quattro tab; 7 · 30 · 90 · tutto | §6 Shell |
| StatCard | S20 | valore, confronto, barre o sparkline; vuoto per riga | §5 |
| Heatmap | S20 panoramica | quattro passi del colore dei dati | §6 |
| PendingOutcomeRow | S21 | azioni in linea | §6 Notifiche |
| SettingsGroup · SettingsRow | S22 | valore a destra; riga danger | §6 Impostazioni |
| NotificationTypeAccordion | S22 `notifications` | per tipo | — |
| PermissionRow | S22 `notifications` · `notifications-denied` | concesso · negato | — |
| SyncStatus | S22 `account*` | in pari · offline · conflitto | — |
| CodeInput | S22 `login-code` | 6 cifre in font-num | §6 |
| Diagnostics | S22 `diagnostics` | copiabile; Svuota cache; Reinstalla PWA (web) | — |

## 9. Fuori dall'app

| Componente | Nel mock | Varianti e stati | DESIGN |
|---|---|---|---|
| AlarmScreen | S8 | `kind` studio · todo · routine · evento; tasto principale nel fill del tipo | §5 Sveglia |
| Notifiche native | S9 | quattro sequenze; canale silenzioso; notifica persistente | §5 Notifiche di sistema |
| HomeWidget | S13 `widget` | 4×2: mese, agenda, Prossima, + | §6 S13 |

## 10. Icone

Lucide, tratto 1.75 (2 nelle micro-azioni), misure in DESIGN §7. Tipo: square-check (già check-square) per il todo, graduation-cap per lo studio, repeat per la routine, calendar per l'evento. Contesto nelle card: map-pin, video, dumbbell, book-open. Ricorrenti: bell (sveglia, esiti), bell-off (notifiche silenziose), triangle-alert (errori), x, plus, chevron-left, chevron-right, play, check, arrow-right (Apri il blocco), grip-vertical (maniglia a sei punti). Ogni icona dei mock è un path Lucide: si usa l'icona della libreria con lo stesso disegno.
