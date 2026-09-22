#!/usr/bin/env bash
# Loop agentico semi-autonomo (macOS/Linux/Git Bash). Vedi docs/05_LOOP_AGENTICO.md §2.B
set -euo pipefail
cd "$(dirname "$0")/.."
MAX_TASKS="${1:-3}"; MODEL="${2:-}"
command -v claude >/dev/null || { echo "Claude Code non trovato nel PATH"; exit 1; }
git tag -f "pre-loop-$(date +%Y%m%d-%H%M)" >/dev/null

for i in $(seq 1 "$MAX_TASKS"); do
  if grep -qE 'CHECKPOINT:|BLOCCO:' docs/STATO.md; then echo "Fermo: checkpoint o blocco in docs/STATO.md"; break; fi
  if ! grep -qE '^\|\s*T-[0-9]+.*\|\s*aperto\s*\|$' docs/TASKS.md; then echo "Nessun task aperto: finito."; break; fi
  echo "=== Iterazione $i/$MAX_TASKS ==="
  if [ -n "$MODEL" ]; then claude -p "/task next" --permission-mode acceptEdits --model "$MODEL"
  else claude -p "/task next" --permission-mode acceptEdits; fi
  npm run verify --silent || { echo "Gate rosso dopo l'iterazione $i: fermo per revisione umana."; break; }
done
echo "Loop terminato. Leggi docs/STATO.md e git log --oneline -10"
