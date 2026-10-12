import { describe, expect, it } from 'vitest';
import {
  backupFile,
  backupSizeEstimate,
  FORMATO_BACKUP,
  fromBase64,
  parseBackup,
  toBase64,
  VERSIONE_BACKUP,
} from './backup';
import { local } from './time';

const ADESSO = local(2026, 9, 23, 16, 8);
const riga = (id: string, extra: object = {}) => ({ id, createdAt: 1, updatedAt: 2, deletedAt: null, ...extra });
/** Un todo vivo con i campi che le schermate leggono (la forma delle buste della sync, D-RECUPERO-1). */
const blocco = (id: string, extra: object = {}) =>
  riga(id, {
    tipo: 'todo',
    stato: 'programmato',
    inizio: ADESSO,
    fine: null,
    conOrario: false,
    giornoLocale: '2026-09-23',
    orarioInizio: '16:08',
    orarioFine: null,
    checklist: [],
    ...extra,
  });

describe('Base64 dei PDF nel file — MECCANISMI §22', () => {
  it('ogni lunghezza (0, 1, 2, 3 byte e oltre) torna identica; il testo è il base64 standard', () => {
    for (const n of [0, 1, 2, 3, 4, 5, 255, 256, 1000]) {
      const dati = Uint8Array.from({ length: n }, (_, i) => (i * 37 + 11) % 256);
      expect(fromBase64(toBase64(dati))).toEqual(dati);
    }
    expect(toBase64(new Uint8Array([77, 97, 110]))).toBe('TWFu');
    expect(toBase64(new Uint8Array([255, 254]))).toBe('//4=');
    expect(fromBase64('TWE=')).toEqual(new Uint8Array([77, 97]));
  });
});

describe('Formato del backup — MECCANISMI §22, FUNZIONALITA §20 (T-030)', () => {
  it('le tabelle passano così come sono, i binari dei PDF in base64; il file si rilegge identico', () => {
    const tabelle = {
      blocchi: [blocco('b1', { titolo: 'Spesa' }), { id: 'b2', createdAt: 1, updatedAt: 3, deletedAt: 3 }],
      materialiBinari: [riga('m1', { materialeId: 'm1', dati: new Uint8Array([1, 2, 3]) })],
    };
    const file = backupFile(tabelle, ADESSO);
    expect(file).toMatchObject({ formato: FORMATO_BACKUP, versione: VERSIONE_BACKUP, creatoIl: ADESSO });
    expect(file.tabelle.materialiBinari?.[0]).toMatchObject({ dati: 'AQID' });
    const letto = parseBackup(JSON.stringify(file), ['blocchi', 'materialiBinari', 'corsi']);
    expect(letto).toEqual({ creatoIl: ADESSO, tabelle: { ...tabelle, corsi: [] } });
  });

  it('un file che non è un backup, di una versione più nuova o con una riga senza identità non si importa', () => {
    const tabelle = ['blocchi'];
    expect(parseBackup('non json', tabelle)).toEqual({ errore: 'illeggibile' });
    expect(parseBackup(JSON.stringify({ formato: 'altro', versione: 1, tabelle: {} }), tabelle)).toEqual({
      errore: 'illeggibile',
    });
    const nuovo = { formato: FORMATO_BACKUP, versione: VERSIONE_BACKUP + 1, creatoIl: 0, tabelle: {} };
    expect(parseBackup(JSON.stringify(nuovo), tabelle)).toEqual({ errore: 'versione' });
    const rotto = { formato: FORMATO_BACKUP, versione: 1, creatoIl: 0, tabelle: { blocchi: [{ titolo: 'x' }] } };
    expect(parseBackup(JSON.stringify(rotto), tabelle)).toEqual({ errore: 'illeggibile' });
    // Le tabelle che questa versione non conosce si ignorano; un backup senza PDF si importa
    const ignoto = { formato: FORMATO_BACKUP, versione: 1, creatoIl: 0, tabelle: { futura: [riga('f')] } };
    expect(parseBackup(JSON.stringify(ignoto), tabelle)).toEqual({ creatoIl: 0, tabelle: { blocchi: [] } });
    // Senza l'ora del file non si sa che backup sia; una tombstone con altri campi torna minima (INV-14)
    const senzaOra = { formato: FORMATO_BACKUP, versione: 1, tabelle: {} };
    expect(parseBackup(JSON.stringify(senzaOra), tabelle)).toEqual({ errore: 'illeggibile' });
    const gonfia = { id: 't', createdAt: 1, updatedAt: 2, deletedAt: 2, giornoLocale: '2026-09-23', stato: 'perso' };
    const conTombstone = { formato: FORMATO_BACKUP, versione: 1, creatoIl: 0, tabelle: { blocchi: [gonfia] } };
    expect(parseBackup(JSON.stringify(conTombstone), tabelle)).toEqual({
      creatoIl: 0,
      tabelle: { blocchi: [{ id: 't', createdAt: 1, updatedAt: 2, deletedAt: 2 }] },
    });
  });

  it('un link che non è http(s) rende il file illeggibile (data:, file: costruiti ad arte; security review)', () => {
    const riga = {
      id: 'm1',
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      tipo: 'link',
      url: 'data:text/html,<h1>x</h1>',
    };
    const testo = JSON.stringify({ formato: FORMATO_BACKUP, versione: 1, creatoIl: 1, tabelle: { materiali: [riga] } });
    expect(parseBackup(testo, ['materiali'])).toEqual({ errore: 'illeggibile' });
    const buona = { ...riga, url: 'https://esempio.it' };
    const ok = JSON.stringify({ formato: FORMATO_BACKUP, versione: 1, creatoIl: 1, tabelle: { materiali: [buona] } });
    expect(parseBackup(ok, ['materiali'])).not.toHaveProperty('errore');
  });

  it('una riga viva con la forma sbagliata rende il file illeggibile, come una busta della sync (D-RECUPERO-1, audit P1-3)', () => {
    const file = (tabelle: object) => JSON.stringify({ formato: FORMATO_BACKUP, versione: 1, creatoIl: 1, tabelle });
    const nomi = ['blocchi', 'moduli', 'preferenze'];
    const modulo = riga('m1', { numero: 1, titolo: 'Tooling', criteri: [] });
    // Le preferenze che non viaggiano hanno valori propri: «Ultimo backup» è un numero
    const ultimo = riga('ultimoBackup', { valore: ADESSO });
    expect(
      parseBackup(file({ blocchi: [blocco('b1')], moduli: [modulo], preferenze: [ultimo] }), nomi),
    ).not.toHaveProperty('errore');
    expect(parseBackup(file({ blocchi: [blocco('b1', { checklist: 'x' })] }), nomi)).toEqual({ errore: 'illeggibile' });
    expect(parseBackup(file({ blocchi: [blocco('b1', { tipo: 'altro' })] }), nomi)).toEqual({ errore: 'illeggibile' });
    expect(parseBackup(file({ moduli: [{ ...modulo, criteri: null }] }), nomi)).toEqual({ errore: 'illeggibile' });
    expect(parseBackup(file({ preferenze: [riga('impostazioni', { valore: 'x' })] }), nomi)).toEqual({
      errore: 'illeggibile',
    });
  });
});

describe('Stima del file — MECCANISMI §22 (audit P3-17)', () => {
  it('i PDF pesano un terzo in più (base64 nel file); note, link e codice come sono', () => {
    expect(backupSizeEstimate({ pdf: 3000, altri: 100, codice: 50 })).toBe(4150);
    expect(backupSizeEstimate({ pdf: 0, altri: 0, codice: 0 })).toBe(0);
  });
});

describe('Istanti dei record — MECCANISMI §22, §25 (audit N-4)', () => {
  it('un istante che non è un intero rende il file illeggibile: nella sync fermerebbe la coda per sempre', () => {
    const file = (r: Record<string, unknown>) =>
      JSON.stringify({ formato: FORMATO_BACKUP, versione: VERSIONE_BACKUP, creatoIl: 0, tabelle: { blocchi: [r] } });
    expect(parseBackup(file({ id: 'b', createdAt: 1, updatedAt: 1.5, deletedAt: 2 }), ['blocchi'])).toEqual({
      errore: 'illeggibile',
    });
    expect(parseBackup(file({ id: 'b', createdAt: 1e20, updatedAt: 2, deletedAt: 2 }), ['blocchi'])).toEqual({
      errore: 'illeggibile',
    });
    expect(parseBackup(file({ id: 'b', createdAt: 1, updatedAt: 2, deletedAt: 2.5 }), ['blocchi'])).toEqual({
      errore: 'illeggibile',
    });
  });
});
