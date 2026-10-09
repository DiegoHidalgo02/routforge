// @vitest-environment jsdom
// Import di uno ZIP senza 00_struttura (S10; FORMATO §1, D-PARSE-1; audit P3-31): il campo del titolo lasciato vuoto
// dà il titolo di ripiego nella lingua dell'app, non in italiano.
// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { strToU8, zipSync } from 'fflate';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { courseCards } from '../app/courses';
import { appDb } from '../app/db';
import { Courses } from './Courses';

let box: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  await Promise.all(appDb.tables.map((t) => t.clear()));
  box = document.body.appendChild(document.createElement('div'));
  root = createRoot(box);
});
afterEach(() => {
  root.unmount();
  box.remove();
  vi.restoreAllMocks();
});

describe('Titolo di ripiego dell’import — FORMATO_CORSO §1, D-PARSE-1 (audit P3-31)', () => {
  it('senza 00_struttura e col campo vuoto il corso si chiama «Imported course» in inglese', async () => {
    root.render(createElement(MemoryRouter, null, createElement(Courses)));
    const input = await vi.waitFor(() => {
      const i = box.querySelector<HTMLInputElement>('input[type="file"]');
      if (!i) throw new Error('nessun selettore del file');
      return i;
    });
    const zip = zipSync({ 'M1-Uno.md': strToU8('# MODULO M1 — Uno\n\n#### Unità 1.1 — A\n') });
    Object.defineProperty(input, 'files', {
      value: [{ name: 'corso.zip', size: zip.length, arrayBuffer: () => Promise.resolve(zip.slice().buffer) }],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    const titolo = await vi.waitFor(() => {
      const f = box.querySelector('form');
      if (!f) throw new Error('nessuna richiesta del titolo');
      return f;
    });
    titolo.requestSubmit();
    await vi.waitFor(async () => expect((await courseCards(appDb)).map((c) => c.titolo)).toEqual(['Imported course']));
  });
});
