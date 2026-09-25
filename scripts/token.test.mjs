// =============================================================================
// Token del design — invariante INV-20 (D-STACK-1; docs/03_HANDOFF_DESIGN_CODE.md §5)
// -----------------------------------------------------------------------------
// src/ui/styles/tokens.css è la copia non modificata dell'export di Claude Design: un valore nuovo nasce nel design
// e arriva con il reimport, mai scritto a mano nella copia. Confronto byte a byte: nessuna logica da autotestare.
// Il test vive in scripts/ perché l'export sta fuori da src/ (INV-1, come scripts/corso-esempio.test.mjs).
// =============================================================================
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..');
const leggi = (p) => readFileSync(join(RADICE, p), 'utf8');

describe('Token del design — docs/03_HANDOFF_DESIGN_CODE.md §5 (INV-20, D-STACK-1)', () => {
  it('src/ui/styles/tokens.css è la copia esatta di claude-design/design/tokens.css', () => {
    expect(leggi('src/ui/styles/tokens.css')).toBe(leggi('claude-design/design/tokens.css'));
  });
});
