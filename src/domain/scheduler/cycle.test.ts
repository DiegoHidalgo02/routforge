import { describe, expect, it } from 'vitest';
import { endOfLocalDay, local, localDayKey, localTimeKey } from '../time';
import type { Blocco, BloccoAncorato } from '../types';
import { lostPlan, orphanPlan } from './cycle';

/** Un blocco con il suo ancoraggio di parete, come lo legge il ciclo dalla tabella `blocchi` (D-TIME-2). */
const ancorato = (over: Partial<BloccoAncorato> & Pick<Blocco, 'id' | 'inizio' | 'fine'>): BloccoAncorato => ({
  tipo: 'routine',
  stato: 'programmato',
  conOrario: true,
  giornoLocale: localDayKey(over.inizio),
  orarioInizio: localTimeKey(over.inizio),
  orarioFine: over.fine === null ? null : localTimeKey(over.fine),
  fuso: 'Europe/Rome',
  ...over,
});

// Settembre 2026: martedì 22, mercoledì 23.
describe('Reset orfani — MECCANISMI §8, SCENARI C8', () => {
  const studio = (id: string, fineOra: number, fineMin: number) =>
    ancorato({
      id,
      tipo: 'studio',
      stato: 'in_corso',
      inizio: local(2026, 9, 23, 9, 0),
      fine: local(2026, 9, 23, fineOra, fineMin),
      unitaId: 'u1',
    });
  const now = local(2026, 9, 23, 10, 40);

  it("riporta a `programmato` solo gli `in_corso` non collegati con la fine passata da > 30', il resto intatto", () => {
    const orfano = studio('orfano', 10, 0);
    const collegato = studio('collegato', 10, 0);
    const recente = studio('recente', 10, 20);
    const programmato = { ...studio('programmato', 10, 0), stato: 'programmato' as const };
    expect(orphanPlan([orfano, collegato, recente, programmato], 'collegato', now)).toEqual([
      { ...orfano, stato: 'programmato' },
    ]);
  });

  it('senza orfani il piano è vuoto', () => {
    expect(orphanPlan([studio('collegato', 10, 0)], 'collegato', now)).toEqual([]);
  });
});

describe('Marcatura persi — SCENARI B7 (routine 18:00–20:00 non avviata)', () => {
  const routine = ancorato({ id: 'r', inizio: local(2026, 9, 23, 18, 0), fine: local(2026, 9, 23, 20, 0) });

  it('alle 20:29 non è ancora persa', () => {
    expect(lostPlan([routine], local(2026, 9, 23, 20, 29))).toEqual({ persi: [], avvisiRitardo: [], avvisiPerso: [] });
  });

  it("alle 20:31 è persa con l'istante della marcatura e un avviso «blocco perso»", () => {
    const now = local(2026, 9, 23, 20, 31);
    expect(lostPlan([routine], now)).toEqual({
      persi: [{ ...routine, stato: 'perso', persoIl: now }],
      avvisiRitardo: [],
      avvisiPerso: ['r'],
    });
  });

  it('un secondo piano sul risultato non marca né avvisa di nuovo (una sola notifica)', () => {
    const { persi } = lostPlan([routine], local(2026, 9, 23, 20, 31));
    expect(lostPlan(persi, local(2026, 9, 23, 20, 32))).toEqual({ persi: [], avvisiRitardo: [], avvisiPerso: [] });
  });

  it("scoperta oltre 2 ore dopo la fine è persa senza avviso; entro le 2 ore con l'avviso (§8)", () => {
    expect(lostPlan([routine], local(2026, 9, 23, 22, 1)).avvisiPerso).toEqual([]);
    expect(lostPlan([routine], local(2026, 9, 23, 22, 1)).persi).toHaveLength(1);
    expect(lostPlan([routine], local(2026, 9, 23, 21, 59)).avvisiPerso).toEqual(['r']);
    expect(lostPlan([routine], local(2026, 9, 23, 22, 0)).avvisiPerso).toEqual(['r']); // «entro le ultime 2 ore»: incluso
  });

  it('vale anche per un blocco di studio', () => {
    const studio = { ...routine, id: 's', tipo: 'studio' as const };
    expect(lostPlan([studio], local(2026, 9, 23, 20, 31)).avvisiPerso).toEqual(['s']);
  });
});

describe('Non fatto — SCENARI A1 (todo «Chiama Marco» senza orario, orizzonte giorno)', () => {
  const inizio = local(2026, 9, 22, 12, 0);
  const marco = ancorato({
    id: 'm',
    tipo: 'todo',
    conOrario: false,
    orizzonte: 'giorno',
    inizio,
    fine: endOfLocalDay(inizio),
  });

  it('alle 00:29 del giorno dopo non è ancora «non fatto»', () => {
    expect(lostPlan([marco], local(2026, 9, 23, 0, 29)).persi).toEqual([]);
  });

  it("alle 00:30 è «non fatto» nel giorno di ieri, con l'avviso «in ritardo» e `ritardoIl`", () => {
    const now = local(2026, 9, 23, 0, 30);
    expect(lostPlan([marco], now)).toEqual({
      persi: [{ ...marco, stato: 'perso', persoIl: now, ritardoIl: now }],
      avvisiRitardo: ['m'],
      avvisiPerso: [],
    });
  });

  it('se l’avviso è già partito (`ritardoIl` scritto) è «non fatto» senza un secondo avviso (D-HOR-1)', () => {
    const now = local(2026, 9, 23, 0, 30);
    const avvisato = { ...marco, ritardoIl: local(2026, 9, 21, 9, 0) };
    expect(lostPlan([avvisato], now)).toEqual({
      persi: [{ ...avvisato, stato: 'perso', persoIl: now }],
      avvisiRitardo: [],
      avvisiPerso: [],
    });
  });

  it('un todo con orizzonte settimana ancora aperto rotola invece di diventare «non fatto» (§6)', () => {
    const spesa = { ...marco, id: 'spesa', orizzonte: 'settimana' as const };
    expect(lostPlan([spesa], local(2026, 9, 23, 0, 30)).persi).toEqual([]);
  });
});

describe('Evento — SCENARI E2 (mai perso)', () => {
  it('un evento concluso da ore non è marcato e non riceve avvisi «perso»', () => {
    const evento = ancorato({
      id: 'e',
      tipo: 'evento',
      inizio: local(2026, 9, 25, 15, 0),
      fine: local(2026, 9, 25, 16, 0),
    });
    expect(lostPlan([evento], local(2026, 9, 26, 12, 0))).toEqual({ persi: [], avvisiRitardo: [], avvisiPerso: [] });
  });
});

describe('Marcatura persi — MECCANISMI §8 (solo i blocchi `programmati`)', () => {
  it('in corso, completati, saltati e già persi restano intatti', () => {
    const base = { inizio: local(2026, 9, 23, 7, 0), fine: local(2026, 9, 23, 8, 0) };
    const blocchi = (['in_corso', 'completato', 'saltato', 'perso'] as const).map((stato) =>
      ancorato({ ...base, id: stato, stato }),
    );
    expect(lostPlan(blocchi, local(2026, 9, 23, 12, 0)).persi).toEqual([]);
  });
});
