// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, list, save } from '../data/repository';
import { GLOBALE } from '../domain/ai';
import { local } from '../domain/time';
import {
  answer,
  configureAi,
  followPendingMessages,
  readChat,
  readConversations,
  readMaskedAiKey,
  removeAiKey,
  saveAiKey,
  sendMessage,
  takeBackLastMessage,
  unitScope,
  waitForNetwork,
} from './ai';
import { CHIAVE_AI } from './backup';
import { importSampleCourse } from './courseImport';
import type { AiClient, RichiestaAi } from './ports/ai';
import { saveSettings } from './settings';

const ADESSO = local(2026, 9, 23, 16, 8);
const ora = () => ADESSO;
let db: RoutForgeDb;
let n = 0;
let richieste: RichiestaAi[];
let risposta: { pezzi: string[]; errore?: { status: number | null; message: string } };

/** Un Gemini finto: registra la richiesta, manda la risposta a pezzi o l'errore del servizio. */
const finto: AiClient = {
  async *stream(r, segnale) {
    richieste.push(r);
    if (risposta.errore) throw Object.assign(new Error(risposta.errore.message), { status: risposta.errore.status });
    for (const p of risposta.pezzi) {
      if (segnale.aborted) throw new DOMException('fermato', 'AbortError');
      yield await Promise.resolve(p);
    }
  },
  verify: (chiave) =>
    chiave === 'AIza-buona'
      ? Promise.resolve()
      : Promise.reject(Object.assign(new Error('API key not valid'), { status: 400 })),
};

beforeEach(async () => {
  db = openDb(`test-ai-${++n}`);
  richieste = [];
  risposta = { pezzi: ['Il micro', 'task passa prima [TEORIA · Unità 0.7 Event loop].'] };
  configureAi(finto);
  await importSampleCourse(db, ADESSO);
});
afterEach(() => db.delete());

/** I messaggi in ordine di istante (gli id sono casuali). */
const messaggi = async () => (await list(db, 'messaggi')).sort((a, b) => a.istante - b.istante);
const unita07 = async () => (await list(db, 'unita')).find((u) => u.numero === '0.7')!;

describe('Chiave e modello — MECCANISMI §18 (T-026)', () => {
  it('«Verifica»: una chiave accettata si salva solo in preferenze.chiaveAi; una rifiutata dà l’errore «chiave»', async () => {
    expect(await saveAiKey(db, 'sbagliata', ADESSO)).toBe('chiave');
    expect(await readMaskedAiKey(db)).toBeNull();
    expect(await saveAiKey(db, ' AIza-buona ', ADESSO)).toBeNull();
    expect(await get(db, 'preferenze', CHIAVE_AI)).toMatchObject({ valore: 'AIza-buona' });
    expect((await get(db, 'preferenze', 'impostazioni'))?.valore).not.toMatchObject({ chiaveAi: expect.anything() });
    await removeAiKey(db, ADESSO);
    expect(await readMaskedAiKey(db)).toBeNull();
  });

  it('senza chiave la risposta è l’errore «chiave», il messaggio resta e il resto funziona', async () => {
    const id = await sendMessage(
      db,
      { ambito: 'globale', corsoId: null, moduloId: null, unitaId: null },
      null,
      'ciao',
      ADESSO,
      true,
    );
    expect(await answer(db, id, ora, () => undefined, new AbortController().signal)).toBe('chiave');
    expect((await messaggi()).map((m) => [m.ruolo, m.testo])).toEqual([['utente', 'ciao']]);
    expect(richieste).toEqual([]);
  });
});

describe('Chat — MECCANISMI §18, SCENARI H4', () => {
  beforeEach(() => saveAiKey(db, 'AIza-buona', ADESSO));

  it('la prima domanda crea la conversazione con l’ambito; la risposta arriva a pezzi e si salva intera', async () => {
    const u = await unita07();
    const ambito = await unitScope(db, u.id);
    expect(ambito).toEqual({ ambito: 'unita', corsoId: u.corsoId, moduloId: u.moduloId, unitaId: u.id });
    const id = await sendMessage(db, ambito!, null, '  Perché il setTimeout a 0 esce dopo la promise?  ', ADESSO, true);
    const visti: string[] = [];
    expect(await answer(db, id, ora, (t) => visti.push(t), new AbortController().signal)).toBeNull();
    expect(visti).toEqual(['Il micro', 'Il microtask passa prima [TEORIA · Unità 0.7 Event loop].']);
    expect(await get(db, 'conversazioni', id)).toMatchObject({
      ambito: 'unita',
      unitaId: u.id,
      titolo: 'Perché il setTimeout a 0 esce dopo la promise?',
      // La risposta viene dopo la domanda anche con l’orologio fermo
      ultimoMessaggio: ADESSO + 1,
    });
    expect((await messaggi()).map((m) => [m.ruolo, m.stato])).toEqual([
      ['utente', 'inviato'],
      ['modello', 'inviato'],
    ]);
    // Modello delle Impostazioni (Flash di default), turni e regole con la lingua «Automatica» (H4)
    expect(richieste[0]?.modello).toBe('gemini-2.5-flash');
    expect(richieste[0]?.turni).toEqual([{ ruolo: 'utente', testo: 'Perché il setTimeout a 0 esce dopo la promise?' }]);
    expect(richieste[0]?.sistema).toMatch(/language of the user's last message/);
  });

  it('lingua delle risposte e modello dalle Impostazioni; la chat globale non ha materiale', async () => {
    await saveSettings(db, { modelloAi: 'pro', linguaRisposte: 'en' }, ADESSO);
    const id = await sendMessage(
      db,
      { ambito: 'globale', corsoId: null, moduloId: null, unitaId: null },
      null,
      'cron?',
      ADESSO,
      true,
    );
    await answer(db, id, ora, () => undefined, new AbortController().signal);
    expect(richieste[0]?.modello).toBe('gemini-2.5-pro');
    expect(richieste[0]?.sistema).toMatch(/Always answer in English/);
    expect(richieste[0]?.sistema).not.toMatch(/MATERIAL/);
  });

  it('contesto dell’unità: codice, teoria e materiali con testo; il PDF scansionato non entra (SCENARI H2)', async () => {
    const u = await unita07();
    const mat = { corsoId: u.corsoId, unitaId: u.id };
    await save(db, 'materiali', { ...mat, tipo: 'nota', titolo: 'Appunti', testo: 'setTimeout 0 = task' }, ADESSO);
    await save(
      db,
      'materiali',
      { ...mat, tipo: 'pdf', titolo: 'Registro.pdf', byte: 3e6, pagine: 3, testoEstratto: 'Pagina 3' },
      ADESSO,
    );
    await save(
      db,
      'materiali',
      { ...mat, tipo: 'pdf', titolo: 'Scansione.pdf', byte: 1e6, pagine: 2, testoEstratto: null },
      ADESSO,
    );
    await save(
      db,
      'fileCodice',
      {
        ...mat,
        sessioneId: null,
        caricamento: 'c1',
        nomeCaricamento: 'lab',
        percorso: 'lab/a.js',
        byte: 14,
        contenuto: 'console.log(1)',
        motivo: null,
      },
      ADESSO,
    );
    const id = await sendMessage(db, (await unitScope(db, u.id))!, null, 'Spiega', ADESSO, true);
    await answer(db, id, ora, () => undefined, new AbortController().signal);
    const s = richieste[0]?.sistema ?? '';
    expect(s).toContain('[CODICE · lab/a.js]');
    expect(s).toContain(`[TEORIA · 0.7 ${u.titolo}]`);
    expect(s).toContain('[NOTA · Appunti]');
    expect(s).toContain('[PDF · Registro.pdf]\nPagina 3');
    expect(s).not.toContain('Scansione.pdf');
  });

  it('«Interrompi»: la risposta si ferma e resta col testo arrivato, segnata come interrotta', async () => {
    const id = await sendMessage(
      db,
      { ambito: 'globale', corsoId: null, moduloId: null, unitaId: null },
      null,
      'x',
      ADESSO,
      true,
    );
    const stop = new AbortController();
    expect(await answer(db, id, ora, () => stop.abort(), stop.signal)).toBeNull();
    expect((await messaggi()).find((m) => m.ruolo === 'modello')).toMatchObject({
      testo: 'Il micro',
      stato: 'interrotto',
    });
  });

  it('errori del servizio mappati (limite, sicurezza): nessuna risposta salvata, la domanda resta', async () => {
    const id = await sendMessage(
      db,
      { ambito: 'globale', corsoId: null, moduloId: null, unitaId: null },
      null,
      'x',
      ADESSO,
      true,
    );
    risposta = { pezzi: [], errore: { status: 429, message: 'RESOURCE_EXHAUSTED' } };
    expect(await answer(db, id, ora, () => undefined, new AbortController().signal)).toBe('limite');
    risposta = { pezzi: [], errore: { status: null, message: 'SAFETY' } };
    expect(await answer(db, id, ora, () => undefined, new AbortController().signal)).toBe('sicurezza');
    expect((await messaggi()).map((m) => m.ruolo)).toEqual(['utente']);
  });
});

describe('Offline — MECCANISMI §18', () => {
  it('scritto offline resta in attesa; al ritorno della rete parte da solo e riceve la risposta', async () => {
    await saveAiKey(db, 'AIza-buona', ADESSO);
    const id = await sendMessage(
      db,
      { ambito: 'globale', corsoId: null, moduloId: null, unitaId: null },
      null,
      'x',
      ADESSO,
      false,
    );
    expect((await messaggi())[0]).toMatchObject({ stato: 'in_attesa' });
    let online = false;
    let torna: () => void = () => undefined;
    const smetti = followPendingMessages(
      db,
      { online: () => online, onOnline: (f) => ((torna = f), () => undefined) },
      ora,
    );
    expect(richieste).toEqual([]);
    online = true;
    torna();
    await expect
      .poll(async () => (await messaggi()).map((m) => [m.ruolo, m.stato]))
      .toEqual([
        ['utente', 'inviato'],
        ['modello', 'inviato'],
      ]);
    expect(await get(db, 'conversazioni', id)).toBeTruthy();
    smetti();
  });
});

describe('Elenco delle conversazioni — MECCANISMI §18', () => {
  it('ogni conversazione con il suo ambito per nome e il numero di messaggi; riaperta, tiene l’ambito', async () => {
    const u = await unita07();
    const ambito = (await unitScope(db, u.id))!;
    const prima = await sendMessage(db, ambito, null, 'Perché?', ADESSO, true);
    await sendMessage(db, ambito, prima, 'E poi?', ADESSO + 1, true);
    await sendMessage(db, GLOBALE, null, 'cron?', ADESSO + 2, true);
    const elenco = await readConversations(db);
    const corso = (await get(db, 'corsi', u.corsoId))!.titolo;
    expect(elenco.map((c) => [c.titolo, c.messaggi, c.nome])).toEqual([
      ['cron?', 1, { ambito: 'globale' }],
      ['Perché?', 2, { ambito: 'unita', corso, unita: '0.7' }],
    ]);
    expect((await readChat(db, prima))?.conversazione).toMatchObject({ ambito: 'unita', unitaId: u.id });
    expect((await readChat(db, prima))?.messaggi.map((m) => m.testo)).toEqual(['Perché?', 'E poi?']);
  });
});

describe('Errori della chat — MECCANISMI §18 (S19)', () => {
  it('senza rete a metà invio la domanda torna in attesa; «Riformula» la toglie e la ridà da modificare', async () => {
    const id = await sendMessage(db, GLOBALE, null, 'prima', ADESSO, true);
    await sendMessage(db, GLOBALE, id, 'domanda bloccata', ADESSO + 1, true);
    await waitForNetwork(db, id, ADESSO + 2);
    expect((await messaggi()).map((m) => [m.testo, m.stato])).toEqual([
      ['prima', 'inviato'],
      ['domanda bloccata', 'in_attesa'],
    ]);
    expect(await takeBackLastMessage(db, id, ADESSO + 3)).toBe('domanda bloccata');
    expect((await messaggi()).map((m) => m.testo)).toEqual(['prima']);
    // Tolta l'unica domanda, sparisce anche la conversazione
    expect(await takeBackLastMessage(db, id, ADESSO + 4)).toBe('prima');
    expect(await get(db, 'conversazioni', id)).toBeUndefined();
  });
});

describe('Casi limite della chat — MECCANISMI §18 (revisione di T-026)', () => {
  beforeEach(() => saveAiKey(db, 'AIza-buona', ADESSO));

  it('una risposta vuota non è una risposta: errore «generico», niente salvato', async () => {
    risposta = { pezzi: [] };
    const id = await sendMessage(db, GLOBALE, null, 'x', ADESSO, true);
    expect(await answer(db, id, ora, () => undefined, new AbortController().signal)).toBe('generico');
    expect((await messaggi()).map((m) => m.ruolo)).toEqual(['utente']);
  });

  it('un solo messaggio in attesa per conversazione: il secondo testo scritto offline si aggiunge al primo', async () => {
    const id = await sendMessage(db, GLOBALE, null, 'prima', ADESSO, false);
    await sendMessage(db, GLOBALE, id, 'poi', ADESSO + 1, false);
    expect((await messaggi()).map((m) => [m.testo, m.stato])).toEqual([['prima\n\npoi', 'in_attesa']]);
  });

  it('la chiave con un carattere invisibile incollato è rifiutata come chiave, non come rete', async () => {
    expect(await saveAiKey(db, 'AIza​buona', ADESSO)).toBe('chiave');
  });
});
