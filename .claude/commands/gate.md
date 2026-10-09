---
description: Gate di qualità di RoutForge (typecheck, lint, formato e test con npm run verify). Nome diverso da /verify, che in Claude Code è una skill integrata con un altro scopo
allowed-tools: Bash(npm run verify:*), Bash(npm run check:*), Bash(npm test:*)
---
Esegui `npm run verify`. Se è rosso, analizza la causa radice (non il sintomo), correggi, riesegui.
Riporta: numero di test, file falliti, cosa hai corretto. Non dichiarare "fatto" con il gate rosso.
