// Hook PostToolUse (Edit|Write): formatta con Prettier il solo file appena toccato, così `format:check` del gate non
// trova differenze a fine turno (09/10/2026). Salta i file fuori dal progetto, quelli di .prettierignore e i formati
// che Prettier non conosce; non blocca mai lo strumento (esce sempre con 0).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
let evento = {};
try {
  evento = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const file = evento.tool_input?.file_path;
if (typeof file !== 'string') process.exit(0);
const percorso = relative(root, file);
const prettier = join(root, 'node_modules', 'prettier', 'bin', 'prettier.cjs');
if (!percorso || percorso.startsWith('..') || isAbsolute(percorso) || !existsSync(prettier)) process.exit(0);

spawnSync(process.execPath, [prettier, '--write', '--ignore-unknown', '--log-level', 'silent', percorso], {
  cwd: root,
  timeout: 20_000,
});
process.exit(0);
