import { describe, expect, it } from 'vitest';
import { validateActivity } from './activity';
import { followUpDraft, phaseLog, shownPhases } from './phases';
import { local, localDayKey } from './time';
import type { FaseTemplate } from './types';

const mattina: FaseTemplate[] = [
  { id: 'f-sveglia', etichetta: 'Sveglia', ordine: 1 },
  { id: 'f-skin', etichetta: 'Skin-care', ordine: 2 },
  { id: 'f-med', etichetta: 'Meditazione', ordine: 3 },
];

describe('Fasi a inversione — SCENARI B5', () => {
  it('conferma con «meditazione» saltata: 2 fatte + 1 saltata, nell’ordine del template', () => {
    expect(phaseLog(mattina, ['f-med'])).toEqual([
      { id: 'f-sveglia', etichetta: 'Sveglia', stato: 'fatta' },
      { id: 'f-skin', etichetta: 'Skin-care', stato: 'fatta' },
      { id: 'f-med', etichetta: 'Meditazione', stato: 'saltata' },
    ]);
  });
  it('senza toccare nulla il log ha 3 fatte, anche se il template arriva in disordine', () => {
    const disordine = [mattina[2]!, mattina[0]!, mattina[1]!];
    expect(phaseLog(disordine, []).map((f) => [f.id, f.stato])).toEqual([
      ['f-sveglia', 'fatta'],
      ['f-skin', 'fatta'],
      ['f-med', 'fatta'],
    ]);
  });
  it('rinominare «skin-care» in «viso» nel template non altera il log: il dettaglio chiuso mostra le etichette congelate', () => {
    const log = phaseLog(mattina, ['f-med']);
    const rinominato = mattina.map((f) => (f.id === 'f-skin' ? { ...f, etichetta: 'Viso' } : f));
    expect(shownPhases(rinominato, log).map((f) => f.etichetta)).toEqual(['Sveglia', 'Skin-care', 'Meditazione']);
    expect(shownPhases(rinominato, log)[2]).toMatchObject({ id: 'f-med', stato: 'saltata' });
  });
});

describe('Fasi — MECCANISMI §5', () => {
  it('senza log valgono il template corrente, in ordine, con stato nullo', () => {
    const disordine = [mattina[1]!, mattina[2]!, mattina[0]!];
    expect(shownPhases(disordine, null)).toEqual(
      mattina.map((f) => ({ id: f.id, etichetta: f.etichetta, stato: null })),
    );
  });
});

describe('Follow-up — SCENARI E1', () => {
  it('«Stampa analisi»: todo senza orario per oggi, orizzonte mese, valido per «+ Crea»', () => {
    const now = local(2026, 9, 24, 10, 30); // giovedì
    const bozza = followUpDraft('Stampa analisi', now);
    expect(bozza).toMatchObject({
      tipo: 'todo',
      titolo: 'Stampa analisi',
      giorno: localDayKey(now),
      orario: null,
      orizzonte: 'mese',
    });
    const v = validateActivity(bozza);
    expect(v.ok && v.blocco).toMatchObject({
      tipo: 'todo',
      conOrario: false,
      orizzonte: 'mese',
      inizio: local(2026, 9, 24, 12, 0),
    });
  });
});
