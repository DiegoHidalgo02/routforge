// =============================================================================
// Registro delle dipendenze verificato dal gate — invariante INV-8 (decisione D-DEP-1)
// -----------------------------------------------------------------------------
// Fonte: CLAUDE.md §2 ("niente dipendenze nuove senza motivo scritto"); docs/06_SUPERVISIONE.md
// ("dipendenze non previste" fermano l'agente). Il registro è docs/DIPENDENZE.md.
// 1. Ogni pacchetto in package.json (dependencies e devDependencies) ha una riga con tipo `runtime` o `dev` coerente.
// 2. Un pacchetto registrato come `prevista` non è installato: quando entra, la riga passa a `dev`/`runtime`.
// 3. Un pacchetto compare una sola volta nel registro (due righe potrebbero mascherarsi a vicenda).
// =============================================================================
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = (p) => readFileSync(join(RADICE, p), 'utf8');

export const TIPI = ['runtime', 'dev', 'prevista'];

/** Righe del registro: | `pacchetto` (uno o più) | tipo | … |. */
export function righeRegistro(testo) {
  const out = [];
  for (const riga of testo.split('\n')) {
    if (!/^\|\s*`/.test(riga)) continue;
    const c = riga
      .split('|')
      .slice(1, -1)
      .map((x) => x.trim());
    if (c.length < 2) continue;
    const nomi = [...c[0].matchAll(/`([^`]+)`/g)].map((m) => m[1]);
    for (const nome of nomi) out.push({ nome, tipo: c[1] });
  }
  return out;
}

/** Pacchetti installati da package.json con il loro tipo. */
export function installati(pkg) {
  const out = new Map();
  for (const n of Object.keys(pkg.dependencies ?? {})) out.set(n, 'runtime');
  for (const n of Object.keys(pkg.devDependencies ?? {})) out.set(n, 'dev');
  return out;
}

export function problemi(pkg, registro) {
  const out = [];
  const inst = installati(pkg);
  const visti = new Set();
  for (const r of registro) {
    if (visti.has(r.nome)) out.push(`${r.nome}: registrato due volte in docs/DIPENDENZE.md`);
    visti.add(r.nome);
  }
  const reg = new Map(registro.map((r) => [r.nome, r.tipo]));
  for (const [nome, tipo] of inst) {
    if (!reg.has(nome)) out.push(`${nome}: installato ma assente da docs/DIPENDENZE.md`);
    else if (reg.get(nome) !== tipo) out.push(`${nome}: in package.json è ${tipo}, nel registro è ${reg.get(nome)}`);
  }
  for (const r of registro) {
    if (!TIPI.includes(r.tipo)) out.push(`${r.nome}: tipo "${r.tipo}" non ammesso`);
    if (r.tipo === 'prevista' && inst.has(r.nome)) out.push(`${r.nome}: installato ma ancora "prevista" nel registro`);
  }
  return out;
}

describe('Dipendenze — CLAUDE.md §2, docs/DIPENDENZE.md (INV-8)', () => {
  it('ogni pacchetto di package.json è registrato con il tipo giusto; nessuna "prevista" è installata; nessun doppione', () => {
    expect(problemi(JSON.parse(leggi('package.json')), righeRegistro(leggi('docs/DIPENDENZE.md')))).toEqual([]);
  });

  it('il controllo riconosce davvero le violazioni (autotest)', () => {
    const registro = righeRegistro('| `a`, `b` | dev | x |\n| `c` | prevista | y |\n| non una riga | dev |');
    expect(registro).toEqual([
      { nome: 'a', tipo: 'dev' },
      { nome: 'b', tipo: 'dev' },
      { nome: 'c', tipo: 'prevista' },
    ]);
    const pkg = { dependencies: { c: '1' }, devDependencies: { a: '1', d: '1' } };
    expect(problemi(pkg, registro)).toEqual([
      'c: in package.json è runtime, nel registro è prevista',
      'd: installato ma assente da docs/DIPENDENZE.md',
      'c: installato ma ancora "prevista" nel registro',
    ]);
    const doppio = righeRegistro('| `a` | dev | x |\n| `a` | prevista | y |');
    expect(problemi({ devDependencies: { a: '1' } }, doppio)).toContain(
      'a: registrato due volte in docs/DIPENDENZE.md',
    );
  });
});
