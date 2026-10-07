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
      modelloAi: 'flash',
      linguaRisposte: 'auto',
    });
    expect(readableSettings({ animazioni: 'mai', celebrazioni: 'festa', aptico: 'no', inizioSettimana: 0 })).toEqual({
      ...IMPOSTAZIONI_DEFAULT,
      animazioni: 'mai',
      inizioSettimana: 0,
    });
  });
});

describe('Modello e lingua delle risposte — MECCANISMI §18, FUNZIONALITA §16', () => {
  it('Gemini 2.5 Flash e risposte «Automatica» di default (S22); Pro e una delle sei lingue si possono scegliere', () => {
    expect(readableSettings({ modelloAi: 'pro', linguaRisposte: 'en' })).toMatchObject({
      modelloAi: 'pro',
      linguaRisposte: 'en',
    });
    expect(readableSettings({ modelloAi: 'ultra', linguaRisposte: 'klingon' })).toMatchObject({
      modelloAi: 'flash',
      linguaRisposte: 'auto',
    });
  });
});
