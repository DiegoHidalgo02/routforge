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

const stato = read('docs/STATO.md').trim();
const tasks = read('docs/TASKS.md');
const open = tasks
  .split('\n')
  .filter((l) => /^\|\s*T-\d+/.test(l) && /\|\s*aperto\s*\|/.test(l))
  .slice(0, 5);

const lines = [
  '=== RoutForge · stato di lavoro (docs/STATO.md) ===',
  stato.slice(0, 4000) || '(docs/STATO.md mancante)',
  '',
  '=== Prossimi task aperti (docs/TASKS.md) ===',
  ...(open.length ? open : ['(nessun task aperto trovato)']),
  '',
  'Regole: CLAUDE.md · gate: npm run verify · fermati solo ai checkpoint di docs/06_SUPERVISIONE.md',
];
process.stdout.write(lines.join('\n') + '\n');
