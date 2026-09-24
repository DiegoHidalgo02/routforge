// Verifica che l'export di Claude Design sia presente in design/ (Handoff §0).
// Esce con codice 1 se manca qualcosa: usato da `npm run design:check`.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const designDir = join(root, 'design');

// Elenco atteso (nomi dal progetto di design). Percorsi alternativi ammessi: alla radice di design/
// oppure in design/design/ e design/spec/ come nell'export.
const expected = [
  ['design/tokens.css', 'tokens.css'],
  ['design/DESIGN.md', 'DESIGN.md'],
  ['design/course-data.js', 'course-data.js'],
  ['HANDOFF.md'],
  ['support.js'],
  ['RoutForge Design System.dc.html'],
  ['01 Oggi.dc.html'],
  ['02 Crea.dc.html'],
  ['03 Dettaglio.dc.html'],
  ['04 Corsi.dc.html'],
  ['05 Sessione.dc.html'],
  ['06 AI e pratica.dc.html'],
  ['07 Statistiche.dc.html'],
  ['08 Notifiche.dc.html'],
  ['09 Impostazioni.dc.html'],
  ['10 Mese PDF Widget.dc.html'],
  ['S1 Oggi Desktop.dc.html'],
  ['S1 Oggi Mobile.dc.html'],
  ['S4 Crea Desktop.dc.html'],
  ['S4 Crea Mobile.dc.html'],
  ['S4 Crea Panel.dc.html'],
  ['S5 Dettaglio Desktop.dc.html'],
  ['S5 Dettaglio Mobile.dc.html'],
  ['S5 Dettaglio Panel.dc.html'],
  ['S8 Sveglia Mobile.dc.html'],
  ['S10 Corsi Desktop.dc.html'],
  ['S10 Corsi Mobile.dc.html'],
  ['S11 Corso Panel.dc.html'],
  ['S11 Modulo Panel.dc.html'],
  ['S12 Unità Panel.dc.html'],
  ['S13 Extra Mobile.dc.html'],
  ['S13 Extra Panel.dc.html'],
  ['S15 Sessione Desktop.dc.html'],
  ['S15 Sessione Mobile.dc.html'],
  ['S15 Sessione Panel.dc.html'],
  ['S19 AI Desktop.dc.html'],
  ['S19 AI Mobile.dc.html'],
  ['S19 AI Panel.dc.html'],
  ['S20 Shell Desktop.dc.html'],
  ['S20 Shell Mobile.dc.html'],
  ['S20 Statistiche Panel.dc.html'],
  ['S21 Notifiche Panel.dc.html'],
  ['S22 Impostazioni Panel.dc.html'],
  ['spec/M0-Riattivazione_JavaScript.md'],
  ['spec/M1-Tooling_Moderno.md'],
];

// Indice ricorsivo dei file presenti (nome relativo, normalizzato) per tollerare sottocartelle dell'export.
function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, acc);
    else
      acc.push(
        p
          .slice(designDir.length + 1)
          .replace(/\\/g, '/')
          .normalize('NFC'),
      );
  }
  return acc;
}
const present = new Set(walk(designDir));
const found = (rel) => [...present].some((p) => p === rel || p.endsWith('/' + rel));

const missing = expected.filter((alts) => !alts.some(found));
console.log(`design/: ${present.size} file presenti, ${expected.length} attesi, ${missing.length} file mancanti`);
for (const m of missing) console.log('  - ' + m.join('  oppure  '));
if (missing.length > 0) {
  console.log(
    "\nImporta il design con /design in Claude Code oppure scompatta l'export in design/ (vedi design/README.md).",
  );
  process.exit(1);
}
