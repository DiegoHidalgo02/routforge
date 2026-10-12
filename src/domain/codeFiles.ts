/**
 * File di codice dell'utente. Fonti: MECCANISMI §17, FUNZIONALITA §10; criterio: T-025 («test delle esclusioni»).
 * Decisione: D-CODE-1.
 *
 * Esclusi: cartelle tecniche, file `.env*`, lock file, log, file di sistema; ammesse le estensioni dei linguaggi comuni
 * e i file noti senza estensione; al più 500 KB per file. Si contano i saltati. Il contenuto serve solo all'AI (T-026);
 * l'utente vede l'albero delle cartelle, non il contenuto.
 */
import { fileNameOf } from './course/parser';

/** Limite per file (§17): 500 KB. */
const MAX_BYTE_CODICE = 500 * 1024;

export type MotivoEsclusione =
  | 'cartella_tecnica'
  | 'segreto'
  | 'lock'
  | 'log'
  | 'sistema'
  | 'estensione'
  | 'troppo_grande'
  /** Uno ZIP che non si apre. */
  | 'illeggibile';

/** Un file caricato (§17): il contenuto per l'AI, o il motivo per cui è escluso. */
export interface FileCodice {
  id: string;
  corsoId: string | null;
  unitaId: string | null;
  /** Da una sessione libera senza unità (FUNZ §10). */
  sessioneId: string | null;
  /** Il caricamento (uno ZIP o un gruppo di file): si elimina insieme. */
  caricamento: string;
  nomeCaricamento: string;
  percorso: string;
  byte: number;
  /** Il testo per l'AI; `null` per un escluso. */
  contenuto: string | null;
  motivo: MotivoEsclusione | null;
  /** Una cartella tecnica esclusa è una riga sola: quanti file conteneva. */
  file?: number;
}

/** Cartelle tecniche (confronto in minuscolo, a qualsiasi profondità: D-CODE-1): dipendenze, build, cache, ambienti, editor. */
const CARTELLE_TECNICHE = new Set(
  (
    'node_modules bower_components .yarn .git .hg .svn dist build out .output _build .build target coverage .next ' +
    '.nuxt .svelte-kit .cache .parcel-cache .turbo .vite .venv venv site-packages __pycache__ .pytest_cache ' +
    '.mypy_cache .tox .gradle .idea .vscode .vs .terraform bin obj vendor pods deriveddata .dart_tool __macosx'
  ).split(' '),
);
const LOCK =
  /^(package-lock\.json|npm-shrinkwrap\.json|packages\.lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|Pipfile\.lock|composer\.lock|Gemfile\.lock|go\.sum|.+\.lock)$/i;
/** File di sistema e di AppleDouble (`._nome`). */
const SISTEMA = /^(\.DS_Store|Thumbs\.db|desktop\.ini|\.directory|Icon\r|\._.*)$/i;
const ESTENSIONI = new Set(
  (
    'js mjs cjs jsx ts mts cts tsx vue svelte astro html htm css scss sass less json jsonc yaml yml toml ini xml md mdx ' +
    'txt py pyi ipynb rb php java kt kts scala groovy gradle c h cc cpp cxx hpp hh cs fs vb csproj sln go rs swift m mm ' +
    'dart lua r jl pl pm sh bash zsh fish ps1 bat cmd sql graphql gql proto prisma tf hcl ex exs erl hs ml elm clj cljs ' +
    'nim zig sol vy cmake ejs hbs pug erb cshtml razor twig j2 njk'
  ).split(' '),
);
/** File noti senza estensione o col nome che è già il tipo (confronto in minuscolo). */
const NOTI = new Set(
  (
    'dockerfile makefile procfile gemfile rakefile jenkinsfile vagrantfile pipfile podfile cmakelists.txt go.mod ' +
    'go.work license readme .gitignore .gitattributes .editorconfig .prettierrc .eslintrc .babelrc .nvmrc .dockerignore'
  ).split(' '),
);

/** I percorsi degli ZIP di Windows usano `\`: si portano a `/` prima di classificarli e salvarli. */
export const normalizePath = (percorso: string): string => percorso.replace(/\\/g, '/');

/** La prima cartella tecnica del percorso, se c'è (per contare una volta sola i suoi file). */
export function technicalFolder(percorso: string): string | null {
  const parti = normalizePath(percorso).split('/').slice(0, -1);
  const i = parti.findIndex((p) => CARTELLE_TECNICHE.has(p.toLowerCase()));
  return i < 0 ? null : `${parti.slice(0, i + 1).join('/')}/`;
}

/** Perché un file non entra (§17), o `null` se entra. */
export function exclusionReason(percorso: string, byte: number): MotivoEsclusione | null {
  const nome = fileNameOf(normalizePath(percorso));
  if (technicalFolder(percorso)) return 'cartella_tecnica';
  // `.env*` (§17): `.env`, `.env.local`, `.envrc`, `.env-cmdrc.json`…
  if (/^\.env/i.test(nome)) return 'segreto';
  if (LOCK.test(nome)) return 'lock';
  if (/\.log$/i.test(nome)) return 'log';
  if (SISTEMA.test(nome)) return 'sistema';
  const punto = nome.lastIndexOf('.');
  const estensione = punto > 0 ? nome.slice(punto + 1).toLowerCase() : '';
  const noto = NOTI.has(nome.toLowerCase()) || /^dockerfile\./i.test(nome);
  if (!noto && !ESTENSIONI.has(estensione)) return 'estensione';
  if (byte > MAX_BYTE_CODICE) return 'troppo_grande';
  return null;
}

/** Tetti di un caricamento (D-CODE-1): lo ZIP letto per intero, i file ammessi e i loro byte. */
export const MAX_BYTE_ZIP = 100 * 1024 * 1024;
export const MAX_FILE_AMMESSI = 5000;
export const MAX_BYTE_AMMESSI = 20 * 1024 * 1024;

type Voce = { percorso: string; byte: number; motivo: MotivoEsclusione | null; file?: number };

/**
 * Le voci da salvare: una cartella tecnica esclusa diventa una riga sola col numero dei suoi file; lo stesso percorso
 * ripetuto nel caricamento (due ZIP) resta una volta, l'ultimo.
 */
export function collapseUpload<V extends Voce>(
  voci: readonly V[],
  cartella: (percorso: string, n: number, byte: number) => V,
): V[] {
  const cartelle = new Map<string, { n: number; byte: number }>();
  const altre = new Map<string, V>();
  for (const v of voci) {
    const c = v.motivo === 'cartella_tecnica' ? technicalFolder(v.percorso) : null;
    if (!c) {
      altre.set(v.percorso, v);
      continue;
    }
    const prima = cartelle.get(c) ?? { n: 0, byte: 0 };
    cartelle.set(c, { n: prima.n + 1, byte: prima.byte + v.byte });
  }
  return [...altre.values(), ...[...cartelle].map(([p, { n, byte }]) => cartella(p, n, byte))];
}

/** I saltati (§17): una cartella tecnica vale i suoi file. */
export const excludedCount = (voci: readonly Voce[]): number =>
  voci.filter((v) => v.motivo).reduce((n, v) => n + (v.file ?? 1), 0);

/** Una riga dell'albero: cartella (`dimensione: null`) o file, rientrato per livello. */
interface RigaAlbero {
  percorso: string;
  nome: string;
  livello: number;
  cartella: boolean;
  byte: number | null;
  motivo: MotivoEsclusione | null;
}

/** L'albero delle cartelle (FUNZ §10): cartelle prima dei file, in ordine alfabetico, a ogni livello. */
export function codeTree(file: readonly { percorso: string; byte: number; motivo: MotivoEsclusione | null }[]) {
  const righe: RigaAlbero[] = [];
  const visita = (prefisso: string, livello: number) => {
    const qui = file.filter((f) => f.percorso.startsWith(prefisso));
    const cartelle = [
      ...new Set(
        qui
          .map((f) => f.percorso.slice(prefisso.length))
          .filter((r) => r.includes('/'))
          .map((r) => r.split('/')[0]!),
      ),
    ].sort();
    for (const c of cartelle) {
      // Una cartella tecnica esclusa è una riga sola col suo motivo, senza figli
      const esclusa = qui.find((x) => x.percorso === `${prefisso}${c}/`);
      righe.push({
        percorso: `${prefisso}${c}/`,
        nome: `${c}/`,
        livello,
        cartella: true,
        byte: esclusa?.byte ?? null,
        motivo: esclusa?.motivo ?? null,
      });
      if (!esclusa) visita(`${prefisso}${c}/`, livello + 1);
    }
    for (const f of qui
      .filter((x) => !x.percorso.slice(prefisso.length).includes('/'))
      .sort((a, b) => (a.percorso < b.percorso ? -1 : 1)))
      righe.push({
        percorso: f.percorso,
        nome: fileNameOf(f.percorso),
        livello,
        cartella: false,
        byte: f.byte,
        motivo: f.motivo,
      });
  };
  visita('', 0);
  return righe;
}
