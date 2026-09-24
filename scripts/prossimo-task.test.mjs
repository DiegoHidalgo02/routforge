// Test del selettore del loop agentico (scripts/prossimo-task.mjs).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { leggiTask, prossimoTask } from './prossimo-task.mjs';

const riga = (id, dipende, modello, stato, marcatori = '') =>
  `| ${id}${marcatori} | Titolo ${id} | §1 | A1 | ${dipende} | ${modello} | ${stato} |`;
const tabella = (...righe) =>
  ['| ID | Task | Spec | Scenari / criteri | Dipende da | Modello | Stato |', '|---|---|---|---|---|---|---|', ...righe].join('\n');
const nessunPiano = () => false;

describe('prossimoTask — stessa regola di /task next', () => {
  it('salta i task le cui dipendenze non sono fatte', () => {
    const t = tabella(riga('T-001', '—', 'già fatto', 'fatto'), riga('T-002', 'T-009', 'Sonnet 5', 'aperto'), riga('T-003', 'T-001', 'Haiku 4.5', 'aperto'));
    const r = prossimoTask(t, nessunPiano);
    expect(r).toMatchObject({ trovato: true, id: 'T-003', modello: 'Haiku 4.5', modelloId: 'claude-haiku-4-5-20251001', fase: 'unica' });
  });

  it('dipendenze senza ID (testo libero) non bloccano', () => {
    const t = tabella(riga('T-000', "richiede l'export del design", 'Fable 5.1', 'aperto'));
    expect(prossimoTask(t, nessunPiano)).toMatchObject({ id: 'T-000', modelloId: 'claude-fable-5-1', usaFable: true });
  });

  it('nessun task aperto → trovato false con motivo', () => {
    expect(prossimoTask(tabella(riga('T-001', '—', 'già fatto', 'fatto')), nessunPiano)).toEqual({ trovato: false, motivo: 'nessun task aperto' });
  });

  it('solo task bloccati da dipendenze → motivo esplicito', () => {
    const r = prossimoTask(tabella(riga('T-005', 'T-004', 'Sonnet 5', 'aperto'), riga('T-004', '—', 'Opus 5.5', 'bloccato')), nessunPiano);
    expect(r.motivo).toBe('task aperti con dipendenze non ancora fatte');
  });
});

describe('prossimoTask — task in due fasi (D-MODEL-1)', () => {
  const due = 'Fable 5.1 (piano) → Opus 5.5 (codice)';
  const t = tabella(riga('T-013', '—', due, 'aperto', ' **R**'));

  it('senza piano → fase piano con Fable', () => {
    expect(prossimoTask(t, nessunPiano)).toMatchObject({ id: 'T-013', fase: 'piano', modello: 'Fable 5.1', usaFable: true, rischioso: true });
  });

  it('con piano → fase codice con Opus', () => {
    expect(prossimoTask(t, (id) => id === 'T-013')).toMatchObject({ fase: 'codice', modello: 'Opus 5.5', modelloId: 'claude-opus-5-5', usaFable: false });
  });
});

describe('prossimoTask — sul backlog reale', () => {
  const reale = readFileSync(new URL('../docs/TASKS.md', import.meta.url), 'utf8');

  it('ogni riga ha 7 colonne e un modello riconosciuto (o "già fatto")', () => {
    const righe = leggiTask(reale);
    expect(righe.length).toBeGreaterThanOrEqual(37);
    for (const r of righe) {
      expect(/^(già fatto|Fable 5\.1|Opus 5\.5|Sonnet 5|Haiku 4\.5|Fable 5\.1 \(piano\) → Opus 5\.5 \(codice\))$/.test(r.modello), `${r.id}: ${r.modello}`).toBe(true);
    }
  });

  it('oggi il prossimo task è T-000 con Fable 5.1', () => {
    expect(prossimoTask(reale, nessunPiano)).toMatchObject({ id: 'T-000', modello: 'Fable 5.1' });
  });
});
