import { beforeEach, describe, expect, it, vi } from 'vitest';

// Disco finto di `@capacitor/filesystem` in Documenti: un nome → il testo scritto; `rename` sostituisce la
// destinazione come il plugin su Android (cancella la vecchia, poi rinomina); `rinominaFallisce` = la vecchia è già
// cancellata quando la rinomina (e la copia di ripiego del plugin) fallisce.
const fs = vi.hoisted(() => ({ disco: new Map<string, string>(), append: 0, fallisceAl: 0, rinominaFallisce: false }));
type Scrittura = { path: string; data: string };

vi.mock('@capacitor/core', () => ({ Capacitor: { getPlatform: () => 'android' } }));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    requestPermissions: () => Promise.resolve({ publicStorage: 'granted' }),
    writeFile: ({ path, data }: Scrittura) => Promise.resolve(void fs.disco.set(path, data)),
    appendFile: ({ path, data }: Scrittura) =>
      ++fs.append === fs.fallisceAl
        ? Promise.reject(new Error('spazio esaurito'))
        : Promise.resolve(void fs.disco.set(path, (fs.disco.get(path) ?? '') + data)),
    deleteFile: ({ path }: { path: string }) => Promise.resolve(void fs.disco.delete(path)),
    rename: ({ from, to }: { from: string; to: string }) => {
      const testo = fs.disco.get(from);
      if (testo === undefined) return Promise.reject(new Error('il file non esiste'));
      if (fs.rinominaFallisce) {
        fs.disco.delete(to);
        return Promise.reject(new Error('rinomina fallita'));
      }
      fs.disco.delete(from);
      fs.disco.set(to, testo);
      return Promise.resolve();
    },
  },
}));

const { backupFiles } = await import('./files');
const NOME = 'routforge-2026-10-09.rfbackup';

describe('Backup in Documenti su Android — MECCANISMI §22, D-BACKUP-2 n. 4', () => {
  beforeEach(() => {
    fs.disco.clear();
    fs.append = 0;
    fs.fallisceAl = 0;
    fs.rinominaFallisce = false;
  });

  it('un testo di 2,5 milioni di caratteri con un’emoji al confine del pezzo arriva intero, senza file parziali', async () => {
    const testo = `${'a'.repeat(1024 * 1024 - 1)}😀${'b'.repeat(1_500_000)}`;
    expect(await backupFiles.salva(NOME, testo)).toBe('documenti');
    expect(fs.disco.get(NOME)).toBe(testo);
    expect([...fs.disco.keys()]).toEqual([NOME]);
  });

  it('un secondo export dello stesso giorno che fallisce a metà lascia intatto il backup di prima (audit P0-1)', async () => {
    fs.disco.set(NOME, 'BACKUP BUONO DELLE 9:00');
    fs.fallisceAl = 1;
    expect(await backupFiles.salva(NOME, 'x'.repeat(2 * 1024 * 1024))).toBeNull();
    expect(fs.disco.get(NOME)).toBe('BACKUP BUONO DELLE 9:00');
    expect([...fs.disco.keys()]).toEqual([NOME]);
  });

  it('una rinomina che fallisce dopo aver cancellato il backup di prima lascia la copia completa nel parziale (revisione di P0-1)', async () => {
    fs.disco.set(NOME, 'BACKUP BUONO DELLE 9:00');
    fs.rinominaFallisce = true;
    expect(await backupFiles.salva(NOME, 'BACKUP NUOVO')).toBeNull();
    expect(fs.disco.get(`${NOME}.parziale`)).toBe('BACKUP NUOVO');
  });
});
