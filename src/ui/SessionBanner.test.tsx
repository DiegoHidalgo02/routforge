// @vitest-environment jsdom
// La sessione attiva letta da una sola query live, condivisa da Shell, banner e Sessione (MECC §10.4; audit N-8).
// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { createElement, Fragment } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { watch } from '../app/db';
import { SessionBannerSlot } from './SessionBanner';

// `watch` vero, contato: ogni query live aperta passa di qui
vi.mock('../app/db', async (originale) => {
  const m = await originale<typeof import('../app/db')>();
  return { ...m, watch: vi.fn(m.watch) };
});

let box: HTMLDivElement;
let root: Root;
beforeEach(() => {
  box = document.body.appendChild(document.createElement('div'));
  root = createRoot(box);
});
afterEach(() => {
  root.unmount();
  box.remove();
  vi.mocked(watch).mockClear();
});

describe('Sessione attiva condivisa — MECCANISMI §10.4 (audit N-8)', () => {
  it('tre banner sulla stessa pagina aprono una sola query live sulla sessione', async () => {
    root.render(
      createElement(
        MemoryRouter,
        null,
        createElement(
          Fragment,
          null,
          createElement(SessionBannerSlot),
          createElement(SessionBannerSlot),
          createElement(SessionBannerSlot),
        ),
      ),
    );
    await vi.waitFor(() => expect(watch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    expect(watch).toHaveBeenCalledTimes(1);
  });
});
