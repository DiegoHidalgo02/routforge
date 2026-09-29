import { afterEach, describe, expect, it } from 'vitest';
import { configureSessionDevice, disableDoNotDisturb, enableDoNotDisturb, keepScreenOn } from './sessionDevice';

const guasto = () => {
  throw new Error('piattaforma');
};

afterEach(() =>
  configureSessionDevice({
    schermo: { keep: () => () => undefined },
    nonDisturbare: { enable: () => Promise.resolve(false), disable: () => undefined },
  }),
);

describe('Schermo acceso e Non Disturbare — MECCANISMI §10.4', () => {
  it('passa le chiamate alle porte e rilascia lo schermo', async () => {
    const chiamate: string[] = [];
    configureSessionDevice({
      schermo: { keep: () => (chiamate.push('acceso'), () => void chiamate.push('rilasciato')) },
      nonDisturbare: {
        enable: () => (chiamate.push('silenzio'), Promise.resolve(true)),
        disable: () => void chiamate.push('ripristino'),
      },
    });
    const rilascia = keepScreenOn();
    expect(await enableDoNotDisturb()).toBe(true);
    disableDoNotDisturb();
    rilascia();
    expect(chiamate).toEqual(['acceso', 'silenzio', 'ripristino', 'rilasciato']);
  });
  it('una porta che fallisce non arriva alla UI: senza Non Disturbare l’iperfocus vale comunque (INV-16)', async () => {
    configureSessionDevice({
      schermo: { keep: guasto },
      nonDisturbare: { enable: () => Promise.reject(new Error('negato')), disable: guasto },
    });
    expect(() => keepScreenOn()()).not.toThrow();
    expect(await enableDoNotDisturb()).toBe(false);
    expect(() => disableDoNotDisturb()).not.toThrow();
  });
});
