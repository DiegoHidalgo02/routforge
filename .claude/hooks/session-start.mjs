// Hook SessionStart: stampa lo stato del progetto e i prossimi task.
// Lo stdout di questo hook entra nel contesto di Claude a inizio sessione,
// così ogni ciclo agentico parte già orientato (principio di continuità).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const read = (p) => {
  try {
    return readFileSync(join(root, p), 'utf8');
  } catch {
    return '';
  }
};

// STATO.md è contesto tecnico, non un diario: se supera il limite va accorciato, non solo troncato qui. Claude Code
// mette in un file l'output di un hook troppo lungo e nel contesto ne entrano solo 2 KB (09/10/2026: con 13 KB si
// perdevano task e regole): stato, cinque righe di task e regole devono restare sotto i 10 000 caratteri.
const LIMITE = 7_000;
const RIGA_TASK = 280;
const stato = read('docs/STATO.md').trim();
const statoMostrato =
  stato.length > LIMITE
    ? `${stato.slice(0, LIMITE)}\n[… docs/STATO.md troncato: leggilo per intero e accorcialo]`
    : stato;
const tasks = read('docs/TASKS.md');
const open = tasks
  .split('\n')
  .filter((l) => /^\|\s*T-\d+/.test(l) && /\|\s*aperto\s*\|/.test(l))
  .slice(0, 5)
  .map((l) => (l.length > RIGA_TASK ? `${l.slice(0, RIGA_TASK)}…` : l));

const lines = [
  '=== RoutForge · stato di lavoro (docs/STATO.md) ===',
  statoMostrato || '(docs/STATO.md mancante)',
  '',
  '=== Prossimi task aperti (docs/TASKS.md) ===',
  ...(open.length ? open : ['(nessun task aperto trovato)']),
  '',
  'Regole: CLAUDE.md + .claude/rules/ per lo strato che tocchi · invarianti: docs/INVARIANTI.md · gate: npm run verify · fermati solo ai checkpoint di docs/06_SUPERVISIONE.md',
];
process.stdout.write(lines.join('\n') + '\n');
