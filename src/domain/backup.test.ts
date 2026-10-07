import { describe, expect, it } from 'vitest';
import { backupFile, FORMATO_BACKUP, fromBase64, parseBackup, toBase64, VERSIONE_BACKUP } from './backup';
import { local } from './time';

const ADESSO = local(2026, 9, 23, 16, 8);
const riga = (id: string, extra: object = {}) => ({ id, createdAt: 1, updatedAt: 2, deletedAt: null, ...extra });

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
      blocchi: [riga('b1', { titolo: 'Spesa' }), { id: 'b2', createdAt: 1, updatedAt: 3, deletedAt: 3 }],
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
});
