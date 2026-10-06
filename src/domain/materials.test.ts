import { describe, expect, it } from 'vitest';
import {
  extractedText,
  isGroundable,
  linkUrl,
  MAX_CARATTERI_ESTRATTI,
  moveMaterials,
  pdfTooLarge,
  type Materiale,
} from './materials';

describe('Materiali — MECCANISMI §17, SCENARI H2', () => {
  it('PDF testuale groundabile, scansionato passivo, oltre 20 MB rifiutato; testo delle prime 40 pagine e al più 60.000 caratteri', () => {
    expect(pdfTooLarge(3 * 1024 * 1024)).toBe(false);
    expect(pdfTooLarge(25 * 1024 * 1024)).toBe(true);
    expect(pdfTooLarge(20 * 1024 * 1024)).toBe(false);
    const testo = extractedText(['  Event   loop\n', '', 'Microtask']);
    expect(testo).toBe('Event loop\n\nMicrotask');
    expect(isGroundable({ tipo: 'pdf', testoEstratto: testo })).toBe(true);
    // Scansionato: nessun testo nelle pagine → passivo
    expect(extractedText(['', '  ', '\n'])).toBeNull();
    expect(isGroundable({ tipo: 'pdf', testoEstratto: null })).toBe(false);
    expect(isGroundable({ tipo: 'nota' })).toBe(true);
    // 41 pagine corte: la 41ª non entra
    expect(extractedText(Array.from({ length: 41 }, (_, i) => `p${i + 1}`))).not.toContain('p41');
    // 41 pagine lunghe: il testo si taglia a 60.000 caratteri
    const pagine = Array.from({ length: 41 }, (_, i) => (i === 40 ? 'ultima' : 'x'.repeat(2000)));
    const lungo = extractedText(pagine)!;
    expect(lungo).not.toContain('ultima');
    expect(lungo).toHaveLength(MAX_CARATTERI_ESTRATTI);
  });

  it('link: protocollo aggiunto se manca; uno schema diverso da http/https non resta eseguibile', () => {
    expect(linkUrl(' youtube.com/watch?v=cCOL7MC4Pl0 ')).toBe('https://youtube.com/watch?v=cCOL7MC4Pl0');
    expect(linkUrl('http://example.org')).toBe('http://example.org');
    expect(linkUrl('javascript:alert(1)')).toBe('https://alert(1)');
    // «host:porta» non è uno schema
    expect(linkUrl('localhost:5173')).toBe('https://localhost:5173');
    expect(linkUrl('example.com:8080/x')).toBe('https://example.com:8080/x');
  });

  it('reimport: i materiali passano all’unità con lo stesso numero del corso nuovo; senza corrispondenza restano sul corso', () => {
    const m = (id: string, unitaId: string | null): Materiale => ({
      id,
      corsoId: 'vecchio',
      unitaId,
      tipo: 'nota',
      titolo: id,
    });
    const spostati = moveMaterials(
      [m('a', 'v:0.7'), m('b', 'v:9.9'), m('c', null)],
      new Map([
        ['v:0.7', '0.7'],
        ['v:9.9', '9.9'],
      ]),
      new Map([['0.7', 'n:0.7']]),
      'nuovo',
    );
    expect(spostati.map((x) => [x.id, x.corsoId, x.unitaId])).toEqual([
      ['a', 'nuovo', 'n:0.7'],
      ['b', 'nuovo', null],
      ['c', 'nuovo', null],
    ]);
  });
});
