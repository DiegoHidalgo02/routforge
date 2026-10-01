// Verifica che l'export di Claude Design sia presente in claude-design/ (Handoff §0).
// Esce con codice 1 se manca qualcosa: usato da `npm run design:check`.
// La cartella del repository si chiama claude-design/ per non confondersi con la sottocartella "design/"
// interna all'export (tokens.css, DESIGN.md, course-data.js): l'import atterra uno a uno, senza spostare nulla.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const designDir = join(import.meta.dirname, '..', 'claude-design');

// Elenco atteso (nomi dal progetto di design), relativo a claude-design/. Un nome senza cartella vale in qualunque
// sottocartella dell'export (`found`): i tre file di design/ si accettano anche nella radice, scompattati a mano.
const expected = [
  'tokens.css',
  'DESIGN.md',
  'course-data.js',
  'HANDOFF.md',
  'support.js',
  'RoutForge Design System.dc.html',
  '01 Oggi.dc.html',
  '02 Crea.dc.html',
  '03 Dettaglio.dc.html',
  '04 Corsi.dc.html',
  '05 Sessione.dc.html',
  '06 AI e pratica.dc.html',
  '07 Statistiche.dc.html',
  '08 Notifiche.dc.html',
  '09 Impostazioni.dc.html',
  '10 Mese PDF Widget.dc.html',
  'S1 Oggi Desktop.dc.html',
  'S1 Oggi Mobile.dc.html',
  'S4 Crea Desktop.dc.html',
  'S4 Crea Mobile.dc.html',
  'S4 Crea Panel.dc.html',
  'S5 Dettaglio Desktop.dc.html',
  'S5 Dettaglio Mobile.dc.html',
  'S5 Dettaglio Panel.dc.html',
  'S8 Sveglia Mobile.dc.html',
  'S10 Corsi Desktop.dc.html',
  'S10 Corsi Mobile.dc.html',
  'S11 Corso Panel.dc.html',
  'S11 Modulo Panel.dc.html',
  'S12 Unità Panel.dc.html',
  'S13 Extra Mobile.dc.html',
  'S13 Extra Panel.dc.html',
  'S15 Sessione Desktop.dc.html',
  'S15 Sessione Mobile.dc.html',
  'S15 Sessione Panel.dc.html',
  'S19 AI Desktop.dc.html',
  'S19 AI Mobile.dc.html',
  'S19 AI Panel.dc.html',
  'S20 Shell Desktop.dc.html',
  'S20 Shell Mobile.dc.html',
  'S20 Statistiche Panel.dc.html',
  'S21 Notifiche Panel.dc.html',
  'S22 Impostazioni Panel.dc.html',
  'spec/M0-Riattivazione_JavaScript.md',
  'spec/M1-Tooling_Moderno.md',
];

// Indice ricorsivo dei file presenti (nome relativo, normalizzato) per tollerare sottocartelle dell'export.
const present = existsSync(designDir)
  ? readdirSync(designDir, { recursive: true })
      .filter((p) => statSync(join(designDir, p)).isFile())
      .map((p) => p.replace(/\\/g, '/').normalize('NFC'))
  : [];
const found = (rel) => present.some((p) => p === rel || p.endsWith('/' + rel));

const missing = expected.filter((rel) => !found(rel));
console.log(
  `claude-design/: ${present.length} file presenti, ${expected.length} attesi, ${missing.length} file mancanti`,
);
for (const m of missing) console.log('  - ' + m);
if (missing.length > 0) {
  console.log(
    "\nImporta il design con /design in Claude Code (destinazione claude-design/) oppure scompatta l'export in claude-design/ (vedi claude-design/README.md).",
  );
  process.exit(1);
}
