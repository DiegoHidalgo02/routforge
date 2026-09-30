---
name: routforge-spec
description: Come navigare le spec di RoutForge (cinque file in docs/spec) per trovare la regola giusta, la sua precedenza e lo scenario che la verifica. Usa questa skill ogni volta che implementi o rivedi un comportamento dell'app.
---
# Navigare le spec di RoutForge

## Precedenza
In caso di contraddizione vince il file più in basso: CONTESTO < FUNZIONALITA < MECCANISMI < FORMATO_CORSO < SCENARI.
Uno scenario batte un meccanismo; un meccanismo batte una funzionalità.

## Dove cercare (MECCANISMI.md)
| Tema | § | Scenari |
|---|---|---|
| Modello dati, stati blocco/unità, ancore senza orario | §1 | — |
| Campi e vincoli di creazione (gradini durata, orizzonte, priorità) | §2 | A5 |
| Spunta e completamento | §3 | B2, B3, E1 |
| Checklist | §4 | A3 |
| Fasi (template, log, follow-up) | §5 | B5, E1 |
| Todo: orizzonte, spostamento, "non fatto", ritardo | §6 | A1, A2, A4 |
| Routine: generazione occorrenze (28 gg), modifica, eliminazione | §7 | B1, B6 |
| Persi, recupero, orfani, esiti pendenti | §8 | B4, B7, C6, C8 |
| Cicli dello scheduler (ordine vincolante) | §9 | G4 |
| Sessione: contesti, regimi, pomodoro, iperfocus, continuità (D-TIMER-2), chiusura e abbandono oltre soglia (D-SESS-2) | §10 | C4, C5, D1–D7 |
| Esiti e puntatore | §11 | C1–C3, C7, C9 |
| Streak | §12 | C2 |
| Notifiche: livelli, trigger, finestra 14 gg, digest, one-shot (nessuna fascia silenziosa, D-NOTIF-3) | §13 | F1–F6, A4 |
| Blocco "Adesso" | §14 | G1, G2, E3 |
| Trascinamento | §15 | G3 |
| Import corso | §16 (+ FORMATO_CORSO) | H1 |
| Materiali e file di codice | §17 | H2 |
| AI: contesto, generazione, validazione, pratiche | §18 | H4, H5, I2–I4 |
| SM-2 | §19 | I1 |
| Statistiche | §20 | — |
| Widget e collegamenti | §21 | — |
| Backup | §22 | — |
| Lingua e diagnostica | §23 | — |
| Ordinamento calendario | §24 | A5 |
| Sincronizzazione | §25 | J1–J5 |

## Numeri che ricorrono
30' (grazia "perso"; intervallo non verificato della sessione); 65% (abbandono oltre soglia → Continua); 28 giorni (orizzonte occorrenze); 14 giorni (finestra notifiche, +31 per i blocchi
considerati); 5 s (niente notifiche entro); ~10 s (one-shot); 10' (posticipa, esito a fine+10'); 3 giorni /
max 5 (esiti pendenti); 2 ore (notifica "perso"); 60 voci / 120 caratteri (checklist); 20 MB, 40 pagine,
60.000 caratteri (PDF); 500 KB (file di codice); 84 giorni (mappa di calore); 5–25 passo 5 (generazione);
1,3 / 2,5 (SM-2); 08:00–22:00 (slot liberi todo); 12:00 (ancora todo senza orario).

## Metodo
1. Parti dallo scenario (SCENARI) → risali al § di MECCANISMI → conferma il senso in FUNZIONALITA.
2. Guarda la riga dello scenario in `docs/TRACCIABILITA.md`: dice in quale modulo vive, quale task lo realizza e quali
   test lo citano già (così non duplichi una regola esistente e sai quale riga aggiornare).
3. Estrai i valori numerici esatti e scrivili nel test prima del codice.
4. Se la spec tace, decidi il minimo coerente e annota `D-xxx` in `docs/01_DECISIONI.md` (scheda in `docs/decisioni/`
   se ad alto impatto); le contraddizioni già note sono in `docs/00_SINTESI.md` §6.
