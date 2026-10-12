import { describe, expect, it } from 'vitest';
import {
  rowBytes,
  receivedInProgress,
  clampUpdatedAt,
  courseFingerprint,
  decide,
  isGenerata,
  isSynced,
  mergeLocalFields,
  needsFingerprints,
  MAX_BYTE_RIGA,
  relinkPlan,
  sendable,
  serverAccepts,
  stripLocalFields,
  toEnvelope,
  validEnvelope,
} from './sync';

const MIO = 'dispositivo-b';
const remota = (updatedAt: number, over: Partial<{ generata: boolean; dispositivo: string }> = {}) => ({
  updatedAt,
  generata: false,
  dispositivo: 'dispositivo-a',
  ...over,
});

describe('Vincitore fra locale e remota — MECCANISMI §25 (D-SYNC-1, D-SYNC-2, D-SYNC-4)', () => {
  const riga = { id: 'x' };
  const voce = (updatedAt: number, generata = false) => ({ updatedAt, generata });
  it('senza riga locale vince la remota; senza modifiche in coda pure (il servizio è più avanti)', () => {
    expect(decide(undefined, undefined, remota(10), MIO)).toBe('remota');
    expect(decide(riga, undefined, remota(10), MIO)).toBe('remota');
  });

  it('con una modifica in coda conta l’istante del gesto; a parità l’id di dispositivo maggiore', () => {
    expect(decide(riga, voce(20), remota(10), MIO)).toBe('locale');
    expect(decide(riga, voce(10), remota(20), MIO)).toBe('remota');
    expect(decide(riga, voce(10), remota(10, { dispositivo: 'dispositivo-a' }), MIO)).toBe('locale');
    expect(decide(riga, voce(10), remota(10, { dispositivo: 'dispositivo-c' }), MIO)).toBe('remota');
  });

  it('un’occorrenza generata non sovrascrive mai una riga esistente; una voce generata della fusione cede', () => {
    expect(decide(riga, undefined, remota(99, { generata: true }), MIO)).toBe('locale');
    expect(decide(undefined, undefined, remota(99, { generata: true }), MIO)).toBe('remota');
    expect(decide(riga, voce(99, true), remota(10), MIO)).toBe('remota');
  });

  it('il servizio (specchio dell’SQL): ultimo vince, parità per dispositivo, la generata cede e non sovrascrive', () => {
    const riga = (updatedAt: number, dispositivo: string, generata = false) => ({ updatedAt, dispositivo, generata });
    expect(serverAccepts(undefined, riga(5, 'a'))).toBe(true);
    expect(serverAccepts(riga(5, 'a'), riga(6, 'b'))).toBe(true);
    expect(serverAccepts(riga(6, 'a'), riga(5, 'b'))).toBe(false);
    expect(serverAccepts(riga(5, 'a'), riga(5, 'b'))).toBe(true);
    expect(serverAccepts(riga(5, 'b'), riga(5, 'a'))).toBe(false);
    expect(serverAccepts(riga(9, 'a'), riga(99, 'b', true))).toBe(false);
    expect(serverAccepts(riga(99, 'a', true), riga(1, 'b'))).toBe(true);
  });

  it('un orologio avanti non vince per sempre: l’istante si ferma a 5 minuti dopo quello del servizio (D-SYNC-2)', () => {
    expect(clampUpdatedAt(1_000, 2_000)).toBe(1_000);
    expect(clampUpdatedAt(10_000_000, 2_000)).toBe(2_000 + 5 * 60_000);
  });
});

describe('Che cosa viaggia — MECCANISMI §25 (D-SYNC-3)', () => {
  it('ricorrenze, blocchi, log delle fasi e le preferenze dell’elenco; mai la chiave AI, la sessione o lo stato della sync', () => {
    expect(isSynced('blocchi', 'x')).toBe(true);
    expect(isSynced('ricorrenze', 'x')).toBe(true);
    expect(isSynced('logFasi', 'x')).toBe(true);
    expect(isSynced('preferenze', 'impostazioni')).toBe(true);
    expect(isSynced('preferenze', 'notifiche')).toBe(true);
    expect(isSynced('preferenze', 'profilo')).toBe(true);
    for (const id of ['chiaveAi', 'sync', 'sessioneAttiva', 'streak', 'ultimaApertura', 'posticipi'])
      expect(isSynced('preferenze', id)).toBe(false);
    for (const t of ['corsi', 'sessioni', 'carte', 'pratiche', 'materialiBinari', 'registroNotifiche', 'syncCoda'])
      expect(isSynced(t, 'x')).toBe(false);
  });

  it('occorrenza generata = di una ricorrenza e mai toccata (programmata o persa); un todo perso no', () => {
    expect(isGenerata({ ricorrenzaId: 'r1', stato: 'programmato' })).toBe(true);
    expect(isGenerata({ ricorrenzaId: 'r1', stato: 'perso' })).toBe(true);
    expect(isGenerata({ ricorrenzaId: 'r1', stato: 'completato' })).toBe(false);
    expect(isGenerata({ ricorrenzaId: null, stato: 'perso' })).toBe(false);
    // Una tombstone non ha né ricorrenza né stato
    const tombstone = { id: 'x', updatedAt: 1, deletedAt: 1 };
    expect(isGenerata(tombstone)).toBe(false);
  });

  it('la busta porta la riga intera e i suoi istanti; l’interruttore generale delle notifiche resta qui', () => {
    const blocco = { id: 'b1', updatedAt: 7, deletedAt: null, createdAt: 1, stato: 'completato' };
    // L'istante della busta è quello del gesto, nella voce (D-SYNC-4)
    expect(toEnvelope('blocchi', blocco, { updatedAt: 5, generata: false })).toEqual({
      tabella: 'blocchi',
      id: 'b1',
      dati: blocco,
      updatedAt: 5,
      deletedAt: null,
      generata: false,
    });
    const notifiche = {
      id: 'notifiche',
      updatedAt: 3,
      deletedAt: null,
      createdAt: 1,
      valore: { generale: false, x: 1 },
    };
    expect(stripLocalFields('preferenze', notifiche)).toEqual({ ...notifiche, valore: { x: 1 } });
    expect(stripLocalFields('blocchi', blocco)).toBe(blocco);
    const ricevuta = { ...notifiche, updatedAt: 9, valore: { x: 2 } };
    expect(mergeLocalFields('preferenze', ricevuta, notifiche)).toEqual({
      ...ricevuta,
      valore: { x: 2, generale: false },
    });
    // Senza riga locale l'interruttore è acceso: senza il campo la riga non si leggerebbe
    expect(mergeLocalFields('preferenze', ricevuta, undefined)).toEqual({
      ...ricevuta,
      valore: { x: 2, generale: true },
    });
  });

  it('una busta ricevuta vale solo nell’ambito e solo per la riga del suo id (servizio compromesso)', () => {
    const busta = (tabella: string, id: string, dati: unknown, deletedAt: number | null = null) => ({
      tabella,
      id,
      dati,
      deletedAt,
      updatedAt: 1,
    });
    expect(validEnvelope(busta('blocchi', 'b1', { ...BLOCCO, id: 'b1' }))).toBe(true);
    expect(validEnvelope(busta('blocchi', 'b1', { id: 'b1', deletedAt: 5 }, 5))).toBe(true);
    expect(validEnvelope(busta('syncCoda', 'preferenze:chiaveAi', { id: 'preferenze:chiaveAi' }))).toBe(false);
    expect(validEnvelope(busta('preferenze', 'impostazioni', { id: 'chiaveAi', valore: 'AIza-altrui' }))).toBe(false);
    expect(validEnvelope(busta('materiali', 'm1', { id: 'm1' }))).toBe(false);
    expect(validEnvelope(busta('blocchi', 'b1', { ...BLOCCO, id: 'b1' }, 5))).toBe(false);
  });

  it('una riga viva con un campo mostrato della forma sbagliata si scarta: non arriva a far cadere il disegno (T-059)', () => {
    const viva = (tabella: string, dati: Record<string, unknown>) =>
      validEnvelope({ tabella, id: 'x', dati: { ...dati, id: 'x' }, deletedAt: null, updatedAt: 1 });
    expect(viva('blocchi', BLOCCO)).toBe(true);
    for (const rotto of [
      { titolo: { malformato: true } },
      { tipo: 'altro' },
      { stato: 'sconosciuto' },
      { inizio: '18:00' },
      { checklist: 'compra il latte' },
      { checklist: [{ testo: 1, fatta: false }] },
      { fasi: [{ etichetta: null }] },
      { promemoria: { modo: 'personalizzato', anticipi: 5 } },
    ])
      expect(viva('blocchi', { ...BLOCCO, ...rotto })).toBe(false);
    expect(viva('ricorrenze', RICORRENZA)).toBe(true);
    for (const rotto of [{ giorni: '1,3,5' }, { dateSaltate: [1] }, { impronta: { a: 1 } }, { titolo: undefined }])
      expect(viva('ricorrenze', { ...RICORRENZA, ...rotto })).toBe(false);
    expect(viva('logFasi', { ricorrenzaId: null, fasi: [{ id: 'f', etichetta: 'Stretching', stato: 'fatta' }] })).toBe(
      true,
    );
    expect(viva('logFasi', { ricorrenzaId: null, fasi: 'tutte' })).toBe(false);
  });
});

/** Righe vive come le scrive l'app (T-059). */
const BLOCCO = {
  tipo: 'todo',
  stato: 'programmato',
  inizio: 1,
  fine: 2,
  conOrario: true,
  giornoLocale: '2026-09-22',
  orarioInizio: '18:00',
  orarioFine: '18:30',
  titolo: 'Chiama Marco',
  checklist: [{ testo: 'Numero', fatta: false }],
  promemoria: { modo: 'auto' },
  deletedAt: null,
};
const RICORRENZA = {
  tipo: 'routine',
  titolo: 'Corsa',
  note: '',
  giorni: [1, 3, 5],
  dataInizio: '2026-09-22',
  dataFine: null,
  dateSaltate: [],
  orarioInizio: '07:00',
  orarioFine: '08:00',
  fuso: 'Europe/Rome',
  corsoId: null,
  fasi: [],
  promemoria: { modo: 'auto' },
  deletedAt: null,
};

describe('Corsi e routine di studio — MECCANISMI §25 (impronta del corso, D-SYNC-5)', () => {
  const moduli = [
    { numero: 1, markdown: '# MODULO M1 — Tooling Moderno' },
    { numero: 0, markdown: '# MODULO M0 — Riattivazione JavaScript' },
  ];
  it('l’impronta viene da titolo e contenuto: non dall’ordine in cui si leggono i moduli', () => {
    const impronta = courseFingerprint('Syllabus', moduli);
    expect(courseFingerprint('Syllabus', [...moduli].reverse())).toBe(impronta);
    expect(courseFingerprint('Altro corso', moduli)).not.toBe(impronta);
    expect(courseFingerprint('Syllabus', [moduli[0]!, { numero: 0, markdown: '# MODULO M0 — Altro' }])).not.toBe(
      impronta,
    );
  });

  // Adesso: i blocchi futuri iniziano dopo
  const ADESSO = 1_000;
  const qui = new Set(['c-qui', 'c-doppio', 'c-altro']);
  const impronte = [
    { id: 'c-qui', impronta: 'i1' },
    { id: 'c-doppio', impronta: 'i1' },
    { id: 'c-altro', impronta: 'i2' },
  ];
  const ricorrenza = (corsoId: string | null, impronta: string | null = null) => ({ id: 'r1', corsoId, impronta });
  const blocco = (
    id: string,
    corsoId: string,
    over: Partial<{ stato: 'programmato' | 'completato'; inizio: number; unitaId: string | null }> = {},
  ) => ({ id, stato: 'programmato' as const, inizio: ADESSO + 1, corsoId, unitaId: null, ricorrenzaId: 'r1', ...over });

  it('una routine col corso di un altro dispositivo passa al corso di qui con la stessa impronta, il primo importato; i blocchi programmati futuri la seguono senza unità', () => {
    const piano = relinkPlan(
      [ricorrenza('c-fuori', 'i1')],
      qui,
      impronte,
      [
        blocco('futuro', 'c-fuori', { unitaId: 'c-fuori:M0:U0.1' }),
        blocco('fatto', 'c-fuori', { stato: 'completato', unitaId: 'c-fuori:M0:U0.1' }),
        blocco('passato', 'c-fuori', { inizio: ADESSO - 1 }),
      ],
      ADESSO,
    );
    expect(piano.ricorrenze).toEqual([{ id: 'r1', corsoId: 'c-qui', impronta: 'i1' }]);
    // Storia e passato restano com'erano; il puntatore assegnerà le unità alle future
    expect(piano.blocchi).toEqual([blocco('futuro', 'c-qui')]);
  });

  it('un blocco toccato sull’altro dispositivo e ricevuto dopo il collegamento prende il corso di qui della sua routine', () => {
    // La routine è già collegata (corso di qui); il blocco spostato arriva col corso e l'unità del telefono
    const piano = relinkPlan(
      [ricorrenza('c-qui', 'i1')],
      qui,
      [],
      [blocco('spostato', 'c-fuori', { unitaId: 'c-fuori:M0:U0.2' })],
      ADESSO,
    );
    expect(piano).toEqual({ ricorrenze: [], blocchi: [blocco('spostato', 'c-qui')] });
  });

  it('senza un corso di qui il blocco tiene il corso altrove ma perde l’unità, che qui non esiste (J3: setup libero)', () => {
    const piano = relinkPlan(
      [ricorrenza('c-fuori', 'i9')],
      qui,
      impronte,
      [blocco('spostato', 'c-fuori', { unitaId: 'c-fuori:M0:U0.2' }), blocco('generato', 'c-fuori')],
      ADESSO,
    );
    expect(piano).toEqual({ ricorrenze: [], blocchi: [blocco('spostato', 'c-fuori')] });
  });

  it('senza impronta, col corso già qui o senza corso non cambia nulla; le impronte servono solo con un corso altrove', () => {
    const nulla = { ricorrenze: [], blocchi: [] };
    expect(relinkPlan([ricorrenza('c-fuori')], qui, impronte, [blocco('b', 'c-fuori')], ADESSO)).toEqual(nulla);
    expect(relinkPlan([ricorrenza('c-altro', 'i1')], qui, impronte, [blocco('b', 'c-altro')], ADESSO)).toEqual(nulla);
    expect(relinkPlan([ricorrenza(null, 'i1')], qui, impronte, [], ADESSO)).toEqual(nulla);
    expect(needsFingerprints([ricorrenza('c-fuori', 'i1')], qui)).toBe(true);
    expect(needsFingerprints([ricorrenza('c-fuori'), ricorrenza('c-qui', 'i1'), ricorrenza(null, 'i1')], qui)).toBe(
      false,
    );
  });
});

describe('Righe che il servizio rifiuta sempre — MECCANISMI §25 (audit P1-11)', () => {
  it('oltre il tetto in byte UTF-8, col carattere nullo o un surrogato solo una riga non si spedisce; le altre sì', () => {
    expect(sendable({ id: 'b1', note: 'x'.repeat(1000) })).toBe(true);
    expect(sendable({ id: 'b1', note: 'x'.repeat(MAX_BYTE_RIGA) })).toBe(false);
    // 360 000 «€» sono 360 000 caratteri, sotto il tetto di 1 048 576, ma 1 080 000 byte UTF-8: oltre
    expect(sendable({ id: 'b1', note: '€'.repeat(360_000) })).toBe(false);
    expect(sendable({ id: 'b1', note: `a${String.fromCharCode(0)}b` })).toBe(false);
    expect(sendable({ id: 'b1', note: `a${String.fromCharCode(0xd800)}b` })).toBe(false);
    // Il testo «\u0000» scritto dall'utente (un esercizio di programmazione) e una coppia valida (un'emoji) partono
    expect(sendable({ id: 'b1', note: 'stampa \\u0000 e \\\\u0000' })).toBe(true);
    expect(sendable({ id: 'b1', note: 'fatto 😀' })).toBe(true);
  });
});

describe('Blocchi in corso altrove — MECCANISMI §25 (audit P3-4)', () => {
  it('la riga locale si legge con le sole voci valide: id → istante della ricezione', () => {
    expect(receivedInProgress({ a: 10, b: 'x', c: Number.NaN, d: null })).toEqual({ a: 10 });
    expect(receivedInProgress(null)).toEqual({});
    expect(receivedInProgress('rotta')).toEqual({});
  });
});

describe('Byte di una riga — MECCANISMI §25 (audit N-5)', () => {
  it('i byte UTF-8 del JSON indentato di uno spazio: base del tetto della riga e di quello del lotto', () => {
    // {\n "a": "è"\n} = 13 caratteri, la «è» vale 2 byte
    expect(rowBytes({ a: 'è' })).toBe(14);
    expect(rowBytes({ a: '😀' })).toBe(16);
  });
});
