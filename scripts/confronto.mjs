// Confronto visivo con le tavole del design (claude-design/docs/IMPLEMENTAZIONE.md §6, D-DESIGN-4): fotografa uno stato
// di una tavola, trovato dalla sua didascalia, e la stessa schermata dell'app alla misura della tavola (390×844 o
// 1280×800). Edge headless pilotato via CDP, nessuna dipendenza; il mock è servito da `scripts/mock.mjs`, l'app dal dev
// server di Vite (avviato qui sulla porta 5391 se non è già vivo). Le immagini si confrontano guardandole: la cornice del
// telefono della tavola è scenografia.
// Uso: npm run confronto -- --tavola "01 Oggi" --stato "archivio completate aperto" [--app /] [--out coverage/confronto]
//   --stato: un pezzo del testo della didascalia, maiuscole indifferenti; senza --app si fotografa solo il mock.
//   --scenario: l'app gira nello scenario dei mock (mercoledì 23 settembre 2026, 16:08, Date iniettato nella pagina) con
//   il corso di esempio salvato e la giornata di S1; --sessione aggiunge una sessione libera avviata 12 minuti prima
//   (banner e carta). --ora HH:MM sposta l'orologio (15:48 «Tra poco», 16:50 «Da recuperare»); --adesso studio | todo |
//   routine | evento sceglie l'attività delle 16:00 (prop `nowKind` di S1).
// Windows: EDGE può indicare un altro eseguibile di Edge/Chrome.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { serveMock } from './mock.mjs';

const RADICE = resolve(import.meta.dirname, '..');
const EDGE = process.env.EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const PORTA_MOCK = 5394;
const PORTA_APP = 5391;
const PORTA_CDP = 9345;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const arg = (nome, predefinito = '') => {
  const i = process.argv.indexOf(nome);
  return i > 0 ? (process.argv[i + 1] ?? '') : predefinito;
};
const tavola = arg('--tavola');
const stato = arg('--stato').toLowerCase();
const rotta = arg('--app');
const out = resolve(RADICE, arg('--out', 'coverage/confronto'));
const sessione = process.argv.includes('--sessione');
const [ore, minuti] = arg('--ora', '16:08').split(':').map(Number);
const adesso = arg('--adesso', 'studio');
const scenario = sessione || process.argv.includes('--scenario') || process.argv.includes('--ora');
// La giornata di S1 (scenario dei mock): [ore, minuti, giorno di settembre se non il 23] di inizio e fine; `unita` = lo studio sul puntatore 0.7
const voci = (fatte, totali) =>
  Array.from({ length: totali }, (_, i) => ({ testo: `Voce ${i + 1}`, fatta: i < fatte }));
const ADESSO = {
  studio: { tipo: 'studio', titolo: 'Ripasso Modulo 0', da: [16, 0], a: [16, 45], unita: '0.7' },
  todo: { tipo: 'todo', titolo: 'Inviare la relazione', da: [16, 0], a: [16, 30], checklist: voci(2, 4) },
  routine: { tipo: 'routine', titolo: 'Corsa', da: [16, 0], a: [16, 45] },
  evento: {
    tipo: 'evento',
    titolo: 'Riunione con il relatore',
    da: [16, 0],
    a: [17, 0],
    luogo: 'Aula 2.4 · Edificio B',
  },
};
const GIORNATA = [
  { tipo: 'studio', stato: 'completato', titolo: 'Lezione di UI/UX', da: [9, 0], a: [10, 0] },
  { tipo: 'evento', stato: 'completato', titolo: 'Riunione progetto', da: [11, 0], a: [12, 0], luogo: 'Meet' },
  { tipo: 'routine', stato: 'completato', titolo: 'Palestra', da: [14, 30], a: [15, 30] },
  ADESSO[adesso] ?? ADESSO.studio,
  { tipo: 'todo', titolo: 'Leggere 20 pagine', da: [19, 0], a: [19, 30], checklist: voci(2, 5) },
  { tipo: 'todo', titolo: 'Prepara la valigia', da: [12, 0], conOrario: false, priorita: 'alta' },
  { tipo: 'todo', titolo: 'Prenota il treno', da: [12, 0], conOrario: false, priorita: 'alta' },
  { tipo: 'todo', titolo: 'Chiama Marco', da: [12, 0], conOrario: false, priorita: 'normale' },
  // «Prossime attività» del mock: giovedì 24 e venerdì 25
  { tipo: 'studio', titolo: 'Lezione di Algoritmi', da: [9, 0, 24], a: [10, 30, 24] },
  { tipo: 'evento', titolo: 'Dentista', da: [15, 0, 24], a: [16, 0, 24] },
  { tipo: 'studio', titolo: 'Ripasso Modulo 0', da: [16, 0, 25], a: [16, 45, 25] },
];
if (!tavola || !stato) {
  console.error(
    'uso: npm run confronto -- --tavola "01 Oggi" --stato "<pezzo della didascalia>" [--app /] [--out dir]',
  );
  process.exit(2);
}
const fileTavola = `${tavola}.dc.html`;
if (!existsSync(join(RADICE, 'claude-design', fileTavola))) {
  console.error(`tavola non trovata: claude-design/${fileTavola}`);
  process.exit(2);
}
// Misura dello stato: `hint-size` del dc-import nella figura con quella didascalia, letta dal file (il motore di
// anteprima sostituisce il dc-import quando disegna)
const figuraSorgente = readFileSync(join(RADICE, 'claude-design', fileTavola), 'utf8')
  .split('<figure')
  .find((f) => (f.match(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/)?.[1] ?? '').toLowerCase().includes(stato));
const misura = (figuraSorgente?.match(/hint-size="(\d+)px,(\d+)px"/)?.slice(1) ?? ['390', '844']).map(Number);
mkdirSync(out, { recursive: true });

const vivo = async (url) => {
  try {
    await fetch(url);
    return true;
  } catch {
    return false;
  }
};
if (await vivo(`http://127.0.0.1:${PORTA_CDP}/json/version`)) {
  console.error(`un Edge è già in ascolto sulla porta ${PORTA_CDP}: chiudilo prima (falserebbe il confronto)`);
  process.exit(2);
}

const mock = await serveMock(PORTA_MOCK);
let vite = null;
if (rotta && !(await vivo(`http://localhost:${PORTA_APP}`))) {
  vite = spawn('cmd.exe', ['/c', `npx vite --port ${PORTA_APP} --strictPort`], { cwd: RADICE, stdio: 'ignore' });
  for (let i = 0; i < 60 && !(await vivo(`http://localhost:${PORTA_APP}`)); i++) await sleep(500);
}
const profilo = mkdtempSync(join(tmpdir(), 'rf-confronto-'));
const edge = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORTA_CDP}`,
  `--user-data-dir=${profilo}`,
  '--accept-lang=it-IT',
  '--window-size=1400,1000',
  'about:blank',
]);
const chiudi = () => {
  try {
    ws?.close();
  } catch {
    /* già chiuso */
  }
  try {
    edge.kill();
  } catch {
    /* già chiuso */
  }
  // Edge rilancia sé stesso: si chiudono i processi col profilo di questa esecuzione; il vite avviato qui, il suo albero.
  const cartella = profilo.split(/[\\/]/).pop();
  spawnSync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'msedge.exe' -and $_.CommandLine -match '${cartella}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
  ]);
  if (vite) {
    spawnSync('taskkill', ['/PID', String(vite.pid), '/T', '/F'], { stdio: 'ignore' });
    spawnSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'vite' -and $_.CommandLine -match '${PORTA_APP}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`,
    ]);
  }
  mock.close();
};
const timeout = setTimeout(() => {
  console.error('tempo scaduto');
  chiudi();
  process.exit(2);
}, 120_000);

let ws;
const console_ = [];
try {
  for (let i = 0; i < 40 && !(await vivo(`http://127.0.0.1:${PORTA_CDP}/json/version`)); i++) await sleep(250);
  const tab = await (await fetch(`http://127.0.0.1:${PORTA_CDP}/json/new?about:blank`, { method: 'PUT' })).json();
  ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const attese = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && attese.has(m.id)) attese.get(m.id)(m.result ?? m.error);
    if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning'))
      console_.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    if (m.method === 'Runtime.exceptionThrown')
      console_.push(`eccezione: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  };
  const cdp = (method, params = {}) =>
    new Promise((r) => {
      attese.set(++id, r);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const js = async (expression) =>
    (await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
  const foto = async (nome, clip) => {
    const { data } = await cdp('Page.captureScreenshot', { captureBeyondViewport: true, ...(clip && { clip }) });
    const percorso = join(out, nome);
    writeFileSync(percorso, Buffer.from(data, 'base64'));
    return percorso;
  };
  await cdp('Runtime.enable');
  await cdp('Page.enable');

  // 1. La tavola: la figura con la didascalia cercata, attesa finché il componente importato non è disegnato
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1400, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: `http://127.0.0.1:${PORTA_MOCK}/${encodeURIComponent(fileTavola)}` });
  const cerca = `(() => {
    const figure = [...document.querySelectorAll('figure')];
    const f = figure.find((x) => (x.querySelector('figcaption')?.textContent ?? '').toLowerCase().includes(${JSON.stringify(stato)}));
    if (!f) return { didascalie: figure.map((x) => x.querySelector('figcaption')?.textContent ?? '') };
    const r = f.getBoundingClientRect();
    return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height, w: ${misura[0]}, h: ${misura[1]}, didascalia: f.querySelector('figcaption')?.textContent ?? '' };
  })()`;
  // La pagina si carica e il motore di anteprima disegna le figure dopo: si aspetta la didascalia, poi l'altezza
  let fig = await js(cerca);
  for (let i = 0; i < 80 && (!fig || fig.didascalie || fig.height < fig.h * 0.8); i++) {
    await sleep(500);
    fig = await js(cerca);
  }
  if (!fig || fig.didascalie) {
    console.error(
      `nessuna didascalia contiene «${stato}». Didascalie di ${fileTavola}:\n- ${(fig?.didascalie ?? []).join('\n- ')}`,
    );
    chiudi();
    process.exit(1);
  }
  await cdp('Emulation.setDeviceMetricsOverride', {
    width: 1400,
    height: Math.ceil(fig.y + fig.height + 40),
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(1500);
  fig = await js(cerca);
  const nome = `${tavola} ${stato}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const fotoMock = await foto(`${nome}-mock.png`, {
    x: fig.x,
    y: fig.y,
    width: fig.width,
    height: fig.height,
    scale: 1,
  });
  console.log(`tavola: ${fotoMock}\n  didascalia: ${fig.didascalia.trim()}\n  misura: ${fig.w}×${fig.h}`);

  // 2. L'app alla stessa misura
  if (rotta) {
    const mobile = fig.w < 1024;
    await cdp('Emulation.setDeviceMetricsOverride', { width: fig.w, height: fig.h, deviceScaleFactor: 1, mobile });
    await cdp('Emulation.setTouchEmulationEnabled', { enabled: mobile, maxTouchPoints: 5 });
    if (scenario) {
      // Orologio dello scenario dei mock: Date sposta l'istante, i timer restano veri (ora locale di parete)
      await cdp('Page.addScriptToEvaluateOnNewDocument', {
        source: `(() => { const D = Date; const scarto = new D(2026, 8, 23, ${ore}, ${minuti}).getTime() - D.now();
          class F extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + scarto); }
            static now() { return D.now() + scarto; } }
          globalThis.Date = F; })();`,
      });
      // Il profilo di Edge è nuovo a ogni esecuzione: il database parte vuoto
      await cdp('Page.navigate', { url: `http://localhost:${PORTA_APP}/` });
      await sleep(2500);
      const esito = await js(`(async () => {
        try {
          const { appDb } = await import('/src/app/db.ts');
          const { importSampleCourse } = await import('/src/app/courseImport.ts');
          const { saveBlock } = await import('/src/data/repository.ts');
          const fuso = Intl.DateTimeFormat().resolvedOptions().timeZone;
          await importSampleCourse(appDb, Date.now());
          const corso = (await appDb.corsi.toArray())[0];
          const unita = (await appDb.unita.toArray()).find((u) => u.numero === '0.7');
          const alle = ([h, m, g = 23]) => new Date(2026, 8, g, h, m).getTime();
          for (const { da, a, unita: n, ...b } of ${JSON.stringify(GIORNATA)}) {
            const studio = n ? { corsoId: corso.id, unitaId: unita.id } : {};
            const dati = { stato: 'programmato', conOrario: true, ...b, ...studio, inizio: alle(da), fine: a ? alle(a) : null };
            await saveBlock(appDb, dati, Date.now(), fuso);
          }
          if (${sessione}) {
            const { startSession } = await import('/src/app/session.ts');
            const scelta = { unitaId: null, corsoId: null, durata: 50, modalita: 'continua', iperfocus: false };
            await startSession(appDb, null, scelta, Date.now() - 12 * 60000, fuso);
          }
          return 'ok';
        } catch (e) { return String(e && e.stack || e); }
      })()`);
      if (esito !== 'ok') throw new Error(`semina dello scenario: ${esito}`);
    }
    await cdp('Page.navigate', { url: `http://localhost:${PORTA_APP}${rotta}` });
    // La pagina è pronta quando il suo testo resta uguale per un secondo (dati letti, animazioni d'entrata finite), al
    // più 30 s: su una macchina carica Vite e IndexedDB rispondono tardi
    let prima = '';
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      const ora = String(await js('document.body.innerText'));
      if (i >= 6 && ora === prima && ora.length > 0) break;
      prima = ora;
    }
    await sleep(1500);
    const fotoApp = await foto(`${nome}-app.png`);
    console.log(`app:    ${fotoApp}  (${rotta})`);
  }
  if (console_.length) console.log(`console (${console_.length}):\n- ${console_.slice(0, 10).join('\n- ')}`);
  else console.log('console: nessun errore né avviso');
} catch (e) {
  console.error('errore:', e?.stack ?? e);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
  chiudi();
}
