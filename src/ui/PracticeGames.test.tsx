// @vitest-environment jsdom
// DevSwipe, Bug Hunter e Audio Flash-Trivia in S19 (MECC §18; T-028): la riproposta a fine mazzo, la vibrazione e la
// spiegazione degli errori, i tentativi sulle righe, la playlist che avanza con la voce e «Salta», il riepilogo. Punteggi
// e playlist successiva sono testati nel dominio (`generation.test.ts`) e nel servizio (`app/practice.test.ts`); la
// voce è finta: la lettura a schermo spento si prova sul telefono.
// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appDb } from '../app/db';
import { configureVoice } from '../app/practice';
import type { EventiVoce } from '../app/ports/voice';
import { PracticeScreen } from './PracticeGames';

let box: HTMLDivElement;
let root: Root;
const vibrate = vi.fn(() => true);
beforeEach(async () => {
  await Promise.all(appDb.tables.map((t) => t.clear()));
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
  vibrate.mockClear();
  box = document.body.appendChild(document.createElement('div'));
  root = createRoot(box);
});
afterEach(() => {
  root.unmount();
  box.remove();
});

/** Una pratica salvata come la lascia la generazione (la UI non importa `data`: la riga si scrive con Dexie). */
const pratica = (tipo: string, elementi: unknown[]) =>
  appDb.pratiche.put({
    id: 'p1',
    unitaId: 'u1',
    tipo,
    creataIl: 0,
    parametri: { quantita: 10, difficolta: 'media' },
    elementi,
    risultato: null,
    lingua: 'en',
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  });
const apri = () =>
  root.render(
    createElement(
      MemoryRouter,
      { initialEntries: ['/pratica/p1'] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/pratica/:id', element: createElement(PracticeScreen) }),
      ),
    ),
  );
const bottone = (inizio: string) =>
  [...box.querySelectorAll('button')].find(
    (b) => b.textContent?.trim().startsWith(inizio) || b.getAttribute('aria-label') === inizio,
  )!;
const testo = () => box.textContent ?? '';
const risultato = async () => {
  const p = await appDb.pratiche.get('p1');
  return p && 'risultato' in p ? p.risultato : undefined;
};

describe('DevSwipe — SCENARI I2 (UI)', () => {
  it('10 carte, 3 errori: vibrazione e spiegazione, le 3 tornano a fine mazzo; riepilogo 7/10 con le 3 sbagliate', async () => {
    const carte = Array.from({ length: 10 }, (_, i) => ({
      contenuto: `const x${i} = ${i};`,
      verdetto: 'corretto',
      spiegazione: `Spiegazione ${i}`,
      titolo: `Carta ${i}`,
      categoria: 'Event loop',
    }));
    await pratica('devswipe', carte);
    apri();
    await vi.waitFor(() => expect(testo()).toContain('const x0 = 0;'));
    for (let i = 0; i < 10; i++) {
      await vi.waitFor(() => expect(testo()).toContain(`${i + 1} / 10`));
      bottone([1, 4, 8].includes(i) ? 'Left' : 'Right').click();
      await vi.waitFor(() => expect(testo()).toContain(`Spiegazione ${i}`));
      // Il secondo tocco passa alla prossima
      bottone('Right').click();
    }
    expect(vibrate).toHaveBeenCalledTimes(3);
    // Le 3 sbagliate riproposte una volta: la coda diventa di 13
    await vi.waitFor(() => expect(testo()).toContain('11 / 13'));
    expect(testo()).toContain('const x1 = 1;');
    for (const i of [1, 4, 8]) {
      await vi.waitFor(() => expect(testo()).toContain(`const x${i} = ${i};`));
      bottone('Right').click();
      await vi.waitFor(() => expect(testo()).toContain(`Spiegazione ${i}`));
      bottone('Right').click();
    }
    await vi.waitFor(() => expect(testo()).toContain('DevSwipe complete'));
    expect(testo()).toContain('70 %');
    expect(testo()).toContain('The 3 wrong ones, brought back once');
    expect(testo()).toContain('Carta 4');
    expect(bottone('Redo the practice')).toBeDefined();
    expect(bottone('Back to the unit')).toBeDefined();
    expect(await risultato()).toMatchObject({ giuste: 7, totali: 10, sbagliate: [1, 4, 8] });
  });

  it('a fine mazzo i tocchi in più mentre il risultato si salva non aggiungono verdetti', async () => {
    const carte = Array.from({ length: 3 }, (_, i) => ({
      contenuto: `const y${i} = ${i};`,
      verdetto: 'corretto',
      spiegazione: `Perché ${i}`,
    }));
    await pratica('devswipe', carte);
    apri();
    for (let i = 0; i < 3; i++) {
      await vi.waitFor(() => expect(testo()).toContain(`const y${i} = ${i};`));
      bottone('Right').click();
      await vi.waitFor(() => expect(testo()).toContain(`Perché ${i}`));
      if (i < 2) bottone('Right').click();
    }
    // Il gesto che chiude il mazzo e altri due tocchi, prima che il salvataggio torni: nessun errore nel gestore
    const errori = vi.fn();
    window.addEventListener('error', errori);
    for (let j = 0; j < 3; j++) {
      bottone('Right').click();
      // React ridisegna fra un tocco e l'altro (microtask), il salvataggio su IndexedDB non è ancora tornato
      await Promise.resolve();
    }
    await vi.waitFor(() => expect(testo()).toContain('DevSwipe complete'));
    window.removeEventListener('error', errori);
    expect(errori).not.toHaveBeenCalled();
    expect(await risultato()).toMatchObject({ giuste: 3, totali: 3, sbagliate: [] });
  });
});

describe('Bug Hunter — SCENARI I3 (UI)', () => {
  it('riga 4: al primo tocco 2 punti e il codice corretto; 2 poi 4 = 1 punto; due errori = 0 e soluzione', async () => {
    const codice = ['a', 'b', 'c', 'd', 'e'].join('\n');
    const es = { linguaggio: 'js', codice, riga: 4, categoria: 'Off by one', corretto: codice.replace('d', 'D') };
    await pratica('bughunter', [es, es, es]);
    apri();
    const riga = (n: number) =>
      [...box.querySelectorAll('button')].find((b) => b.textContent === `${n}${'abcde'[n - 1]}`)!;
    await vi.waitFor(() => expect(testo()).toContain('Tap the wrong line'));
    riga(4).click();
    await vi.waitFor(() => expect(testo()).toContain('Line 4 · 2 points'));
    expect(testo()).toContain('D');
    bottone('Next').click();
    await vi.waitFor(() => expect(testo()).toContain('2 / 3'));
    riga(2).click();
    await vi.waitFor(() => expect(testo()).toContain('Not that one. You have a second try (1 point).'));
    riga(4).click();
    await vi.waitFor(() => expect(testo()).toContain('Line 4 · 1 point on the second try'));
    bottone('Next').click();
    await vi.waitFor(() => expect(testo()).toContain('3 / 3'));
    riga(2).click();
    await vi.waitFor(() => expect(testo()).toContain('second try'));
    riga(3).click();
    await vi.waitFor(() => expect(testo()).toContain('Two tries · 0 points · solution'));
    bottone('See the score').click();
    // Punteggio = punti / (2 × esercizi) = 3 / 6
    await vi.waitFor(() => expect(testo()).toContain('Bug Hunter complete'));
    expect(testo()).toContain('50 %');
    expect(testo()).toContain('The missed exercise');
    expect(await risultato()).toMatchObject({ giuste: 3, totali: 6, sbagliate: [2] });
  });
});

describe('Audio Flash-Trivia — SCENARI I4 (UI)', () => {
  it('la voce legge e passa da sola; «Salta» conta come sbagliata; fine playlist: 8 / 10 · 80 % e le 2 sbagliate', async () => {
    let eventi: EventiVoce | null = null;
    const leggi = vi.fn((_e: unknown, _da: number, _l: string | null, _p: number, ev: EventiVoce) => {
      eventi = ev;
      return Promise.resolve();
    });
    configureVoice({ leggi, ferma: () => Promise.resolve() });
    await pratica(
      'trivia',
      Array.from({ length: 10 }, (_, i) => ({ domanda: `Domanda ${i}?`, spiegazione: `Risposta ${i}.` })),
    );
    apri();
    await vi.waitFor(() => expect(testo()).toContain('Domanda 0?'));
    bottone('Play').click();
    expect(leggi).toHaveBeenLastCalledWith(expect.any(Array), 0, 'en', 5000, expect.anything());
    // Domanda → silenzio → spiegazione → elemento successivo, senza tocchi
    const voce = () => eventi!;
    voce().fase(0, 'pausa');
    await vi.waitFor(() => expect(testo()).toContain('Silence'));
    voce().fase(0, 'spiegazione');
    await vi.waitFor(() => expect(testo()).toContain('Risposta 0.'));
    voce().fase(3, 'domanda');
    await vi.waitFor(() => expect(testo()).toContain('Domanda 3?'));
    // «Salta» sull'elemento 3 e sull'8: la lettura riparte dal successivo
    bottone('Skip').click();
    expect(leggi).toHaveBeenLastCalledWith(expect.any(Array), 4, 'en', 5000, expect.anything());
    voce().fase(8, 'domanda');
    await vi.waitFor(() => expect(testo()).toContain('Domanda 8?'));
    bottone('Skip').click();
    voce().fase(9, 'spiegazione');
    voce().fine();
    await vi.waitFor(() => expect(testo()).toContain('Playlist complete'));
    expect(testo()).toContain('80 %');
    expect(testo()).toContain('Domanda 3?');
    expect(testo()).toContain('Domanda 8?');
    expect(testo()).toContain('comes back');
    expect(await risultato()).toMatchObject({ giuste: 8, totali: 10, percentuale: 80, sbagliate: [3, 8] });
  });

  it('un errore della voce ferma la lettura e lo dice, ma Play resta: si riprova dallo stesso elemento', async () => {
    let eventi: EventiVoce | null = null;
    const leggi = vi.fn((_e: unknown, _da: number, _l: string | null, _p: number, ev: EventiVoce) => {
      eventi = ev;
      return Promise.resolve();
    });
    configureVoice({ leggi, ferma: () => Promise.resolve() });
    await pratica('trivia', [{ domanda: 'Domanda?', spiegazione: 'Risposta.' }]);
    apri();
    await vi.waitFor(() => expect(testo()).toContain('Domanda?'));
    bottone('Play').click();
    const voce = () => eventi!;
    voce().errore();
    await vi.waitFor(() => expect(box.querySelector('[role="alert"]')).not.toBeNull());
    expect(bottone('Play').disabled).toBe(false);
    bottone('Play').click();
    expect(leggi).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(box.querySelector('[role="alert"]')).toBeNull());
  });
});
