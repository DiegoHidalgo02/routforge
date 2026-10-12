import { describe, expect, it } from 'vitest';
import {
  canCheckRoutine,
  horizonLastDay,
  isOrphan,
  isRollingTodo,
  lostAtInstant,
  lostNotificationDue,
  pendingOutcomes,
  recoveryDeadline,
  shouldMarkLost,
} from './lost';
import { orphanPlan } from './scheduler/cycle';
import { local, localDayKey } from './time';
import type { Blocco } from './types';

const block = (over: Partial<Blocco>): Blocco => ({
  id: 'x',
  tipo: 'routine',
  stato: 'programmato',
  inizio: local(2026, 9, 23, 7, 0), // mercoledì
  fine: local(2026, 9, 23, 8, 0),
  conOrario: true,
  ...over,
});

describe('Persi — SCENARI B2 (routine 07:00–08:00 di mercoledì)', () => {
  const b = block({});
  it("non è persa un istante prima delle 08:30, lo è dalle 08:30 in punto (fine + 30'; audit P3-6)", () => {
    expect(shouldMarkLost(b, local(2026, 9, 23, 8, 30) - 1)).toBe(false);
    expect(shouldMarkLost(b, local(2026, 9, 23, 8, 30))).toBe(true);
    expect(lostAtInstant(b)).toBe(local(2026, 9, 23, 8, 30));
  });
  it('spuntabile solo mercoledì (né martedì né giovedì)', () => {
    expect(canCheckRoutine(b, local(2026, 9, 22, 12, 0))).toBe(false);
    expect(canCheckRoutine(b, local(2026, 9, 23, 0, 0))).toBe(true);
    expect(canCheckRoutine(b, local(2026, 9, 23, 23, 59))).toBe(true);
    expect(canCheckRoutine(b, local(2026, 9, 24, 12, 0))).toBe(false);
  });
});

describe('Routine notturna — SCENARI B3 (sabato 23:00 → domenica 01:00)', () => {
  const b = block({ inizio: local(2026, 9, 26, 23, 0), fine: local(2026, 9, 27, 1, 0) });
  it('domenica alle 00:30 è ancora spuntabile; persa da domenica 01:30', () => {
    expect(canCheckRoutine(b, local(2026, 9, 27, 0, 30))).toBe(true);
    expect(shouldMarkLost(b, local(2026, 9, 27, 1, 29))).toBe(false);
    expect(shouldMarkLost(b, local(2026, 9, 27, 1, 31))).toBe(true);
  });
});

describe('Routine senza durata — SCENARI B4 (07:00, senza fine)', () => {
  const b = block({ fine: null });
  it("verifica a inizio + 30'; persa alle 00:29 del giorno dopo", () => {
    expect(recoveryDeadline(b)).toBe(local(2026, 9, 23, 7, 30));
    expect(lostAtInstant(b)).toBe(local(2026, 9, 24, 0, 29));
    expect(shouldMarkLost(b, local(2026, 9, 23, 23, 0))).toBe(false);
    expect(shouldMarkLost(b, local(2026, 9, 24, 0, 30))).toBe(true);
  });
  it('spuntabile tutto il giorno previsto', () => {
    expect(canCheckRoutine(b, local(2026, 9, 23, 22, 0))).toBe(true);
  });
});

describe('Verifica e recupero — SCENARI B7 (18:00–20:00)', () => {
  const b = block({ inizio: local(2026, 9, 23, 18, 0), fine: local(2026, 9, 23, 20, 0) });
  it('la scadenza di recupero è a metà durata (19:00) e la marcatura persa alle 20:30', () => {
    expect(recoveryDeadline(b)).toBe(local(2026, 9, 23, 19, 0));
    expect(lostAtInstant(b)).toBe(local(2026, 9, 23, 20, 30));
  });
});

describe('Avviso «blocco perso» — MECCANISMI §8 (routine e studio, fine nelle ultime 2 ore)', () => {
  const b = block({ inizio: local(2026, 9, 23, 18, 0), fine: local(2026, 9, 23, 20, 0) });
  const alle = (h: number, m: number) => local(2026, 9, 23, h, m);

  it('routine e studio con la fine nelle ultime 2 ore; mai todo ed evento', () => {
    expect(lostNotificationDue(b, alle(20, 31))).toBe(true);
    expect(lostNotificationDue({ ...b, tipo: 'studio' }, alle(22, 0))).toBe(true);
    expect(lostNotificationDue(b, alle(22, 1))).toBe(false);
    expect(lostNotificationDue({ ...b, tipo: 'todo' }, alle(20, 31))).toBe(false);
    expect(lostNotificationDue({ ...b, tipo: 'evento' }, alle(20, 31))).toBe(false);
  });

  it('non se una sessione era partita sul blocco (C8; «conta nel piano» spento, D-ESITO-1) né se è nato dopo la sua fine (D-OCC-1)', () => {
    expect(lostNotificationDue({ ...b, tipo: 'studio', minutiRitardo: 0 }, alle(20, 31))).toBe(false);
    expect(lostNotificationDue({ ...b, createdAt: alle(20, 5) }, alle(20, 31))).toBe(false);
    expect(lostNotificationDue({ ...b, createdAt: alle(19, 0) }, alle(20, 31))).toBe(true);
  });
});

describe('Todo — SCENARI A1 / A2 (orizzonte)', () => {
  it('A1: todo senza orario, orizzonte giorno → "non fatto" dalle 00:30 del giorno dopo', () => {
    const t = block({
      tipo: 'todo',
      conOrario: false,
      orizzonte: 'giorno',
      inizio: local(2026, 9, 23, 12, 0),
      fine: null,
    });
    expect(shouldMarkLost(t, local(2026, 9, 23, 23, 50))).toBe(false);
    expect(shouldMarkLost(t, local(2026, 9, 24, 0, 30))).toBe(true);
  });

  it('A2: todo con orizzonte settimana ancora in corso NON diventa perso (rotola)', () => {
    const t = block({
      tipo: 'todo',
      orizzonte: 'settimana',
      inizio: local(2026, 9, 22, 18, 0), // martedì
      fine: local(2026, 9, 22, 18, 30),
    });
    expect(shouldMarkLost(t, local(2026, 9, 23, 9, 0))).toBe(false); // mercoledì: rotola
    expect(shouldMarkLost(t, local(2026, 9, 28, 9, 0))).toBe(true); // lunedì dopo: orizzonte scaduto
  });

  it("rotola chi ha orizzonte settimana o mese ancora aperto, contato dal giorno di parete quando c'è (D-TIME-2)", () => {
    const t = block({
      tipo: 'todo',
      orizzonte: 'settimana',
      inizio: local(2026, 9, 22, 18, 0),
      fine: local(2026, 9, 22, 18, 30),
    });
    expect(isRollingTodo(t, local(2026, 9, 27, 9, 0))).toBe(true);
    expect(isRollingTodo(t, local(2026, 9, 28, 9, 0))).toBe(false);
    expect(isRollingTodo({ ...t, orizzonte: 'giorno' }, local(2026, 9, 22, 20, 0))).toBe(false);
    // Istanti di domenica, giorno di parete lunedì (creato in un altro fuso): l'orizzonte è la domenica dopo
    const lunedi = {
      ...t,
      inizio: local(2026, 9, 27, 23, 30),
      fine: local(2026, 9, 28, 0, 0),
      giornoLocale: '2026-09-28',
    };
    expect(isRollingTodo(lunedi, local(2026, 9, 29, 9, 0))).toBe(true);
  });

  it('orizzonte: settimana → domenica; mese → ultimo giorno del mese', () => {
    const tue = local(2026, 9, 22, 10, 0);
    expect(localDayKey(horizonLastDay(tue, 'giorno'))).toBe('2026-09-22');
    expect(localDayKey(horizonLastDay(tue, 'settimana'))).toBe('2026-09-27');
    // Settimana dalla domenica (Impostazioni, FUNZ §23): l'orizzonte finisce il sabato
    expect(localDayKey(horizonLastDay(tue, 'settimana', 0))).toBe('2026-09-26');
    expect(localDayKey(horizonLastDay(local(2026, 9, 27, 10), 'settimana', 0))).toBe('2026-10-03');
    expect(localDayKey(horizonLastDay(tue, 'mese'))).toBe('2026-09-30');
    expect(localDayKey(horizonLastDay(local(2026, 9, 27, 10, 0), 'settimana'))).toBe('2026-09-27'); // domenica resta domenica
  });
});

describe('Eventi — SCENARI E2', () => {
  it('un evento non viene mai marcato perso', () => {
    const e = block({ tipo: 'evento', inizio: local(2026, 9, 25, 15, 0), fine: local(2026, 9, 25, 16, 0) });
    expect(shouldMarkLost(e, local(2026, 9, 26, 12, 0))).toBe(false);
  });
});

describe('Esiti pendenti — SCENARI C6 / §8', () => {
  it('blocchi di studio persi negli ultimi 3 giorni, dal più recente, massimo 5', () => {
    const now = local(2026, 9, 25, 12, 0);
    const mk = (id: string, day: number, over: Partial<Blocco> = {}): Blocco =>
      block({
        id,
        tipo: 'studio',
        stato: 'perso',
        inizio: local(2026, 9, day, 9, 0),
        fine: local(2026, 9, day, 10, 0),
        persoIl: local(2026, 9, day, 10, 30),
        ...over,
      });
    const list = [
      mk('old', 20), // > 3 giorni: escluso
      mk('a', 24),
      mk('b', 23),
      mk('c', 22),
      mk('r', 25, { stato: 'programmato', persoIl: null }), // programmato con fine passata: incluso
      mk('done', 24, { stato: 'completato' }), // escluso
      mk('rt', 24, { tipo: 'routine' }), // non studio: escluso
    ];
    expect(pendingOutcomes(list, now).map((b) => b.id)).toEqual(['r', 'a', 'b', 'c']);
  });
});

describe('Orfani — MECCANISMI §8, SCENARI C8 (in corso senza la sessione attiva)', () => {
  // Blocco di studio 09:00–10:00 di mercoledì rimasto `in_corso`
  const b = block({
    id: 's',
    tipo: 'studio',
    stato: 'in_corso',
    inizio: local(2026, 9, 23, 9, 0),
    fine: local(2026, 9, 23, 10, 0),
  });

  it("non collegato alla sessione attiva, 40' dopo la fine è orfano", () => {
    expect(isOrphan(b, null, local(2026, 9, 23, 10, 40))).toBe(true);
    expect(isOrphan(b, 'un-altro-blocco', local(2026, 9, 23, 10, 40))).toBe(true);
  });

  it('collegato alla sessione attiva non è mai orfano, anche ore dopo la fine (tempo extra, §10.4)', () => {
    expect(isOrphan(b, 's', local(2026, 9, 23, 13, 0))).toBe(false);
  });

  it("con la fine passata da 30' esatti non lo è ancora; un istante dopo sì (> 30', §8)", () => {
    expect(isOrphan(b, null, local(2026, 9, 23, 10, 30))).toBe(false);
    expect(isOrphan(b, null, local(2026, 9, 23, 10, 30) + 1)).toBe(true);
  });

  it('solo un blocco `in_corso` può essere orfano', () => {
    expect(isOrphan({ ...b, stato: 'programmato' }, null, local(2026, 9, 23, 12, 0))).toBe(false);
    expect(isOrphan({ ...b, stato: 'perso' }, null, local(2026, 9, 23, 12, 0))).toBe(false);
  });

  it('senza durata la fine è 23:59: orfano solo dopo le 00:29 del giorno dopo (§8, fine effettiva)', () => {
    const s = { ...b, fine: null };
    expect(isOrphan(s, null, local(2026, 9, 24, 0, 29))).toBe(false);
    expect(isOrphan(s, null, local(2026, 9, 24, 0, 30))).toBe(true);
  });
});

describe('In corso su un altro dispositivo — MECCANISMI §8, §25 (audit P3-4)', () => {
  // Uno studio 09:00–10:00 avviato in recupero sul telefono: qui arriva `in_corso` dalla sync alle 10:35
  const b = block({
    id: 's',
    tipo: 'studio',
    stato: 'in_corso',
    inizio: local(2026, 9, 23, 9, 0),
    fine: local(2026, 9, 23, 10, 0),
  });
  const ricevutoIl = local(2026, 9, 23, 10, 35);

  it('per 12 ore dalla ricezione non è orfano: è la sessione dell’altro dispositivo, che qui non si vede', () => {
    expect(isOrphan(b, null, local(2026, 9, 23, 10, 40), ricevutoIl)).toBe(false);
    expect(isOrphan(b, null, local(2026, 9, 23, 22, 34), ricevutoIl)).toBe(false);
  });

  it('dopo 12 ore senza esito vale di nuovo §8: l’altro dispositivo non l’ha chiuso', () => {
    expect(isOrphan(b, null, local(2026, 9, 23, 22, 36), ricevutoIl)).toBe(true);
  });

  it('il piano degli orfani legge le ricezioni per id; gli altri seguono §8 (C8)', () => {
    const altro = { ...b, id: 'c8' };
    expect(orphanPlan([b, altro], null, local(2026, 9, 23, 10, 40), { s: ricevutoIl }).map((x) => x.id)).toEqual([
      'c8',
    ]);
  });
});
