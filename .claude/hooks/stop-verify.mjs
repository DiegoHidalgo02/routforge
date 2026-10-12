// Hook Stop: impedisce a Claude di dichiarare finito un turno con il gate rosso.
// - Legge il JSON dell'evento da stdin; se `stop_hook_active` è true, non blocca
//   (evita loop infiniti, come da documentazione degli hook).
// - Esegue `npm run verify`; se fallisce esce con codice 2 e il motivo su stderr:
//   Claude riceve l'errore e continua a lavorare finché il gate è verde.
// - Salta silenziosamente se non esiste package.json (repo non ancora pronto)
//   o se il file .claude/hooks/SKIP_VERIFY esiste (fase "rosso" voluta del TDD).
// - Senza node_modules il gate non può girare: lo dice chiaramente invece di fallire su "tsc non trovato".
// - Salta se nel checkout sono cambiati solo documenti Markdown che il gate non legge (o niente): un turno di sole
//   risposte o di documenti non spende fino a 280 s di verifica (09/10/2026); i documenti letti dai test restano dentro.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();

let input = '';
try {
  input = readFileSync(0, 'utf8');
} catch {
  /* nessun input */
}
let event = {};
try {
  event = JSON.parse(input || '{}');
} catch {
  /* input non JSON */
}

if (event.stop_hook_active) process.exit(0);
if (!existsSync(join(root, 'package.json'))) process.exit(0);
if (existsSync(join(root, '.claude/hooks/SKIP_VERIFY'))) process.exit(0);

const LETTI_DAL_GATE = [
  'docs/DIPENDENZE.md',
  'docs/TASKS.md',
  'docs/TRACCIABILITA.md',
  'docs/spec/RoutForge_SCENARI.md',
];
const modifiche = spawnSync('git', ['status', '--porcelain', '-uall'], { cwd: root, encoding: 'utf8' });
if (modifiche.status === 0) {
  const percorsi = modifiche.stdout
    .split('\n')
    .filter(Boolean)
    .map((r) => r.slice(3).split(' -> ').pop().replace(/^"|"$/g, ''));
  const contano = percorsi.filter(
    (p) => !p.startsWith('audit/') && !(p.endsWith('.md') && !LETTI_DAL_GATE.includes(p)),
  );
  if (contano.length === 0) process.exit(0);
}
if (!existsSync(join(root, 'node_modules'))) {
  process.stderr.write(
    'Dipendenze non installate: il gate `npm run verify` non può girare. Esegui `npm ci` e rilancia la verifica.\n',
  );
  process.exit(2);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const res = spawnSync(npm, ['run', 'verify', '--silent'], {
  cwd: root,
  encoding: 'utf8',
  shell: process.platform === 'win32',
  timeout: 280_000,
});

if (res.status === 0) process.exit(0);

const tail = `${res.stdout ?? ''}\n${res.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n');
process.stderr.write(
  `Il gate \`npm run verify\` è ROSSO: non chiudere il turno. Correggi e rilancia la verifica.\n${tail}\n`,
);
process.exit(2);
