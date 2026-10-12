---
name: fusi
description: Esegue in locale la suite di test nei quattro fusi della CI (Roma, Los Angeles, Kolkata, Auckland). Da usare prima dei commit che toccano tempo o persistenza.
disable-model-invocation: true
---

# /fusi — la suite nei quattro fusi della CI

La CI (`.github/workflows/ci.yml`) ripete i test in quattro fusi (CONTESTO §3, D-TIME-1): Roma, Los Angeles,
Kolkata (mezz'ora) e Auckland (cambio d'ora nel verso opposto). Qui la stessa prova in locale.

Su Windows `TZ=` in Git Bash è ignorato: ogni giro passa da PowerShell. `--maxWorkers=2` evita i timeout spuri della
macchina satura. Esegui i quattro giri **in sequenza** (in parallelo saturano la macchina):

```bash
powershell.exe -NoProfile -Command "$env:TZ='Europe/Rome'; npx vitest run --maxWorkers=2"
powershell.exe -NoProfile -Command "$env:TZ='America/Los_Angeles'; npx vitest run --maxWorkers=2"
powershell.exe -NoProfile -Command "$env:TZ='Asia/Kolkata'; npx vitest run --maxWorkers=2"
powershell.exe -NoProfile -Command "$env:TZ='Pacific/Auckland'; npx vitest run --maxWorkers=2"
```

Su macOS o Linux: `TZ=Europe/Rome npx vitest run --maxWorkers=2`, e così per gli altri tre.

Se l'utente passa dei file (`/fusi src/domain/time.test.ts`), aggiungili in fondo a ogni comando al posto della suite
intera. Riporta per ogni fuso i file e i test passati e, per un test fallito, il fuso, il nome e il messaggio
dell'asserzione. Un fallimento in un solo fuso è un difetto di tempo (`src/domain/time.ts`, D-TIME-1, D-TIME-2,
D-TIME-3), non un test instabile: non ripetere il giro sperando che passi.
