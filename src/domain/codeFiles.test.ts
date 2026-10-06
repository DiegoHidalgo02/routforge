import { describe, expect, it } from 'vitest';
import { codeTree, collapseUpload, excludedCount, exclusionReason, normalizePath, technicalFolder } from './codeFiles';

describe('File di codice: esclusioni — MECCANISMI §17 (T-025)', () => {
  it('cartelle tecniche, .env*, lock, log e file di sistema esclusi; estensioni comuni e file noti ammessi; 500 KB per file', () => {
    expect(exclusionReason('task-tracker/app.js', 5_400)).toBeNull();
    expect(exclusionReason('task-tracker/Dockerfile', 300)).toBeNull();
    expect(exclusionReason('makefile', 300)).toBeNull();
    expect(exclusionReason('Dockerfile.dev', 300)).toBeNull();
    expect(exclusionReason('api/go.mod', 300)).toBeNull();
    expect(exclusionReason('task-tracker/node_modules/react/index.js', 100)).toBe('cartella_tecnica');
    expect(exclusionReason('Node_Modules/x.js', 100)).toBe('cartella_tecnica');
    expect(technicalFolder('task-tracker/node_modules/react/index.js')).toBe('task-tracker/node_modules/');
    // `.env*` (§17): ogni nome che inizia con .env
    for (const segreto of ['.env', 'api/.env.local', '.envrc', '.env-cmdrc.json', '.env_prod.yaml'])
      expect(exclusionReason(segreto, 50)).toBe('segreto');
    // `.npmrc` può contenere un token: non è fra i file ammessi
    expect(exclusionReason('.npmrc', 50)).not.toBeNull();
    expect(exclusionReason('package-lock.json', 90_000)).toBe('lock');
    expect(exclusionReason('logs/server.log', 10)).toBe('log');
    expect(exclusionReason('.DS_Store', 10)).toBe('sistema');
    expect(exclusionReason('src/._app.js', 10)).toBe('sistema');
    expect(exclusionReason('foto.png', 10)).toBe('estensione');
    // 500 KB per file (§17)
    expect(exclusionReason('dati.json', 500 * 1024)).toBeNull();
    expect(exclusionReason('dati.json', 500 * 1024 + 1)).toBe('troppo_grande');
    // Gli ZIP di Windows usano `\`
    expect(normalizePath('task-tracker\\node_modules\\a.js')).toBe('task-tracker/node_modules/a.js');
  });

  it('una cartella tecnica è una riga sola col numero dei file, contati fra gli esclusi; un percorso ripetuto resta l’ultimo', () => {
    const righe = collapseUpload(
      [
        { percorso: 'p/node_modules/a.js', byte: 1, motivo: 'cartella_tecnica' as const },
        { percorso: 'p/node_modules/b/c.js', byte: 2, motivo: 'cartella_tecnica' as const },
        { percorso: 'p/index.html', byte: 3, motivo: null },
        { percorso: 'p/index.html', byte: 4, motivo: null },
        { percorso: 'p/.env', byte: 5, motivo: 'segreto' as const },
      ],
      (percorso, file, byte) => ({ percorso, byte, motivo: 'cartella_tecnica' as const, file }),
    );
    expect(righe).toEqual([
      { percorso: 'p/index.html', byte: 4, motivo: null },
      { percorso: 'p/.env', byte: 5, motivo: 'segreto' },
      { percorso: 'p/node_modules/', byte: 3, motivo: 'cartella_tecnica', file: 2 },
    ]);
    expect(excludedCount(righe)).toBe(3);
  });

  it('albero: cartelle prima dei file, rientro per livello, gli esclusi restano visibili', () => {
    const righe = codeTree([
      { percorso: 'task-tracker/app.js', byte: 5_400, motivo: null },
      { percorso: 'task-tracker/index.html', byte: 2_100, motivo: null },
      { percorso: 'event-loop-lab/previsioni.md', byte: 3_800, motivo: null },
      { percorso: '.env', byte: 50, motivo: 'segreto' },
      { percorso: 'task-tracker/node_modules/', byte: 9_000, motivo: 'cartella_tecnica' },
    ]);
    expect(righe.map((r) => [r.nome, r.livello])).toEqual([
      ['event-loop-lab/', 0],
      ['previsioni.md', 1],
      ['task-tracker/', 0],
      ['node_modules/', 1],
      ['app.js', 1],
      ['index.html', 1],
      ['.env', 0],
    ]);
    expect(righe.at(-1)?.motivo).toBe('segreto');
    // La cartella tecnica esclusa: una riga sola, cartella, col motivo
    expect(righe[3]).toMatchObject({ nome: 'node_modules/', cartella: true, motivo: 'cartella_tecnica' });
  });
});
