import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { local } from '../domain/time';
import { ErroreImportCorso, importCourseFromZip } from './courseImport';

/** Un modulo minimo conforme a FORMATO_CORSO §2 (basta per superare MODULE_HEADER + un'unità leggibile). */
const M1 = `# MODULO M1 — Tooling Moderno

**Tipo:** NUOVO CONTENUTO
**Prerequisiti:** —

#### Unità 1.1 — Node e npm
**🎯 Concetto Core: il runtime**
Node esegue JavaScript fuori dal browser.
`;

const M3 = `## MODULO 3 - Backend

**Tipo:** NUOVO CONTENUTO
**Prerequisiti:** M1

#### Unità 3.1 — Node server
**🎯 Concetto Core: HTTP**
Testo.
`;

const M2_BROKEN = `# Modulo senza intestazione valida

**Tipo:** NUOVO CONTENUTO
#### Unità 2.1 — Orfana
`;

const STRUTTURA = `# Syllabus Software Engineer 2026
## Percorso autodidatta in 5 moduli
`;

const opts = { corsoId: 'corso-1', now: local(2026, 9, 22, 10, 0) };

describe('Import corso da ZIP — SCENARI H1', () => {
  const zip = zipSync({
    'sub/00_struttura.md': strToU8(STRUTTURA),
    'M3-Backend.md': strToU8(M3),
    'sub2/M1-Tooling_Moderno.md': strToU8(M1),
    'note.txt': strToU8('# MODULO M9 — non deve essere letto'),
    'M2-Rotto.md': strToU8(M2_BROKEN),
  });

  it('end-to-end da uno ZIP reale: 2 moduli in ordine 1, 3; il .txt è ignorato; M2 genera un avviso ed è saltato', () => {
    const { corso, avvisi } = importCourseFromZip(zip, opts);
    expect(corso.moduli.map((m) => m.numero)).toEqual([1, 3]);
    expect(corso.titolo).toBe('Syllabus Software Engineer 2026');
    expect(avvisi.some((w) => w.file === 'M2-Rotto.md' && /intestazione di modulo mancante/.test(w.messaggio))).toBe(
      true,
    );
    expect(avvisi.some((w) => /M9/.test(w.messaggio))).toBe(false);
  });

  it('un secondo import dello stesso ZIP crea un secondo corso identico (id diverso)', () => {
    const a = importCourseFromZip(zip, opts);
    const b = importCourseFromZip(zip, { ...opts, corsoId: 'corso-2' });
    expect(b.corso.id).not.toBe(a.corso.id);
    const strip = (o: unknown) => JSON.parse(JSON.stringify(o).replaceAll('corso-2', 'corso-1'));
    expect(strip(b.corso)).toEqual(a.corso);
    expect(b.avvisi).toEqual(a.avvisi);
  });

  it('ZIP senza moduli → errore leggibile', () => {
    const senzaModuli = zipSync({ 'README.md': strToU8('# ciao') });
    expect(() => importCourseFromZip(senzaModuli, opts)).toThrow(ErroreImportCorso);
  });
});
