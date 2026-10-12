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
import { Account, Backup, Diagnostics } from './Settings';

// L'import vero, che un test può far fallire come uno spazio esaurito a metà (audit P2-26); la UI non vede `data` (INV-1)
const guasto = vi.hoisted(() => ({ importazione: false }));
vi.mock('../app/backup', async (originale) => {
  const m = await originale<typeof import('../app/backup')>();
  return {
    ...m,
    importBackup: (...a: Parameters<typeof m.importBackup>) =>
      guasto.importazione ? Promise.reject(new Error('spazio esaurito')) : m.importBackup(...a),
  };
});

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

/** Lo spazio del browser (jsdom non ha `navigator.storage`): senza la stima la sezione di «Svuota cache» non c'è. */
const spazioDelBrowser = () =>
  Object.defineProperty(navigator, 'storage', {
    configurable: true,
    value: {
      estimate: () => Promise.resolve({ usage: 2048, quota: 1 << 30, usageDetails: { caches: 1024 } }),
      persisted: () => Promise.resolve(true),
    },
  });

describe('«Reinstalla PWA» — MECCANISMI §23 (T-035)', () => {
  // jsdom non ha `matchMedia`, che la Diagnostica legge per la riduzione delle animazioni
  beforeEach(() => {
    window.matchMedia = (media: string) =>
      ({ matches: false, media, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
    Reflect.deleteProperty(navigator, 'storage');
  });

  it('senza un service worker che controlla la pagina (app Android, sviluppo) il bottone non c’è', async () => {
    apri(Diagnostics);
    await vi.waitFor(() => expect(bottoni('Copy diagnostics')).toHaveLength(1));
    expect(bottoni('Reinstall PWA')).toHaveLength(0);
  });

  /** La PWA attiva: un service worker che controlla la pagina e la sua cache; `unregister` e le cache cancellate. */
  const pwaAttiva = () => {
    spazioDelBrowser();
    const unregister = vi.fn(() => Promise.resolve(true));
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: {}, getRegistrations: () => Promise.resolve([{ unregister }]) },
    });
    const cancellate: string[] = [];
    vi.stubGlobal('caches', {
      keys: () => Promise.resolve(['workbox-precache-v2']),
      delete: (k: string) => Promise.resolve(Boolean(cancellate.push(k))),
    });
    return { unregister, cancellate };
  };

  it('col service worker della PWA svuota le cache e lo deregistra, poi ricarica', async () => {
    const { unregister, cancellate } = pwaAttiva();
    apri(Diagnostics);
    await vi.waitFor(() => expect(bottoni('Reinstall PWA')).toHaveLength(1));
    bottoni('Reinstall PWA')[0]!.click();
    await vi.waitFor(() => expect(unregister).toHaveBeenCalledTimes(1));
    expect(cancellate).toEqual(['workbox-precache-v2']);
  });

  it('offline non fa nulla: senza rete la PWA non si reinstallerebbe e l’app resterebbe senza file', async () => {
    const { unregister, cancellate } = pwaAttiva();
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    try {
      apri(Diagnostics);
      await vi.waitFor(() => expect(bottoni('Reinstall PWA')).toHaveLength(1));
      bottoni('Reinstall PWA')[0]!.click();
      bottoni('Clear cache')[0]!.click();
      await new Promise((r) => setTimeout(r, 300));
      expect(unregister).not.toHaveBeenCalled();
      expect(cancellate).toEqual([]);
    } finally {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });
});

describe('«Svuota cache» — FUNZIONALITA §24, MECCANISMI §23 (T-035)', () => {
  beforeEach(() => {
    window.matchMedia = (media: string) =>
      ({ matches: false, media, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
    Reflect.deleteProperty(navigator, 'storage');
  });

  it('con la PWA attiva la cache è quella del service worker: svuotarla reinstalla la PWA, che resta usabile offline', async () => {
    spazioDelBrowser();
    const unregister = vi.fn(() => Promise.resolve(true));
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { controller: {}, getRegistrations: () => Promise.resolve([{ unregister }]) },
    });
    vi.stubGlobal('caches', {
      keys: () => Promise.resolve(['workbox-precache-v2']),
      delete: () => Promise.resolve(true),
    });
    apri(Diagnostics);
    await vi.waitFor(() => expect(bottoni('Clear cache')).toHaveLength(1));
    bottoni('Clear cache')[0]!.click();
    await vi.waitFor(() => expect(unregister).toHaveBeenCalledTimes(1));
  });
});

describe('Import di un backup con un account — MECCANISMI §22, §25, D-SYNC-4 n. 7 (audit P2-26)', () => {
  const nulla = () => Promise.resolve();
  /** Un servizio della sync finto, con o senza account. */
  const sync = (account: StatoSync['account']) => {
    const stato: StatoSync = { account, fase: 'in_pari', inCoda: 0, ultimaSync: null, dispositivi: [], finto: false };
    registerSyncService({
      start: () => () => undefined,
      run: nulla,
      sendCode: () => Promise.resolve(true),
      verifyCode: () => Promise.resolve(true),
      signOut: nulla,
      signOutLocal: nulla,
      revokeDevice: nulla,
      eraseRemote: () => Promise.resolve(true),
      setName: nulla,
      subscribe: () => () => undefined,
      snapshot: () => stato,
    } satisfies SyncService);
  };
  afterEach(() => {
    guasto.importazione = false;
    sync(null);
  });
  const scegliBackup = async () => {
    const { testo } = await backupText(appDb, 0);
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
    await vi.waitFor(() => expect(conferma()).not.toBeNull());
  };

  it('con un account la conferma dice che si esce e che al nuovo accesso vale la modifica più recente', async () => {
    sync({ email: 'diego@example.com', nome: null });
    await scegliBackup();
    expect(conferma()?.textContent).toContain('the most recent change wins');
  });

  it('senza account la conferma resta quella di prima', async () => {
    sync(null);
    await scegliBackup();
    expect(conferma()?.textContent).not.toContain('the most recent change wins');
  });

  it('un import fallito con un account dice che i dati sono com’erano e che si è usciti dall’account', async () => {
    sync({ email: 'diego@example.com', nome: null });
    await scegliBackup();
    guasto.importazione = true;
    bottoni('Replace and reload')[0]!.click();
    await vi.waitFor(() => expect(box.querySelector('[role="alert"]')?.textContent).toContain('signed out'));
  });
});
