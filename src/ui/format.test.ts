import { describe, expect, it } from 'vitest';
import { dimensione } from './format';

describe('Dimensioni in byte — MECCANISMI §17, §23 (audit P3-14)', () => {
  it('sempre in base 1024, come il limite di 20 MB dei PDF: 20 MiB si leggono «20 MB» in Materiali e in Diagnostica', () => {
    expect(dimensione(20 * 1024 * 1024)).toBe('20 MB');
    expect(dimensione(2 * 1024 ** 3)).toBe('2 GB');
    expect(dimensione(84 * 1024)).toBe('84 KB');
    expect(dimensione(0)).toBe('0 KB');
  });
});
