import { describe, expect, it } from 'vitest';
import {
  clampUpdatedAt,
  decide,
  isGenerata,
  isSynced,
  mergeLocalFields,
  serverAccepts,
  stripLocalFields,
  toEnvelope,
} from './sync';

const MIO = 'dispositivo-b';
const remota = (updatedAt: number, over: Partial<{ generata: boolean; dispositivo: string }> = {}) => ({
  updatedAt,
  generata: false,
  dispositivo: 'dispositivo-a',
  ...over,
});

describe('Vincitore fra locale e remota — MECCANISMI §25 (D-SYNC-1, D-SYNC-2)', () => {
  it('senza riga locale vince la remota; senza modifiche in coda pure (il servizio è più avanti)', () => {
    expect(decide(undefined, false, remota(10), MIO)).toBe('remota');
    expect(decide({ updatedAt: 20 }, false, remota(10), MIO)).toBe('remota');
  });

  it('con una modifica in coda vince la più recente; a parità l’id di dispositivo maggiore', () => {
    expect(decide({ updatedAt: 20 }, true, remota(10), MIO)).toBe('locale');
    expect(decide({ updatedAt: 10 }, true, remota(20), MIO)).toBe('remota');
    expect(decide({ updatedAt: 10 }, true, remota(10, { dispositivo: 'dispositivo-a' }), MIO)).toBe('locale');
    expect(decide({ updatedAt: 10 }, true, remota(10, { dispositivo: 'dispositivo-c' }), MIO)).toBe('remota');
  });

  it('un’occorrenza generata non sovrascrive mai una riga esistente; dove manca, si scrive', () => {
    expect(decide({ updatedAt: 1 }, false, remota(99, { generata: true }), MIO)).toBe('locale');
    expect(decide(undefined, false, remota(99, { generata: true }), MIO)).toBe('remota');
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
    expect(toEnvelope('blocchi', blocco, false)).toEqual({
      tabella: 'blocchi',
      id: 'b1',
      dati: blocco,
      updatedAt: 7,
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
    // Senza riga locale l'interruttore resta com'è nella remota (assente: il default)
    expect(mergeLocalFields('preferenze', ricevuta, undefined)).toBe(ricevuta);
  });
});
