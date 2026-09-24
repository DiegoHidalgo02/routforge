#!/usr/bin/env bash
# Loop agentico semi-autonomo (Git Bash / macOS / Linux): stessa logica di scripts/loop.ps1.
# Uso: bash scripts/loop.sh [MAX_TASKS] [--consenti-fable] [--forza-modello <id>]
set -euo pipefail
cd "$(dirname "$0")/.."
MAX_TASKS=3; CONSENTI_FABLE=0; FORZA=""
while [ $# -gt 0 ]; do
  case "$1" in
    --consenti-fable) CONSENTI_FABLE=1 ;;
    --forza-modello) FORZA="$2"; shift ;;
    *) MAX_TASKS="$1" ;;
  esac
  shift
done
command -v claude >/dev/null || { echo "Claude Code non trovato nel PATH"; exit 1; }
git tag -f "pre-loop-$(date +%Y%m%d-%H%M)" >/dev/null

for i in $(seq 1 "$MAX_TASKS"); do
  if grep -qE 'CHECKPOINT:|BLOCCO:' docs/STATO.md; then echo "Fermo: checkpoint o blocco in docs/STATO.md"; break; fi
  eval "$(node scripts/prossimo-task.mjs --formato sh)"
  if [ "$TROVATO" != "true" ]; then echo "Fermo: $MOTIVO."; break; fi
  if [ "$USAFABLE" = "true" ] && [ "$CONSENTI_FABLE" = "0" ] && [ -z "$FORZA" ]; then
    echo "Fermo: il prossimo passo ($ID, fase $FASE) usa Fable 5.1. Eseguilo in modo interattivo o rilancia con --consenti-fable."
    break
  fi
  MODELLO="${FORZA:-$MODELLOID}"
  if [ "$RISCHIOSO" = "true" ]; then git tag -f "snapshot-$ID-$(date +%Y%m%d-%H%M)" >/dev/null; echo "Task rischioso: tag di sicurezza creato"; fi
  echo "=== Giro $i/$MAX_TASKS — $ID (fase $FASE) con $MODELLO ==="
  PRIMA="$(git rev-parse HEAD)"
  claude -p "/task $ID loop" --permission-mode acceptEdits --model "$MODELLO"
  npm run verify --silent || { echo "Gate rosso dopo $ID: fermo per revisione umana."; break; }
  if [ "$(git rev-parse HEAD)" = "$PRIMA" ]; then echo "Nessun commit su $ID in questo giro: fermo."; break; fi
done
echo "Loop terminato. Leggi docs/STATO.md e git log --oneline -10"
