import { describe, expect, it } from 'vitest';
import {
  applyOutcome,
  assignPointer,
  completedUnits,
  criteriaMet,
  currentUnit,
  modulePath,
  partialProgress,
  pointerPlan,
  previousUnitInPath,
  statiModuli,
  type UnitaPercorso,
} from './pointer';
import { local, minutes } from './time';
import type { Blocco } from './types';

const unit = (id: string, moduloNumero: number, ordine: number): UnitaPercorso => ({
  id,
  moduloNumero,
  ordine,
  stato: 'non_iniziata',
  minuti: 0,
  progresso: 0,
});

/** Corso di C1: unità 1.1, 1.2, 2.1. */
const course = () => [unit('1.1', 1, 1), unit('1.2', 1, 2), unit('2.1', 2, 1)];

/** Routine lun–ven 09:00: quattro occorrenze future. */
const blocks = [
  { id: 'b1', inizio: local(2026, 9, 23, 9) },
  { id: 'b2', inizio: local(2026, 9, 24, 9) },
  { id: 'b3', inizio: local(2026, 9, 25, 9) },
  { id: 'b4', inizio: local(2026, 9, 28, 9) },
];

describe('Puntatore — SCENARI C1', () => {
  it('le occorrenze future puntano, in ordine, a 1.1, 1.2, 2.1, poi a nessuna unità', () => {
    const map = assignPointer(course(), blocks);
    expect([...map.values()]).toEqual(['1.1', '1.2', '2.1', null]);
    expect(currentUnit(course())?.id).toBe('1.1');
  });

  it('i blocchi sono ordinati cronologicamente anche se passati in disordine', () => {
    const map = assignPointer(course(), [blocks[2]!, blocks[0]!, blocks[1]!]);
    expect(map.get('b1')).toBe('1.1');
    expect(map.get('b2')).toBe('1.2');
    expect(map.get('b3')).toBe('2.1');
  });
});

describe('Esiti — SCENARI C3', () => {
  it('Completata su 1.1 → 1.1 completata, domani punta a 1.2, progresso corso 1/3', () => {
    const r = applyOutcome({ unita: course(), unitaPianificataId: '1.1', esito: 'completata', minuti: 60 });
    expect(r.statoBlocco).toBe('completato');
    expect(r.unita.find((u) => u.id === '1.1')?.stato).toBe('completata');
    expect(currentUnit(r.unita)?.id).toBe('1.2');
  });

  it('poi Indietro su 1.2 → 1.1 torna da rivedere ed è di nuovo la prossima; 1.2 resta non iniziata', () => {
    const step1 = applyOutcome({ unita: course(), unitaPianificataId: '1.1', esito: 'completata', minuti: 60 });
    const prev = previousUnitInPath(step1.unita, '1.2');
    expect(prev?.id).toBe('1.1');
    const step2 = applyOutcome({
      unita: step1.unita,
      unitaPianificataId: '1.2',
      esito: 'indietro',
      minuti: 30,
      unitaPrecedenteId: prev?.id,
    });
    expect(step2.statoBlocco).toBe('indietro');
    expect(step2.unita.find((u) => u.id === '1.1')?.stato).toBe('da_rivedere');
    expect(step2.unita.find((u) => u.id === '1.2')?.stato).toBe('non_iniziata');
    expect(currentUnit(step2.unita)?.id).toBe('1.1');
  });

  it('poi Salta su 1.1 → 1.1 saltata, esce dal percorso; prossima = 1.2', () => {
    let unita = applyOutcome({ unita: course(), unitaPianificataId: '1.1', esito: 'completata', minuti: 60 }).unita;
    unita = applyOutcome({
      unita,
      unitaPianificataId: '1.2',
      esito: 'indietro',
      minuti: 30,
      unitaPrecedenteId: '1.1',
    }).unita;
    const r = applyOutcome({ unita, unitaPianificataId: '1.1', esito: 'salta', minuti: 0 });
    expect(r.statoBlocco).toBe('saltato');
    expect(r.unita.find((u) => u.id === '1.1')?.stato).toBe('saltata');
    expect(currentUnit(r.unita)?.id).toBe('1.2');
  });
});

describe('Continua — SCENARI C2', () => {
  it('45 minuti senza ore stimate → parziale, progresso = min(0,95; 45/180)', () => {
    const r = applyOutcome({ unita: course(), unitaPianificataId: '1.1', esito: 'continua', minuti: 45 });
    const u = r.unita.find((x) => x.id === '1.1')!;
    expect(r.statoBlocco).toBe('parziale');
    expect(u.stato).toBe('parziale');
    expect(u.minuti).toBe(45);
    expect(u.progresso).toBeCloseTo(45 / 180, 6);
    expect(currentUnit(r.unita)?.id).toBe('1.1'); // domani punta ancora a 1.1
  });

  it('il progresso parziale non supera 0,95 e usa le ore stimate quando ci sono', () => {
    expect(partialProgress(1000)).toBe(0.95);
    expect(partialProgress(60, 2)).toBe(0.5);
  });
});

describe('Moduli bloccati — FORMATO_CORSO §4 (decisione D-PTR-1)', () => {
  it('statiModuli: senza criteri è passato e apre il successivo; la chiusura si propaga', () => {
    const s = statiModuli([
      { numero: 1, criteriSoddisfatti: true },
      { numero: 2, criteriSoddisfatti: false },
      { numero: 3, criteriSoddisfatti: true },
    ]);
    expect([...s.values()]).toEqual(['passato', 'aperto', 'bloccato']);
  });

  it('il puntatore non entra in un modulo bloccato', () => {
    const modules = [
      { numero: 1, criteriSoddisfatti: false },
      { numero: 2, criteriSoddisfatti: true },
    ];
    const map = assignPointer(course(), blocks, modules);
    expect([...map.values()]).toEqual(['1.1', '1.2', null, null]);
  });

  it('con i criteri del modulo 1 tutti a sì, il modulo 2 si apre', () => {
    const modules = [
      { numero: 1, criteriSoddisfatti: true },
      { numero: 2, criteriSoddisfatti: false },
    ];
    const map = assignPointer(course(), blocks, modules);
    expect([...map.values()]).toEqual(['1.1', '1.2', '2.1', null]);
  });

  it('criteriaMet: il modulo è passato con tutti i criteri a sì, anche senza criteri; basta un no per non esserlo', () => {
    expect(criteriaMet([])).toBe(true);
    expect(criteriaMet([{ fatto: true }, { fatto: true }])).toBe(true);
    expect(criteriaMet([{ fatto: true }, { fatto: false }])).toBe(false);
  });
});

describe('Puntatore — SCENARI C1 (piano sui blocchi del corso, MECCANISMI §11)', () => {
  /** Martedì 22 settembre 2026 a mezzogiorno: le occorrenze di `blocks` sono tutte future. */
  const now = local(2026, 9, 22, 12, 0);
  const studio = (id: string, inizio: number, unitaId: string | null, over: Partial<Blocco> = {}): Blocco => ({
    id,
    tipo: 'studio',
    stato: 'programmato',
    inizio,
    fine: inizio + minutes(60),
    conOrario: true,
    unitaId,
    ...over,
  });
  const future = () => [
    studio('b1', local(2026, 9, 23, 9), null),
    studio('b2', local(2026, 9, 24, 9), null),
    studio('b3', local(2026, 9, 25, 9), null),
    studio('b4', local(2026, 9, 28, 9), 'vecchia'),
  ];

  it('le occorrenze future puntano in ordine a 1.1, 1.2, 2.1, poi a nessuna unità', () => {
    expect([...pointerPlan(course(), [], future(), now)]).toEqual([
      ['b1', '1.1'],
      ['b2', '1.2'],
      ['b3', '2.1'],
      ['b4', null],
    ]);
  });

  it('non tocca e non conta i blocchi già iniziati, non programmati o non di studio', () => {
    const esclusi = [
      studio('iniziato', local(2026, 9, 22, 11), 'u-iniziato'),
      studio('in-corso', local(2026, 9, 23, 8), 'u-in-corso', { stato: 'in_corso' }),
      studio('perso', local(2026, 9, 21, 9), 'u-perso', { stato: 'perso' }),
      studio('routine', local(2026, 9, 23, 7), null, { tipo: 'routine' }),
    ];
    const piano = pointerPlan(course(), [], [...esclusi, ...future()], now);
    expect([...piano.keys()]).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(piano.get('b1')).toBe('1.1');
  });

  it('senza cambiamenti il piano è vuoto; dopo «1.1 completata» contiene solo i blocchi che cambiano', () => {
    const giaPuntate: Record<string, string> = { b1: '1.1', b2: '1.2', b3: '2.1' };
    const allineati = future().map((b) => ({ ...b, unitaId: giaPuntate[b.id] ?? null }));
    expect(pointerPlan(course(), [], allineati, now).size).toBe(0);
    const unita = course().map((u) => (u.id === '1.1' ? { ...u, stato: 'completata' as const } : u));
    expect([...pointerPlan(unita, [], allineati, now)]).toEqual([
      ['b1', '1.2'],
      ['b2', '2.1'],
      ['b3', null],
    ]);
  });

  it('non entra in un modulo con un criterio Go/No-Go a no nel modulo precedente (D-PTR-1)', () => {
    const moduli = [
      { numero: 1, criteri: [{ fatto: true }, { fatto: false }] },
      { numero: 2, criteri: [] },
    ];
    // 2.1 non è mai assegnata: b3 resta senza unità (nessun cambiamento), b4 perde quella vecchia
    expect([...pointerPlan(course(), moduli, future(), now)]).toEqual([
      ['b1', '1.1'],
      ['b2', '1.2'],
      ['b4', null],
    ]);
  });
});

describe('Moduli segnaposto — FORMATO_CORSO §5 (T-041)', () => {
  it('un segnaposto è sempre bloccato e blocca i successivi, anche col precedente passato', () => {
    const stati = statiModuli([
      modulePath({ numero: 0, criteri: [{ fatto: true }] }),
      modulePath({ numero: 1, criteri: [{ fatto: true }] }),
      modulePath({ numero: 2, criteri: [], segnaposto: true }),
      modulePath({ numero: 3, criteri: [] }),
    ]);
    expect([...stati.values()]).toEqual(['passato', 'passato', 'bloccato', 'bloccato']);
  });
});

describe('Unità completate — MECCANISMI §11, D-DATA-2 n. 7 (audit P2-18)', () => {
  it('conta solo le completate: una saltata, una parziale o da rivedere non sono fatte', () => {
    const stati = ['completata', 'saltata', 'completata', 'parziale', 'da_rivedere', 'non_iniziata'] as const;
    expect(completedUnits(stati.map((stato) => ({ stato })))).toBe(2);
    expect(completedUnits([])).toBe(0);
  });
});
