import { describe, expect, it } from 'vitest';
import { pickLanguage } from './language';

describe('Lingua — MECCANISMI §23', () => {
  it('prima lingua del dispositivo, in ordine di preferenza, fra it/en/es/pt/fr/de', () => {
    expect(pickLanguage(['it-IT', 'en-US'])).toBe('it');
    expect(pickLanguage(['ja-JP', 'de-AT', 'fr'])).toBe('de');
    expect(pickLanguage(['pt-BR'])).toBe('pt');
    expect(pickLanguage(['ES'])).toBe('es');
    expect(pickLanguage(['fr_CA'])).toBe('fr');
  });

  it('altrimenti en', () => {
    expect(pickLanguage(['ja-JP', 'zh-Hans-CN'])).toBe('en');
    expect(pickLanguage([])).toBe('en');
  });
});
