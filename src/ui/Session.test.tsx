// @vitest-environment jsdom
// Sessione (MECC §10.1–§10.4, S15), la parte che vive nella UI: il setup con una sessione già attiva porta al timer
// (SCENARI D6), «Inizia» dal recupero scrive la sessione sul blocco (SCENARI C5), il banner riporta al timer (D4) e
// l'iperfocus chiede conferma all'uscita (D5). Il resto sta nei test di `domain/session`, `domain/timer` e `app/session`.
// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appDb } from '../app/db';
import { readActiveSession, startSession } from '../app/session';
import type { SceltaSessione } from '../domain/session';
import { local } from '../domain/time';
import { ActiveSession, SessionBanner, SessionSetup, useSessionView } from './Session';

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
const scelta = (over: Partial<SceltaSessione> = {}): SceltaSessione => ({
  unitaId: null,
  corsoId: null,
  durata: 50,
  modalita: 'continua',
  iperfocus: false,
  ...over,
});
/** Il banner come lo mostra la Shell su mobile. */
function Banner() {
  const vista = useSessionView();
  return vista ? createElement(SessionBanner, { vista, variante: 'banner' }) : null;
}
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
    // Il timer della sessione su s1 (routine 09:00–10:00 avviata alle 10:20: recupero da 50)
    await vi.waitFor(() => expect(box.textContent).toContain('Finish'));
    expect(box.textContent).toContain('50:00');
  });
});

describe('Persistenza — SCENARI D4 (UI)', () => {
  it('riaperta 12 minuti dopo, il banner mostra la sessione e «Resume» riporta al timer', async () => {
    await startSession(appDb, null, scelta(), ADESSO, FUSO);
    vi.setSystemTime(ADESSO + 12 * 60_000);
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/'] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: '/', element: createElement(Banner) }),
          createElement(Route, { path: '/sessione', element: createElement(ActiveSession) }),
        ),
      ),
    );
    await vi.waitFor(() => expect(box.textContent).toContain('Session in progress · 38:00'));
    [...box.querySelectorAll('a')].find((a) => a.textContent === 'Resume')!.click();
    await vi.waitFor(() => expect(box.textContent).toContain('Finish'));
    expect(box.textContent).toContain('38:00');
  });
});

describe('Iperfocus — SCENARI D5 (UI)', () => {
  it('uscita bloccata con l’ora di sblocco; «Exit anyway» registra l’interruzione e sblocca', async () => {
    await startSession(appDb, null, scelta({ iperfocus: true }), ADESSO, FUSO);
    mostra('/sessione');
    await vi.waitFor(() => expect(box.textContent).toContain('Exit unlocks at 11:10'));
    expect(box.textContent).not.toContain('Finish');
    // L'indietro del sistema resta sul timer e chiede conferma
    window.dispatchEvent(new PopStateEvent('popstate'));
    await vi.waitFor(() => expect(box.querySelector('[role="dialog"]')?.textContent).toContain('Exit locked'));
    bottone('Stay').click();
    await vi.waitFor(() => expect(box.querySelector('[role="dialog"]')).toBeNull());
    bottone('Exit').click();
    await vi.waitFor(() => expect(box.querySelector('[role="dialog"]')?.textContent).toContain('Exit locked'));
    bottone('Stay').click();
    await vi.waitFor(() => expect(box.querySelector('[role="dialog"]')).toBeNull());
    bottone('Exit').click();
    await vi.waitFor(() => expect(box.textContent).toContain('Exit anyway'));
    bottone('Exit anyway').click();
    await vi.waitFor(() => expect(box.textContent).toContain('Finish'));
    expect(box.textContent).toContain('“Hyperfocus” interruption recorded');
    expect((await readActiveSession(appDb))?.interruzioni).toMatchObject([{ iperfocus: true }]);
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
    await vi.waitFor(() => expect(box.textContent).toContain('Finish'));
    expect(box.textContent).toContain('catch-up');
    expect(await readActiveSession(appDb)).toMatchObject({ bloccoId: 's1', contesto: 'recupero', durata: 50 });
  });
});
