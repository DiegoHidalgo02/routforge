# =============================================================================
# Loop agentico semi-autonomo (PowerShell 7+). Vedi docs/05_LOOP_AGENTICO.md §2.B
# -----------------------------------------------------------------------------
# A ogni giro:
#   1. si ferma se docs/STATO.md contiene CHECKPOINT: o BLOCCO:
#   2. chiede a scripts/prossimo-task.mjs il prossimo task (stessa regola di /task next)
#      e il MODELLO dalla colonna "Modello" di docs/TASKS.md (task in due fasi inclusi)
#   3. si ferma prima dei passi che usano Fable 5.1, salvo -ConsentiFable (quota settimanale)
#   4. crea un tag git di sicurezza se il task è rischioso (R)
#   5. esegue `claude -p "/task <ID> loop" --model <modello>`
#   6. si ferma se il gate è rosso o se il giro non ha prodotto nessun commit
# Uso: pwsh -File scripts/loop.ps1 -MaxTasks 3 [-ConsentiFable] [-ForzaModello claude-sonnet-5]
# =============================================================================
param(
  [int]$MaxTasks = 3,
  [switch]$ConsentiFable,          # permette al loop di usare Fable 5.1 (T-000 e fasi "piano")
  [string]$ForzaModello = ""       # solo per prove: ignora la colonna Modello
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { throw "Claude Code non trovato nel PATH" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node non trovato nel PATH" }
git tag -f "pre-loop-$(Get-Date -Format yyyyMMdd-HHmm)" | Out-Null

for ($i = 1; $i -le $MaxTasks; $i++) {
  $stato = Get-Content docs/STATO.md -Raw
  if ($stato -match 'CHECKPOINT:' -or $stato -match 'BLOCCO:') { Write-Host "Fermo: checkpoint o blocco in docs/STATO.md"; break }

  $info = node scripts/prossimo-task.mjs | ConvertFrom-Json
  if (-not $info.trovato) { Write-Host "Fermo: $($info.motivo)."; break }

  if ($info.usaFable -and -not $ConsentiFable -and $ForzaModello -eq "") {
    Write-Host "Fermo: il prossimo passo ($($info.id), fase $($info.fase)) usa Fable 5.1."
    Write-Host "Eseguilo in modo interattivo (/model -> Fable 5.1, poi /task $($info.id)), oppure rilancia con -ConsentiFable."
    break
  }
  $modello = if ($ForzaModello -ne "") { $ForzaModello } else { $info.modelloId }

  if ($info.rischioso) {
    $tag = "snapshot-$($info.id)-$(Get-Date -Format yyyyMMdd-HHmm)"
    git tag -f $tag | Out-Null
    Write-Host "Task rischioso: creato il tag $tag"
  }

  Write-Host "=== Giro $i/$MaxTasks — $($info.id) (fase $($info.fase)) con $($info.modello) [$modello] ==="
  $prima = git rev-parse HEAD
  & claude -p "/task $($info.id) loop" --permission-mode acceptEdits --model $modello
  if ($LASTEXITCODE -ne 0) { Write-Host "claude è uscito con codice ${LASTEXITCODE}: fermo."; break }

  & npm run verify --silent
  if ($LASTEXITCODE -ne 0) { Write-Host "Gate rosso dopo $($info.id): fermo per revisione umana."; break }

  if ((git rev-parse HEAD) -eq $prima) { Write-Host "Nessun commit su $($info.id) in questo giro: fermo per evitare ripetizioni. Leggi docs/STATO.md."; break }
}
Write-Host "Loop terminato. Leggi docs/STATO.md e git log --oneline -10"
