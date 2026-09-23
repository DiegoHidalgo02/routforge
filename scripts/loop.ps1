# Loop agentico semi-autonomo (Windows PowerShell 7+). Vedi docs/05_LOOP_AGENTICO.md §2.B
# Esegue `claude -p "/task next"` finché: i task sono finiti, compare CHECKPOINT/BLOCCO in docs/STATO.md,
# o si raggiunge -MaxTasks. Crea da solo il tag git `pre-loop-<data>` per poter tornare indietro.
param(
  [int]$MaxTasks = 3,
  [string]$Model = ""   # es. "sonnet" oppure vuoto = default di Claude Code
)
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { throw "Claude Code non trovato nel PATH" }
git tag -f "pre-loop-$(Get-Date -Format yyyyMMdd-HHmm)" | Out-Null

for ($i = 1; $i -le $MaxTasks; $i++) {
  $stato = Get-Content docs/STATO.md -Raw
  if ($stato -match 'CHECKPOINT:' -or $stato -match 'BLOCCO:') { Write-Host "Fermo: checkpoint o blocco in docs/STATO.md"; break }
  $aperti = (Select-String -Path docs/TASKS.md -Pattern '^\|\s*T-\d+.*\|\s*aperto\s*\|$').Count
  if ($aperti -eq 0) { Write-Host "Nessun task aperto: finito."; break }

  Write-Host "=== Iterazione $i/$MaxTasks ==="
  $claudeArgs = @("-p", "/task next", "--permission-mode", "acceptEdits")
  if ($Model -ne "") { $claudeArgs += @("--model", $Model) }
  & claude @claudeArgs
  if ($LASTEXITCODE -ne 0) { Write-Host "claude è uscito con codice $LASTEXITCODE: fermo."; break }

  & npm run verify --silent
  if ($LASTEXITCODE -ne 0) { Write-Host "Gate rosso dopo l'iterazione ${i}: fermo per revisione umana."; break }
}
Write-Host "Loop terminato. Leggi docs/STATO.md e git log --oneline -10"
