import { describe, expect, it } from 'vitest';
import type { UnitaPercorso } from './pointer';
import {
  anticipatedBlock,
  courseDefaultUnit,
  lockedUnit,
  sessionContext,
  startContext,
  startPlan,
  studyActions,
  type SceltaSessione,
} from './session';
import { local } from './time';
import type { Blocco } from './types';

// Lunedì 28 settembre 2026 (oggi nei test), martedì 29.
const oggi = (h: number, m = 0) => local(2026, 9, 28, h, m);
const domani = (h: number, m = 0) => local(2026, 9, 29, h, m);

const studio = (over: Partial<Blocco> = {}): Blocco => ({
  id: 's1',
  tipo: 'studio',
  stato: 'programmato',
  conOrario: true,
  inizio: oggi(15),
  fine: oggi(16),
  corsoId: 'c1',
  unitaId: 'u07',
  ricorrenzaId: 'r1',
  ...over,
});

const scelta = (over: Partial<SceltaSessione> = {}): SceltaSessione => ({
  unitaId: null,
  corsoId: null,
  durata: 50,
  modalita: 'continua',
  iperfocus: false,
  ...over,
});

describe('Contesto di avvio — MECCANISMI §10.1', () => {
  it('nessun blocco → libera', () => {
    expect(sessionContext(null, oggi(10))).toBe('libera');
  });
  it('programmato e adesso < inizio − 5′ → anticipo; da inizio − 5′ in poi → routine', () => {
    expect(sessionContext(studio(), oggi(14, 54))).toBe('anticipo');
    expect(sessionContext(studio(), oggi(14, 55))).toBe('routine');
    expect(sessionContext(studio(), oggi(15, 59))).toBe('routine');
  });
  it('fine passata, o blocco perso → recupero', () => {
    expect(sessionContext(studio(), oggi(16))).toBe('recupero');
    expect(sessionContext(studio({ stato: 'perso' }), oggi(15, 10))).toBe('recupero');
  });
  it('all’avvio: in anticipo, da un blocco chiuso o da un altro tipo la sessione è libera', () => {
    expect(startContext(studio(), oggi(14, 40))).toBe('libera');
    expect(startContext(studio({ stato: 'completato' }), oggi(15, 10))).toBe('libera');
    expect(startContext(studio({ tipo: 'routine' }), oggi(15, 10))).toBe('libera');
    expect(startContext(studio(), oggi(15, 10))).toBe('routine');
    expect(startContext(studio({ stato: 'perso' }), oggi(17))).toBe('recupero');
  });
});

describe('Anticipo — SCENARI C4', () => {
  const b = studio();
  it('alle 14:40 l’occorrenza delle 15:00 è in anticipo: «Anticipa» o sessione libera', () => {
    expect(sessionContext(b, oggi(14, 40))).toBe('anticipo');
    expect(studyActions(b, oggi(14, 40), null)).toEqual(['anticipa', 'libera']);
  });
  it('«Inizia sessione» in anticipo parte come sessione libera senza toccare l’occorrenza', () => {
    const piano = startPlan(b, scelta({ unitaId: 'u07', corsoId: 'c1' }), oggi(14, 40));
    expect(piano.blocco).toBeNull();
    expect(piano.sessione).toMatchObject({ contesto: 'libera', bloccoId: null, unitaId: 'u07', fine: null });
  });
  it('«Anticipa sessione» sposta a 14:40–15:40 con 20 minuti di anticipo e il setup la propone come routine', () => {
    const spostato = anticipatedBlock(b, oggi(14, 40));
    expect(spostato).toMatchObject({ inizio: oggi(14, 40), fine: oggi(15, 40), minutiAnticipo: 20 });
    expect(sessionContext(spostato!, oggi(14, 40))).toBe('routine');
    const piano = startPlan(spostato!, scelta(), oggi(14, 40));
    expect(piano.sessione).toMatchObject({ contesto: 'routine', bloccoId: 's1', fine: oggi(15, 40), durata: 60 });
    expect(piano.blocco).toMatchObject({ stato: 'in_corso', minutiRitardo: 0, minutiAnticipo: 20 });
  });
  it('«Anticipa» vale solo in anticipo e solo per il blocco di oggi', () => {
    expect(anticipatedBlock(b, oggi(14, 55))).toBeNull();
    expect(anticipatedBlock(studio({ inizio: domani(15), fine: domani(16) }), oggi(14, 40))).toBeNull();
    expect(studyActions(studio({ inizio: domani(15), fine: domani(16) }), oggi(14, 40), null)).toEqual(['libera']);
  });
});

describe('Recupero tardivo e ritardo — SCENARI C5', () => {
  const b = studio({ inizio: oggi(9), fine: oggi(10) });
  it('09:00–10:00 avviata alle 10:20 in recupero con 50′: blocco in corso, ritardo 80′', () => {
    expect(sessionContext(b, oggi(10, 20))).toBe('recupero');
    expect(studyActions(b, oggi(10, 20), null)).toEqual(['recupera']);
    const piano = startPlan(b, scelta({ durata: 50 }), oggi(10, 20));
    expect(piano.blocco).toMatchObject({ stato: 'in_corso', minutiRitardo: 80 });
    expect(piano.sessione).toMatchObject({ contesto: 'recupero', bloccoId: 's1', durata: 50, avvio: oggi(10, 20) });
    expect(piano.sessione.fine).toBe(oggi(11, 10));
  });
  it('recupero a cronometro: nessuna fine', () => {
    expect(startPlan(b, scelta({ durata: null }), oggi(10, 20)).sessione).toMatchObject({ durata: null, fine: null });
  });
  it('un perso di ieri si recupera ancora (§8)', () => {
    const ieri = studio({ stato: 'perso', inizio: local(2026, 9, 27, 9), fine: local(2026, 9, 27, 10) });
    expect(studyActions(ieri, oggi(10), null)).toEqual(['recupera']);
  });
});

describe('Routine: fine ancorata all’orologio — MECCANISMI §10.1', () => {
  it('avviata alle 15:10: ritardo 10′, fine = fine del blocco, notifiche e timer da T-017', () => {
    const piano = startPlan(studio(), scelta({ durata: 25 }), oggi(15, 10));
    expect(piano.sessione).toMatchObject({ contesto: 'routine', fine: oggi(16), durata: 50 });
    expect(piano.blocco).toMatchObject({ stato: 'in_corso', minutiRitardo: 10 });
  });
  it('avviata qualche minuto prima dell’inizio: ritardo 0, mai negativo (D-SESS-1)', () => {
    expect(startPlan(studio(), scelta(), oggi(14, 57)).blocco).toMatchObject({ minutiRitardo: 0 });
  });
});

describe('Azioni dello studio — MECCANISMI §10.1', () => {
  it('il blocco della sessione attiva si riprende', () => {
    expect(studyActions(studio({ stato: 'in_corso' }), oggi(15, 20), { bloccoId: 's1' })).toEqual(['riprendi']);
  });
  it('completato, indietro o saltato → ripasso (sessione libera senza blocco)', () => {
    for (const stato of ['completato', 'indietro', 'saltato'] as const)
      expect(studyActions(studio({ stato }), oggi(15, 20), null)).toEqual(['ripasso']);
    const piano = startPlan(studio({ stato: 'completato' }), scelta(), oggi(15, 20));
    expect(piano.blocco).toBeNull();
    expect(piano.sessione.contesto).toBe('libera');
  });
  it('parziale di oggi → ripresa sul blocco, che tiene il suo esito; di un altro giorno → sessione libera', () => {
    expect(studyActions(studio({ stato: 'parziale' }), oggi(15, 20), null)).toEqual(['riprendi']);
    expect(studyActions(studio({ stato: 'parziale' }), oggi(17), null)).toEqual(['riprendi']);
    const ripresa = startPlan(studio({ stato: 'parziale' }), scelta(), oggi(15, 20));
    expect(ripresa.blocco).toBeNull();
    expect(ripresa.sessione).toMatchObject({ bloccoId: 's1', contesto: 'routine' });
    const ieri = studio({ stato: 'parziale', inizio: local(2026, 9, 27, 15), fine: local(2026, 9, 27, 16) });
    expect(studyActions(ieri, oggi(15, 20), null)).toEqual(['libera']);
    expect(startContext(ieri, oggi(15, 20))).toBe('libera');
  });
  it('un in corso che nessuna sessione punta (orfano) si riprende e tiene il ritardo del primo avvio', () => {
    const orfano = studio({ stato: 'in_corso', minutiRitardo: 3 });
    expect(studyActions(orfano, oggi(15, 40), null)).toEqual(['riprendi']);
    expect(startPlan(orfano, scelta(), oggi(15, 40)).blocco).toMatchObject({ stato: 'in_corso', minutiRitardo: 3 });
  });
  it('una routine a cavallo della mezzanotte si avvia ancora nel suo orario (D-SESS-1)', () => {
    const notte = studio({ inizio: oggi(23, 30), fine: domani(0, 30) });
    expect(studyActions(notte, domani(0, 10), null)).toEqual(['inizia']);
    expect(startContext(notte, domani(0, 10))).toBe('routine');
  });
  it('fra inizio − 5′ e la fine → inizia', () => {
    expect(studyActions(studio(), oggi(14, 55), null)).toEqual(['inizia']);
  });
});

describe('Materia — SCENARI C9', () => {
  const senzaCorso = studio({ corsoId: null, unitaId: null, inizio: oggi(20), fine: oggi(21) });
  it('blocco con unità puntata → quella, bloccata; senza corso → scelta libera', () => {
    expect(lockedUnit(studio(), oggi(15, 10))).toBe('u07');
    expect(lockedUnit(senzaCorso, oggi(20, 5))).toBeNull();
    // Libera (anche in anticipo): l'unità si sceglie
    expect(lockedUnit(studio(), oggi(14, 40))).toBeNull();
  });
  it('dal setup si sceglie l’unità 1.2 di un corso: la sessione la porta, col suo corso', () => {
    const piano = startPlan(senzaCorso, scelta({ unitaId: 'u12', corsoId: 'c2' }), oggi(20, 5));
    expect(piano.sessione).toMatchObject({ bloccoId: 's1', unitaId: 'u12', corsoId: 'c2' });
    expect(piano.blocco).toMatchObject({ stato: 'in_corso', unitaId: null, corsoId: null });
  });
  it('se nel setup non si sceglie nulla, la sessione non ha unità', () => {
    expect(startPlan(senzaCorso, scelta(), oggi(20, 5)).sessione).toMatchObject({ unitaId: null, corsoId: null });
  });
  it('con l’unità puntata la scelta del setup non conta', () => {
    const piano = startPlan(studio(), scelta({ unitaId: 'altra', corsoId: 'c2' }), oggi(15, 10));
    expect(piano.sessione).toMatchObject({ unitaId: 'u07', corsoId: 'c1' });
  });
});

describe('Corso scelto nel setup → unità corrente — MECCANISMI §10.1', () => {
  const u = (id: string, moduloNumero: number, ordine: number, stato: UnitaPercorso['stato']): UnitaPercorso => ({
    id,
    moduloNumero,
    ordine,
    stato,
    minuti: 0,
    progresso: 0,
  });
  it('la prima pendente dei moduli aperti', () => {
    expect(courseDefaultUnit([u('b', 0, 2, 'non_iniziata'), u('a', 0, 1, 'completata')])).toBe('b');
  });
  it('senza pendenti aperte: la prima non completata né saltata; altrimenti nessuna', () => {
    const moduli = [
      { numero: 0, criteriSoddisfatti: false },
      { numero: 1, criteriSoddisfatti: false },
    ];
    expect(courseDefaultUnit([u('a', 0, 1, 'completata'), u('c', 1, 1, 'non_iniziata')], moduli)).toBe('c');
    expect(courseDefaultUnit([u('a', 0, 1, 'completata'), u('b', 0, 2, 'saltata')])).toBeNull();
  });
});
