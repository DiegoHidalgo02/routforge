// @vitest-environment jsdom
// Flashcard (MECC §19; T-027): «Niente» rimette la carta in fondo alla coda della stessa sessione (SCENARI I1); la regola
// SM-2 sta nel dominio (`sm2.ts`) e il salvataggio in `app/practice`, testati lì: qui la coda delle carte da girare.
// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appDb } from '../app/db';
import { DeckScreen } from './Practice';

let box: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  await Promise.all(appDb.tables.map((t) => t.clear()));
  // Un mazzo con una carta nuova, dovuta subito (la UI non importa `data`: le righe si scrivono con Dexie)
  const riga = { createdAt: 0, updatedAt: 0, deletedAt: null };
  await appDb.mazzi.put({ id: 'm1', unitaId: 'u1', creatoIl: 0, ...riga });
  await appDb.carte.put({
    id: 'c1',
    mazzoId: 'm1',
    fronte: 'Microtask?',
    retro: 'Prima del prossimo task',
    citazione: '',
    valutazioni: [],
    facilita: 2.5,
    intervalloGiorni: 0,
    scadenza: 0,
    ...riga,
  });
  box = document.body.appendChild(document.createElement('div'));
  root = createRoot(box);
});
afterEach(() => {
  root.unmount();
  box.remove();
});

const bottone = (testo: string) => [...box.querySelectorAll('button')].find((b) => b.textContent?.trim() === testo)!;

describe('Flashcard — SCENARI I1 (UI della coda)', () => {
  it('«Niente» ripropone la carta nella stessa sessione; «Bene» la chiude e il mazzo è finito', async () => {
    root.render(
      createElement(
        MemoryRouter,
        { initialEntries: ['/mazzo/m1'] },
        createElement(Routes, null, createElement(Route, { path: '/mazzo/:id', element: createElement(DeckScreen) })),
      ),
    );
    await vi.waitFor(() => expect(box.textContent).toContain('Microtask?'));
    expect(box.textContent).toContain('1 / 1');
    bottone('Show answer').click();
    await vi.waitFor(() => expect(box.textContent).toContain('Prima del prossimo task'));
    bottone('Again').click();
    // La stessa carta torna in fondo alla coda: seconda di due, già ripassata una volta
    await vi.waitFor(() => expect(box.textContent).toContain('2 / 2'));
    expect(box.textContent).toContain('Microtask?');
    expect(box.textContent).toContain('reviewed once');
    bottone('Show answer').click();
    await vi.waitFor(() => expect(bottone('Good')).toBeDefined());
    bottone('Good').click();
    await vi.waitFor(() => expect(box.textContent).toContain('Deck reviewed'));
    expect(await appDb.carte.get('c1')).toMatchObject({
      valutazioni: [{ valutazione: 'niente' }, { valutazione: 'bene' }],
    });
  });
});
