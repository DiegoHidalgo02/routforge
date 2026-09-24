// =============================================================================
// Regole architetturali verificate dal gate (npm run verify)
// -----------------------------------------------------------------------------
// Fonte: CLAUDE.md §3 e docs/02_ARCHITETTURA.md §1; CONTESTO §3 ("i meccanismi puri
// devono essere verificabili in isolamento").
// 1. Direzione delle dipendenze fra strati: ui → app → data → domain; platform implementa
//    le interfacce (porte) di app. Vale per gli strati che esistono; i futuri sono già coperti.
// 2. Purezza di src/domain: niente tempo corrente, casualità, I/O, API del browser o pacchetti
//    esterni. Il "now" arriva sempre come parametro.
// =============================================================================
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/** Strati raggiungibili da ciascuno strato (sé stesso incluso). */
export const DIPENDENZE_AMMESSE = {
  domain: ['domain'],
  data: ['data', 'domain'],
  app: ['app', 'data', 'domain'],
  ui: ['ui', 'app', 'domain'],
  platform: ['platform', 'app', 'domain'],
};

/** Costrutti vietati nel dominio (cercati nel codice senza commenti). */
export const VIETATI_NEL_DOMINIO = [
  [/\bDate\.now\s*\(/, 'Date.now(): il tempo corrente va passato come parametro'],
  [/\bnew Date\s*\(\s*\)/, 'new Date() senza argomenti: legge il tempo corrente'],
  [/\bMath\.random\s*\(/, 'Math.random(): risultati non deterministici'],
  [/\bconsole\./, 'console: il dominio non fa I/O'],
  [/\b(window|document|localStorage|sessionStorage|indexedDB|navigator)\b/, 'API del browser nel dominio'],
  [/\bfetch\s*\(/, 'fetch(): rete nel dominio'],
  [/\b(setTimeout|setInterval)\s*\(/, 'timer nel dominio'],
];

export const senzaCommenti = (codice) =>
  codice.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

export const importDi = (codice) =>
  [...codice.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);

function fileSorgente(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return fileSorgente(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const stratoDi = (percorso) => relative(SRC, percorso).split(sep)[0];

/** Violazioni per un file: [messaggio]. */
export function violazioni(percorso, codice) {
  const out = [];
  const strato = stratoDi(percorso);
  const ammessi = DIPENDENZE_AMMESSE[strato];
  if (!ammessi) return out; // file fuori dagli strati (es. main.tsx alla radice di src)
  for (const spec of importDi(codice)) {
    if (spec.startsWith('.')) {
      const bersaglio = stratoDi(resolve(dirname(percorso), spec));
      if (bersaglio in DIPENDENZE_AMMESSE && !ammessi.includes(bersaglio))
        out.push(`${strato} non può importare da ${bersaglio} ("${spec}")`);
    } else if (strato === 'domain') {
      out.push(`il dominio non importa pacchetti esterni ("${spec}")`);
    }
  }
  if (strato === 'domain') {
    const pulito = senzaCommenti(codice);
    for (const [re, motivo] of VIETATI_NEL_DOMINIO) if (re.test(pulito)) out.push(motivo);
  }
  return out;
}

describe('Architettura — regole del progetto', () => {
  it('nessuna violazione negli strati esistenti (direzione delle dipendenze e purezza del dominio)', () => {
    const trovate = fileSorgente(SRC).flatMap((p) =>
      violazioni(p, readFileSync(p, 'utf8')).map((v) => `${relative(SRC, p)}: ${v}`),
    );
    expect(trovate).toEqual([]);
  });

  it('il controllo riconosce davvero le violazioni (autotest)', () => {
    const inDominio = join(SRC, 'domain', 'finto.ts');
    expect(violazioni(inDominio, 'const t = Date.now();')).toHaveLength(1);
    expect(violazioni(inDominio, 'const d = new Date();')).toHaveLength(1);
    expect(violazioni(inDominio, "import x from 'dexie';")).toHaveLength(1);
    expect(violazioni(inDominio, "import { a } from '../data/repo';")).toHaveLength(1);
    expect(violazioni(inDominio, '// Date.now() citato in un commento\nconst d = new Date(ms);')).toEqual([]);
    expect(violazioni(join(SRC, 'data', 'repo.ts'), "import { u } from '../ui/Oggi';")).toHaveLength(1);
    expect(violazioni(join(SRC, 'ui', 'Oggi.tsx'), "import { s } from '../app/scheduler';")).toEqual([]);
  });
});
