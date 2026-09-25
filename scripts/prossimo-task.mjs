#!/usr/bin/env node
// =============================================================================
// prossimo-task.mjs — Quale task esegue il loop adesso, e con quale modello
// -----------------------------------------------------------------------------
// Usato da scripts/loop.ps1 e scripts/loop.sh. Stessa regola di `/task next`:
// il primo task `aperto` di docs/TASKS.md le cui dipendenze (T-0NN) sono `fatto`.
// Il modello viene dalla colonna "Modello" (decisione D-MODEL-1):
//   "Opus 5.5" | "Sonnet 5" | "Fable 5.1" (D-MODEL-2: Haiku non si usa più)
//   "Fable 5.1 (piano) → Opus 5.5 (codice)" → fase piano con Fable se
//      docs/piani/<ID>.md non esiste ancora, altrimenti fase codice con Opus.
//
// Uso:  node scripts/prossimo-task.mjs              → JSON
//       node scripts/prossimo-task.mjs --formato sh → righe KEY='valore' per `eval` in bash
// =============================================================================
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Etichetta della colonna → nome del modello per `claude --model`
// (stringhe dei modelli pubblicate da Anthropic, settembre 2026).
export const MODELLI = {
  'Fable 5.1': 'claude-fable-5-1',
  'Opus 5.5': 'claude-opus-5-5',
  'Sonnet 5': 'claude-sonnet-5',
};

/** Legge le righe dei task dalla tabella di docs/TASKS.md. */
export function leggiTask(testo) {
  const righe = [];
  for (const riga of testo.split('\n')) {
    if (!/^\|\s*T-\d+/.test(riga)) continue;
    // Colonne: ID | Task | Spec | Scenari | Dipende da | Modello | Stato
    const c = riga
      .split('|')
      .slice(1, -1)
      .map((x) => x.trim());
    if (c.length !== 7) continue; // riga malformata: meglio ignorarla che indovinare
    const [idCell, titolo, , , dipende, modello, stato] = c;
    const id = /T-\d+/.exec(idCell)[0];
    righe.push({
      id,
      marcatori: (idCell.match(/\*\*([A-Z]+\d*)\*\*/g) ?? []).map((m) => m.replace(/\*/g, '')),
      titolo: titolo.replace(/`/g, '').slice(0, 80),
      dipendenze: dipende.match(/T-\d+/g) ?? [],
      modello,
      stato,
    });
  }
  return righe;
}

/**
 * Sceglie il prossimo task e il modello.
 * @param {string} testoTasks contenuto di docs/TASKS.md
 * @param {(id: string) => boolean} pianoEsiste true se docs/piani/<id>.md esiste
 */
export function prossimoTask(testoTasks, pianoEsiste) {
  const tutti = leggiTask(testoTasks);
  const fatti = new Set(tutti.filter((t) => t.stato === 'fatto').map((t) => t.id));
  const t = tutti.find((x) => x.stato === 'aperto' && x.dipendenze.every((d) => fatti.has(d)));
  if (!t) {
    const aperti = tutti.filter((x) => x.stato === 'aperto').length;
    return {
      trovato: false,
      motivo: aperti === 0 ? 'nessun task aperto' : 'task aperti con dipendenze non ancora fatte',
    };
  }

  // Un task marcato **CPn** aspetta una decisione dell'utente (docs/06_SUPERVISIONE.md): il loop non lo avvia
  // finché il marcatore resta sulla riga; si toglie quando la decisione è registrata in docs/01_DECISIONI.md.
  const checkpoint = t.marcatori.find((m) => /^CP\d+$/.test(m));
  if (checkpoint) {
    return {
      trovato: false,
      motivo: `${t.id} richiede il checkpoint ${checkpoint} (docs/06_SUPERVISIONE.md): decidi, registra la decisione e togli il marcatore dalla riga`,
    };
  }

  let etichetta = t.modello;
  let fase = 'unica';
  if (/\(piano\)/.test(t.modello)) {
    // Task in due fasi: il file del piano decide la fase.
    const [piano, codice] = t.modello.split('→').map((s) => s.replace(/\((piano|codice)\)/, '').trim());
    if (pianoEsiste(t.id)) {
      etichetta = codice;
      fase = 'codice';
    } else {
      etichetta = piano;
      fase = 'piano';
    }
  }
  const modelloId = MODELLI[etichetta];
  if (!modelloId) return { trovato: false, motivo: `modello non riconosciuto per ${t.id}: "${t.modello}"` };

  return {
    trovato: true,
    id: t.id,
    titolo: t.titolo,
    fase,
    modello: etichetta,
    modelloId,
    usaFable: etichetta === 'Fable 5.1',
    rischioso: t.marcatori.includes('R'),
  };
}

// --- Riga di comando -----------------------------------------------------------
const questoFile = fileURLToPath(import.meta.url);
// Eseguito da riga di comando (non importato dai test)?
if (process.argv[1] && resolve(process.argv[1]) === questoFile) {
  const radice = join(dirname(questoFile), '..');
  const testo = readFileSync(join(radice, 'docs', 'TASKS.md'), 'utf8');
  const r = prossimoTask(testo, (id) => existsSync(join(radice, 'docs', 'piani', `${id}.md`)));
  if (process.argv.includes('--formato') && process.argv[process.argv.indexOf('--formato') + 1] === 'sh') {
    // Valori tra apici singoli per bash (gli apici interni vengono neutralizzati).
    for (const [k, v] of Object.entries(r)) console.log(`${k.toUpperCase()}='${String(v).replace(/'/g, '')}'`);
  } else {
    console.log(JSON.stringify(r));
  }
}
