// @vitest-environment jsdom
// S8 Sveglia (MECC §13.2; T-057): dove porta ogni tasto. «Segna fatto» con le voci tutte spuntate completa senza aprire
// l'app e rimette il telefono al blocco schermo; con voci aperte chiede lo sblocco e apre il Dettaglio su «Voci
// rimaste»; «Posticipa» sposta di 10' e chiude. Le regole dei gesti stanno in `app/notificationActions`, testate lì.
// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appDb } from '../app/db';
import { registerNotificationService, type NotificationService } from '../app/notifications';
import type { SvegliaAperta } from '../app/ports/notifications';
import { local } from '../domain/time';
import type { VoceChecklist } from '../domain/types';
import { Alarm } from './Alarm';

const FUSO = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Mercoledì 23 settembre 2026, 18:30: la sveglia di «Leggere 20 pagine» delle 19:00 (SCENARI A6)
const ADESSO = local(2026, 9, 23, 18, 30);
const SVEGLIA: SvegliaAperta = { chiave: 'pre:30:t1', trigger: 'pre', bloccoId: 't1', anticipo: 30, idNativo: 5 };

/** Il todo delle 19:00 con la sua checklist (la UI non importa `data`: la riga si scrive con Dexie). */
const todo = (checklist: VoceChecklist[]) =>
  appDb.blocchi.put({
    id: 't1',
    tipo: 'todo',
    stato: 'programmato',
    conOrario: true,
    inizio: local(2026, 9, 23, 19),
    fine: local(2026, 9, 23, 19, 30),
    titolo: 'Leggere 20 pagine',
    checklist,
    giornoLocale: '2026-09-23',
    orarioInizio: '19:00',
    orarioFine: '19:30',
    fuso: FUSO,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  });

const chiudi = vi.fn<(id: number | null, inSfondo: boolean) => Promise<void>>(() => Promise.resolve());
const sblocca = vi.fn(() => Promise.resolve(true));
const mostraSveglia = vi.fn(() => Promise.resolve());
registerNotificationService({ sveglia: { mostra: mostraSveglia, sblocca, chiudi } } as unknown as NotificationService);

/** Dove è arrivata l'app, con lo stato della rotta. */
function Dove() {
  const l = useLocation();
  return createElement('output', null, `${l.pathname} ${JSON.stringify(l.state)}`);
}

let box: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(ADESSO);
  await Promise.all(appDb.tables.map((t) => t.clear()));
  chiudi.mockClear();
  sblocca.mockClear();
  mostraSveglia.mockClear();
  box = document.body.appendChild(document.createElement('div'));
  root = createRoot(box);
});
afterEach(() => {
  root.unmount();
  box.remove();
  vi.useRealTimers();
});

const mostra = () =>
  root.render(
    createElement(
      MemoryRouter,
      { initialEntries: [{ pathname: '/sveglia', state: SVEGLIA }] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/sveglia', element: createElement(Alarm) }),
        createElement(Route, { path: '*', element: createElement(Dove) }),
      ),
    ),
  );
const bottone = (testo: string) => [...box.querySelectorAll('button')].find((b) => b.textContent?.trim() === testo)!;
const dove = () => box.querySelector('output')?.textContent;

describe('Sveglia S8 — SCENARI A6 (T-057)', () => {
  it('voci tutte spuntate: «Segna fatto» completa senza aprire l’app e rimette il telefono al blocco', async () => {
    await todo([{ testo: 'pagine 1-10', fatta: true }]);
    mostra();
    await vi.waitFor(() => expect(box.textContent).toContain('Leggere 20 pagine'));
    // Sopra il blocco l'app resta nascosta finché S8 non è disegnata
    await vi.waitFor(() => expect(mostraSveglia).toHaveBeenCalledOnce());
    expect(box.textContent).toContain('30 min before');
    expect(box.textContent).toContain('19:00 – 19:30');
    bottone('Mark done').click();
    await vi.waitFor(() => expect(dove()).toBe('/ null'));
    expect(await appDb.blocchi.get('t1')).toMatchObject({ stato: 'completato' });
    expect(chiudi).toHaveBeenCalledWith(5, true);
    expect(sblocca).not.toHaveBeenCalled();
  });

  it('voci aperte: chiede lo sblocco e apre il Dettaglio su «Voci rimaste», senza completare', async () => {
    await todo([
      { testo: 'pagine 1-10', fatta: true },
      { testo: 'pagine 11-20', fatta: false },
    ]);
    mostra();
    await vi.waitFor(() => expect(box.textContent).toContain('Checklist 1/2'));
    bottone('Mark done').click();
    await vi.waitFor(() => expect(dove()).toBe('/attivita/t1 {"vista":"residuo"}'));
    expect(sblocca).toHaveBeenCalledOnce();
    expect(chiudi).toHaveBeenCalledWith(5, false);
    expect(await appDb.blocchi.get('t1')).toMatchObject({ stato: 'programmato' });
  });

  it('«Posticipa»: +10′ con la stessa chiave e il telefono torna al blocco (SCENARI F5)', async () => {
    await todo([]);
    mostra();
    await vi.waitFor(() => expect(box.textContent).toContain('Leggere 20 pagine'));
    bottone('Snooze +10 min').click();
    await vi.waitFor(() => expect(dove()).toBe('/ null'));
    // L'istante del tocco: `vi.waitFor` fa avanzare l'orologio finto di qualche decina di millisecondi
    const riga = (await appDb.preferenze.get('posticipi')) as { valore: Record<string, number> } | undefined;
    expect(riga?.valore['pre:30:t1']).toBeGreaterThanOrEqual(ADESSO);
    expect(chiudi).toHaveBeenCalledWith(5, true);
  });
});
