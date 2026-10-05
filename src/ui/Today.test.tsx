// @vitest-environment jsdom
// Oggi nella UI: riordino dei todo senza orario (MECC §15, SCENARI G3) con le frecce su desktop e la barra su mobile,
// le alternative al trascinamento (jsdom non impagina: il puntatore si verifica nel browser), card Adesso (G2) e spunta
// dalla lista (A7, C10).
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
// Un flusso della UI qui scrive in IndexedDB e aspetta il ridisegno di giornata, progresso e card Adesso: su una macchina
// carica supera i 5 s di Vitest anche quando è corretto
vi.setConfig({ testTimeout: 20_000 });
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
  priorita: 'alta' | 'normale' | 'bassa' = 'normale',
): BozzaAttivita => ({
  ...comune,
  tipo: 'todo',
  titolo,
  giorno,
  orario,
  orizzonte: 'giorno',
  priorita,
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
 * La giornata di G3: «Prepara la valigia» e «Prenota il treno» con priorità alta, «Chiama Marco» normale, creati in
 * quest'ordine; intorno ciò che non si riordina: evento, routine, todo con orario, evento tutto il giorno e la routine
 * «Palestra» 07:00–08:00, persa alle 08:58 dal ciclo.
 */
async function giornata(): Promise<{ treno: string }> {
  await crea(todo('Prepara la valigia', null, '2026-09-28', 'alta'), local(2026, 9, 28, 6, 0));
  const treno = await crea(todo('Prenota il treno', null, '2026-09-28', 'alta'), local(2026, 9, 28, 6, 1));
  await crea(todo('Chiama Marco', null), local(2026, 9, 28, 6, 2));
  await crea(evento('Lezione', { inizio: '15:00', fine: '15:40' }));
  await crea(evento('Compleanno', null));
  await crea(todo('Spesa', { inizio: '18:00', durata: 30 }));
  await crea(routine('Corsa', '19:00', '20:00'));
  await crea(routine('Palestra', '07:00', '08:00'));
  await runCycle(appDb, ADESSO, FUSO);
  return { treno };
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
const maniglie = () =>
  [...box.querySelectorAll<HTMLButtonElement>('button[data-maniglia]')].map((m) => m.getAttribute('aria-label'));
const riga = (titolo: string) =>
  [...box.querySelectorAll<HTMLLIElement>('li[data-id]')].find((li) => li.textContent?.includes(titolo));
/** I titoli della fascia senza orario, nell'ordine mostrato: anche l'evento tutto il giorno, che non si sposta. */
const fascia = () =>
  [...box.querySelectorAll<HTMLLIElement>('li[data-senza-orario]')].map((li) => li.querySelector('a')?.textContent);
const tasto = (dove: Element | null | undefined, freccia: 'su' | 'giu') =>
  dove?.querySelector<HTMLButtonElement>(`button[data-freccia="${freccia}"]`) ?? null;
const annuncio = () => box.querySelector('[aria-live="polite"]')?.textContent ?? '';
const toast = () => [...box.querySelectorAll('[role="status"]')].find((r) => r.querySelector('button'));

describe('Riordino — SCENARI G3 (UI di Oggi)', () => {
  it.each([false, true])(
    'maniglia e frecce solo sui todo senza orario aperti, né su eventi, routine, todo con orario o persi (desktop: %s)',
    async (suDesktop) => {
      desktop = suDesktop;
      await giornata();
      mostra();
      await vi.waitFor(() => expect(box.textContent).toContain('Compleanno'), { timeout: 5000 });
      const titoli = ['Prepara la valigia', 'Prenota il treno', 'Chiama Marco'];
      expect(maniglie()).toEqual(titoli.map((titolo) => t('riordinaTitolo', { titolo })));
      expect(box.querySelectorAll('button[data-freccia]')).toHaveLength(6);
      for (const titolo of ['Lezione', 'Spesa', 'Corsa', 'Palestra', 'Compleanno'])
        expect(riga(titolo)?.querySelector('button[data-maniglia], button[data-freccia]')).toBeNull();
    },
  );

  it('desktop: su «Prenota il treno» «Sposta giù» è spenta; «Sposta su» la porta sopra «Prepara la valigia», il fuoco la segue', async () => {
    desktop = true;
    const { treno } = await giornata();
    mostra();
    await vi.waitFor(
      () => expect(fascia()).toEqual(['Prepara la valigia', 'Prenota il treno', 'Compleanno', 'Chiama Marco']),
      {
        timeout: 5000,
      },
    );
    expect(tasto(riga('Prenota il treno'), 'giu')?.disabled).toBe(true);
    expect(tasto(riga('Prepara la valigia'), 'su')?.disabled).toBe(true);

    tasto(riga('Prenota il treno'), 'su')!.click();
    await vi.waitFor(
      () => expect(fascia()).toEqual(['Prenota il treno', 'Prepara la valigia', 'Compleanno', 'Chiama Marco']),
      { timeout: 5000 },
    );
    // «Sposta su» ora è spenta: il fuoco passa all'altra freccia; la regione live dice la posizione nel gruppo
    await vi.waitFor(() => expect(document.activeElement).toBe(tasto(riga('Prenota il treno'), 'giu')), {
      timeout: 5000,
    });
    expect(annuncio()).toBe(
      t('annuncioRiordino', { titolo: 'Prenota il treno', n: 1, totale: 2, livello: t('livelloAlta') }),
    );
    // Solo l'ordine: resta senza orario, nello stesso giorno, con lo stesso stato; nessun «Annulla»
    const b = (await readDetail(appDb, treno))!.blocco;
    expect([b.conOrario, b.giornoLocale, b.stato]).toEqual([false, '2026-09-28', 'programmato']);
    expect(toast()).toBeUndefined();
  });

  it('mobile: un tocco sulla maniglia apre «Sposta su», «Sposta giù» e «Fine» con le stesse regole; «Fine» chiude', async () => {
    await giornata();
    mostra();
    await vi.waitFor(() => expect(maniglie()).toHaveLength(3), { timeout: 5000 });
    const maniglia = riga('Prenota il treno')!.querySelector<HTMLButtonElement>('button[data-maniglia]')!;
    maniglia.click();
    const barra = () => box.querySelector(`[role="toolbar"][aria-label="${t('riordina')}"]`);
    await vi.waitFor(() => expect(barra()?.textContent).toContain('Prenota il treno'), { timeout: 5000 });
    expect(maniglia.getAttribute('aria-pressed')).toBe('true');
    expect(tasto(barra(), 'giu')?.disabled).toBe(true);

    tasto(barra(), 'su')!.click();
    await vi.waitFor(
      () => expect(fascia()).toEqual(['Prenota il treno', 'Prepara la valigia', 'Compleanno', 'Chiama Marco']),
      { timeout: 5000 },
    );
    await vi.waitFor(() => expect(tasto(barra(), 'su')?.disabled).toBe(true), { timeout: 5000 });
    expect(tasto(barra(), 'giu')?.disabled).toBe(false);
    expect(barra()?.textContent).toContain('1');
    expect(annuncio()).toContain('Prenota il treno');

    [...barra()!.querySelectorAll('button')].find((x) => x.textContent === t('fineRiordino'))!.click();
    await vi.waitFor(() => expect(barra()).toBeNull(), { timeout: 5000 });
    expect(annuncio()).toBe('');
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

describe('Spunta dalla lista — SCENARI A7, C10 (UI di Oggi)', () => {
  const cerchio = (titolo: string) =>
    box.querySelector<HTMLButtonElement>(`button[aria-label="${t('segnaFattoTitolo', { titolo })}"]`);
  const stato = async (id: string) => (await readDetail(appDb, id))!.blocco.stato;
  const archivio = () => box.querySelector(`[role="button"][aria-label="${t('archivioCompletate', { n: 1 })}"]`);
  /** «Completate» di «Il tuo progresso oggi»: «fatte / totali». */
  const completate = () =>
    [...(box.querySelector('[aria-labelledby="progresso-titolo"]')?.querySelectorAll('span') ?? [])]
      .map((x) => x.textContent)
      .find((x) => /^\d+ \/ \d+$/.test(x ?? ''));

  it('«Chiama Marco» senza voci: il cerchio lo completa senza aprire il dettaglio; «Annulla» del toast lo riapre', async () => {
    const id = await crea(todo('Chiama Marco', null));
    mostra();
    await vi.waitFor(() => expect(cerchio('Chiama Marco')).not.toBeNull(), { timeout: 5000 });
    await vi.waitFor(() => expect(completate()).toBe('0 / 1'), { timeout: 5000 });
    cerchio('Chiama Marco')!.click();
    await vi.waitFor(() => expect(toast()?.textContent).toContain(t('toastFatto', { titolo: 'Chiama Marco' })), {
      timeout: 5000,
    });
    expect(await stato(id)).toBe('completato');
    // «Il tuo progresso oggi» si aggiorna con la spunta e con «Annulla» (DATI-UI)
    await vi.waitFor(() => expect(completate()).toBe('1 / 1'), { timeout: 5000 });
    // La card entra nell'archivio delle completate; con tutto fatto oggi arriva la Giornata chiusa (S1)
    await vi.waitFor(() => expect(archivio()?.textContent).toContain('Chiama Marco'), { timeout: 5000 });
    expect(box.textContent).toContain(t('giornataChiusa'));

    toast()!.querySelector('button')!.click();
    await vi.waitFor(async () => expect(await stato(id)).toBe('programmato'), { timeout: 5000 });
    await vi.waitFor(() => expect(completate()).toBe('0 / 1'), { timeout: 5000 });
    await vi.waitFor(() => expect(archivio()).toBeNull(), { timeout: 5000 });
  });

  it('un’occorrenza di studio di domani ha il cerchio spento: il tocco non scrive nulla (C10)', async () => {
    const ricorrenza = await crea({
      ...comune,
      tipo: 'studio',
      titolo: 'Ripasso',
      corsoId: null,
      giorni: [2],
      inizio: '09:00',
      fine: '10:00',
      dataInizio: '2026-09-29',
      termine: null,
    });
    await runCycle(appDb, ADESSO, FUSO);
    mostra('/?giorno=2026-09-29');
    await vi.waitFor(() => expect(cerchio('Ripasso')?.getAttribute('aria-disabled')).toBe('true'), { timeout: 5000 });
    expect(cerchio('Ripasso')!.title).toBe(t('siSegnaNelGiornoPrevisto'));
    cerchio('Ripasso')!.click();
    const stati = (await appDb.blocchi.toArray())
      .filter((b) => 'ricorrenzaId' in b && b.ricorrenzaId === ricorrenza)
      .map((b) => ('stato' in b ? b.stato : null));
    expect(stati.length).toBeGreaterThan(0);
    expect(new Set(stati)).toEqual(new Set(['programmato']));
  });
});
