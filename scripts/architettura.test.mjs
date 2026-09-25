// =============================================================================
// Regole architetturali verificate dal gate (npm run verify) — invarianti INV-1, INV-2, INV-3
// -----------------------------------------------------------------------------
// Fonte: CLAUDE.md §3 e docs/02_ARCHITETTURA.md §1; CONTESTO §3 ("i meccanismi puri
// devono essere verificabili in isolamento"); elenco completo in docs/INVARIANTI.md.
// 1. Direzione delle dipendenze fra strati: ui → app → data → domain; platform implementa
//    le interfacce (porte) di app e da app importa SOLO src/app/ports. Nessun import esce da src/ né raggiunge un file
//    di src fuori dagli strati (main.tsx è il punto di composizione: importa gli strati, nessuno strato importa lui).
// 2. Purezza di src/domain, test inclusi: niente tempo corrente, fuso o localizzazione (Intl), casualità, I/O,
//    API del browser o pacchetti esterni (i test possono importare solo `vitest`). Il "now" arriva sempre come parametro.
// 3. Ogni modulo di dominio è esportato da src/domain/index.ts: un solo punto d'ingresso, nessun modulo orfano.
// 4. I pacchetti che parlano con la persistenza o con la piattaforma si importano solo nel loro strato (`dexie` e i
//    suoi add-on in data; Capacitor e client AI in platform): da ui o app salterebbero data o le porte. React e le
//    librerie della UI solo in ui: i servizi di app restano senza framework.
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
  [/\bnew Date\b(?!\s*\()/, 'new Date senza parentesi: legge il tempo corrente'],
  [/\bIntl\./, 'Intl: fuso orario e localizzazione non si leggono nel dominio'],
  [/\bMath\.random\s*\(/, 'Math.random(): risultati non deterministici'],
  [/\bconsole\./, 'console: il dominio non fa I/O'],
  [/\b(window|document|localStorage|sessionStorage|indexedDB|navigator)\b/, 'API del browser nel dominio'],
  [/\bfetch\s*\(/, 'fetch(): rete nel dominio'],
  [/\b(setTimeout|setInterval)\s*\(/, 'timer nel dominio'],
];

/** Pacchetti esterni legati a uno strato (regola 4): altrove aggirerebbero `data` o le porte (INV-1). */
export const PACCHETTI_DI_STRATO = [
  [/^dexie($|[/-])/, 'data'],
  [/^@capacitor(-community)?\//, 'platform'],
  [/^@google\/genai(\/|$)/, 'platform'],
  [/^(react|react-dom|react-router|lucide-react)(\/|$)/, 'ui'],
];

/** Unico pacchetto esterno ammesso nei test del dominio. */
const PACCHETTI_AMMESSI_NEI_TEST = ['vitest'];

export const senzaCommenti = (codice) => codice.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

export const importDi = (codice) =>
  [...codice.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g)].map((m) => m[1]);

const isTest = (percorso) => /\.test\.tsx?$/.test(percorso);

/** Tutti i file .ts/.tsx sotto `dir`, test inclusi. */
function fileTs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return fileTs(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const stratoDi = (percorso) => relative(SRC, percorso).split(sep)[0];
const dentroSrc = (percorso) => !relative(SRC, percorso).startsWith('..');
const isPorta = (percorso) => /[\\/]ports[\\/]/.test(percorso);

/** Violazioni per un file: [messaggio]. */
export function violazioni(percorso, codice) {
  const out = [];
  const strato = stratoDi(percorso);
  const ammessi = DIPENDENZE_AMMESSE[strato];
  if (!ammessi) return out; // file fuori dagli strati (es. main.tsx alla radice di src)
  for (const spec of importDi(codice)) {
    if (spec.startsWith('.')) {
      const target = resolve(dirname(percorso), spec);
      if (!dentroSrc(target)) {
        out.push(`import fuori da src ("${spec}")`);
        continue;
      }
      const bersaglio = stratoDi(target);
      if (!ammessi.includes(bersaglio)) out.push(`${strato} non può importare da ${bersaglio} ("${spec}")`);
      else if (strato === 'platform' && bersaglio === 'app' && !isPorta(target))
        out.push(`platform importa da app solo le porte in src/app/ports ("${spec}")`);
    } else if (strato === 'domain' && !(isTest(percorso) && PACCHETTI_AMMESSI_NEI_TEST.includes(spec))) {
      out.push(`il dominio non importa pacchetti esterni ("${spec}")`);
    } else {
      const legato = PACCHETTI_DI_STRATO.find(([re]) => re.test(spec));
      if (legato && legato[1] !== strato) out.push(`${spec} si importa solo in ${legato[1]}`);
    }
  }
  if (strato === 'domain') {
    const pulito = senzaCommenti(codice);
    for (const [re, motivo] of VIETATI_NEL_DOMINIO) if (re.test(pulito)) out.push(motivo);
  }
  return out;
}

/** Moduli di dominio (senza test e senza index) non esportati dal barrel. */
export function moduliNonEsportati(indexCodice, percorsi) {
  const domain = join(SRC, 'domain');
  return percorsi
    .filter((p) => !isTest(p) && !p.endsWith(`${sep}index.ts`))
    .map(
      (p) =>
        './' +
        relative(domain, p)
          .split(sep)
          .join('/')
          .replace(/\.tsx?$/, ''),
    )
    .filter((mod) => !indexCodice.includes(`'${mod}'`));
}

describe('Architettura — regole del progetto (docs/INVARIANTI.md INV-1, INV-2, INV-3)', () => {
  it('nessuna violazione negli strati esistenti (direzione delle dipendenze e purezza del dominio, test inclusi)', () => {
    const trovate = fileTs(SRC).flatMap((p) =>
      violazioni(p, readFileSync(p, 'utf8')).map((v) => `${relative(SRC, p)}: ${v}`),
    );
    expect(trovate).toEqual([]);
  });

  it('ogni modulo di dominio è esportato da src/domain/index.ts', () => {
    const index = readFileSync(join(SRC, 'domain', 'index.ts'), 'utf8');
    expect(moduliNonEsportati(index, fileTs(join(SRC, 'domain')))).toEqual([]);
  });

  it('il controllo riconosce davvero le violazioni (autotest)', () => {
    const inDominio = join(SRC, 'domain', 'finto.ts');
    const testDominio = join(SRC, 'domain', 'finto.test.ts');
    expect(violazioni(inDominio, 'const t = Date.now();')).toHaveLength(1);
    expect(violazioni(inDominio, 'const d = new Date();')).toHaveLength(1);
    expect(violazioni(inDominio, 'const d = new Date;')).toHaveLength(1);
    expect(violazioni(inDominio, 'const z = Intl.DateTimeFormat().resolvedOptions().timeZone;')).toHaveLength(1);
    expect(violazioni(inDominio, "import x from 'dexie';")).toHaveLength(1);
    expect(violazioni(inDominio, "import { a } from '../data/repo';")).toHaveLength(1);
    expect(violazioni(inDominio, "import { a } from '../../scripts/x.mjs';")).toEqual([
      'import fuori da src ("../../scripts/x.mjs")',
    ]);
    expect(violazioni(inDominio, '// Date.now() citato in un commento\nconst d = new Date(ms);')).toEqual([]);
    expect(violazioni(testDominio, "import { it } from 'vitest';\nconst t = Date.now();")).toHaveLength(1);
    expect(violazioni(testDominio, "import { it } from 'vitest';\nimport { x } from 'lodash';")).toHaveLength(1);
    expect(violazioni(join(SRC, 'data', 'repo.ts'), "import { u } from '../ui/Oggi';")).toHaveLength(1);
    expect(violazioni(join(SRC, 'ui', 'Oggi.tsx'), "import { s } from '../app/scheduler';")).toEqual([]);
    expect(violazioni(join(SRC, 'ui', 'Oggi.tsx'), "import { liveQuery } from 'dexie';")).toEqual([
      'dexie si importa solo in data',
    ]);
    expect(violazioni(join(SRC, 'ui', 'Oggi.tsx'), "import { useLiveQuery } from 'dexie-react-hooks';")).toHaveLength(
      1,
    );
    expect(violazioni(join(SRC, 'app', 'x.ts'), "import { Filesystem } from '@capacitor/filesystem';")).toHaveLength(1);
    expect(violazioni(join(SRC, 'app', 'x.ts'), "import { useSyncExternalStore } from 'react';")).toHaveLength(1);
    expect(violazioni(join(SRC, 'ui', 'Oggi.tsx'), "import { x } from '../ponte';")).toEqual([
      'ui non può importare da ponte ("../ponte")',
    ]);
    expect(violazioni(join(SRC, 'data', 'db.ts'), "import Dexie from 'dexie';")).toEqual([]);
    const tts = "import { TextToSpeech } from '@capacitor-community/text-to-speech';";
    expect(violazioni(join(SRC, 'platform', 'tts.ts'), tts)).toEqual([]);
    const adapter = join(SRC, 'platform', 'web', 'clock.ts');
    expect(violazioni(adapter, "import type { Clock } from '../../app/ports/clock';")).toEqual([]);
    expect(violazioni(adapter, "import { SchedulerService } from '../../app/scheduler';")).toHaveLength(1);
    const domain = join(SRC, 'domain');
    const file = [
      join(domain, 'a.ts'),
      join(domain, 'corso', 'b.ts'),
      join(domain, 'a.test.ts'),
      join(domain, 'index.ts'),
    ];
    expect(moduliNonEsportati("export * from './a';", file)).toEqual(['./corso/b']);
  });
});
