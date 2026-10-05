// Serve `claude-design/` così com'è, senza trasformazioni, per aprire i `.dc.html` nel browser (D-DESIGN-4): il motore di
// anteprima `support.js` rilegge la pagina e i componenti fratelli con `fetch`, vietato su file://. Nessuna dipendenza.
// Uso: `npm run mock` (porta 5394; `-- --port N` per cambiarla), poi apri l'URL stampato: la radice elenca le tavole.
import { createServer } from 'node:http';
import { createReadStream, existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

const RADICE = join(import.meta.dirname, '..', 'claude-design');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/** Avvia il server su 127.0.0.1 e risolve con l'istanza (chiudila con `server.close()`). */
export function serveMock(port = 5394) {
  const server = createServer((req, res) => {
    const percorso = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (percorso === '/') {
      const tavole = readdirSync(RADICE).filter((n) => n.endsWith('.dc.html'));
      res.writeHead(200, { 'content-type': MIME['.html'] });
      res.end(
        '<!doctype html><meta charset="utf-8"><title>Mock RoutForge</title>' +
          '<body style="font:14px system-ui;background:#0A0D13;color:#fff;padding:24px"><h1>claude-design/</h1>' +
          tavole.map((n) => `<p><a style="color:#8AAAF6" href="/${encodeURIComponent(n)}">${n}</a></p>`).join(''),
      );
      return;
    }
    const file = normalize(join(RADICE, percorso));
    if (!file.startsWith(RADICE + sep) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      res.end('non trovato');
      return;
    }
    res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

if (process.argv[1] && normalize(process.argv[1]) === normalize(import.meta.filename)) {
  const i = process.argv.indexOf('--port');
  const port = i > 0 ? Number(process.argv[i + 1]) : 5394;
  await serveMock(port);
  console.log(`Mock del design: http://127.0.0.1:${port}/  (Ctrl+C per chiudere)`);
}
