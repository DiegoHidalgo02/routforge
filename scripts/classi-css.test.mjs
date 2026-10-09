// =============================================================================
// Classi dei CSS Modules (INV-23; D-STACK-1; audit P3-29)
// -----------------------------------------------------------------------------
// Ogni `alias.classe` di un componente di src/ui esiste come selettore nel modulo CSS importato con quell'alias. Né il
// compilatore (il tipo di una classe è `string | undefined`) né i test della UI (in Vitest un modulo CSS è un proxy che
// risponde a ogni nome) vedono una classe mancante, che nel DOM diventa la parola `undefined`.
// L'alias non va riusato come variabile locale nello stesso file: le sue proprietà sembrerebbero classi.
// =============================================================================
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const UI = join(import.meta.dirname, '..', 'src', 'ui');
const IMPORT_CSS = /^import (\w+) from '\.\/(\w+\.module\.css)';$/gm;

/** Le classi che `codice` legge da `alias` e che `css` non definisce. */
export function classiMancanti(codice, alias, css) {
  const definite = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  const usate = codice.matchAll(new RegExp(`(?<![\\w.])${alias}\\.([a-zA-Z_]\\w*)`, 'g'));
  return [...new Set([...usate].map((m) => m[1]))].filter((c) => !definite.has(c));
}

describe('Classi dei CSS Modules — INV-23 (audit P3-29)', () => {
  it('autotest: riconosce una classe usata e non definita', () => {
    expect(classiMancanti('<div className={`${s.card} ${s.extra}`} />', 's', '.card { color: red }')).toEqual([
      'extra',
    ]);
  });

  it('ogni classe usata dai componenti esiste nel loro modulo CSS', () => {
    const mancanti = [];
    for (const file of readdirSync(UI).filter((n) => n.endsWith('.tsx') && !n.endsWith('.test.tsx'))) {
      const codice = readFileSync(join(UI, file), 'utf8');
      for (const [, alias, modulo] of codice.matchAll(IMPORT_CSS))
        for (const c of classiMancanti(codice, alias, readFileSync(join(UI, modulo), 'utf8')))
          mancanti.push(`${file}: ${alias}.${c}`);
    }
    expect(mancanti).toEqual([]);
  });
});
