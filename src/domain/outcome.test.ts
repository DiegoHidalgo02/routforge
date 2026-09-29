import { describe, expect, it } from 'vitest';
import {
  canRegisterOutcome,
  countsByDefault,
  outcomeBlock,
  outcomeHints,
  outcomeUnits,
  plannedMinutes,
  retroactiveBlock,
  sessionMinutes,
  type DatiEsito,
} from './outcome';
import type { UnitaPercorso } from './pointer';
import { local, MINUTE } from './time';
import type { Blocco, Esito } from './types';

type U = UnitaPercorso & { corsoId: string; confidenza: number | null };
const unit = (id: string, moduloNumero: number, ordine: number, corsoId = 'c1'): U => ({
  id,
  corsoId,
  moduloNumero,
  ordine,
  stato: 'non_iniziata',
  minuti: 0,
  progresso: 0,
  confidenza: null,
});
/** Corso di C1: unità 1.1, 1.2, 2.1; più un'unità di un altro corso. */
const units = (): U[] => [unit('1.1', 1, 1), unit('1.2', 1, 2), unit('2.1', 2, 1), unit('x.1', 1, 1, 'c2')];
const dati = (esito: Esito, over: Partial<DatiEsito> = {}): DatiEsito => ({
  esito,
  confidenza: 3,
  nota: '',
  contaNelPiano: true,
  ...over,
});
const byId = (xs: U[]) => Object.fromEntries(xs.map((u) => [u.id, u]));

const studio = (over: Partial<Blocco> = {}): Blocco => ({
  id: 's1',
  tipo: 'studio',
  stato: 'programmato',
  inizio: local(2026, 9, 28, 9),
  fine: local(2026, 9, 28, 10),
  conOrario: true,
  corsoId: 'c1',
  unitaId: '1.1',
  ...over,
});

describe('Continua — SCENARI C2', () => {
  it('45 minuti con confidenza 3: 1.1 parziale, 45 minuti, progresso min(0,95; 45/180) (§11)', () => {
    const out = byId(outcomeUnits(units(), '1.1', dati('continua'), { '1.1': 45 }));
    expect(out['1.1']).toMatchObject({ stato: 'parziale', minuti: 45, progresso: 45 / 180, confidenza: 3 });
    expect(Object.keys(out)).toEqual(['1.1']);
  });
  it('il blocco diventa parziale con confidenza, nota e minuti; la marcatura persa si azzera (§11)', () => {
    const b = outcomeBlock(studio({ persoIl: 1 }), dati('continua', { nota: ' ok ' }), 45, local(2026, 9, 28, 10));
    expect(b).toMatchObject({
      stato: 'parziale',
      persoIl: null,
      chiusoIl: local(2026, 9, 28, 10),
      confidenza: 3,
      notaEsito: 'ok',
      minuti: 45,
    });
  });
});

describe('Completata, Indietro, Salta — SCENARI C3', () => {
  it('Completata su 1.1 → completata con progresso 1', () => {
    expect(byId(outcomeUnits(units(), '1.1', dati('completata'), {}))['1.1']).toMatchObject({
      stato: 'completata',
      progresso: 1,
    });
  });
  it('Indietro su 1.2 → 1.1 torna da rivedere, 1.2 resta non iniziata (l’unità precedente nel percorso)', () => {
    const prima = units().map((u) => (u.id === '1.1' ? { ...u, stato: 'completata' as const } : u));
    const out = byId(outcomeUnits(prima, '1.2', dati('indietro'), { '1.2': 30 }));
    expect(out['1.1']?.stato).toBe('da_rivedere');
    expect(out['1.2']).toMatchObject({ stato: 'non_iniziata', minuti: 30, confidenza: 3 });
  });
  it('Indietro sulla prima unità del percorso agisce sulla pianificata', () => {
    expect(byId(outcomeUnits(units(), '1.1', dati('indietro'), {}))['1.1']?.stato).toBe('da_rivedere');
  });
  it('Indietro salta le unità saltate: torna la precedente ancora nel percorso (D-ESITO-1)', () => {
    const prima = units().map((u) =>
      u.id === '1.1'
        ? { ...u, stato: 'completata' as const }
        : u.id === '1.2'
          ? { ...u, stato: 'saltata' as const }
          : u,
    );
    const out = byId(outcomeUnits(prima, '2.1', dati('indietro'), {}));
    expect(out['1.1']?.stato).toBe('da_rivedere');
    expect(out['1.2']).toBeUndefined();
  });
  it('l’unità precedente è nello stesso corso', () => {
    const out = byId(outcomeUnits(units(), 'x.1', dati('indietro'), {}));
    expect(out['x.1']?.stato).toBe('da_rivedere');
    expect(out['1.1']).toBeUndefined();
  });
  it('Salta su 1.1 → saltata, progresso invariato', () => {
    expect(byId(outcomeUnits(units(), '1.1', dati('salta'), {}))['1.1']).toMatchObject({
      stato: 'saltata',
      progresso: 0,
    });
  });
  it('lo stato del blocco segue la tabella di §11', () => {
    const stato = (e: Esito) => outcomeBlock(studio(), dati(e), 0, 0).stato;
    expect([stato('completata'), stato('continua'), stato('indietro'), stato('salta')]).toEqual([
      'completato',
      'parziale',
      'indietro',
      'saltato',
    ]);
  });
  it('i suggerimenti dello sheet: il puntatore passa alla prossima pendente, Indietro ripete la precedente', () => {
    const lista = [
      { id: '1.1', stato: 'completata' as const },
      { id: '1.2', stato: 'non_iniziata' as const },
      { id: '2.1', stato: 'non_iniziata' as const },
    ];
    expect(outcomeHints(lista, '1.2')).toEqual({ successiva: '2.1', precedente: '1.1' });
    expect(outcomeHints(lista, '2.1')).toEqual({ successiva: '1.2', precedente: '1.2' });
    expect(outcomeHints(lista.slice(0, 1), '1.1')).toEqual({ successiva: null, precedente: null });
  });
});

describe('Minuti — MECCANISMI §11 «Sempre»', () => {
  it('le altre unità toccate ricevono solo i minuti; la confidenza non scelta resta quella di prima', () => {
    const prima = units().map((u) => (u.id === '1.1' ? { ...u, confidenza: 4 } : u));
    const out = byId(outcomeUnits(prima, '1.1', dati('completata', { confidenza: null }), { '1.1': 25, 'x.1': 20 }));
    expect(out['1.1']).toMatchObject({ minuti: 25, confidenza: 4 });
    expect(out['x.1']).toMatchObject({ stato: 'non_iniziata', minuti: 20, progresso: 0, confidenza: null });
  });
  it('dal riepilogo: minuti arrotondati per unità e minuti di focus', () => {
    expect(
      sessionMinutes({ focus: 50 * MINUTE + 20_000, perUnita: { u1: 25 * MINUTE + 40_000, u2: 25 * MINUTE } }),
    ).toEqual({
      minuti: 50,
      perUnita: { u1: 26, u2: 25 },
    });
  });
});

describe('Esito su blocco perso — SCENARI C6', () => {
  it('«Registra esito» senza sessione: minuti = durata pianificata; 0 con Salta o senza durata (§11)', () => {
    expect(plannedMinutes(studio(), 'completata')).toBe(60);
    expect(plannedMinutes(studio(), 'salta')).toBe(0);
    expect(plannedMinutes(studio({ fine: null }), 'continua')).toBe(0);
  });
  it('si registra su un perso o su un programmato con la fine passata, non prima e non su altri tipi (§8)', () => {
    const now = local(2026, 9, 28, 10, 5);
    expect(canRegisterOutcome(studio({ stato: 'perso' }), now)).toBe(true);
    expect(canRegisterOutcome(studio(), now)).toBe(true);
    expect(canRegisterOutcome(studio(), local(2026, 9, 28, 9, 30))).toBe(false);
    expect(canRegisterOutcome(studio({ stato: 'in_corso' }), now)).toBe(false);
    expect(canRegisterOutcome(studio({ stato: 'completato' }), now)).toBe(false);
    expect(canRegisterOutcome(studio({ tipo: 'routine', stato: 'perso' }), now)).toBe(false);
  });
});

describe('Sessione libera che conta — SCENARI C7', () => {
  it('«conta nel piano» di default: sì da un blocco; per una libera, sì se c’è un’unità (§11)', () => {
    expect(countsByDefault({ bloccoId: 's1', unitaId: null })).toBe(true);
    expect(countsByDefault({ bloccoId: null, unitaId: '2.1' })).toBe(true);
    expect(countsByDefault({ bloccoId: null, unitaId: null })).toBe(false);
  });
  it('il blocco retroattivo copre inizio e fine della sessione, sull’unità scelta', () => {
    const r = retroactiveBlock(local(2026, 9, 28, 9), local(2026, 9, 28, 9, 25), '2.1', 'c1');
    expect(outcomeBlock(r, dati('completata'), 25, local(2026, 9, 28, 9, 25))).toMatchObject({
      tipo: 'studio',
      stato: 'completato',
      conOrario: true,
      inizio: local(2026, 9, 28, 9),
      fine: local(2026, 9, 28, 9, 25),
      unitaId: '2.1',
      corsoId: 'c1',
      minuti: 25,
    });
  });
});

describe('Routine di studio senza corso — SCENARI C9', () => {
  it('l’unità scelta nel setup va sul blocco senza unità, col suo corso', () => {
    const b = outcomeBlock(studio({ unitaId: null, corsoId: null }), dati('completata'), 60, 0, {
      id: '1.2',
      corsoId: 'c1',
    });
    expect(b).toMatchObject({ stato: 'completato', unitaId: '1.2', corsoId: 'c1' });
  });
  it('un parziale ripreso somma i minuti al primo esito (D-ESITO-1)', () => {
    expect(outcomeBlock(studio({ stato: 'parziale', minuti: 30 }), dati('completata'), 20, 0).minuti).toBe(50);
  });
  it('senza unità l’esito non tocca nessuna unità', () => {
    expect(outcomeUnits(units(), null, dati('completata'), {})).toEqual([]);
  });
});
