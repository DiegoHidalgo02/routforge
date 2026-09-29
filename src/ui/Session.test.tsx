// @vitest-environment jsdom
// Setup della sessione (MECC §10.1, S15 `setup`), la parte che vive nella UI: il setup con una sessione già attiva porta
// al timer (SCENARI D6) e «Inizia» dal recupero scrive la sessione sul blocco (SCENARI C5). Il resto sta nei test di
// `domain/session` e `app/session`.
// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appDb } from '../app/db';
import { readActiveSession, startSession } from '../app/session';
import { local } from '../domain/time';
import { ActiveSession, SessionSetup } from './Session';

const FUSO = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Lunedì 28 settembre 2026 alle 10:20 (C5).
const ADESSO = local(2026, 9, 28, 10, 20);

/** Un blocco di studio senza corso, h:00–h+1:00 di oggi (la UI non importa `data`: la riga si scrive con Dexie). */
const studio = (id: string, h: number) =>
  appDb.blocchi.put({
    id,
    tipo: 'studio',
    stato: 'programmato',
    conOrario: true,
    inizio: local(2026, 9, 28, h),
    fine: local(2026, 9, 28, h + 1),
    corsoId: null,
    unitaId: null,
    titolo: 'Studio',
    giornoLocale: '2026-09-28',
    orarioInizio: `${String(h).padStart(2, '0')}:00`,
    orarioFine: `${String(h + 1).padStart(2, '0')}:00`,
    fuso: FUSO,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  });

let box: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ADESSO);
  await Promise.all(appDb.tables.map((t) => t.clear()));
  box = document.body.appendChild(document.createElement('div'));
  root = createRoot(box);
});
afterEach(() => {
  root.unmount();
  box.remove();
  vi.useRealTimers();
});

const mostra = (percorso: string) =>
  root.render(
    createElement(
      MemoryRouter,
      { initialEntries: [percorso] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/sessione/setup', element: createElement(SessionSetup) }),
        createElement(Route, { path: '/sessione', element: createElement(ActiveSession) }),
      ),
    ),
  );
const bottone = (testo: string) => [...box.querySelectorAll('button')].find((b) => b.textContent?.trim() === testo)!;

describe('Una sola sessione — SCENARI D6 (UI)', () => {
  it('con una sessione attiva, il setup da un altro blocco porta alla sessione in corso', async () => {
    await studio('s1', 9);
    await studio('s2', 10);
    await startSession(
      appDb,
      's1',
      { unitaId: null, corsoId: null, durata: 50, modalita: 'continua', iperfocus: false },
      ADESSO,
      FUSO,
    );
    mostra('/sessione/setup?blocco=s2');
    await vi.waitFor(() => expect(box.textContent).toContain('Session in progress'));
    expect(box.textContent).toContain('Started at 10:20');
  });
});

describe('Recupero tardivo e ritardo — SCENARI C5 (UI)', () => {
  it('il setup delle 10:20 propone il recupero; «50» e «Start» mettono il blocco in corso', async () => {
    await studio('s1', 9);
    mostra('/sessione/setup?blocco=s1');
    await vi.waitFor(() => expect(box.textContent).toContain('Catch-up · occurrence of'));
    bottone('50').click();
    await vi.waitFor(() => expect(box.textContent).toContain('planned end 11:10'));
    box.querySelector<HTMLButtonElement>('[class*="inizia"]')!.click();
    await vi.waitFor(() => expect(box.textContent).toContain('Session in progress'));
    expect(await readActiveSession(appDb)).toMatchObject({ bloccoId: 's1', contesto: 'recupero', durata: 50 });
  });
});
