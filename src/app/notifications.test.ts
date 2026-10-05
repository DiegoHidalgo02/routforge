// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { get, list, listBy, save, saveBlock, type DatiBlocco } from '../data/repository';
import type { BozzaAttivita } from '../domain/activity';
import {
  CHIAVE_PROVA,
  CHIAVE_TEMPO_SCADUTO,
  IMPOSTAZIONI_NOTIFICHE_DEFAULT,
  RITARDO_ONE_SHOT_MS,
  type VoceRegistro,
} from '../domain/notifications/desiredSet';
import type { SceltaSessione } from '../domain/session';
import { addLocalDays, local } from '../domain/time';
import type { Orizzonte, Promemoria } from '../domain/types';
import { createActivity } from './activities';
import { completeBlock, deleteBlock, reopenBlock, toggleChecklist } from './completion';
import {
  CHIAVE_IMPOSTAZIONI_NOTIFICHE,
  createNotifications,
  readNotificationSettings,
  snoozeNotification,
} from './notifications';
import type { Clock } from './ports/clock';
import type { Notifications } from './ports/notifications';
import { editRecurrence } from './recurrences';
import { reorderTodo } from './reorder';
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
  return {
    now: () => t,
    fuso: () => FUSO,
    every: () => () => {},
    onForeground: () => () => {},
    inForeground: () => true,
  };
}

const blocco = (dati: Partial<DatiBlocco> & Pick<DatiBlocco, 'id' | 'inizio' | 'fine'>) =>
  saveBlock(db, { tipo: 'studio', stato: 'programmato', conOrario: true, titolo: 'Studio', ...dati }, oggi(7), FUSO);

async function crea(bozza: BozzaAttivita, now: number): Promise<string> {
  const r = await createActivity(db, bozza, now, FUSO);
  if (!r.ok) throw new Error(r.errori.join());
  return r.id;
}
type BozzaTodo = Extract<BozzaAttivita, { tipo: 'todo' }>;
const todo = (orario: { inizio: string; durata: number } | null, checklist: string[] = []): BozzaTodo => ({
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
const senzaOrario = (titolo: string, giorno: string, orizzonte: Orizzonte = 'giorno'): BozzaTodo => ({
  ...todo(null),
  titolo,
  giorno,
  orizzonte,
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

  describe('Riordino — SCENARI G3 (notifiche invariate)', () => {
    it('riordinare un todo senza orario non arma nulla di nuovo: resta nel digest', async () => {
      const a = await crea(senzaOrario('Prepara la valigia', '2026-09-28'), oggi(8));
      await crea(senzaOrario('Prenota il treno', '2026-09-28'), oggi(8, 1));
      const p = portaFinta();
      const s = createNotifications(db, p.porta, orologio(oggi(8)));
      await s.reconcile(oggi(8));
      const prima = p.vista();
      expect(await reorderTodo(db, a, 1, oggi(9), FUSO)).toBe(true);
      await s.reconcile(oggi(9));
      expect(p.vista()).toEqual(prima);
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
    // L'unica chiamata è l'avviso «perso» (T-020): nessun cancel, nessun riarmo delle voci scattate
    expect(p.chiamate.slice(prima)).toEqual(['schedule perso:0:r2']);
    expect(await registro()).toEqual(['inizio:0:r2', 'perso:0:r2', 'pre:10:r2', 'verifica:0:r2']);
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

  it('orario del digest (§13.5): letto se valido; righe senza di lui (T-019) o con un orario impossibile → default', async () => {
    const nuove = { ...IMPOSTAZIONI_NOTIFICHE_DEFAULT, digest: { orario: '07:30' } };
    await save(db, 'preferenze', { id: CHIAVE_IMPOSTAZIONI_NOTIFICHE, valore: nuove }, oggi(8));
    expect(await readNotificationSettings(db)).toEqual(nuove);
    const vecchie = { generale: true, perTipo: IMPOSTAZIONI_NOTIFICHE_DEFAULT.perTipo };
    await save(db, 'preferenze', { id: CHIAVE_IMPOSTAZIONI_NOTIFICHE, valore: vecchie }, oggi(8));
    expect(await readNotificationSettings(db)).toEqual(IMPOSTAZIONI_NOTIFICHE_DEFAULT);
    const rotte = { ...nuove, digest: { orario: '25:00' } };
    await save(db, 'preferenze', { id: CHIAVE_IMPOSTAZIONI_NOTIFICHE, valore: rotte }, oggi(8));
    expect(await readNotificationSettings(db)).toEqual(IMPOSTAZIONI_NOTIFICHE_DEFAULT);
  });
});

describe('Nessuna fascia silenziosa — SCENARI F3', () => {
  it('il todo delle 06:30 (anticipo 30′) avvisa alle 06:00; il digest alle 08:00; il «perso» delle 23:31 parte: nessun rinvio', async () => {
    const t = await crea({ ...todo({ inizio: '06:30', durata: 30 }), giorno: '2026-09-29' }, oggi(19));
    await crea(senzaOrario('Spesa', '2026-09-29'), oggi(19));
    await blocco({ id: 'r1', tipo: 'routine', inizio: oggi(21), fine: oggi(23) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(20)));
    await s.reconcile(oggi(20));
    expect(p.vista()).toEqual([
      'pre:10:r1@20:50',
      'inizio:0:r1@21:00',
      'verifica:0:r1@22:00',
      `pre:30:${t}@06:00`,
      `scadenza:0:${t}@06:30`,
      'digest:0:2026-09-29@08:00',
    ]);
    await runCycle(db, oggi(23, 31), FUSO);
    await s.reconcile(oggi(23, 31));
    expect(p.vista(oggi(23, 31))).toContain('perso:0:r1@23:31');
  });
});

describe('Digest — SCENARI A4', () => {
  it('due todo senza orario di oggi e uno di ieri (mese) non fatto: alle 08:00 un solo digest, 3 da fare (1 arretrato) coi titoli', async () => {
    const marco = await crea(senzaOrario('Chiama Marco', '2026-09-28'), oggi(7));
    const spesa = await crea(senzaOrario('Spesa', '2026-09-28'), oggi(7));
    const bolletta = await crea(senzaOrario('Bolletta', '2026-09-27', 'mese'), local(2026, 9, 27, 9, 0));
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(7)));
    await s.reconcile(oggi(7));
    const digest = () =>
      [...p.armate.values()]
        .filter((v) => v.trigger === 'digest')
        .sort((a, b) => a.istante - b.istante)
        .map((v) => [v.chiave, v.istante, v.digest?.totale, v.digest?.arretrati, [...(v.digest?.titoli ?? [])].sort()]);
    const titoli = ['Bolletta', 'Chiama Marco', 'Spesa'];
    expect(digest()).toEqual([['digest:0:2026-09-28', oggi(8), 3, 1, titoli]]);
    // Il ciclo delle 07:01 rotola «Bolletta» a oggi: resta un arretrato e il digest non cambia
    await runCycle(db, oggi(7, 1), FUSO);
    expect((await get(db, 'blocchi', bolletta))?.giornoLocale).toBe('2026-09-28');
    await s.reconcile(oggi(7, 1));
    expect(digest()).toEqual([['digest:0:2026-09-28', oggi(8), 3, 1, titoli]]);
    // Dopo le 08:00 il prossimo digest è quello di domani: solo «Bolletta» rotolerà ancora
    await s.reconcile(oggi(8, 1));
    expect(digest()).toEqual([
      ['digest:0:2026-09-28', oggi(8), 3, 1, titoli],
      ['digest:0:2026-09-29', local(2026, 9, 29, 8, 0), 1, 1, ['Bolletta']],
    ]);
    // Senza todo senza orario da fare: nessun digest
    for (const id of [marco, spesa, bolletta]) await completeBlock(db, id, oggi(8, 2), FUSO);
    await s.reconcile(oggi(8, 3));
    expect(digest()).toEqual([['digest:0:2026-09-28', oggi(8), 3, 1, titoli]]);
  });
});

describe('Posticipa — SCENARI F5', () => {
  it('«Posticipa» alle 09:01 sull’«inizio» delle 09:00: voce alle 09:11; un secondo tocco la sposta ancora; completata → nulla', async () => {
    await blocco({ id: 'r1', tipo: 'routine', inizio: oggi(9), fine: oggi(10) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await s.reconcile(oggi(8));
    await snoozeNotification(db, 'inizio:0:r1', oggi(9, 1));
    await s.reconcile(oggi(9, 1));
    expect(p.vista(oggi(9, 1))).toEqual(['inizio:0:r1@09:11', 'verifica:0:r1@09:30']);
    await snoozeNotification(db, 'inizio:0:r1', oggi(9, 12));
    await s.reconcile(oggi(9, 12));
    expect(p.vista(oggi(9, 12))).toEqual(['inizio:0:r1@09:22', 'verifica:0:r1@09:30']);
    await completeBlock(db, 'r1', oggi(9, 13), FUSO);
    await snoozeNotification(db, 'inizio:0:r1', oggi(9, 14));
    await s.reconcile(oggi(9, 14));
    expect(p.vista(oggi(9, 14))).toEqual([]);
  });
});

describe('Blocco perso — SCENARI B7', () => {
  it('routine 18:00–20:00 non avviata: il ciclo la marca persa e parte un solo avviso silenzioso 10 s dopo; il ciclo dopo non lo ripete', async () => {
    await blocco({ id: 'r', tipo: 'routine', inizio: oggi(18), fine: oggi(20) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(17)));
    await s.reconcile(oggi(17));
    await runCycle(db, oggi(20, 31), FUSO);
    await s.reconcile(oggi(20, 31));
    const persi = [...p.armate.values()].filter((v) => v.trigger === 'perso');
    expect(persi.map((v) => [v.chiave, v.istante, v.silenzioso, v.oneShot, v.azioni])).toEqual([
      ['perso:0:r', oggi(20, 31) + RITARDO_ONE_SHOT_MS, true, true, []],
    ]);
    const prima = p.chiamate.length;
    await runCycle(db, oggi(20, 32), FUSO);
    await s.reconcile(oggi(20, 32));
    expect(p.chiamate.length).toBe(prima);
    expect(await registro()).toContain('perso:0:r');
  });

  it('un perso riprogrammato (Modifica, T-042) e perso di nuovo riceve un nuovo avviso (D-NOTIF-2)', async () => {
    await blocco({ id: 'r', tipo: 'routine', inizio: oggi(18), fine: oggi(19) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(17)));
    await runCycle(db, oggi(19, 31), FUSO);
    await s.reconcile(oggi(19, 31));
    expect(p.vista(oggi(19, 31))).toEqual(['perso:0:r@19:31']);
    const perso = (await get(db, 'blocchi', 'r'))!;
    const ripreso = { ...perso, stato: 'programmato' as const, persoIl: null, inizio: oggi(20), fine: oggi(21) };
    await saveBlock(db, ripreso, oggi(19, 32), FUSO);
    await runCycle(db, oggi(21, 31), FUSO);
    await s.reconcile(oggi(21, 31));
    expect(p.vista(oggi(21, 31))).toEqual(['perso:0:r@21:31']);
  });

  it('un’occorrenza nata già persa non riceve l’avviso: routine creata alle 19:40 per le 18:00–19:00 di ogni giorno (D-OCC-1)', async () => {
    const rid = await crea(routine('18:00', '19:00'), oggi(19, 40));
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(19, 40)));
    await runCycle(db, oggi(19, 41), FUSO);
    expect((await get(db, 'blocchi', `${rid}:2026-09-28:18:00`))?.stato).toBe('perso');
    await s.reconcile(oggi(19, 41));
    // Entro le 2 ore dalla fine: solo la nascita dopo la fine esclude l'avviso
    expect(p.vista().some((v) => v.startsWith('perso:'))).toBe(false);
    expect(p.vista()).toContain(`pre:10:${rid}:2026-09-29:18:00@17:50`);
  });
});

describe('Avviso «perso» — SCENARI C8 (sessione avviata, poi abbandonata o chiusa senza contare nel piano)', () => {
  it('il blocco di studio riportato a programmato e poi giudicato perso non riceve l’avviso «perso»', async () => {
    await blocco({ id: 's1', inizio: oggi(9), fine: oggi(10) });
    await blocco({ id: 's2', inizio: oggi(9), fine: oggi(10) });
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await s.reconcile(oggi(8));
    await startSession(db, 's1', scelta, oggi(9, 10), FUSO);
    await abandonSession(db, oggi(9, 20), FUSO);
    await startSession(db, 's2', scelta, oggi(9, 21), FUSO);
    await endSession(db, oggi(9, 40), FUSO, { esito: 'continua', confidenza: null, nota: '', contaNelPiano: false });
    expect((await get(db, 'blocchi', 's2'))?.stato).toBe('programmato');
    await runCycle(db, oggi(10, 40), FUSO);
    expect([(await get(db, 'blocchi', 's1'))?.stato, (await get(db, 'blocchi', 's2'))?.stato]).toEqual([
      'perso',
      'perso',
    ]);
    await s.reconcile(oggi(10, 40));
    expect(p.vista(oggi(10, 40)).filter((v) => v.startsWith('perso:'))).toEqual([]);
  });
});

describe('Todo in ritardo — SCENARI A1', () => {
  it('«Chiama Marco» non fatto alle 00:30: un solo avviso silenzioso 10 s dopo con Segna fatto e Posticipa; il giorno dopo nulla', async () => {
    const id = await crea(senzaOrario('Chiama Marco', '2026-09-27'), local(2026, 9, 27, 10, 0));
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(local(2026, 9, 27, 10, 0)));
    await s.reconcile(local(2026, 9, 27, 10, 0));
    await runCycle(db, oggi(0, 30), FUSO);
    await s.reconcile(oggi(0, 30));
    const ritardo = [...p.armate.values()].filter((v) => v.trigger === 'ritardo');
    expect(ritardo.map((v) => [v.chiave, v.istante, v.silenzioso, v.azioni])).toEqual([
      [`ritardo:0:${id}`, oggi(0, 30) + RITARDO_ONE_SHOT_MS, true, ['segna_fatto', 'posticipa']],
    ]);
    const prima = p.chiamate.length;
    await runCycle(db, local(2026, 9, 29, 0, 30), FUSO);
    await s.reconcile(local(2026, 9, 29, 0, 30));
    expect(p.chiamate.length).toBe(prima);
  });
});

describe('Prova — MECCANISMI §13.6, FUNZ §7.6', () => {
  it('test(): chiede il permesso e arma la notifica di prova a +6 s, fuori dal registro', async () => {
    const p = portaFinta();
    const s = createNotifications(db, p.porta, orologio(oggi(8)));
    await s.test(oggi(8));
    expect(p.porta.requestPermission).toHaveBeenCalledTimes(1);
    expect([...p.armate.values()].map((v) => [v.chiave, v.istante, v.oneShot])).toEqual([
      [CHIAVE_PROVA, oggi(8) + 6_000, true],
    ]);
    expect(await registro()).toEqual([]);
    await blocco({ id: 's1', inizio: oggi(9), fine: oggi(10) });
    await s.reconcile(oggi(8, 1));
    expect(p.porta.requestPermission).toHaveBeenCalledTimes(1);
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
