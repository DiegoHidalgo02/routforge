import { describe, expect, it } from 'vitest';
import { addLocalDays, local, localDayKey, minutes } from '../time';
import type { Blocco, Promemoria, Ricorrenza } from '../types';
import {
  assignNativeIds,
  blockNotifications,
  CHIAVE_PROVA,
  CHIAVE_TEMPO_SCADUTO,
  desiredSet,
  digestNotification,
  IMPOSTAZIONI_NOTIFICHE_DEFAULT as DEF,
  nativeId,
  oneShotNotifications,
  POSTICIPO_MS,
  reconcilePlan,
  RITARDO_ONE_SHOT_MS,
  runsInBackground,
  sessionNotification,
  testNotification,
  unreadableBlocks,
  type ImpostazioniNotifiche,
  type NotificaPianificata,
} from './desiredSet';

// Lunedì 28 settembre 2026.
const oggi = (h: number, m = 0) => local(2026, 9, 28, h, m);

const blocco = (over: Partial<Blocco> = {}): Blocco => ({
  id: 'b1',
  tipo: 'studio',
  stato: 'programmato',
  inizio: oggi(9),
  fine: oggi(10),
  conOrario: true,
  titolo: 'Studio',
  ...over,
});
const pers = (...a: [number, boolean?][]): Promemoria => ({
  modo: 'personalizzato',
  anticipi: a.map(([minuti, sveglia = false]) => ({ minuti, sveglia })),
});
const ricorrenza = (promemoria: Promemoria): Ricorrenza => ({
  id: 'r1',
  tipo: 'routine',
  titolo: 'Corsa',
  note: '',
  giorni: [1],
  dataInizio: '2026-09-28',
  dataFine: null,
  dateSaltate: [],
  corsoId: null,
  fasi: [],
  promemoria,
  orarioInizio: '07:00',
  orarioFine: '08:00',
  fuso: 'Europe/Rome',
});
const conImp = (f: (i: ImpostazioniNotifiche) => void): ImpostazioniNotifiche => {
  const i = JSON.parse(JSON.stringify(DEF)) as ImpostazioniNotifiche;
  f(i);
  return i;
};
const riassunto = (n: NotificaPianificata[]) =>
  n.map((x) => [x.trigger, x.anticipo, new Date(x.istante).getHours() * 60 + new Date(x.istante).getMinutes()]);

describe('Livelli — MECCANISMI §13.1', () => {
  it('default per tipo: todo 30, studio 5, routine 10, evento 15', () => {
    expect(Object.fromEntries(Object.entries(DEF.perTipo).map(([t, v]) => [t, v.anticipi]))).toEqual({
      todo: [30],
      studio: [5],
      routine: [10],
      evento: [15],
    });
  });

  it('default: digest alle 08:00 (§13.5)', () => {
    expect(DEF.digest).toEqual({ orario: '08:00' });
  });

  it('Auto = anticipi del tipo; Off = nulla; Personalizzato = i suoi', () => {
    const r = (promemoria?: Promemoria) =>
      riassunto(blockNotifications(blocco({ tipo: 'routine', ...(promemoria && { promemoria }) }), undefined, DEF));
    expect(r()).toEqual(r({ modo: 'auto' }));
    expect(r({ modo: 'auto' })[0]).toEqual(['pre', 10, 8 * 60 + 50]);
    expect(r({ modo: 'off' })).toEqual([]);
    expect(r(pers([60]))[0]).toEqual(['pre', 60, 8 * 60]);
  });

  it('fusione vuota → nessun promemoria, nemmeno i trigger strutturali', () => {
    expect(blockNotifications(blocco({ promemoria: pers() }), undefined, DEF)).toEqual([]);
    const senzaAnticipi = conImp((i) => (i.perTipo.studio.anticipi = []));
    expect(blockNotifications(blocco(), undefined, senzaAnticipi)).toEqual([]);
  });

  it('generale spento → nulla; tipo spento → nulla per quel tipo', () => {
    expect(
      blockNotifications(
        blocco(),
        undefined,
        conImp((i) => (i.generale = false)),
      ),
    ).toEqual([]);
    const todoSpento = conImp((i) => (i.perTipo.todo.attivo = false));
    expect(blockNotifications(blocco({ tipo: 'todo' }), undefined, todoSpento)).toEqual([]);
    expect(blockNotifications(blocco(), undefined, todoSpento)).not.toEqual([]);
  });

  it("l'occorrenza eredita il promemoria della definizione, non quello copiato sul blocco", () => {
    const b = blocco({ tipo: 'routine', ricorrenzaId: 'r1', promemoria: { modo: 'auto' } });
    expect(blockNotifications(b, ricorrenza({ modo: 'off' }), DEF)).toEqual([]);
    expect(riassunto(blockNotifications(b, ricorrenza(pers([0, true])), DEF))).toEqual([
      ['inizio', 0, 9 * 60],
      ['verifica', 0, 9 * 60 + 30],
    ]);
    expect(blockNotifications(b, ricorrenza(pers([0, true])), DEF)[0]?.sveglia).toBe(true);
  });

  it('canale silenzioso dal tipo; sveglia solo dal Personalizzato; anticipo libero di 2 giorni', () => {
    const silenzioso = conImp((i) => (i.perTipo.studio.silenzioso = true));
    expect(blockNotifications(blocco(), undefined, silenzioso).every((n) => n.silenzioso)).toBe(true);
    expect(blockNotifications(blocco(), undefined, DEF).some((n) => n.sveglia)).toBe(false);
    const due = blockNotifications(blocco({ promemoria: pers([2880]) }), undefined, DEF)[0]!;
    expect([due.chiave, due.istante]).toEqual(['pre:2880:b1', oggi(9) - minutes(2880)]);
  });

  it('una sveglia oltre 7 h (possibile solo da dati esterni) vale come notifica', () => {
    const [n] = blockNotifications(blocco({ promemoria: pers([8 * 60, true]) }), undefined, DEF);
    expect(n?.sveglia).toBe(false);
  });
});

describe('Trigger — MECCANISMI §13.2, SCENARI F1', () => {
  it('studio 09:00–10:00 Auto: 08:55 pre, 09:00 inizio (Inizia), 09:30 verifica, 10:10 esito', () => {
    const n = blockNotifications(blocco(), undefined, DEF);
    expect(riassunto(n)).toEqual([
      ['pre', 5, 8 * 60 + 55],
      ['inizio', 0, 9 * 60],
      ['verifica', 0, 9 * 60 + 30],
      ['esito', 0, 10 * 60 + 10],
    ]);
    expect(n[1]?.azioni).toEqual(['inizia', 'posticipa']);
    expect(n[3]?.azioni).toEqual(['registra_esito', 'posticipa']);
    expect(n.map((x) => x.chiave)).toEqual(['pre:5:b1', 'inizio:0:b1', 'verifica:0:b1', 'esito:0:b1']);
  });

  it('studio in corso: resta solo l’esito (la verifica è cancellata)', () => {
    expect(riassunto(blockNotifications(blocco({ stato: 'in_corso' }), undefined, DEF))).toEqual([
      ['esito', 0, 10 * 60 + 10],
    ]);
  });

  it('dopo una sessione abbandonata il blocco torna programmato ma è già avviato: niente verifica (§8, audit P1-9)', () => {
    // MECC §8: la verifica scatta «se il blocco non è stato avviato né chiuso»; `minutiRitardo` resta dal primo avvio
    for (const tipo of ['studio', 'routine'] as const)
      expect(
        riassunto(blockNotifications(blocco({ tipo, minutiRitardo: 2 }), undefined, DEF)).map(([t]) => t),
      ).not.toContain('verifica');
  });

  it('routine: pre 10 · inizio · verifica, azione Posticipa', () => {
    const n = blockNotifications(blocco({ tipo: 'routine' }), undefined, DEF);
    expect(riassunto(n)).toEqual([
      ['pre', 10, 8 * 60 + 50],
      ['inizio', 0, 9 * 60],
      ['verifica', 0, 9 * 60 + 30],
    ]);
    expect(n.every((x) => x.azioni.join() === 'posticipa')).toBe(true);
  });

  it('todo con orario: pre 30 · scadenza all’orario (Segna fatto); senza orario nulla', () => {
    const n = blockNotifications(blocco({ tipo: 'todo' }), undefined, DEF);
    expect(riassunto(n)).toEqual([
      ['pre', 30, 8 * 60 + 30],
      ['scadenza', 0, 9 * 60],
    ]);
    expect(n[1]?.azioni).toEqual(['segna_fatto', 'posticipa']);
    expect(blockNotifications(blocco({ tipo: 'todo', conOrario: false }), undefined, DEF)).toEqual([]);
  });

  it('evento con orario: una voce per anticipo, «all’inizio» compreso', () => {
    const n = blockNotifications(blocco({ tipo: 'evento', promemoria: pers([60], [0]) }), undefined, DEF);
    expect(riassunto(n)).toEqual([
      ['pre', 60, 8 * 60],
      ['inizio', 0, 9 * 60],
    ]);
    expect(riassunto(blockNotifications(blocco({ tipo: 'evento' }), undefined, DEF))).toEqual([
      ['pre', 15, 8 * 60 + 45],
    ]);
  });

  it('stati terminali e perso → nulla', () => {
    for (const stato of ['completato', 'parziale', 'indietro', 'saltato', 'perso'] as const)
      expect(blockNotifications(blocco({ stato }), undefined, DEF)).toEqual([]);
  });

  it('routine notturna 23:00–01:00: verifica a mezzanotte', () => {
    const n = blockNotifications(
      blocco({ tipo: 'routine', inizio: oggi(23), fine: local(2026, 9, 29, 1, 0) }),
      undefined,
      DEF,
    );
    expect(n.find((x) => x.trigger === 'verifica')?.istante).toBe(local(2026, 9, 29, 0, 0));
  });
});

describe('Verifica — SCENARI B4, B7', () => {
  it('B4: routine senza durata alle 07:00 → verifica alle 07:30, nessun esito', () => {
    const n = blockNotifications(blocco({ tipo: 'routine', inizio: oggi(7), fine: null }), undefined, DEF);
    expect(n.find((x) => x.trigger === 'verifica')?.istante).toBe(oggi(7, 30));
    expect(n.some((x) => x.trigger === 'esito')).toBe(false);
  });

  it('B7: routine 18:00–20:00 → verifica alle 19:00', () => {
    const n = blockNotifications(blocco({ tipo: 'routine', inizio: oggi(18), fine: oggi(20) }), undefined, DEF);
    expect(n.find((x) => x.trigger === 'verifica')?.istante).toBe(oggi(19));
  });
});

describe('Tutto il giorno — SCENARI E3', () => {
  const tuttoIlGiorno = (promemoria?: Promemoria) =>
    blocco({ tipo: 'evento', conOrario: false, inizio: oggi(12), fine: null, ...(promemoria && { promemoria }) });

  it('evento tutto il giorno: una notifica alle 08:00 del giorno', () => {
    const n = blockNotifications(tuttoIlGiorno(), undefined, DEF);
    expect(n.map((x) => [x.chiave, x.istante])).toEqual([['giorno:0:b1', oggi(8)]]);
  });

  it('Off → nulla', () => {
    expect(blockNotifications(tuttoIlGiorno({ modo: 'off' }), undefined, DEF)).toEqual([]);
  });
});

describe('Sveglie — SCENARI F2', () => {
  it('evento alle 20:00, 1 giorno, 1 ora, all’inizio come sveglia: ieri 20:00, oggi 19:00, sveglia alle 20:00', () => {
    const n = blockNotifications(
      blocco({ tipo: 'evento', inizio: oggi(20), fine: oggi(21), promemoria: pers([1440], [60], [0, true]) }),
      undefined,
      DEF,
    );
    expect(n.map((x) => [x.istante, x.sveglia])).toEqual([
      [local(2026, 9, 27, 20, 0), false],
      [oggi(19), false],
      [oggi(20), true],
    ]);
    expect(n.filter((x) => x.istante === oggi(20))).toHaveLength(1);
  });
});

describe('«Segna fatto» senza aprire l’app — SCENARI A6 (T-057)', () => {
  const todo = (checklist: { testo: string; fatta: boolean }[]) =>
    blocco({ tipo: 'todo', titolo: 'Leggere 20 pagine', inizio: oggi(19), fine: oggi(19, 30), checklist });

  it('con voci aperte «Segna fatto» apre l’app; con tutte spuntate (o senza voci) completa in sfondo; Posticipa in sfondo', () => {
    const [aperte] = blockNotifications(
      todo([
        { testo: 'a', fatta: true },
        { testo: 'b', fatta: false },
      ]),
      undefined,
      DEF,
    );
    const [fatte] = blockNotifications(todo([{ testo: 'a', fatta: true }]), undefined, DEF);
    const [senza] = blockNotifications(todo([]), undefined, DEF);
    expect([aperte?.vociAperte, fatte?.vociAperte, senza?.vociAperte]).toEqual([true, false, false]);
    expect([aperte, fatte].map((v) => v && runsInBackground(v, 'segna_fatto'))).toEqual([false, true]);
    expect(aperte && runsInBackground(aperte, 'posticipa')).toBe(true);
    expect(fatte && runsInBackground(fatte, 'inizia')).toBe(false);
  });

  it('spuntare l’ultima voce cambia le voci armate del todo: il piano le riarma', () => {
    const prima = blockNotifications(todo([{ testo: 'a', fatta: false }]), undefined, DEF);
    const dopo = blockNotifications(todo([{ testo: 'a', fatta: true }]), undefined, DEF);
    const registro = prima.map((v, i) => ({ ...v, idNativo: i + 1 }));
    const piano = reconcilePlan(dopo, registro, false, oggi(8));
    expect(piano.daArmare.map((v) => [v.trigger, v.vociAperte])).toEqual([
      ['pre', false],
      ['scadenza', false],
    ]);
  });
});

describe('Finestra — MECCANISMI §13.3, SCENARI F4', () => {
  const input = (blocchi: Blocco[], ricorrenze: Ricorrenza[] = []) => ({
    blocchi,
    ricorrenze,
    impostazioni: DEF,
    sessione: null,
    titoloSessione: '',
  });

  it('evento fra 20 giorni con anticipo 1 giorno: non armato oggi, armato fra 6 giorni', () => {
    const fra20 = addLocalDays(oggi(9), 20);
    const e = blocco({ tipo: 'evento', inizio: fra20, fine: fra20 + minutes(60), promemoria: pers([1440]) });
    expect(desiredSet(input([e]), oggi(8))).toEqual([]);
    expect(desiredSet(input([e]), addLocalDays(oggi(9), 6)).map((x) => x.chiave)).toEqual(['pre:1440:b1']);
  });

  it('routine per sempre: solo le voci che scattano entro 14 giorni', () => {
    const giorni = Array.from({ length: 30 }, (_, i) => addLocalDays(oggi(7), i));
    const blocchi = giorni.map((g, i) => blocco({ id: `r${i}`, tipo: 'routine', inizio: g, fine: g + minutes(60) }));
    const n = desiredSet(input(blocchi), oggi(6));
    const ultimo = addLocalDays(oggi(6), 14);
    expect(n.every((x) => x.istante <= ultimo)).toBe(true);
    expect(new Set(n.map((x) => localDayKey(x.istante))).size).toBe(14);
  });

  it('niente nel passato; entro 5 s la voce è desiderata ma non si arma; il bordo dei 14 giorni è incluso', () => {
    const b = blocco({ tipo: 'evento', promemoria: pers([0]) });
    expect(desiredSet(input([b]), oggi(9) + 1)).toEqual([]);
    const vicine = desiredSet(input([b]), oggi(9) - 4_000);
    expect(vicine).toHaveLength(1);
    expect(reconcilePlan(vicine, [], false, oggi(9) - 4_000).daArmare).toEqual([]);
    const lontane = desiredSet(input([b]), oggi(9) - 6_000);
    expect(reconcilePlan(lontane, [], false, oggi(9) - 6_000).daArmare).toHaveLength(1);
    const lontano = addLocalDays(oggi(9), 14);
    expect(
      desiredSet(input([blocco({ tipo: 'evento', inizio: lontano, fine: null, promemoria: pers([0]) })]), oggi(9)),
    ).toHaveLength(1);
  });

  it('anticipo libero di 31 giorni su un blocco fra 40 giorni: scatto fra 9 giorni → armato', () => {
    const fra40 = addLocalDays(oggi(9), 40);
    const b = blocco({ tipo: 'evento', inizio: fra40, fine: null, promemoria: pers([31 * 24 * 60]) });
    expect(desiredSet(input([b]), oggi(9))).toHaveLength(1);
  });

  it('ordinato per istante, poi per chiave; il tempo scaduto entra nell’insieme', () => {
    const n = desiredSet(
      {
        ...input([blocco({ stato: 'in_corso' })]),
        sessione: { fine: oggi(10), bloccoId: 'b1' },
        titoloSessione: 'Studio',
      },
      oggi(9, 10),
    );
    expect(n.map((x) => x.chiave)).toEqual([CHIAVE_TEMPO_SCADUTO, 'esito:0:b1']);
  });
});

describe('Tempo scaduto — MECCANISMI §10.4, §13.6, SCENARI D1', () => {
  it('sessione ancorata alle 10:00: voce alle 10:00 con chiave fissa, one-shot', () => {
    const n = sessionNotification({ fine: oggi(10), bloccoId: 'b1' }, 'Studio', DEF);
    expect([n?.chiave, n?.istante, n?.oneShot, n?.trigger]).toEqual([
      CHIAVE_TEMPO_SCADUTO,
      oggi(10),
      true,
      'tempo_scaduto',
    ]);
  });

  it('fine null → nulla; generale spento → nulla; tipo studio spento → resta', () => {
    expect(sessionNotification({ fine: null, bloccoId: null }, '', DEF)).toBeNull();
    expect(sessionNotification(null, '', DEF)).toBeNull();
    expect(
      sessionNotification(
        { fine: oggi(10), bloccoId: null },
        '',
        conImp((i) => (i.generale = false)),
      ),
    ).toBeNull();
    const studioSpento = conImp((i) => (i.perTipo.studio.attivo = false));
    expect(sessionNotification({ fine: oggi(10), bloccoId: null }, '', studioSpento)).not.toBeNull();
  });

  it('fine passata (tempo extra) → fuori dalla finestra', () => {
    const n = desiredSet(
      {
        blocchi: [],
        ricorrenze: [],
        impostazioni: DEF,
        sessione: { fine: oggi(10), bloccoId: null },
        titoloSessione: '',
      },
      oggi(10, 5),
    );
    expect(n).toEqual([]);
  });
});

describe('Identificatori — MECCANISMI §13.3 (32 bit)', () => {
  it('deterministico, intero con segno a 32 bit', () => {
    expect(nativeId('pre:5:b1')).toBe(nativeId('pre:5:b1'));
    for (const k of ['a', 'pre:5:b1', CHIAVE_TEMPO_SCADUTO, 'x'.repeat(200)]) {
      const id = nativeId(k);
      expect(Number.isInteger(id) && id >= -(2 ** 31) && id < 2 ** 31).toBe(true);
    }
  });

  it('1.000 chiavi realistiche → 1.000 id diversi', () => {
    const chiavi = Array.from({ length: 1000 }, (_, i) => `inizio:0:r${i}:2026-10-${(i % 28) + 1}:07:00`);
    const ids = assignNativeIds(chiavi, new Map());
    expect(new Set(ids.values()).size).toBe(1000);
  });

  it('collisione forzata → id consecutivi, stabili all’ordine; gli id del registro si conservano', () => {
    const hash = () => 7;
    expect([...assignNativeIds(['b', 'a'], new Map(), hash)].sort()).toEqual([
      ['a', 7],
      ['b', 8],
    ]);
    const ids = assignNativeIds(['a', 'c'], new Map([['c', 7]]), hash);
    expect([ids.get('a'), ids.get('c')]).toEqual([8, 7]);
  });
});

describe('Riconciliazione — MECCANISMI §13.3 (piano)', () => {
  const voci = blockNotifications(blocco(), undefined, DEF);
  const registro = voci.map((v, i) => ({ ...v, idNativo: i }));

  const now = oggi(8);

  it('registro vuoto → tutto da armare, con gli id nativi', () => {
    const p = reconcilePlan(voci, [], false, now);
    expect(p.daArmare.map((v) => [v.chiave, v.idNativo])).toEqual(voci.map((v) => [v.chiave, nativeId(v.chiave)]));
    expect([p.daCancellare, p.daTogliere]).toEqual([[], []]);
  });

  it('uguale → nulla; con riarmaTutto → tutto con gli stessi id', () => {
    expect(reconcilePlan(voci, registro, false, now)).toEqual({ daCancellare: [], daTogliere: [], daArmare: [] });
    expect(reconcilePlan(voci, registro, true, now).daArmare.map((v) => v.idNativo)).toEqual([0, 1, 2, 3]);
  });

  it('istante cambiato (anche dal riancoraggio al cambio di fuso) → riarmo con lo stesso id, nessuna cancellazione', () => {
    const spostate = voci.map((v) => ({ ...v, istante: v.istante + minutes(60) }));
    expect(reconcilePlan(spostate, registro, false, now)).toMatchObject({ daCancellare: [], daTogliere: [] });
    expect(reconcilePlan(spostate, registro, false, now).daArmare.map((v) => v.idNativo)).toEqual([0, 1, 2, 3]);
  });

  it('non desiderata e non ancora scattata → da cancellare e togliere', () => {
    const p = reconcilePlan(voci.slice(1), registro, false, now);
    expect([p.daCancellare, p.daTogliere, p.daArmare]).toEqual([[0], ['pre:5:b1'], []]);
  });

  it('una voce desiderata che scatta entro 5 s resta armata; una non più desiderata si cancella anche se imminente (F6)', () => {
    const now = oggi(8, 55) - 3_000;
    expect(reconcilePlan(voci, registro, false, now)).toEqual({ daCancellare: [], daTogliere: [], daArmare: [] });
    const p = reconcilePlan([], registro, false, now);
    expect(p.daCancellare).toEqual([0, 1, 2, 3]);
    // Cambiata a un istante entro 5 s (C4, «Anticipa»): non si riarma, la versione vecchia pendente si cancella
    const anticipate = voci.map((v) => (v.chiave === 'pre:5:b1' ? { ...v, istante: now } : v));
    expect(reconcilePlan(anticipate, registro, false, now)).toEqual({
      daCancellare: [0],
      daTogliere: ['pre:5:b1'],
      daArmare: [],
    });
  });

  it('già scattata: non si cancella e resta nel registro fino a fine domani (Ieri · gestite, §8), poi esce', () => {
    const dopo = oggi(9, 1); // pre 08:55 e inizio 09:00 sono scattate
    expect(reconcilePlan(voci.slice(2), registro, false, dopo)).toEqual({
      daCancellare: [],
      daTogliere: [],
      daArmare: [],
    });
    const dopodomani = local(2026, 9, 30, 0, 1);
    expect(reconcilePlan([], registro, false, dopodomani)).toEqual({
      daCancellare: [],
      daTogliere: ['pre:5:b1', 'inizio:0:b1', 'verifica:0:b1', 'esito:0:b1'],
      daArmare: [],
    });
    expect(reconcilePlan([], registro, false, local(2026, 9, 29, 23, 59)).daTogliere).toEqual([]);
  });
});

describe('Casi limite — MECCANISMI §13.3 (studio ripreso, recupero)', () => {
  const input = (b: Blocco, fine: number | null) => ({
    blocchi: [b],
    ricorrenze: [],
    impostazioni: DEF,
    sessione: { fine, bloccoId: b.id },
    titoloSessione: 'Studio',
  });

  it('studio in corso da recupero con la fine del blocco passata: resta solo il tempo scaduto', () => {
    const n = desiredSet(input(blocco({ stato: 'in_corso' }), oggi(11, 30)), oggi(10, 40));
    expect(n.map((x) => x.chiave)).toEqual([CHIAVE_TEMPO_SCADUTO]);
  });

  it('studio parziale ripreso: nessuna voce del blocco, il tempo scaduto sì', () => {
    const n = desiredSet(input(blocco({ stato: 'parziale' }), oggi(9, 50)), oggi(9));
    expect(n.map((x) => x.chiave)).toEqual([CHIAVE_TEMPO_SCADUTO]);
  });
});

const insieme = (blocchi: Blocco[], imp: ImpostazioniNotifiche, now: number, posticipi: Record<string, number> = {}) =>
  desiredSet({ blocchi, ricorrenze: [], impostazioni: imp, sessione: null, titoloSessione: '', posticipi }, now);

describe('One-shot — MECCANISMI §6, §8, §13.6, SCENARI B7, A1', () => {
  const persa = blocco({
    id: 'r',
    tipo: 'routine',
    stato: 'perso',
    inizio: oggi(18),
    fine: oggi(20),
    persoIl: oggi(20, 31),
  });

  it('B7: routine 18:00–20:00 persa alle 20:31 → «perso» 10 s dopo, silenziosa, one-shot, senza azioni', () => {
    expect(RITARDO_ONE_SHOT_MS).toBe(10_000); // §6, §8, §13.6: «~10 s»
    const [n, ...altre] = oneShotNotifications(persa, DEF);
    expect(altre).toEqual([]);
    expect(n).toMatchObject({
      chiave: 'perso:0:r',
      trigger: 'perso',
      istante: oggi(20, 31) + RITARDO_ONE_SHOT_MS,
      silenzioso: true,
      oneShot: true,
      azioni: [],
      inizioBlocco: oggi(18),
    });
    expect(blockNotifications(persa, undefined, DEF)).toEqual([n]);
  });

  it('studio perso → azione Registra esito; fine oltre le 2 ore, tipo o generale spenti → nulla', () => {
    expect(oneShotNotifications({ ...persa, tipo: 'studio' }, DEF)[0]?.azioni).toEqual(['registra_esito']);
    expect(oneShotNotifications({ ...persa, persoIl: oggi(22, 1) }, DEF)).toEqual([]);
    expect(
      oneShotNotifications(
        persa,
        conImp((i) => (i.perTipo.routine.attivo = false)),
      ),
    ).toEqual([]);
    expect(
      oneShotNotifications(
        persa,
        conImp((i) => (i.generale = false)),
      ),
    ).toEqual([]);
  });

  it('nessun «perso» se una sessione era partita sul blocco (C8, «conta» spento) o se è nato dopo la sua fine (D-OCC-1)', () => {
    expect(oneShotNotifications({ ...persa, tipo: 'studio', minutiRitardo: 12 }, DEF)).toEqual([]);
    expect(oneShotNotifications({ ...persa, createdAt: oggi(20, 5) }, DEF)).toEqual([]);
    expect(oneShotNotifications({ ...persa, createdAt: oggi(19) }, DEF)).toHaveLength(1);
  });

  it('A1: todo «non fatto» con ritardoIl 00:30 → «ritardo» 10 s dopo con Segna fatto e Posticipa; anche il todo rotolato', () => {
    const nonFatto = blocco({
      id: 't',
      tipo: 'todo',
      stato: 'perso',
      conOrario: false,
      inizio: local(2026, 9, 27, 12, 0),
      fine: local(2026, 9, 27, 23, 59),
      ritardoIl: oggi(0, 30),
    });
    const [n] = oneShotNotifications(nonFatto, DEF);
    expect(n).toMatchObject({
      chiave: 'ritardo:0:t',
      trigger: 'ritardo',
      istante: oggi(0, 30) + RITARDO_ONE_SHOT_MS,
      silenzioso: true,
      oneShot: true,
      azioni: ['segna_fatto', 'posticipa'],
    });
    const rotolato = blocco({
      id: 't2',
      tipo: 'todo',
      conOrario: false,
      inizio: oggi(12),
      fine: oggi(23, 59),
      orizzonte: 'settimana',
      ritardoIl: oggi(0, 1),
    });
    expect(blockNotifications(rotolato, undefined, DEF).map((x) => x.chiave)).toEqual(['ritardo:0:t2']);
    expect(oneShotNotifications({ ...nonFatto, stato: 'completato' }, DEF)).toEqual([]);
    expect(oneShotNotifications({ ...nonFatto, ritardoIl: null }, DEF)).toEqual([]);
  });

  it('F3: il «perso» delle 23:30 parte all’istante della marcatura, anche a mezzanotte per una routine senza durata', () => {
    const b = { ...persa, inizio: oggi(21), fine: oggi(23), persoIl: oggi(23, 30) };
    expect(insieme([b], DEF, oggi(23, 30)).map((x) => [x.chiave, x.istante])).toEqual([
      ['perso:0:r', oggi(23, 30) + RITARDO_ONE_SHOT_MS],
    ]);
    // Routine senza durata di ieri (fine 23:59), marcata persa alle 00:30: avviso alle 00:30
    const senzaDurata = {
      ...persa,
      inizio: local(2026, 9, 27, 7, 0),
      fine: null,
      persoIl: oggi(0, 30),
    };
    expect(insieme([senzaDurata], DEF, oggi(0, 30)).map((x) => x.istante)).toEqual([oggi(0, 30) + RITARDO_ONE_SHOT_MS]);
  });
});

describe('Nessuna fascia silenziosa — MECCANISMI §13.4, SCENARI F3', () => {
  it('il todo delle 06:30 con anticipo 30′ avvisa alle 06:00 e scade alle 06:30; il digest alle 08:00: nessun rinvio', () => {
    const t = blocco({ id: 't', tipo: 'todo', inizio: oggi(6, 30), fine: oggi(7) });
    const senza = blocco({
      id: 's',
      tipo: 'todo',
      conOrario: false,
      inizio: oggi(12),
      fine: oggi(23, 59),
      titolo: 'Spesa',
    });
    expect(insieme([t, senza], DEF, oggi(0)).map((x) => [x.chiave, x.istante])).toEqual([
      ['pre:30:t', oggi(6)],
      ['scadenza:0:t', oggi(6, 30)],
      ['digest:0:2026-09-28', oggi(8)],
    ]);
  });
});

describe('Posticipa — MECCANISMI §13.2, SCENARI F5', () => {
  const r = blocco({ id: 'r', tipo: 'routine' }); // 09:00–10:00

  it('tocco alle 09:01 sull’«inizio» delle 09:00: la voce torna alle 09:11 con la stessa chiave', () => {
    expect(POSTICIPO_MS).toBe(minutes(10));
    expect(insieme([r], DEF, oggi(9, 1), { 'inizio:0:r': oggi(9, 1) }).map((x) => [x.chiave, x.istante])).toEqual([
      ['inizio:0:r', oggi(9, 11)],
      ['verifica:0:r', oggi(9, 30)],
    ]);
  });

  it('solo con lo stato coerente: completata → nulla; in corso solo «esito»; perso solo «in ritardo»', () => {
    expect(insieme([{ ...r, stato: 'completato' }], DEF, oggi(9, 1), { 'inizio:0:r': oggi(9, 1) })).toEqual([]);
    const s: Blocco = { ...r, tipo: 'studio', stato: 'in_corso' };
    const tocchi = { 'inizio:0:r': oggi(9, 1), 'verifica:0:r': oggi(9, 31), 'esito:0:r': oggi(10, 11) };
    expect(insieme([s], DEF, oggi(10, 11), tocchi).map((x) => [x.chiave, x.istante])).toEqual([
      ['esito:0:r', oggi(10, 21)],
    ]);
    const t = blocco({
      id: 't',
      tipo: 'todo',
      stato: 'perso',
      conOrario: false,
      inizio: local(2026, 9, 27, 12, 0),
      fine: local(2026, 9, 27, 23, 59),
      ritardoIl: oggi(0, 30),
    });
    expect(insieme([t], DEF, oggi(0, 31), { 'ritardo:0:t': oggi(0, 31) }).map((x) => [x.chiave, x.istante])).toEqual([
      ['ritardo:0:t', oggi(0, 41)],
    ]);
  });

  it('senza l’azione Posticipa il tocco non conta (tempo scaduto); un tocco più vecchio dello scatto non sposta nulla', () => {
    const n = desiredSet(
      {
        blocchi: [],
        ricorrenze: [],
        impostazioni: DEF,
        sessione: { fine: oggi(10), bloccoId: null },
        titoloSessione: '',
        posticipi: { [CHIAVE_TEMPO_SCADUTO]: oggi(9, 55) },
      },
      oggi(9, 50),
    );
    expect(n.map((x) => x.istante)).toEqual([oggi(10)]);
    expect(insieme([r], DEF, oggi(8, 30), { 'inizio:0:r': oggi(8) }).map((x) => x.istante)).toEqual([
      oggi(8, 50),
      oggi(9),
      oggi(9, 30),
    ]);
  });
});

describe('Digest nell’insieme — MECCANISMI §13.5, SCENARI A4', () => {
  const senza = (id: string, titolo: string, over: Partial<Blocco> = {}) =>
    blocco({ id, titolo, tipo: 'todo', conOrario: false, inizio: oggi(12), fine: oggi(23, 59), ...over });
  const blocchi = [
    senza('a', 'Chiama Marco'),
    senza('b', 'Spesa'),
    senza('c', 'Bolletta', { inizio: local(2026, 9, 27, 12, 0), orizzonte: 'mese' }),
  ];

  it('voce «digest» alle 08:00 con la chiave del giorno, canale del tipo todo e il contenuto di A4', () => {
    expect(digestNotification(blocchi, DEF, oggi(7))).toMatchObject({
      chiave: 'digest:0:2026-09-28',
      istante: oggi(8),
      trigger: 'digest',
      tipo: 'todo',
      bloccoId: null,
      oneShot: false,
      azioni: [],
      silenzioso: false,
      digest: { totale: 3, arretrati: 1, titoli: ['Bolletta', 'Chiama Marco', 'Spesa'] },
    });
    expect(insieme(blocchi, DEF, oggi(7)).map((x) => x.chiave)).toEqual(['digest:0:2026-09-28']);
  });

  it('tipo todo spento o nessun todo senza orario → nessun digest; l’orario è configurabile', () => {
    expect(
      digestNotification(
        blocchi,
        conImp((i) => (i.perTipo.todo.attivo = false)),
        oggi(7),
      ),
    ).toBeNull();
    expect(digestNotification([], DEF, oggi(7))).toBeNull();
    const presto = conImp((i) => (i.digest.orario = '06:30'));
    expect(digestNotification(blocchi, presto, oggi(7))?.istante).toBe(local(2026, 9, 29, 6, 30));
  });
});

describe('Prova — MECCANISMI §13.6', () => {
  it('notifica di prova a +6 s, chiave fissa, one-shot', () => {
    expect(testNotification(oggi(8))).toMatchObject({
      chiave: CHIAVE_PROVA,
      trigger: 'prova',
      istante: oggi(8) + 6_000,
      oneShot: true,
      bloccoId: null,
    });
  });
});

describe('Blocchi che non si leggono — MECCANISMI §13.3, CONTESTO §3 (audit P1-2)', () => {
  it('un tipo sconosciuto o un promemoria personalizzato senza anticipi si riconoscono; i blocchi buoni no', () => {
    const rotti = [
      blocco({ id: 'tipo', tipo: 'x' as Blocco['tipo'] }),
      blocco({ id: 'anticipi', promemoria: { modo: 'personalizzato' } as Promemoria }),
    ];
    expect(unreadableBlocks([blocco(), ...rotti], [], DEF)).toEqual(['tipo', 'anticipi']);
    expect(unreadableBlocks([blocco({ ricorrenzaId: 'r1' })], [ricorrenza(pers([5]))], DEF)).toEqual([]);
  });
});

describe("L'esito non è mai una sveglia — SCENARI F7", () => {
  it('studio 16:00–16:45 con «5 min prima» e «all’inizio» come sveglia: sveglie alle 15:55 e alle 16:00, verifica ed esito normali', () => {
    const n = blockNotifications(
      blocco({ tipo: 'studio', inizio: oggi(16), fine: oggi(16, 45), promemoria: pers([5, true], [0, true]) }),
      undefined,
      DEF,
    );
    expect(Object.fromEntries(n.map((x) => [x.trigger, x.sveglia]))).toEqual({
      pre: true,
      inizio: true,
      verifica: false,
      esito: false,
    });
    expect(n.find((x) => x.trigger === 'pre')?.istante).toBe(oggi(15, 55));
    expect(n.find((x) => x.trigger === 'esito')?.istante).toBe(oggi(16, 55));
  });
});

describe('Riconciliazione con le voci armate da questo processo — MECCANISMI §13.3 (audit P3-3)', () => {
  // Sul web ogni scheda ha i suoi timer e il registro è condiviso: il registro può dire «armata» o «tolta» per
  // un'altra scheda
  const voci = blockNotifications(blocco(), undefined, DEF);
  const registro = voci.map((v, i) => ({ ...v, idNativo: i }));
  const now = oggi(8);

  it('senza argomento le voci armate qui sono il registro: con una copia del registro il piano è lo stesso', () => {
    const spostate = voci.map((v) => ({ ...v, istante: v.istante + minutes(60) }));
    for (const desiderate of [voci, voci.slice(1), spostate])
      expect(reconcilePlan(desiderate, registro, false, now)).toEqual(
        reconcilePlan(desiderate, registro, false, now, [...registro]),
      );
  });

  it('una voce armata qui nella versione vecchia e cambiata a meno di 5 s si cancella, anche col registro già aggiornato', () => {
    const adesso = oggi(8, 55) - 3_000;
    const vecchia = { ...registro[0]!, istante: registro[0]!.istante + minutes(1) };
    const p = reconcilePlan(voci, registro, false, adesso, [vecchia, ...registro.slice(1)]);
    expect([p.daCancellare, p.daArmare]).toEqual([[0], []]);
  });

  it('una voce nel registro ma non armata qui si arma; una armata qui in un’altra versione si riarma', () => {
    const spostata = { ...registro[1]!, istante: registro[1]!.istante - minutes(60) };
    const p = reconcilePlan(voci, registro, false, now, [registro[0]!, spostata, registro[2]!]);
    expect(p.daArmare.map((v) => v.idNativo)).toEqual([1, 3]);
    expect(p.daCancellare).toEqual([]);
  });

  it('una voce armata qui e tolta dal registro da un’altra scheda si cancella, se non è ancora scattata', () => {
    const p = reconcilePlan(voci.slice(1), registro.slice(1), false, now, registro);
    expect([p.daCancellare, p.daArmare]).toEqual([[0], []]);
    const scattata = { ...registro[0]!, istante: now - 1 };
    expect(
      reconcilePlan(voci.slice(1), registro.slice(1), false, now, [scattata, ...registro.slice(1)]).daCancellare,
    ).toEqual([]);
  });
});
