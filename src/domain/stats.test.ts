import { describe, expect, it } from 'vitest';
import {
  activityMap,
  behaviourStats,
  blockMinutes,
  discipline,
  focusMinutes,
  longestStreak,
  periodRange,
  previousRange,
  sessionCount,
  statsEmpty,
  studyStats,
  triggerResponse,
  barWeeks,
  weeklyFocus,
  weeklyLost,
  weeklySessions,
  type SessioneStatistica,
} from './stats';
import { local, MINUTE } from './time';
import type { Riepilogo } from './timer';
import type { Blocco } from './types';

// Mercoledì 23 settembre 2026, 16:08 (orologio dei mock).
const ADESSO = local(2026, 9, 23, 16, 8);
const sessione = (
  avvio: number,
  minuti: number,
  over: Partial<Omit<SessioneStatistica, 'riepilogo'>> & { riepilogo?: Partial<Riepilogo> } = {},
): SessioneStatistica => ({
  bloccoId: null,
  avvio,
  fine: null,
  durata: minuti,
  modalita: 'continua',
  iperfocus: false,
  chiusura: 'completata',
  ...over,
  riepilogo: {
    focus: minuti * MINUTE,
    extra: 0,
    pauseSegmento: 0,
    numeroPause: 0,
    durataPause: 0,
    interruzioni: 0,
    usciteEmergenza: 0,
    perUnita: {},
    segmentiCompletati: 0,
    ...over.riepilogo,
  },
});
const blocco = (over: Partial<Blocco>): Blocco => ({
  id: 'b',
  tipo: 'studio',
  stato: 'completato',
  inizio: local(2026, 9, 23, 9),
  fine: local(2026, 9, 23, 10),
  conOrario: true,
  ...over,
});

describe('Periodo e focus — MECCANISMI §20', () => {
  it('7 giorni con oggi; il precedente di pari durata; focus delle sessioni avviate nel periodo e delta', () => {
    const r = periodRange(7, ADESSO);
    expect([r.da, r.a]).toEqual([local(2026, 9, 17), local(2026, 9, 24)]);
    const p = previousRange(7, ADESSO)!;
    expect([p.da, p.a]).toEqual([local(2026, 9, 10), local(2026, 9, 17)]);
    const s = [
      sessione(local(2026, 9, 23, 9), 45),
      sessione(local(2026, 9, 18, 9), 30),
      sessione(local(2026, 9, 12, 9), 50),
    ];
    expect(focusMinutes(s, [], r)).toBe(75);
    expect(focusMinutes(s, [], p)).toBe(50);
    expect(previousRange('tutto', ADESSO)).toBeNull();
    // Senza alcuna sessione: i minuti accreditati ai blocchi di studio (ripiego)
    expect(focusMinutes([], [blocco({ minuti: 40 }), blocco({ tipo: 'todo', minuti: 99 })], r)).toBe(40);
  });

  it('barre per settimana dal lunedì; sessioni e focus medio', () => {
    const r = periodRange(30, ADESSO);
    const s = [
      sessione(local(2026, 9, 21, 9), 60),
      sessione(local(2026, 9, 23, 9), 30),
      sessione(local(2026, 9, 15, 9), 45),
    ];
    const barre = weeklyFocus(s, [], r);
    expect(barre.at(-1)).toEqual({ settimana: local(2026, 9, 21), minuti: 90 });
    expect(barre.at(-2)).toEqual({ settimana: local(2026, 9, 14), minuti: 45 });
    expect(sessionCount(s, r)).toEqual({ numero: 3, media: 45 });
    // Con la settimana dalla domenica (Impostazioni, FUNZ §23) l'ultima barra parte il 20
    expect(weeklyFocus(s, [], r, 0).at(-1)).toEqual({ settimana: local(2026, 9, 20), minuti: 90 });
    // Senza sessioni le barre hanno lo stesso ripiego del totale: i minuti dei blocchi di studio
    expect(weeklyFocus([], [blocco({ minuti: 40 })], r).at(-1)).toEqual({ settimana: local(2026, 9, 21), minuti: 40 });
  });

  it('a cavallo del cambio dell’ora (25/10/2026) i giorni e le settimane partono a mezzanotte locale', () => {
    const fine = local(2026, 11, 4, 12);
    const r = periodRange(30, fine);
    expect(r.da).toBe(local(2026, 10, 6));
    const barre = weeklyFocus([sessione(local(2026, 10, 26, 9), 30)], [], r);
    expect(barre.map((b) => new Date(b.settimana).getHours())).toEqual(barre.map(() => 0));
    expect(barre.find((b) => b.settimana === local(2026, 10, 26))?.minuti).toBe(30);
  });
});

describe('Disciplina e costanza — MECCANISMI §20, §12', () => {
  it('completati / (completati + persi + saltati), globale e per tipo; parziali e programmati fuori dal rapporto', () => {
    const r = periodRange(7, ADESSO);
    const d = discipline(
      [
        blocco({ stato: 'completato' }),
        blocco({ stato: 'parziale' }),
        blocco({ stato: 'perso' }),
        blocco({ tipo: 'todo', stato: 'saltato' }),
        blocco({ tipo: 'todo', stato: 'programmato' }),
      ],
      r,
    );
    expect(d.globale).toBe(1 / 3);
    expect(d.perTipo).toMatchObject({ studio: 1 / 2, todo: 0, evento: null });
  });

  it('il record è la serie più lunga di giorni con un esito Completata o Continua, nel giorno dell’esito', () => {
    const giorno = (d: number, stato: Blocco['stato'] = 'completato') =>
      blocco({ inizio: local(2026, 9, d, 9), stato });
    const serie = [giorno(1), giorno(2), giorno(3), giorno(5), giorno(6, 'parziale'), giorno(7, 'perso')];
    expect(longestStreak(serie, 0)).toBe(3);
    // L'esito del blocco del 3 registrato il 4: le serie diventano 1–2 e 4–6
    expect(
      longestStreak([...serie.slice(0, 2), { ...serie[2]!, chiusoIl: local(2026, 9, 4, 8) }, ...serie.slice(3)], 0),
    ).toBe(3);
    // Mai sotto la streak attuale
    expect(longestStreak([], 5)).toBe(5);
  });

  it('vuoto: nessuna sessione e nessun blocco giudicato', () => {
    expect(statsEmpty([], [blocco({ stato: 'programmato' }), blocco({ stato: 'parziale' })])).toBe(true);
    expect(statsEmpty([], [blocco({ stato: 'perso' })])).toBe(false);
    expect(statsEmpty([sessione(ADESSO, 10)], [])).toBe(false);
  });
});

describe('Mappa di calore — MECCANISMI §20, SCENARI B4', () => {
  it('ultimi 84 giorni; i minuti dei blocchi fatti; senza orario o senza durata 0; scala sul massimo con minimo 60', () => {
    const { giorni, mappa } = activityMap(
      [
        blocco({ inizio: local(2026, 9, 23, 9), fine: local(2026, 9, 23, 9, 30) }),
        // B4: routine senza durata completata → giorno attivo con 0 minuti
        blocco({ tipo: 'routine', inizio: local(2026, 9, 22, 7), fine: null }),
        blocco({ tipo: 'todo', inizio: local(2026, 9, 21, 12), fine: local(2026, 9, 21, 23, 59), conOrario: false }),
        blocco({ stato: 'perso', inizio: local(2026, 9, 20, 9) }),
        // §20 «completati/parziali»: l'esito Indietro non fa un giorno con attività
        blocco({ stato: 'indietro', inizio: local(2026, 9, 19, 9) }),
        // Spuntato alle 16:08 il blocco delle 18:00 di oggi: oggi è già un giorno con attività
        blocco({ tipo: 'todo', inizio: local(2026, 9, 23, 18), fine: local(2026, 9, 23, 18, 30) }),
      ],
      ADESSO,
    );
    expect(giorni).toBe(3);
    expect(mappa).toHaveLength(84);
    expect(mappa.at(-1)).toEqual({ giorno: '2026-09-23', minuti: 60, livello: 1 });
    expect(mappa.at(-5)?.minuti).toBe(0);
    expect(mappa.at(-2)).toEqual({ giorno: '2026-09-22', minuti: 0, livello: 0 });
    expect(mappa.at(-3)?.minuti).toBe(0);
  });
});

describe('Studio e iperfocus — MECCANISMI §20, SCENARI D5', () => {
  it('esiti dei blocchi di studio; iperfocus con le uscite d’emergenza e il tempo extra', () => {
    const r = periodRange(7, ADESSO);
    const iper = (minuti: number, extra: number, uscite: number, chiusura: SessioneStatistica['chiusura']) =>
      sessione(local(2026, 9, 23, 9), minuti, {
        iperfocus: true,
        chiusura,
        riepilogo: { extra: extra * MINUTE, usciteEmergenza: uscite },
      });
    const s = studyStats(
      [
        blocco({ stato: 'completato' }),
        blocco({ stato: 'parziale' }),
        blocco({ stato: 'perso' }),
        blocco({ stato: 'saltato' }),
        blocco({ tipo: 'todo', stato: 'completato' }),
      ],
      // D5: 54 min con tempo extra +4 e un'uscita d'emergenza in un'altra sessione
      [iper(54, 4, 0, 'completata'), iper(20, 0, 1, 'abbandonata'), sessione(local(2026, 9, 22, 9), 30)],
      r,
    );
    expect(s.esiti).toEqual({ completata: 1, continua: 1, indietro: 0, saltaPersa: 2 });
    // Una sessione libera con l'esito Indietro entra negli esiti; una legata a un blocco no (conta il blocco)
    const esito = (e: 'indietro' | 'completata') => ({ esito: e, confidenza: null, nota: '', contaNelPiano: true });
    const libere = studyStats(
      [],
      [
        sessione(local(2026, 9, 22, 9), 20, { esito: esito('indietro') }),
        sessione(local(2026, 9, 22, 11), 20, { bloccoId: 'b', esito: esito('completata') }),
      ],
      r,
    );
    expect(libere.esiti).toEqual({ completata: 0, continua: 0, indietro: 1, saltaPersa: 0 });
    expect(s.iperfocus).toEqual({ sessioni: 2, totali: 3, minuti: 74, uscite: 1, abbandoni: 1, extra: 4 });
    expect(s.extra).toBe(4);
  });
});

describe('Risposta al trigger — MECCANISMI §20, SCENARI B7', () => {
  it('routine 18:00–20:00: spuntata alle 19:40 risponde al trigger delle 19:00; non toccata no; spuntata prima non scatta', () => {
    const routine = (over: Partial<Blocco>) =>
      blocco({ tipo: 'routine', inizio: local(2026, 9, 22, 18), fine: local(2026, 9, 22, 20), ...over });
    const t = triggerResponse(
      [
        routine({ stato: 'completato', chiusoIl: local(2026, 9, 22, 19, 40) }),
        routine({ stato: 'perso', chiusoIl: null }),
        routine({ stato: 'completato', chiusoIl: local(2026, 9, 22, 18, 30) }),
      ],
      periodRange(7, ADESSO),
      ADESSO,
    );
    expect(t).toEqual({ scattati: 2, risposti: 1, persi: 1, tasso: 1 / 2 });
  });

  it('senza durata la verifica è a inizio + 30′; avvio dopo la scadenza ed esito Continua rispondono; prima della scadenza non scatta', () => {
    const t = triggerResponse(
      [
        // Routine senza durata delle 07:00: verifica alle 07:30, spuntata alle 07:45
        blocco({ tipo: 'routine', inizio: local(2026, 9, 22, 7), fine: null, chiusoIl: local(2026, 9, 22, 7, 45) }),
        // Studio 09–10 avviato alle 09:40 (verifica alle 09:30)
        blocco({ stato: 'in_corso', minutiRitardo: 40 }),
        // Studio 09–10 di ieri con esito Continua scritto senza istante di chiusura
        blocco({ stato: 'parziale', inizio: local(2026, 9, 22, 9), fine: local(2026, 9, 22, 10) }),
        // Oggi 18:00–20:00: la verifica delle 19:00 non è ancora arrivata alle 16:08
        blocco({ tipo: 'routine', stato: 'programmato', inizio: local(2026, 9, 23, 18), fine: local(2026, 9, 23, 20) }),
        // Un todo non ha la verifica di metà durata
        blocco({ tipo: 'todo', stato: 'perso', inizio: local(2026, 9, 21, 9) }),
      ],
      periodRange(7, ADESSO),
      ADESSO,
    );
    expect(t).toEqual({ scattati: 3, risposti: 3, persi: 0, tasso: 1 });
  });

  it('il tocco sulla notifica della verifica risponde anche se poi il blocco si perde (§20 «tocco registrato», T-021)', () => {
    const routine = (over: Partial<Blocco>) =>
      blocco({
        tipo: 'routine',
        stato: 'perso',
        inizio: local(2026, 9, 22, 18),
        fine: local(2026, 9, 22, 20),
        ...over,
      });
    const t = triggerResponse(
      [routine({ toccoVerificaIl: local(2026, 9, 22, 19, 2) }), routine({ toccoVerificaIl: null })],
      periodRange(7, ADESSO),
      ADESSO,
    );
    expect(t).toEqual({ scattati: 2, risposti: 1, persi: 2, tasso: 1 / 2 });
  });
});

describe('Studio: piano, ritmo, unità e puntualità — MECCANISMI §20, SCENARI C5', () => {
  it('efficienza sulle sessioni con piano; pause, pomodoro, minuti per unità; puntualità con i recuperi (C5)', () => {
    const s = studyStats(
      [
        blocco({ minutiRitardo: 3 }), // entro 5'
        blocco({ minutiRitardo: 12 }), // ritardo oltre 5'
        blocco({ minutiRitardo: 0, minutiAnticipo: 10 }), // «Anticipa sessione» di 10'
        // Recupero avviato dopo la fine (09–10 alle 10:30): SCENARI C5 lo conta «in ritardo > 5'» (audit P1-10)
        blocco({ minutiRitardo: 90 }),
        blocco({ minutiRitardo: null }), // mai avviato
      ],
      [
        sessione(local(2026, 9, 23, 9), 40, {
          durata: 50,
          riepilogo: { numeroPause: 2, durataPause: 6 * MINUTE, interruzioni: 1, perUnita: { u1: 40 * MINUTE } },
        }),
        sessione(local(2026, 9, 22, 9), 50, {
          modalita: 'p25',
          riepilogo: { segmentiCompletati: 3, perUnita: { u1: 20 * MINUTE, u2: 30 * MINUTE } },
        }),
        sessione(local(2026, 9, 21, 9), 30, { durata: null }), // cronometro: senza piano
      ],
      periodRange(7, ADESSO),
    );
    expect(s.pianificato).toEqual({ focus: 90, piano: 100 });
    expect(s.pause).toEqual({ numero: 2, minuti: 6 });
    expect(s.interruzioni).toBe(1);
    expect(s.pomodoro).toEqual({ sessioni: 1, segmenti: 3 });
    expect(s.unita).toEqual([
      { unitaId: 'u1', minuti: 60, ultima: local(2026, 9, 23, 9), sessioni: 2 },
      { unitaId: 'u2', minuti: 30, ultima: local(2026, 9, 22, 9), sessioni: 1 },
    ]);
    // Scarti 3, 12, −10, 90: media 23,75 → 24; entro 5' due su quattro; oltre 5' il 12 e il recupero
    expect(s.puntualita).toEqual({ scarto: 24, entro: 2 / 4, ritardi: 2, anticipi: 1, anticipoMedio: 10 });
  });
});

describe('Comportamenti — MECCANISMI §20, SCENARI B4, B5', () => {
  const routine = (over: Partial<Blocco>) => blocco({ tipo: 'routine', ...over });
  const blocchi = [
    blocco({ id: 'p1', stato: 'perso', inizio: local(2026, 9, 21, 9) }),
    blocco({ id: 'p2', stato: 'perso', tipo: 'todo', inizio: local(2026, 9, 21, 18) }),
    blocco({ id: 'p3', stato: 'perso', tipo: 'todo', inizio: local(2026, 9, 22, 18) }),
    blocco({ id: 'f1', inizio: local(2026, 9, 23, 9), fine: local(2026, 9, 23, 10) }),
    // Costanza: due lunedì attivi nelle 4 settimane intere prima della corrente
    blocco({ id: 'c1', inizio: local(2026, 9, 14, 9), fine: local(2026, 9, 14, 10) }),
    blocco({ id: 'c2', inizio: local(2026, 9, 7, 9), fine: local(2026, 9, 7, 10) }),
    // B4: routine senza durata, una fatta e una persa; la programmata non conta
    ...(['completato', 'perso', 'programmato'] as const).map((stato, i) =>
      routine({
        id: `r${i}`,
        ricorrenzaId: 'med',
        titolo: 'Meditazione',
        fine: null,
        stato,
        inizio: local(2026, 9, 22 - i, 7),
      }),
    ),
    ...[21, 22].map((g) =>
      routine({
        id: `m${g}`,
        ricorrenzaId: 'mat',
        titolo: 'Mattina',
        inizio: local(2026, 9, g, 6),
        fine: local(2026, 9, g, 6, 30),
      }),
    ),
  ];
  const fase = (id: string, etichetta: string, stato: 'fatta' | 'saltata') => ({ id, etichetta, stato });
  const ricorrenze = [
    {
      id: 'mat',
      titolo: 'Mattina',
      fasi: [
        { id: 'a', etichetta: 'viso', ordine: 1 },
        { id: 'b', etichetta: 'Stretching', ordine: 2 },
      ],
    },
  ];
  const log = [
    { id: 'm21', ricorrenzaId: 'mat', fasi: [fase('a', 'Skin-care', 'saltata'), fase('b', 'Stretching', 'fatta')] },
    { id: 'm22', ricorrenzaId: 'mat', fasi: [fase('a', 'Skin-care', 'fatta'), fase('b', 'Stretching', 'fatta')] },
  ];

  it('fasce dal focus delle sessioni, altrimenti dai blocchi fatti; costanza per giorno; persi; fasi; routine senza durata', () => {
    const c = behaviourStats(
      blocchi,
      [sessione(local(2026, 9, 23, 9), 45), sessione(local(2026, 9, 22, 20), 30)],
      log,
      ricorrenze,
      7,
      ADESSO,
    );
    expect(c.fasce).toEqual([45, 0, 30, 0]);
    expect(behaviourStats(blocchi, [], log, ricorrenze, 7, ADESSO).fasce).toEqual([120, 0, 0, 0]);
    expect(c.costanza).toEqual([0, 2 / 4, 0, 0, 0, 0, 0]);
    // La frase del design: lunedì di mattina ha 2 persi su 4 (09:00 e la routine delle 07:00)
    expect(c.persi).toEqual({ numero: 4, momento: { giorno: 1, fascia: 0, quota: 2 / 4 } });
    // B5: «skin-care» rinominata «viso» nel template; i log restano com'erano, la fase compare una volta come «viso»
    expect(c.fasi).toEqual([{ etichetta: 'viso', padre: 'Mattina', saltate: 1, totali: 2 }]);
    expect(c.senzaDurata).toEqual([{ titolo: 'Meditazione', ora: '07:00', fatte: 1, totali: 2 }]);
  });
});

describe('Barre per settimana — MECCANISMI §20 (S20: vince il design, D-STATS-1)', () => {
  it('sempre le ultime 12 settimane fino a quella corrente, qualunque sia il periodo; sessioni con la media e persi', () => {
    const barre = barWeeks(ADESSO);
    expect([barre.da, barre.a]).toEqual([local(2026, 7, 6), local(2026, 9, 28)]);
    const s = weeklySessions(
      [sessione(local(2026, 9, 23, 9), 30), sessione(local(2026, 9, 22, 9), 30), sessione(local(2026, 9, 15, 9), 30)],
      barre,
    );
    expect(s.settimane).toHaveLength(12);
    expect(s.settimane.at(-1)).toEqual({ settimana: local(2026, 9, 21), numero: 2 });
    expect(s.media).toBe(3 / 12);
    const persi = weeklyLost([blocco({ stato: 'perso', inizio: local(2026, 9, 21, 9) }), blocco({})], barre);
    expect([persi.length, persi.at(-1)?.numero]).toEqual([12, 1]);
  });
});

describe('Minuti di un blocco — MECCANISMI §20, SCENARI B4 (audit P3-13)', () => {
  const inizio = local(2026, 9, 23, 9, 0);
  it('con orario la durata in minuti; senza orario, senza fine o con la fine prima dell’inizio vale 0', () => {
    expect(blockMinutes({ conOrario: true, inizio, fine: inizio + 45 * MINUTE })).toBe(45);
    expect(blockMinutes({ conOrario: false, inizio, fine: inizio + 45 * MINUTE })).toBe(0);
    expect(blockMinutes({ conOrario: true, inizio, fine: null })).toBe(0);
    expect(blockMinutes({ conOrario: true, inizio, fine: inizio - MINUTE })).toBe(0);
  });
});
