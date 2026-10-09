import { describe, expect, it } from 'vitest';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import italiano from './it.json';
import pt from './pt.json';
import { formaPlurale } from './index';

const segnaposto = (x: string) => [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Sei lingue complete — MECCANISMI §23, FUNZIONALITA §22 (T-031)', () => {
  it('ogni testo esiste, non è vuoto e ha gli stessi segnaposto dell’italiano', () => {
    for (const [lingua, d] of Object.entries({ en, es, fr, de, pt }) as [string, Record<string, string>][])
      for (const [chiave, testo] of Object.entries(italiano)) {
        expect(d[chiave], `${lingua}.${chiave}`).toBeTruthy();
        expect(segnaposto(d[chiave] ?? ''), `${lingua}.${chiave}`).toEqual(segnaposto(testo));
      }
  });
});

describe('Forme plurali — MECCANISMI §23, FUNZIONALITA §22 (audit P3-22)', () => {
  it('lo zero è singolare in francese e portoghese, plurale in italiano, inglese, spagnolo e tedesco', () => {
    expect(formaPlurale('fr', 0)).toBe(true);
    expect(formaPlurale('pt', 0)).toBe(true);
    expect((['it', 'en', 'es', 'de'] as const).map((l) => formaPlurale(l, 0))).toEqual([false, false, false, false]);
    expect(formaPlurale('it', 1)).toBe(true);
    expect(formaPlurale('fr', 2)).toBe(false);
  });
});
