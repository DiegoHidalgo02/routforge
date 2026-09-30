import { describe, expect, it } from 'vitest';
import { TIMER_VUOTO, type SessioneAttiva } from './session';
import { local, MINUTE } from './time';
import {
  abandonPlan,
  addInterruption,
  changeUnit,
  closeSession,
  currentStudyUnit,
  exitLocked,
  focusPercent,
  pauseSession,
  resumeSession,
  segmentTimeline,
  skipSegment,
  summary,
  timerState,
} from './timer';

// Lunedì 28 settembre 2026.
const ore = (h: number, m = 0, s = 0) => local(2026, 9, 28, h, m) + s * 1000;

const sessione = (over: Partial<SessioneAttiva> = {}): SessioneAttiva => ({
  unitaId: 'u1',
  corsoId: 'c1',
  durata: 50,
  modalita: 'continua',
  iperfocus: false,
  bloccoId: null,
  contesto: 'libera',
  avvio: ore(9),
  fine: null,
  ...TIMER_VUOTO,
  ...over,
});

describe('Ancorata all’orologio — SCENARI D1', () => {
  // Occorrenza 09:00–10:00 avviata alle 09:10 (routine): fine = fine del blocco, durata 50 (startPlan)
  const avviata = sessione({ contesto: 'routine', bloccoId: 'b1', avvio: ore(9, 10), fine: ore(10), durata: 50 });
  it('all’avvio mancano 50 minuti', () => {
    expect(timerState(avviata, ore(9, 10)).restante).toBe(50 * MINUTE);
  });
  it('una pausa di 5 minuti alle 09:30 non sposta la fine: alle 10:00 è finita con focus 45', () => {
    let s = pauseSession(avviata, ore(9, 30));
    expect(timerState(s, ore(9, 32)).inPausa).toBe(true);
    s = resumeSession(s, ore(9, 35));
    expect(timerState(s, ore(9, 59)).finita).toBe(false);
    const alle10 = timerState(s, ore(10));
    expect(alle10).toMatchObject({ finita: true, focus: 45 * MINUTE, fine: ore(10), restante: 0, extra: 0 });
  });
  it('oltre la fine prosegue in tempo extra, al netto delle pause', () => {
    const s = resumeSession(pauseSession(avviata, ore(10, 1)), ore(10, 2));
    expect(timerState(s, ore(10, 5))).toMatchObject({ extra: 4 * MINUTE, focus: 54 * MINUTE, avanzamento: 1 });
  });
});

describe('Ancorata al focus — SCENARI D2', () => {
  it('libera da 50 con una pausa di 10: finisce 60 minuti dopo l’avvio', () => {
    const s = resumeSession(pauseSession(sessione(), ore(9, 20)), ore(9, 30));
    expect(timerState(s, ore(9, 59)).finita).toBe(false);
    expect(timerState(s, ore(9, 40)).fine).toBe(ore(10));
    expect(timerState(s, ore(10))).toMatchObject({ finita: true, focus: 50 * MINUTE });
  });
  it('in pausa la fine si allontana', () => {
    const s = pauseSession(sessione(), ore(9, 20));
    expect(timerState(s, ore(9, 25)).fine).toBe(ore(9, 55));
  });
  it('il cronometro non finisce mai e non ha tempo extra', () => {
    const s = sessione({ durata: null });
    expect(timerState(s, ore(12))).toMatchObject({ finita: false, restante: null, extra: 0, avanzamento: null });
  });
});

describe('Pomodoro multi-materia — SCENARI D3', () => {
  const p = sessione({ durata: 90, modalita: 'p25' });
  const minuti = (s: SessioneAttiva) => segmentTimeline(s).map((x) => (x.fine - x.inizio) / MINUTE);
  it('i segmenti tassellano la durata: 25/5 tre volte su 90, 25/5/25/5/20 su 80; nessuno in modalità continua', () => {
    expect(minuti(p)).toEqual([25, 5, 25, 5, 25, 5]);
    expect(minuti(sessione({ durata: 80, modalita: 'p25' }))).toEqual([25, 5, 25, 5, 20]);
    expect(segmentTimeline(sessione())).toEqual([]);
  });
  it('dopo un «salta» i segmenti seguenti si anticipano e tassellano ancora la durata', () => {
    const s = skipSegment(p, ore(9, 10));
    expect(minuti(s)).toEqual([10, 5, 25, 5, 25, 5, 15]);
    // A 80' di focus l'ultimo segmento (studio) ha ancora un conto alla rovescia coerente con la fine
    expect(timerState(s, ore(10, 20)).segmento).toMatchObject({ tipo: 'studio', restante: 10 * MINUTE, totale: 7 });
  });
  it('ancorata all’orologio con una pausa: a fine sessione il segmento in corso conta come completato', () => {
    const r = sessione({ contesto: 'routine', avvio: ore(9), fine: ore(10), durata: 60, modalita: 'p25' });
    // Pausa di 2': a fine sessione il focus è 58, l'ultima pausa-segmento (55–60) è in corso e conta
    const conPausa = resumeSession(pauseSession(r, ore(9, 10)), ore(9, 12));
    expect(minuti(conPausa)).toEqual([25, 5, 25, 5]);
    expect(closeSession(conPausa, ore(10)).riepilogo.segmentiCompletati).toBe(4);
  });
  it('i segmenti avanzano da soli: a 26 minuti è la prima pausa', () => {
    expect(timerState(p, ore(9, 26)).segmento).toMatchObject({ indice: 1, totale: 6, tipo: 'pausa' });
  });
  it('cambio d’unità al terzo segmento di studio: 50 minuti sulla prima e 25 sulla seconda', () => {
    const s = changeUnit(p, ore(10), 'u2');
    expect(currentStudyUnit(s)).toBe('u2');
    const r = closeSession(s, ore(10, 30));
    expect(r.riepilogo.perUnita).toEqual({ u1: 50 * MINUTE, u2: 25 * MINUTE });
    expect(r.riepilogo).toMatchObject({ focus: 90 * MINUTE, pauseSegmento: 15 * MINUTE, segmentiCompletati: 6 });
    // L'esito resta sull'unità pianificata (T-018)
    expect(r.unitaId).toBe('u1');
    expect(r.chiusura).toBe('completata');
  });
  it('«salta» congela il focus reale del segmento; l’ultimo non si salta', () => {
    const s = skipSegment(p, ore(9, 10));
    expect(timerState(s, ore(9, 12)).segmento).toMatchObject({ indice: 1, tipo: 'pausa', restante: 3 * MINUTE });
    expect(summary(s, ore(9, 12))).toMatchObject({ perUnita: { u1: 10 * MINUTE }, segmentiCompletati: 0 });
    const ultimo = timerState(p, ore(10, 27)).segmento;
    expect(ultimo).toMatchObject({ indice: 5 });
    expect(skipSegment(p, ore(10, 27))).toBe(p);
    expect(timerState(p, ore(10, 40)).segmento).toMatchObject({ indice: 5, restante: null });
  });
  it('senza durata: 4 cicli, poi l’ultimo segmento prosegue', () => {
    const s = sessione({ durata: null, modalita: 'p50' });
    expect(timerState(s, ore(9)).segmento).toMatchObject({ totale: 8 });
  });
});

describe('Persistenza — SCENARI D4', () => {
  it('riaperta 12 minuti dopo, il timer ha 12 minuti in più di focus e non è in pausa', () => {
    // La sessione salvata contiene solo istanti: nessun contatore da far ripartire
    const salvata: SessioneAttiva = JSON.parse(JSON.stringify(sessione())) as SessioneAttiva;
    expect(timerState(salvata, ore(9, 12))).toMatchObject({ focus: 12 * MINUTE, inPausa: false });
  });
});

describe('Iperfocus — SCENARI D5', () => {
  const s = sessione({ iperfocus: true });
  it('uscita bloccata fino alla fine; l’ora di sblocco è la fine', () => {
    expect(exitLocked(s, ore(9, 20))).toBe(true);
    expect(timerState(s, ore(9, 20)).fine).toBe(ore(9, 50));
    expect(exitLocked(s, ore(9, 50))).toBe(false);
  });
  it('senza una fine (cronometro) l’uscita non si blocca', () => {
    expect(exitLocked(sessione({ iperfocus: true, durata: null }), ore(9, 20))).toBe(false);
  });
  it('«Esci comunque» registra l’interruzione «iperfocus» (uscita d’emergenza) e sblocca', () => {
    const uscita = addInterruption(s, ore(9, 20), true);
    expect(exitLocked(uscita, ore(9, 21))).toBe(false);
    expect(summary(uscita, ore(9, 21))).toMatchObject({ interruzioni: 1, usciteEmergenza: 1 });
    expect(summary(addInterruption(s, ore(9, 20)), ore(9, 21))).toMatchObject({ interruzioni: 1, usciteEmergenza: 0 });
  });
  it('superata la durata: tempo extra +04:12, riepilogo 54 minuti con 4 di extra', () => {
    const t = timerState(s, ore(9, 54, 12));
    expect(t).toMatchObject({ finita: true, extra: 4 * MINUTE + 12_000 });
    const r = closeSession(s, ore(9, 54, 12)).riepilogo;
    expect(Math.round(r.focus / MINUTE)).toBe(54);
    expect(Math.round(r.extra / MINUTE)).toBe(4);
  });
});

describe('Chiusura — MECCANISMI §10.5', () => {
  it('terminata prima del traguardo, abbandonata su richiesta; una pausa aperta si chiude', () => {
    const inPausa = pauseSession(sessione(), ore(9, 20));
    const c = closeSession(inPausa, ore(9, 30));
    expect(c).toMatchObject({ chiusura: 'terminata_prima', chiusaIl: ore(9, 30), pause: [{ fine: ore(9, 30) }] });
    expect(c.riepilogo).toMatchObject({ focus: 20 * MINUTE, numeroPause: 1, durataPause: 10 * MINUTE });
    expect(closeSession(sessione(), ore(9, 30), 'abbandonata').chiusura).toBe('abbandonata');
    expect(closeSession(sessione({ durata: null }), ore(9, 5)).chiusura).toBe('completata');
  });
  it('una pausa doppia o una ripresa senza pausa non cambiano nulla', () => {
    const s = pauseSession(sessione(), ore(9, 10));
    expect(pauseSession(s, ore(9, 11))).toBe(s);
    expect(resumeSession(sessione(), ore(9, 11)).pause).toEqual([]);
  });
});

describe('Abbandono oltre soglia — SCENARI D7', () => {
  // Routine sul blocco 09:00–10:00 avviata alle 09:00: durata pianificata 60 minuti (D-SESS-2)
  const routine = sessione({ contesto: 'routine', bloccoId: 'b1', avvio: ore(9), fine: ore(10), durata: 60 });
  const CONTINUA = { esito: 'continua', confidenza: null, nota: '', contaNelPiano: true };
  it('alle 09:40 con 39 minuti di focus (65%, §10.5): terminata prima con l’esito Continua che conta nel piano', () => {
    const s = resumeSession(pauseSession(routine, ore(9, 20)), ore(9, 21));
    expect(focusPercent(s, ore(9, 40))).toBe(65);
    expect(abandonPlan(s, ore(9, 40))).toEqual({ chiusura: 'terminata_prima', esito: CONTINUA });
  });
  it('alle 09:35 con 35 minuti di focus (58%): abbandono senza esito', () => {
    expect(focusPercent(routine, ore(9, 35))).toBe(58);
    expect(abandonPlan(routine, ore(9, 35))).toEqual({ chiusura: 'abbandonata', esito: null });
  });
  it('le pause non contano: 40 minuti di orologio con 10 di pausa sono al 50%', () => {
    const s = resumeSession(pauseSession(routine, ore(9, 20)), ore(9, 30));
    expect(focusPercent(s, ore(9, 40))).toBe(50);
    expect(abandonPlan(s, ore(9, 40)).esito).toBeNull();
  });
  it('il tempo extra non alza la quota oltre il 100%', () => {
    expect(focusPercent(routine, ore(10, 10))).toBe(100);
  });
  it('un recupero da 25 minuti sul blocco: la quota è sulla durata scelta, la stessa del tempo extra', () => {
    const r = sessione({ contesto: 'recupero', bloccoId: 'b1', avvio: ore(10, 20), fine: ore(10, 45), durata: 25 });
    expect(focusPercent(r, ore(10, 40))).toBe(80);
  });
  it('senza blocco o col cronometro la soglia non vale: sempre abbandono', () => {
    expect(focusPercent(sessione(), ore(9, 49))).toBeNull();
    expect(abandonPlan(sessione(), ore(9, 49))).toEqual({ chiusura: 'abbandonata', esito: null });
    const cronometro = sessione({ contesto: 'recupero', bloccoId: 'b1', durata: null });
    expect(focusPercent(cronometro, ore(12))).toBeNull();
    expect(abandonPlan(cronometro, ore(12)).esito).toBeNull();
  });
});
