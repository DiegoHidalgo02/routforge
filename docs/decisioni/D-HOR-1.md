# D-HOR-1 — Todo che rotolano: slot libero, ripieghi, avviso «in ritardo» una volta

**Stato**: applicata il 26/09/2026 (T-012): `src/domain/scheduler/horizon.ts`, `src/domain/lost.ts`
(`isRollingTodo`), `src/app/horizon.ts`, campi `Blocco.ritardoIl` e `Blocco.orarioOriginale` in `src/domain/types.ts`;
revisione indipendente `spec-reviewer` (non conforme alla prima stesura: rilievi applicati). Riga nel registro:
`docs/01_DECISIONI.md`.

## Contesto

MECC §6 sposta a oggi, a ogni ciclo, i todo `programmati` con orizzonte settimana o mese rimasti in un giorno passato:
senza orario all'ancora delle 12:00, con orario in uno «slot libero» fra le 08:00 e le 22:00 della stessa durata, con
tre punti in ordine (orario originale se libero; primo varco da adesso; ripiego sull'orario originale o sull'inizio
finestra). Poi, una volta per todo, parte l'avviso «todo in ritardo» (§6, §13.6; FUNZ §4.1). Restano aperti: quale
sia l'«orario originale» dopo più spostamenti, se l'orario originale già passato sia «libero», da dove parta la
ricerca, quando si ripieghi sull'inizio finestra, quali blocchi occupino tempo, quale sia il giorno di un todo dopo un
cambio di fuso e dove ricordare che l'avviso è partito.

## Decisione

1. **Orario originale** = l'ora di parete scelta dall'utente. Se un ciclo sposta il todo in un varco perché quell'ora
   era occupata, `Blocco.orarioOriginale` la ricorda e il giorno dopo si riprova lì; torna `null` quando il todo è di
   nuovo al suo orario. Modifica (T-042) e trascinamento su un orario (T-015) la azzerano: la scelta nuova diventa
   l'originale.
2. **Punto 1**: l'orario originale vale se il suo slot sta in 08:00–22:00 e non si sovrappone a nulla, anche se oggi
   è già passato: «partendo da adesso» la spec lo scrive solo per il punto 2.
3. **Punto 2**: la ricerca parte da max(08:00, adesso arrotondato per eccesso al multiplo di 5'); il varco deve finire
   entro le 22:00.
4. **Punto 3**: l'orario originale anche se sovrapposto, se il suo slot sta nella finestra; altrimenti le 08:00.
5. **Chi occupa tempo**: i blocchi con orario e con durata (fine > inizio), `programmati` o `in_corso`, che toccano la
   finestra di oggi, anche quelli di ieri che sconfinano dopo mezzanotte. Non occupano i blocchi chiusi o persi, quelli
   senza orario e quelli senza durata. I todo che rotolano nello stesso ciclo si collocano in ordine d'inizio e
   occupano lo slot preso.
6. **Giorno del todo** = quello di parete memorizzato (`giornoLocale`, D-TIME-2), per «giorno passato» e per
   l'orizzonte: dopo un cambio di fuso un giorno passato conserva gli istanti, che possono cadere in un altro giorno.
   La regola «todo che rotola invece di diventare "non fatto"» è una sola (`isRollingTodo` in `lost.ts`), usata dallo
   spostamento e dalla marcatura.
7. **Senza orario**: 12:00–23:59 di oggi, come alla creazione (`ANCORA_TODO`, §1). Si leggono i blocchi da 30 giorni
   fa a oggi (`GIORNI_INDIETRO`): l'orizzonte più lungo è il mese.
8. **Orizzonte scaduto ad app chiusa**: il todo non rotola più e resta nel giorno in cui era; il ciclo lo marca «non
   fatto» (§8). Non viene portato all'ultimo giorno dell'orizzonte.
9. **Avviso al più una volta per todo**: il campo `Blocco.ritardoIl` (istante dell'avviso) si imposta al primo
   spostamento (`rollPlan`) o alla marcatura «non fatto» (T-013, con `lateNoticeDue`); chi lo trova già impostato non
   avvisa più, anche dopo «Riapri». `rollTodos` restituisce gli id da avvisare; li spedisce T-020.

## Motivazione

- «Originale» è l'orario che l'utente ha scelto: dopo un solo giorno con le 18:00 occupate il todo della spesa non deve
  diventare per sempre un todo delle 10:00.
- Il punto 1 letterale non fa slittare l'orario quando l'app si apre tardi: il todo delle 18:00 aperto alle 19:00 resta
  alle 18:00 (passato, ancora spuntabile).
- I 5 minuti sono il passo delle durate (§2) e dell'aggancio del trascinamento (§15): un orario come «14:07» non
  compare altrove nel calendario. Gli offset dei fusi sono multipli di 15', quindi il passo sull'istante assoluto
  coincide con quello dell'ora locale.
- Un blocco senza durata non ha tempo da occupare; uno di ieri che finisce alle 09:00 occupa davvero le 08:00–09:00.
- Il calendario mostra un blocco nel suo `giornoLocale`: lo spostamento e la marcatura devono ragionare sullo stesso
  giorno, altrimenti dopo un viaggio un todo resterebbe fermo o rotolerebbe oltre la sua domenica.
- L'avviso deve restare «una volta» dopo un riavvio, un backup e una sincronizzazione: il registro notifiche è derivato,
  si ricostruisce a ogni riconciliazione ed è escluso da backup e sync (§1), quindi non può ricordarlo. Sul blocco sta
  accanto a `persoIl` e `chiusoIl`, con la stessa regola «ultimo vince» (§25).
- Scrivere `ritardoIl` insieme allo spostamento tiene evento e memoria in una sola scrittura: la seconda esecuzione del
  ciclo non sposta nulla e non avvisa nessuno (INV-15).

## Alternative scartate

- Ora di parete attuale come orario originale (prima stesura): nessun campo in più, ma un giorno occupato spostava
  l'orario per sempre (rilievo della revisione).
- Punto 1 solo se l'orario è ancora futuro: l'orario slitterebbe ogni volta che l'app si apre dopo quell'ora.
- Ricerca da adesso senza arrotondamento: orari al minuto (e istanti al millisecondo) nel calendario.
- Ripiego sempre sull'orario originale: un todo delle 06:30 resterebbe fuori dalla finestra che §6 impone.
- Giorno e orizzonte dagli istanti nel fuso corrente: sbagliati per i giorni passati dopo un viaggio (D-TIME-2).
- Portare all'ultimo giorno dell'orizzonte un todo scaduto ad app chiusa: regola che §6 non ha.
- Memoria dell'avviso nel registro notifiche o in `preferenze`: il primo è derivato e fuori da backup e sync, la
  seconda separerebbe l'evento dalla scrittura del blocco.

## Conseguenze

- T-013 chiama `rollTodos` a ogni ciclo, dopo l'estensione delle ricorrenze e prima di orfani e persi (§9); alla
  marcatura «non fatto» di un todo imposta `ritardoIl` se `lateNoticeDue` e unisce questi id a quelli di `rollTodos`.
- L'avviso è **al più** una volta: `ritardoIl` registra la decisione di avvisare, non la consegna. Fra T-013 e T-020 i
  todo spostati consumano l'avviso senza riceverlo; dopo T-020 un fallimento della porta lo perde (INV-16) e T-020 lo
  registra in Diagnostica.
- T-020 spedisce gli avvisi «in ritardo» agli id raccolti (one-shot ~10 s, canale silenzioso, azioni Segna fatto e
  Posticipa, non soggetti alle ore silenziose, §13.4 e §13.6). Per il digest (§13.5) gli arretrati che si sposteranno a
  quel giorno si possono contare con `rollPlan` all'istante del digest, usando id e istanti: giorno locale e ora di
  parete dei todo in `spostati` sono quelli di prima finché `saveBlock` non li ricalcola. Esito (D-NOTIF-2): l'avviso è
  la voce `ritardo:0:<id>` a `ritardoIl` + 10 s dell'insieme desiderato; nel digest gli arretrati sono i todo senza
  orario di giorni passati per cui vale `isRollingTodo` all'istante del digest, più quelli già rotolati (`ritardoIl`).
- Un todo collocato a un orario già passato (punto 2 della decisione) non riceve la notifica «scadenza» di §13.2:
  §13.3 non arma notifiche nel passato. Riceve l'avviso «in ritardo», se non l'ha già avuto.
- L'orizzonte si conta dal giorno attuale del todo: finché rotola coincide con quello di creazione (resta nella stessa
  settimana o mese). T-015 (trascinamento su un altro giorno) e T-042 (modifica) decidono se uno spostamento manuale
  rinnova l'orizzonte e azzerano `orarioOriginale`.
- `ritardoIl` e `orarioOriginale` entrano in backup e sincronizzazione con il resto del blocco (T-030, T-033).

## Verifica

`src/domain/scheduler/horizon.test.ts` (A1, A2, i tre punti dello slot, confini dei varchi, chi occupa, due todo nello
stesso ciclo, orario originale ricordato e ritrovato, fuso cambiato, ora legale, mezzanotte, avviso una volta,
idempotenza), `src/domain/lost.test.ts` (`isRollingTodo` con il giorno di parete) e `src/app/horizon.test.ts` (A2 dal
database con la checklist conservata e il ritorno alle 18:00, rotolamento fino a domenica con un solo avviso, lunedì
«non fatto», seconda esecuzione senza scritture, A1, lettura a 30 giorni); suite ripetuta in Auckland, Los Angeles e
Kolkata; prova di mutazione su arrotondamento, finestra, ripiego, avviso, occupazione dei todo collocati, orario
originale e giorno di parete (tutte uccise).
