// @vitest-environment jsdom
// Trascinamento nella vista Giorno di Oggi (MECC §15, SCENARI G3), la parte che vive nella UI: quali card hanno la
// maniglia, la riga di aggancio, il rilascio e «Annulla». Si guida da tastiera, l'alternativa al trascinamento, perché
// jsdom non impagina: il puntatore (card sollevata, bersaglio sotto il dito) si verifica nel browser (D-DRAG-1).
// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createActivity } from '../app/activities';
import { readDetail } from '../app/completion';
import { appDb } from '../app/db';
import { runCycle } from '../app/scheduler';
import type { BozzaAttivita } from '../domain/activity';
import { local } from '../domain/time';
import { t } from './i18n';
import { Today } from './Today';

const FUSO = Intl.DateTimeFormat().resolvedOptions().timeZone;
/**
 * Lunedì 28 settembre 2026 alle 08:58: oggi nei test. L'orologio finto di Vitest qui scorre con il tempo reale: da
 * adesso il primo aggancio è comunque alle 09:00, il multiplo di 5' successivo (§15).
 */
const ADESSO = local(2026, 9, 28, 8, 58);
const comune = { note: '', promemoria: { modo: 'auto' } } as const;

// jsdom non ha `matchMedia` né `ResizeObserver`: mobile o desktop si sceglie qui
let desktop = false;
window.matchMedia = (media: string) =>
  ({ matches: desktop, media, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

async function crea(bozza: BozzaAttivita, now = local(2026, 9, 28, 6, 0)): Promise<string> {
  const r = await createActivity(appDb, bozza, now, FUSO);
  if (!r.ok) throw new Error(r.errori.join());
  return r.id;
}
const evento = (titolo: string, orario: Extract<BozzaAttivita, { tipo: 'evento' }>['orario']): BozzaAttivita => ({
  ...comune,
  tipo: 'evento',
  titolo,
  giorno: '2026-09-28',
  orario,
  luogo: '',
  fasi: [],
});
const todo = (
  titolo: string,
  orario: { inizio: string; durata: number } | null,
  giorno = '2026-09-28',
): BozzaAttivita => ({
  ...comune,
  tipo: 'todo',
  titolo,
  giorno,
  orario,
  orizzonte: 'giorno',
  priorita: 'normale',
  checklist: [],
  corsoId: null,
});
/** Il lunedì, da oggi. */
const routine = (titolo: string, inizio: string, fine: string): BozzaAttivita => ({
  ...comune,
  tipo: 'routine',
  titolo,
  giorni: [1],
  inizio,
  fine,
  dataInizio: '2026-09-28',
  termine: null,
  fasi: [],
});

/**
 * La giornata di G3: «Leggere 20 pagine» senza orario, i due blocchi 15:00–15:40 e 16:00–17:00; intorno ciò che non si
 * trascina (todo con orario, routine programmata, evento tutto il giorno) e la routine «Palestra» 07:00–08:00, persa
 * alle 08:58 dal ciclo.
 */
async function giornata(): Promise<{ leggere: string; palestra: string }> {
  await crea(evento('Lezione', { inizio: '15:00', fine: '15:40' }));
  await crea(evento('Ripasso', { inizio: '16:00', fine: '17:00' }));
  await crea(evento('Compleanno', null));
  await crea(todo('Spesa', { inizio: '18:00', durata: 30 }));
  await crea(routine('Corsa', '19:00', '20:00'));
  const leggere = await crea(todo('Leggere 20 pagine', null));
  await crea(routine('Palestra', '07:00', '08:00'));
  await runCycle(appDb, ADESSO, FUSO);
  const palestra = (await appDb.blocchi.toArray()).find((b) => 'titolo' in b && b.titolo === 'Palestra')!.id;
  return { leggere, palestra };
}

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
  desktop = false;
  vi.useRealTimers();
});

const mostra = (percorso = '/') =>
  root.render(createElement(MemoryRouter, { initialEntries: [percorso] }, createElement(Today)));
const maniglie = () => [...box.querySelectorAll<HTMLButtonElement>('button[aria-label^="Move: "]')];
const maniglia = (titolo: string) => maniglie().find((m) => m.getAttribute('aria-label') === `Move: ${titolo}`)!;
const tasto = (el: HTMLElement, key: string) =>
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
/** Invio sulla maniglia e attesa della presa: due tasti sono sempre due eventi, con il ridisegno in mezzo. */
const prendi = async (m: HTMLButtonElement) => {
  m.focus();
  tasto(m, 'Enter');
  await vi.waitFor(() => expect(m.getAttribute('aria-pressed')).toBe('true'));
};
const aggancio = () => box.querySelector('[data-aggancio]')?.textContent ?? null;
const bersaglio = () => box.querySelector('[data-bersaglio]')?.getAttribute('data-giorno-striscia') ?? null;
const primoDellaStriscia = () => box.querySelector('[data-giorno-striscia]')?.getAttribute('data-giorno-striscia');
const toast = () => [...box.querySelectorAll('[role="status"]')].find((r) => r.querySelector('button'));
const posto = async (id: string) => {
  const b = (await readDetail(appDb, id))!.blocco;
  return [b.stato, b.conOrario, b.giornoLocale, b.orarioInizio, b.orarioFine];
};

describe('Trascinamento — SCENARI G3 (UI di Oggi)', () => {
  it.each([false, true])(
    'la maniglia c’è solo sul todo senza orario e sul perso, né su evento, routine o todo con orario (desktop: %s)',
    async (suDesktop) => {
      desktop = suDesktop;
      await giornata();
      mostra();
      await vi.waitFor(() => expect(box.textContent).toContain('Compleanno'));
      expect(maniglie().map((m) => m.getAttribute('aria-label'))).toEqual(
        suDesktop ? ['Move: Palestra', 'Move: Leggere 20 pagine'] : ['Move: Leggere 20 pagine', 'Move: Palestra'],
      );
    },
  );

  it('la riga di aggancio mostra «15:40 · 30 min», il todo atterra alle 15:40–16:10 e «Annulla» lo riporta indietro', async () => {
    const { leggere } = await giornata();
    mostra();
    await vi.waitFor(() => expect(maniglie()).toHaveLength(2));
    const m = maniglia('Leggere 20 pagine');
    await prendi(m);
    // Prima della Palestra persa (07:00–08:00) lo spazio è passato: il primo aggancio è dopo, dalle 09:00 di adesso
    for (const atteso of ['09:00', '15:40']) {
      tasto(m, 'ArrowDown');
      await vi.waitFor(() => expect(aggancio()).toContain(atteso));
    }
    expect(aggancio()).toContain('30 min');
    expect(box.textContent).toContain('Between Lezione 15:00–15:40 and Ripasso 16:00–17:00');

    tasto(m, 'Enter');
    await vi.waitFor(async () =>
      expect(await posto(leggere)).toEqual(['programmato', true, '2026-09-28', '15:40', '16:10']),
    );
    await vi.waitFor(() => expect(toast()?.textContent).toContain('Leggere 20 pagine moved to today 15:40'));
    expect(aggancio()).toBeNull();
    // La maniglia è sparita con il todo che ha preso un orario: il fuoco va ad «Annulla», poi torna sulla card
    await vi.waitFor(() => expect(document.activeElement?.textContent).toBe('Undo'));

    toast()!.querySelector('button')!.click();
    expect(document.activeElement?.closest('li')?.getAttribute('data-id')).toBe(leggere);
    await vi.waitFor(async () =>
      expect(await posto(leggere)).toEqual(['programmato', false, '2026-09-28', '12:00', '23:59']),
    );
    await vi.waitFor(() => expect(toast()).toBeUndefined());
  });

  it('di lunedì il todo senza orario perso di domenica va a domani: durante la presa la striscia parte da oggi', async () => {
    const marco = await crea(todo('Chiama Marco', null, '2026-09-27'), local(2026, 9, 27, 9, 0));
    await runCycle(appDb, ADESSO, FUSO);
    expect((await posto(marco))[0]).toBe('perso');
    mostra('/?giorno=2026-09-27');
    await vi.waitFor(() => expect(maniglie()).toHaveLength(1));
    expect(primoDellaStriscia()).toBe('2026-09-21');

    const m = maniglia('Chiama Marco');
    await prendi(m);
    await vi.waitFor(() => expect(primoDellaStriscia()).toBe('2026-09-28'));
    for (const atteso of ['2026-09-28', '2026-09-29']) {
      tasto(m, 'ArrowRight');
      await vi.waitFor(() => expect(bersaglio()).toBe(atteso));
    }
    expect(aggancio()).toContain('tomorrow');
    expect(aggancio()).toContain('missed → scheduled');

    tasto(m, 'Enter');
    await vi.waitFor(async () =>
      expect(await posto(marco)).toEqual(['programmato', false, '2026-09-29', '12:00', '23:59']),
    );
    await vi.waitFor(() => expect(primoDellaStriscia()).toBe('2026-09-21'));
  });

  it('la routine persa «Palestra» va a domani nella striscia, orario invariato; «Annulla» la rimette persa', async () => {
    const { palestra } = await giornata();
    mostra();
    await vi.waitFor(() => expect(maniglie()).toHaveLength(2));
    const m = maniglia('Palestra');
    await prendi(m);
    tasto(m, 'ArrowRight');
    await vi.waitFor(() => expect(bersaglio()).toBe('2026-09-29'));
    expect(aggancio()).toContain('tomorrow 07:00');
    expect(aggancio()).toContain('missed → scheduled');

    tasto(m, 'Enter');
    await vi.waitFor(async () =>
      expect(await posto(palestra)).toEqual(['programmato', true, '2026-09-29', '07:00', '08:00']),
    );
    await vi.waitFor(() => expect(toast()?.textContent).toContain('Palestra moved to tomorrow 07:00'));
    toast()!.querySelector('button')!.click();
    await vi.waitFor(async () =>
      expect(await posto(palestra)).toEqual(['perso', true, '2026-09-28', '07:00', '08:00']),
    );
  });

  it('«Annulla» resta 5 secondi (MECCANISMI §15)', async () => {
    // Anche i timer finti, che però scorrono col tempo reale: IndexedDB finto continua a rispondere
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'], shouldAdvanceTime: true });
    vi.setSystemTime(ADESSO);
    await giornata();
    mostra();
    await vi.waitFor(() => expect(maniglie()).toHaveLength(2));
    const m = maniglia('Palestra');
    await prendi(m);
    tasto(m, 'ArrowRight');
    await vi.waitFor(() => expect(bersaglio()).toBe('2026-09-29'));
    tasto(m, 'Enter');
    await vi.waitFor(() => expect(toast()).toBeDefined());
    vi.advanceTimersByTime(4000);
    // Un giro perché React ridisegni: se il toast si fosse chiuso, qui non ci sarebbe più
    await new Promise((fatto) => setTimeout(fatto, 50));
    expect(toast()).toBeDefined();
    vi.advanceTimersByTime(1000);
    await vi.waitFor(() => expect(toast()).toBeUndefined());
  });

  it('Esc lascia il blocco dov’era, senza scrivere', async () => {
    const { leggere } = await giornata();
    mostra();
    await vi.waitFor(() => expect(maniglie()).toHaveLength(2));
    const m = maniglia('Leggere 20 pagine');
    await prendi(m);
    tasto(m, 'ArrowDown');
    await vi.waitFor(() => expect(aggancio()).toContain('09:00'));
    tasto(m, 'Escape');
    await vi.waitFor(() => expect(aggancio()).toBeNull());
    expect(m.getAttribute('aria-pressed')).toBe('false');
    expect(await posto(leggere)).toEqual(['programmato', false, '2026-09-28', '12:00', '23:59']);
  });

  it('su desktop col mouse si solleva dal titolo il todo senza orario, non un evento né una routine', async () => {
    desktop = true;
    // jsdom non impagina: niente cattura del puntatore né elementi sotto il puntatore
    Element.prototype.setPointerCapture = () => undefined;
    document.elementFromPoint = () => null;
    await giornata();
    mostra();
    await vi.waitFor(() => expect(box.textContent).toContain('Lezione'));
    const titolo = (t: string) => [...box.querySelectorAll('li[data-id] a')].find((a) => a.textContent?.includes(t))!;
    const trascina = (el: Element) => {
      const evento = (tipo: string, y: number) =>
        new PointerEvent(tipo, {
          bubbles: true,
          cancelable: true,
          button: 0,
          pointerType: 'mouse',
          clientX: 10,
          clientY: y,
        });
      el.dispatchEvent(evento('pointerdown', 10));
      el.dispatchEvent(evento('pointermove', 80));
    };
    for (const t of ['Lezione', 'Corsa', 'Spesa']) trascina(titolo(t));
    expect(box.querySelector('[data-sollevata]')).toBeNull();
    trascina(titolo('Leggere 20 pagine'));
    await vi.waitFor(() =>
      expect(box.querySelector('[data-sollevata="puntatore"]')?.textContent).toContain('Leggere 20 pagine'),
    );
  });
});

describe('Card Adesso — SCENARI G2 (UI di Oggi)', () => {
  const riga = (titolo: string) =>
    [...box.querySelectorAll<HTMLLIElement>('li[data-id]')].find((li) => li.textContent?.includes(titolo));
  const comandi = (titolo: string) =>
    [...(riga(titolo)?.querySelectorAll('button') ?? [])].map((b) => b.getAttribute('aria-label'));
  /** Rimonta Oggi a un altro istante: l'orologio della schermata scatta coi timer veri, qui fermi al minuto. */
  const alle = (ora: number, minuti: number) => {
    root.unmount();
    root = createRoot(box);
    vi.setSystemTime(local(2026, 9, 28, ora, minuti));
    mostra();
  };

  it.each([false, true])(
    'la card Adesso su A non ha un comando di chiusura; con B in corso passa a B e A torna card normale (desktop: %s)',
    async (suDesktop) => {
      desktop = suDesktop;
      await crea(routine('Colazione', '09:00', '10:00'));
      await crea(routine('Palestra', '10:00', '11:00'));
      await runCycle(appDb, ADESSO, FUSO);

      // Su mobile la card cresce allo scatto dell'ora, 900 ms dopo l'apertura
      alle(9, 30);
      await vi.waitFor(() => expect(riga('Colazione')?.textContent).toContain(t('adesso')), { timeout: 3000 });
      expect(comandi('Colazione')).toEqual([t('segnaFatta')]);
      expect(riga('Palestra')?.textContent).not.toContain(t('adesso'));

      alle(10, 5);
      await vi.waitFor(() => expect(riga('Palestra')?.textContent).toContain(t('adesso')), { timeout: 3000 });
      expect(comandi('Palestra')).toEqual([t('segnaFatta')]);
      expect(riga('Colazione')?.textContent).not.toContain(t('adesso'));
      expect(riga('Colazione')?.textContent).not.toContain(t('daRecuperare'));
    },
  );
});
