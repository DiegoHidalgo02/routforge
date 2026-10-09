// @vitest-environment jsdom
// Le azioni distruttive di Impostazioni (S22; MECC §22, §25; audit P2-16): il primo tocco apre la conferma in linea e i
// dati restano; solo l'azione della conferma esegue.
// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { createElement, type FunctionComponent } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { backupText } from '../app/backup';
import { appDb } from '../app/db';
import { registerSyncService, type StatoSync, type SyncService } from '../app/sync';
import { Account, Backup } from './Settings';

let box: HTMLDivElement;
let root: Root;
beforeEach(async () => {
  await Promise.all(appDb.tables.map((t) => t.clear()));
  // jsdom non sa ricaricare la pagina dopo la sostituzione o l'azzeramento (MECC §22: «ricarica»)
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  box = document.body.appendChild(document.createElement('div'));
  root = createRoot(box);
});
afterEach(() => {
  root.unmount();
  box.remove();
  vi.restoreAllMocks();
});

const apri = (schermata: FunctionComponent) => root.render(createElement(MemoryRouter, null, createElement(schermata)));
const bottoni = (etichetta: string) => [...box.querySelectorAll('button')].filter((b) => b.textContent === etichetta);
const conferma = () => box.querySelector('[role="alertdialog"]');
const impostazioni = () => appDb.preferenze.get('impostazioni');
const salvaImpostazioni = () =>
  appDb.preferenze.put({ id: 'impostazioni', valore: {}, createdAt: 0, updatedAt: 0, deletedAt: null });

describe('Azioni distruttive di Impostazioni — MECCANISMI §22, §25 (audit P2-16)', () => {
  it('«Elimina tutti i dati»: il primo tocco apre la conferma e i dati restano; la conferma azzera', async () => {
    await salvaImpostazioni();
    apri(Backup);
    await vi.waitFor(() => expect(bottoni('Delete all data')).toHaveLength(1));
    bottoni('Delete all data')[0]!.click();
    await vi.waitFor(() => expect(conferma()).not.toBeNull());
    expect(await impostazioni()).toBeDefined();
    // Il secondo «Delete all data» è l'azione della conferma
    bottoni('Delete all data')[1]!.click();
    await vi.waitFor(async () => expect(await impostazioni()).toBeUndefined());
  });

  it('«Importa backup»: il file scelto apre la conferma e i dati restano; «Sostituisci e ricarica» sostituisce', async () => {
    const { testo } = await backupText(appDb, 0);
    await salvaImpostazioni();
    apri(Backup);
    const input = await vi.waitFor(() => {
      const i = box.querySelector<HTMLInputElement>('input[type="file"]');
      if (!i) throw new Error('nessun selettore del file');
      return i;
    });
    Object.defineProperty(input, 'files', {
      value: [{ name: 'routforge.rfbackup', text: () => Promise.resolve(testo) }],
    });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(conferma()?.textContent).toContain('routforge.rfbackup'));
    expect(await impostazioni()).toBeDefined();
    bottoni('Replace and reload')[0]!.click();
    await vi.waitFor(async () => expect(await impostazioni()).toBeUndefined());
  });

  it('«Cancella i dati remoti»: il primo tocco apre la conferma senza toccare l’account; la conferma li cancella', async () => {
    const eraseRemote = vi.fn(() => Promise.resolve(true));
    const nulla = () => Promise.resolve();
    const stato: StatoSync = {
      account: { email: 'diego@example.com', nome: null },
      fase: 'in_pari',
      inCoda: 0,
      ultimaSync: null,
      dispositivi: [],
      finto: false,
    };
    registerSyncService({
      start: () => () => undefined,
      run: nulla,
      sendCode: () => Promise.resolve(true),
      verifyCode: () => Promise.resolve(true),
      signOut: nulla,
      signOutLocal: nulla,
      revokeDevice: nulla,
      eraseRemote,
      setName: nulla,
      subscribe: () => () => undefined,
      // Lo stesso oggetto a ogni lettura, come il servizio vero (useSyncExternalStore)
      snapshot: () => stato,
    } satisfies SyncService);
    apri(Account);
    await vi.waitFor(() => expect(bottoni('Delete remote data')).toHaveLength(1));
    bottoni('Delete remote data')[0]!.click();
    await vi.waitFor(() => expect(conferma()).not.toBeNull());
    expect(eraseRemote).not.toHaveBeenCalled();
    bottoni('Delete from the account')[0]!.click();
    await vi.waitFor(() => expect(eraseRemote).toHaveBeenCalledTimes(1));
  });
});
