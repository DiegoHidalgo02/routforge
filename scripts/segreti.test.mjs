// =============================================================================
// Nessun segreto nei file del repository — invariante INV-9 (decisione D-SEC-1)
// -----------------------------------------------------------------------------
// Fonte: CLAUDE.md §8 ("mai committare chiavi o .env"; la chiave Gemini vive solo sul dispositivo).
// Cerca le forme di chiave più probabili in questo progetto in tutti i file di testo, esclusi
// node_modules, .git, dist, coverage, le uscite di Gradle del progetto Android (build, .gradle: generate e ignorate da
// git, decine di MB fra APK e intermedi), il lockfile e questo file (che contiene i pattern, non chiavi).
// =============================================================================
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const QUESTO = import.meta.filename;
const RADICE = join(import.meta.dirname, '..');

export const PATTERN = [
  [/\bAIza[0-9A-Za-z_-]{35}\b/, 'chiave API Google (Gemini)'],
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/, 'chiave privata'],
  [/\bsk-[A-Za-z0-9]{20,}\b/, 'chiave API OpenAI'],
  [/\bghp_[A-Za-z0-9]{36}\b/, 'token GitHub'],
  [/\beyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/, 'token JWT'],
];

const CARTELLE_ESCLUSE = new Set(['node_modules', '.git', 'dist', 'coverage', 'build', '.gradle']);
const FILE_ESCLUSI = new Set(['package-lock.json']);
const BINARI = /\.(png|jpe?g|gif|webp|ico|zip|pdf|woff2?|ttf|otf)$/i;

function fileTesto(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return CARTELLE_ESCLUSE.has(n) ? [] : fileTesto(p);
    return FILE_ESCLUSI.has(n) || BINARI.test(n) || p === QUESTO ? [] : [p];
  });
}

/** Segreti trovati in un testo: [descrizione]. */
export const segretiIn = (testo) => PATTERN.filter(([re]) => re.test(testo)).map(([, cosa]) => cosa);

describe('Segreti — CLAUDE.md §8 (INV-9)', () => {
  it('nessun file del repository contiene chiavi o token', () => {
    const trovati = fileTesto(RADICE).flatMap((p) =>
      segretiIn(readFileSync(p, 'utf8')).map((cosa) => `${relative(RADICE, p).split(sep).join('/')}: ${cosa}`),
    );
    expect(trovati).toEqual([]);
  });

  it('i pattern riconoscono davvero le chiavi (autotest, chiavi finte costruite a runtime)', () => {
    expect(segretiIn(`chiave=${'AIza'}${'A'.repeat(35)}`)).toEqual(['chiave API Google (Gemini)']);
    expect(segretiIn(`${'-----BEGIN '}PRIVATE KEY-----`)).toEqual(['chiave privata']);
    expect(segretiIn(`openai=${'sk-'}${'a'.repeat(24)}`)).toEqual(['chiave API OpenAI']);
    expect(segretiIn(`token ${'ghp_'}${'x'.repeat(36)}`)).toEqual(['token GitHub']);
    const segmento = `${'eyJ'}${'a'.repeat(24)}`;
    expect(segretiIn(`bearer ${segmento}.${segmento}.${'b'.repeat(12)}`)).toEqual(['token JWT']);
    expect(segretiIn('testo normale con AIza breve, sk-corta e eyJ.eyJ.x')).toEqual([]);
  });
});
