---
description: Esegui il gate di qualità (typecheck + test) e riassumi il risultato
allowed-tools: Bash(npm run verify:*), Bash(npm run check:*), Bash(npm test:*)
---
Esegui `npm run verify`. Se è rosso, analizza la causa radice (non il sintomo), correggi, riesegui.
Riporta: numero di test, file falliti, cosa hai corretto. Non dichiarare "fatto" con il gate rosso.
