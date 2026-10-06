import { describe, expect, it } from 'vitest';
import { IMPOSTAZIONI_DEFAULT, readableSettings } from './settings';

describe('Impostazioni — FUNZIONALITA §23', () => {
  it('predefiniti: animazioni auto, celebrazioni sobria, aptico acceso, settimana dal lunedì; un campo non valido vale il suo predefinito', () => {
    expect(readableSettings(undefined)).toEqual(IMPOSTAZIONI_DEFAULT);
    expect(IMPOSTAZIONI_DEFAULT).toEqual({
      animazioni: 'auto',
      celebrazioni: 'sobria',
      aptico: true,
      inizioSettimana: 1,
    });
    expect(readableSettings({ animazioni: 'mai', celebrazioni: 'festa', aptico: 'no', inizioSettimana: 0 })).toEqual({
      animazioni: 'mai',
      celebrazioni: 'sobria',
      aptico: true,
      inizioSettimana: 0,
    });
  });
});
