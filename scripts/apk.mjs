// =============================================================================
// APK di RoutForge (T-035, D-RILASCIO-1): build web, copia nel progetto Android (Capacitor) e Gradle.
// `npm run apk` = release firmata con la chiave di ~/.routforge (fuori dal repository); `npm run apk:debug` = debug,
// senza chiave. Stampa dove trovare il file da installare.
// =============================================================================
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');
const debug = process.argv.includes('--debug');
const windows = process.platform === 'win32';

if (!debug && !existsSync(join(homedir(), '.routforge', 'keystore.properties'))) {
  console.error(
    'Manca ~/.routforge/keystore.properties con la chiave di firma (D-RILASCIO-1): ripristina la copia della cartella ' +
      '~/.routforge, oppure usa `npm run apk:debug`.',
  );
  process.exit(1);
}

// Comandi fissi, senza dati dell'utente: una riga sola per la shell (Windows lancia npm, npx e gradlew.bat solo così)
const esegui = (comando, argomenti, cwd = ROOT) => {
  const r = spawnSync([comando, ...argomenti].join(' '), { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

// Una release senza firma completa esce come `app-release-unsigned.apk`: l'APK di prima si toglie (Gradle lo rifà
// anche se il resto è aggiornato), così si annuncia solo un file scritto da questa build
const apk = join(
  'android',
  'app',
  'build',
  'outputs',
  'apk',
  debug ? 'debug/app-debug.apk' : 'release/app-release.apk',
);
rmSync(join(ROOT, apk), { force: true });
esegui('npm', ['run', 'build']);
esegui('npx', ['cap', 'sync', 'android']);
// Su Windows `cmd` può non cercare nella cartella di lavoro: il percorso intero, tra virgolette
const gradle = windows ? `"${join(ROOT, 'android', 'gradlew.bat')}"` : './gradlew';
esegui(gradle, [debug ? 'assembleDebug' : 'assembleRelease'], join(ROOT, 'android'));
if (!existsSync(join(ROOT, apk))) {
  console.error(`\nNessun APK in ${apk}: controlla la firma in ~/.routforge/keystore.properties (D-RILASCIO-1).`);
  process.exit(1);
}
console.log(`\nAPK pronto: ${apk}`);
