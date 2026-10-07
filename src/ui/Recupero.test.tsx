// @vitest-environment jsdom
// La pagina di recupero (T-059; CONTESTO §3): un errore di disegno non lascia lo schermo vuoto; «Riprova» ridisegna,
// «Elimina tutti i dati» chiede la conferma in linea e azzera il dispositivo; l'errore va in Diagnostica.
// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appDb } from '../app/db';
import { readDiagnostics } from '../app/diagnostics';
import { Recupero } from './Recupero';

let box: HTMLDivElement;
let root: Root;
let rotta = true;
beforeEach(async () => {
  await Promise.all(appDb.tables.map((t) => t.clear()));
  // React riporta in console l'errore preso dal confine; jsdom non sa ricaricare la pagina
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  rotta = true;
  box = document.body.appendChild(document.createElement('div'));
  root = createRoot(box);
});
afterEach(() => {
  root.unmount();
  box.remove();
  vi.restoreAllMocks();
});

/** Una schermata che non riesce a disegnare finché la riga resta malformata. */
function Schermata() {
  if (rotta) throw new Error('riga malformata');
  return createElement('p', null, 'Oggi');
}
const apri = () => root.render(createElement(Recupero, null, createElement(Schermata)));
const testo = () => box.textContent ?? '';
const bottoni = (etichetta: string) => [...box.querySelectorAll('button')].filter((b) => b.textContent === etichetta);

describe('Pagina di recupero — CONTESTO §3 (T-059)', () => {
  it('un errore di disegno mostra la pagina, non il vuoto; l’errore va in Diagnostica; «Riprova» ridisegna', async () => {
    apri();
    await vi.waitFor(() => expect(testo()).toContain("This screen can't be shown"));
    const { eventi } = await readDiagnostics(appDb, 0);
    expect(eventi[0]).toMatchObject({ sorgente: 'interfaccia', messaggio: 'riga malformata' });
    rotta = false;
    bottoni('Try again')[0]!.click();
    await vi.waitFor(() => expect(testo()).toBe('Oggi'));
  });

  it('«Elimina tutti i dati» chiede la conferma in linea, poi azzera il dispositivo', async () => {
    await appDb.preferenze.put({ id: 'impostazioni', valore: {}, createdAt: 0, updatedAt: 0, deletedAt: null });
    apri();
    await vi.waitFor(() => expect(bottoni('Delete all data')).toHaveLength(1));
    bottoni('Delete all data')[0]!.click();
    await vi.waitFor(() => expect(box.querySelector('[role="alertdialog"]')).not.toBeNull());
    expect(await appDb.preferenze.get('impostazioni')).toBeDefined();
    // Il secondo «Delete all data» è l'azione della conferma
    bottoni('Delete all data')[1]!.click();
    await vi.waitFor(async () => expect(await appDb.preferenze.get('impostazioni')).toBeUndefined());
  });
});
