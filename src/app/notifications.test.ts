// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, list, listBy, save, saveBlock, type DatiBlocco } from '../data/repository';
import type { BozzaAttivita } from '../domain/activity';
import {
  CHIAVE_TEMPO_SCADUTO,
  IMPOSTAZIONI_NOTIFICHE_DEFAULT,
  type VoceRegistro,
} from '../domain/notifications/desiredSet';
import type { SceltaSessione } from '../domain/session';
import { addLocalDays, local } from '../domain/time';
import type { Promemoria } from '../domain/types';
import { createActivity } from './activities';
import { completeBlock, deleteBlock, reopenBlock, toggleChecklist } from './completion';
import { moveBlock } from './drag';
import { CHIAVE_IMPOSTAZIONI_NOTIFICHE, createNotifications, readNotificationSettings } from './notifications';
import type { Clock } from './ports/clock';
import type { Notifications } from './ports/notifications';
import { editRecurrence } from './recurrences';
import { runCycle } from './scheduler';
import { abandonSession, anticipateSession, CHIAVE_SESSIONE_ATTIVA, endSession, startSession } from './session';

const FUSO = 'Europe/Rome';
// Lunedì 28 settembre 2026.
const oggi = (h: number, m = 0) => local(2026, 9, 28, h, m);

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-notifiche-${++n}`);
});
afterEach(() => db.delete());

/** Porta finta: registra le chiamate e tiene l'insieme armato come una piattaforma (stesso id = sostituzione). */
function portaFinta() {
  const armate = new Map<number, VoceRegistro>();
  const chiamate: string[] = [];
  const guasta = { cancel: false, schedule: false };
  const porta: Notifications = {
    requestPermission: vi.fn(() => Promise.resolve(true)),
    schedule: vi.fn((voci: readonly VoceRegistro[]) => {
      if (guasta.schedule) return Promise.reject(new Error('schedule'));
      chiamate.push(`schedule ${voci.map((v) => v.chiave).join(' ')}`);
      for (const v of voci) armate.set(v.idNativo, v);
      return Promise.resolve();
    }),
    cancel: vi.fn((ids: readonly number[]) => {
      if (guasta.cancel) return Promise.reject(new Error('cancel'));
      chiamate.push(`cancel ${ids.length}`);
      for (const id of ids) armate.delete(id);
      return Promise.resolve();
    }),
  };
  /** Le voci armate come «chiave@HH:MM» del giorno dello scatto, per istante. */
  const vista = (dopo = -Infinity) =>
    [...armate.values()]
      .filter((v) => v.istante > dopo)
      .sort((a, b) => a.istante - b.istante)
      .map((v) => `${v.chiave}@${new Date(v.istante).toTimeString().slice(0, 5)}`);
  return { porta, armate, chiamate, guasta, vista };
}

function orologio(t: number): Clock {
  return { now: () => t, fuso: () => FUSO, every: () => () => {}, onForeground: () => () => {} };
}

const blocco = (dati: Partial<DatiBlocco> & Pick<DatiBlocco, 'id' | 'inizio' | 'fine'>) =>
  saveBlock(db, { tipo: 'studio', stato: 'programmato', conOrario: true, titolo: 'Studio', ...dati }, oggi(7), FUSO);

async function crea(bozza: BozzaAttivita, now: number): Promise<string> {
  const r = await createActivity(db, bozza, now, FUSO);
  if (!r.ok) throw new Error(r.errori.join());
  return r.id;
}
const todo = (orario: { inizio: string; durata: number } | null, checklist: string[] = []): BozzaAttivita => ({
  tipo: 'todo',
  titolo: 'Spesa',
  note: '',
  promemoria: { modo: 'auto' },
  giorno: '2026-09-28',
  orario,
  orizzonte: 'giorno',
  priorita: 'normale',
  checklist,
  corsoId: null,
});
const evento = (
  giorno: string,
  orario: { inizio: string; fine: string } | null,
  promemoria: Promemoria,
): BozzaAttivita => ({
  tipo: 'evento',
  titolo: 'Cena',
  note: '',
  promemoria,
  giorno,
  orario,
  luogo: '',
  fasi: [],
});
const routine = (inizio: string, fine: string | null): BozzaAttivita => ({
  tipo: 'routine',
  titolo: 'Corsa',
  note: '',
  promemoria: { modo: 'auto' },
  giorni: [0, 1, 2, 3, 4, 5, 6],
  inizio,
  fine,
  dataInizio: '2026-09-28',
  termine: null,
  fasi: [],
});
const scelta: SceltaSessione = { unitaId: null, corsoId: null, durata: 50, modalita: 'continua', iperfocus: false };
const registro = async () => (await list(db, 'registroNotifiche')).map((r) => r.chiave).sort();

describe('Studio con default — SCENARI F1', () => {
  it('08:55 pre, 09:00 inizio, 09:30 verifica, 10:10 esito; avviata alle 09:02 la verifica sparisce, l’esito resta', async () => {
    await blocco({ id: 's1', inizio: oggi(9), fine: oggi(10) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await s.reconcile(oggi(8));
    expect(p.vista()).toEqual(['pre:5:s1@08:55', 'inizio:0:s1@09:00', 'verifica:0:s1@09:30', 'esito:0:s1@10:10']);
    await startSession(db, 's1', scelta, oggi(9, 2), FUSO);
    await s.reconcile(oggi(9, 2));
    // pre e inizio sono già scattate; delle pendenti resta l'esito
    expect(p.vista(oggi(9, 2)).filter((v) => !v.startsWith(CHIAVE_TEMPO_SCADUTO))).toEqual(['esito:0:s1@10:10']);
    const prima = p.chiamate.length;
    await s.reconcile(oggi(9, 3));
    expect(p.chiamate.length).toBe(prima);
  });
});

describe('Sveglie — SCENARI F2', () => {
  it('evento 20:00 con 1 giorno, 1 ora e sveglia all’inizio: tre voci, l’ultima sveglia', async () => {
    const pers: Promemoria = {
      modo: 'personalizzato',
      anticipi: [
        { minuti: 1440, sveglia: false },
        { minuti: 60, sveglia: false },
        { minuti: 0, sveglia: true },
      ],
    };
    await crea(evento('2026-09-29', { inizio: '20:00', fine: '21:00' }, pers), oggi(8));
    const p = portaFinta();
    await createNotifications(db, p.porta, orologio(oggi(8))).reconcile(oggi(8));
    const voci = [...p.armate.values()].sort((a, b) => a.istante - b.istante);
    expect(voci.map((v) => [v.istante, v.sveglia])).toEqual([
      [oggi(20), false],
      [local(2026, 9, 29, 19, 0), false],
      [local(2026, 9, 29, 20, 0), true],
    ]);
  });
});

describe('Finestra — SCENARI F4', () => {
  it('routine per sempre: dopo 10 giorni la finestra si estende e il passato esce dal registro', async () => {
    await crea(routine('07:00', '08:00'), oggi(6));
    await runCycle(db, oggi(6), FUSO);
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(6)));
    await s.reconcile(oggi(6));
    const ultimo = addLocalDays(oggi(6), 14);
    expect([...p.armate.values()].every((v) => v.istante <= ultimo)).toBe(true);
    const dopo = addLocalDays(oggi(6), 10);
    await runCycle(db, dopo, FUSO);
    await s.reconcile(dopo);
    const righe = await list(db, 'registroNotifiche');
    const future = righe.filter((v) => v.istante > dopo);
    expect(future.every((v) => v.istante <= addLocalDays(dopo, 14))).toBe(true);
    expect(future.some((v) => v.istante > ultimo)).toBe(true);
    // Le già scattate restano solo da ieri in poi (Ieri · gestite, §8)
    expect(righe.every((v) => v.istante >= addLocalDays(oggi(0), 9))).toBe(true);
  });

  it('evento fra 20 giorni con anticipo 1 giorno: armato quando lo scatto entra nei 14 giorni', async () => {
    const pers: Promemoria = { modo: 'personalizzato', anticipi: [{ minuti: 1440, sveglia: false }] };
    await crea(evento('2026-10-18', { inizio: '20:00', fine: '21:00' }, pers), oggi(8));
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await s.reconcile(oggi(8));
    expect(p.armate.size).toBe(0);
    await s.reconcile(addLocalDays(oggi(21), 6));
    expect(p.armate.size).toBe(1);
  });
});

describe('Tutto il giorno — SCENARI E3', () => {
  it('evento tutto il giorno domani: una notifica alle 08:00', async () => {
    await crea(evento('2026-09-29', null, { modo: 'auto' }), oggi(10));
    const p = portaFinta();
    await createNotifications(db, p.porta, orologio(oggi(10))).reconcile(oggi(10));
    expect([...p.armate.values()].map((v) => v.istante)).toEqual([local(2026, 9, 29, 8, 0)]);
  });
});

describe('Cambio di stato — SCENARI F6', () => {
  it('completare cancella, riaprire ri-arma, eliminare cancella', async () => {
    const id = await crea(todo({ inizio: '18:00', durata: 30 }), oggi(8));
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await s.reconcile(oggi(8));
    expect(p.armate.size).toBe(2);
    await completeBlock(db, id, oggi(9), FUSO);
    await s.reconcile(oggi(9));
    expect(p.armate.size).toBe(0);
    await reopenBlock(db, id, oggi(9, 1), FUSO);
    await s.reconcile(oggi(9, 1));
    expect(p.vista()).toEqual([`pre:30:${id}@17:30`, `scadenza:0:${id}@18:00`]);
    await deleteBlock(db, id, oggi(9, 2), FUSO);
    await s.reconcile(oggi(9, 2));
    expect([p.armate.size, (await registro()).length]).toEqual([0, 0]);
  });

  describe('Trascinamento — SCENARI G3 (notifiche ri-armate)', () => {
    it('trascinare un todo senza orario alle 15:00 arma le sue notifiche; l’annulla le cancella di nuovo', async () => {
      const id = await crea(todo(null), oggi(8));
      const p = portaFinta();
      const s = createNotifications(db, p.porta, orologio(oggi(8)));
      await s.reconcile(oggi(8));
      expect(p.armate.size).toBe(0);
      const annulla = await moveBlock(db, id, { inizio: oggi(15) }, oggi(9), FUSO);
      await s.reconcile(oggi(9));
      expect(p.vista()).toEqual([`pre:30:${id}@14:30`, `scadenza:0:${id}@15:00`]);
      await annulla?.(oggi(9));
      await s.reconcile(oggi(9));
      expect(p.armate.size).toBe(0);
    });

    it('trascinare un perso a un orario nuovo lo ri-arma; l’annulla lo riporta perso e cancella', async () => {
      await blocco({ id: 'r1', tipo: 'routine', inizio: oggi(7), fine: oggi(8) });
      await runCycle(db, oggi(9), FUSO);
      const p = portaFinta();
      const s = createNotifications(db, p.porta, orologio(oggi(9)));
      await s.reconcile(oggi(9));
      const annulla = await moveBlock(db, 'r1', { inizio: oggi(18) }, oggi(9), FUSO);
      await s.reconcile(oggi(9));
      expect(p.vista()).toEqual(['pre:10:r1@17:50', 'inizio:0:r1@18:00', 'verifica:0:r1@18:30']);
      await annulla?.(oggi(9));
      await s.reconcile(oggi(9));
      expect(p.armate.size).toBe(0);
    });
  });

  it('perdere (ciclo): il perso esce dal desiderato; le sue voci, già consegnate, non si cancellano né si riarmano', async () => {
    await blocco({ id: 'r2', tipo: 'routine', inizio: oggi(21), fine: oggi(21, 30) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(20)));
    await s.reconcile(oggi(20));
    expect(p.armate.size).toBe(3);
    await runCycle(db, oggi(22, 1), FUSO);
    expect((await get(db, 'blocchi', 'r2'))?.stato).toBe('perso');
    const prima = p.chiamate.length;
    await s.reconcile(oggi(22, 1));
    expect(p.chiamate.length).toBe(prima);
    expect(await registro()).toEqual(['inizio:0:r2', 'pre:10:r2', 'verifica:0:r2']);
  });

  it('spegnere il tipo todo cancella tutte le notifiche dei todo alla riconciliazione successiva', async () => {
    await crea(todo({ inizio: '18:00', durata: 30 }), oggi(8));
    await blocco({ id: 's1', inizio: oggi(15), fine: oggi(16) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await s.reconcile(oggi(8));
    const imp = structuredClone(IMPOSTAZIONI_NOTIFICHE_DEFAULT);
    imp.perTipo.todo.attivo = false;
    await save(db, 'preferenze', { id: CHIAVE_IMPOSTAZIONI_NOTIFICHE, valore: imp }, oggi(8));
    await s.reconcile(oggi(8, 1));
    expect([...p.armate.values()].map((v) => v.tipo)).toEqual(['studio', 'studio', 'studio', 'studio']);
  });
});

describe('Checklist — SCENARI A3', () => {
  it('spuntare l’ultima voce completa e cancella; despuntarla riapre e ri-arma', async () => {
    const id = await crea(todo({ inizio: '18:00', durata: 30 }, ['latte']), oggi(8));
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await s.reconcile(oggi(8));
    await toggleChecklist(db, id, 0, oggi(9), FUSO);
    await s.reconcile(oggi(9));
    expect(p.armate.size).toBe(0);
    await toggleChecklist(db, id, 0, oggi(9, 1), FUSO);
    await s.reconcile(oggi(9, 1));
    expect(p.armate.size).toBe(2);
  });
});

describe('Modifica della routine — SCENARI B6', () => {
  it('07:00 → 18:00 alle 15:00: le notifiche di domani cambiano chiave e orario, le vecchie sono cancellate', async () => {
    const rid = await crea(routine('07:00', '08:00'), oggi(6));
    await runCycle(db, oggi(6), FUSO);
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(15)));
    await s.reconcile(oggi(15));
    const domani = (v: string[]) => v.filter((x) => x.includes('2026-09-29'));
    expect(domani(p.vista())).toEqual([
      `pre:10:${rid}:2026-09-29:07:00@06:50`,
      `inizio:0:${rid}:2026-09-29:07:00@07:00`,
      `verifica:0:${rid}:2026-09-29:07:00@07:30`,
    ]);
    const r = (await get(db, 'ricorrenze', rid))!;
    await editRecurrence(db, { ...r, orarioInizio: '18:00', orarioFine: '19:00' }, oggi(15), FUSO);
    await s.reconcile(oggi(15));
    expect(domani(p.vista())).toEqual([
      `pre:10:${rid}:2026-09-29:18:00@17:50`,
      `inizio:0:${rid}:2026-09-29:18:00@18:00`,
      `verifica:0:${rid}:2026-09-29:18:00@18:30`,
    ]);
  });
});

describe('Anticipo — SCENARI C4', () => {
  it('«Anticipa» alle 14:40 ri-arma verifica ed esito sugli orari nuovi', async () => {
    await blocco({ id: 's1', inizio: oggi(15), fine: oggi(16) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(14, 30)));
    await s.reconcile(oggi(14, 30));
    await anticipateSession(db, 's1', oggi(14, 40), FUSO);
    await s.reconcile(oggi(14, 40));
    expect(p.vista()).toEqual(['verifica:0:s1@15:10', 'esito:0:s1@15:50']);
  });
});

describe('Tempo scaduto — SCENARI D1', () => {
  it('avvio alle 09:10 sul blocco 09:00–10:00: voce alle 10:00; chiusura e abbandono la cancellano', async () => {
    await blocco({ id: 's1', inizio: oggi(9), fine: oggi(10) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(9, 10)));
    const sessione = await startSession(db, 's1', scelta, oggi(9, 10), FUSO);
    expect(sessione.fine).toBe(oggi(10));
    await s.reconcile(oggi(9, 10));
    expect(p.vista()).toEqual([`${CHIAVE_TEMPO_SCADUTO}@10:00`, 'esito:0:s1@10:10']);
    await endSession(db, oggi(9, 40), FUSO, { esito: 'continua', confidenza: null, nota: '', contaNelPiano: false });
    await s.reconcile(oggi(9, 40));
    expect(p.vista()).not.toContain(`${CHIAVE_TEMPO_SCADUTO}@10:00`);

    await startSession(db, 's1', scelta, oggi(9, 41), FUSO);
    await s.reconcile(oggi(9, 41));
    expect(p.vista()).toContain(`${CHIAVE_TEMPO_SCADUTO}@10:00`);
    await abandonSession(db, oggi(9, 42), FUSO);
    await s.reconcile(oggi(9, 42));
    expect(p.vista()).not.toContain(`${CHIAVE_TEMPO_SCADUTO}@10:00`);
  });
});

describe('Registro — MECCANISMI §1, §13.3', () => {
  it('righe = voci armate con idNativo; differenza vuota senza chiamate né scritture; permesso chiesto una volta', async () => {
    await blocco({ id: 's1', inizio: oggi(9), fine: oggi(10) });
    await blocco({ id: 's2', inizio: oggi(15), fine: oggi(16) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await s.reconcile(oggi(8));
    const righe = await list(db, 'registroNotifiche');
    expect(righe.map((r) => [r.id, r.idNativo])).toEqual(
      [...p.armate.values()].map((v) => [v.chiave, v.idNativo]).sort(([a], [b]) => String(a).localeCompare(String(b))),
    );
    const aggiornate = righe.map((r) => r.updatedAt);
    await s.reconcile(oggi(8, 1));
    expect(p.chiamate).toHaveLength(1);
    expect((await list(db, 'registroNotifiche')).map((r) => r.updatedAt)).toEqual(aggiornate);
    await blocco({ id: 's3', inizio: oggi(17), fine: oggi(18) });
    await s.reconcile(oggi(8, 2));
    expect(p.porta.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('la prima riconciliazione del processo riarma tutto il registro, senza cancellare; la seconda nulla', async () => {
    await blocco({ id: 's1', inizio: oggi(9), fine: oggi(10) });
    await createNotifications(db, portaFinta().porta, orologio(oggi(8))).reconcile(oggi(8));
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await s.reconcile(oggi(8));
    expect(p.chiamate).toEqual(['schedule pre:5:s1 inizio:0:s1 verifica:0:s1 esito:0:s1']);
    await s.reconcile(oggi(8));
    expect(p.chiamate).toHaveLength(1);
  });

  it('una porta che fallisce non fa fallire la riconciliazione; il registro resta e la successiva riprova (INV-16)', async () => {
    await blocco({ id: 's1', inizio: oggi(9), fine: oggi(10) });
    const p = portaFinta();
    p.guasta.schedule = true;
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await expect(s.reconcile(oggi(8))).resolves.toBeUndefined();
    expect(await registro()).toEqual([]);
    p.guasta.schedule = false;
    await s.reconcile(oggi(8));
    expect((await registro()).length).toBe(4);
    await completeBlock(db, 's1', oggi(8, 1), FUSO);
    await abandonSession(db, oggi(8, 1), FUSO);
    await saveBlock(db, { ...(await get(db, 'blocchi', 's1'))!, stato: 'saltato' }, oggi(8, 1), FUSO);
    p.guasta.cancel = true;
    await s.reconcile(oggi(8, 2));
    expect((await registro()).length).toBe(4);
    p.guasta.cancel = false;
    await s.reconcile(oggi(8, 3));
    expect(await registro()).toEqual([]);
  });

  it('un permesso che non risponde mai (prompt aperto, nessun gesto) non ferma la coda', async () => {
    await blocco({ id: 's1', inizio: oggi(9), fine: oggi(10) });
    const p = portaFinta();
    p.porta.requestPermission = () => new Promise<boolean>(() => {});
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await s.reconcile(oggi(8));
    await blocco({ id: 's2', inizio: oggi(15), fine: oggi(16) });
    await s.reconcile(oggi(8, 1));
    expect(p.armate.size).toBe(8);
  });

  it('due riconciliazioni insieme si accodano: la seconda trova la differenza vuota', async () => {
    await blocco({ id: 's1', inizio: oggi(9), fine: oggi(10) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await Promise.all([s.reconcile(oggi(8)), s.reconcile(oggi(8))]);
    expect(p.chiamate).toHaveLength(1);
  });

  it('impostazioni assenti o illeggibili → default di §13.1', async () => {
    expect(await readNotificationSettings(db)).toEqual(IMPOSTAZIONI_NOTIFICHE_DEFAULT);
    await save(db, 'preferenze', { id: CHIAVE_IMPOSTAZIONI_NOTIFICHE, valore: { generale: 'sì' } }, oggi(8));
    expect(await readNotificationSettings(db)).toEqual(IMPOSTAZIONI_NOTIFICHE_DEFAULT);
  });
});

describe('Inneschi — MECCANISMI §13.3 (ogni mutazione)', () => {
  it('start(): una scrittura su un blocco o sulla sessione attiva riconcilia senza il ciclo; dopo lo stop nulla', async () => {
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    const stop = s.start();
    await blocco({ id: 's1', inizio: oggi(9), fine: oggi(10) });
    await vi.waitFor(() => expect(p.armate.size).toBe(4));
    await save(
      db,
      'preferenze',
      { id: CHIAVE_SESSIONE_ATTIVA, valore: { ...scelta, avvio: oggi(8), fine: oggi(8, 50), bloccoId: null } },
      oggi(8),
    );
    await vi.waitFor(() => expect(p.vista()).toContain(`${CHIAVE_TEMPO_SCADUTO}@08:50`));
    stop();
    await blocco({ id: 's2', inizio: oggi(15), fine: oggi(16) });
    await new Promise<void>((fatto) => setTimeout(fatto, 50));
    expect(p.armate.size).toBe(5);
    expect(await listBy(db, 'blocchi', 'tipo', 'studio')).toHaveLength(2);
  });
});

// La lib della radice è ES2022 senza DOM né Node (D-TS-1): si dichiarano i soli globali che servono ai test
declare const setTimeout: (fatto: () => void, ms: number) => unknown;
declare function structuredClone<T>(v: T): T;
