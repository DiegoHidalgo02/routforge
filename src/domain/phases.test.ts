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

describe('Follow-up — SCENARI E1 (scadenza del padre, D-DETT-2)', () => {
  // E1 e MECC §5 dicono «orizzonte mese»; l'utente (25/09/2026) ha deciso che il follow-up scade il giorno dell'evento,
  // mai prima di oggi: spec da allineare (D-DETT-2).
  const dentista = { inizio: local(2026, 9, 24, 10, 0) }; // giovedì
  it('«Stampa analisi»: todo senza orario nel giorno dell’evento, orizzonte giorno, valido per «+ Crea»', () => {
    const now = local(2026, 9, 24, 10, 30);
    const bozza = followUpDraft('Stampa analisi', dentista, now);
    expect(bozza).toMatchObject({
      tipo: 'todo',
      titolo: 'Stampa analisi',
      giorno: localDayKey(now),
      orario: null,
      orizzonte: 'giorno',
    });
    const v = validateActivity(bozza);
    expect(v.ok && v.blocco).toMatchObject({
      tipo: 'todo',
      conOrario: false,
      orizzonte: 'giorno',
      inizio: local(2026, 9, 24, 12, 0),
    });
  });
  it('evento completato sabato (concluso): il follow-up è per sabato, mai per un giorno passato', () => {
    const sabato = followUpDraft('Stampa analisi', dentista, local(2026, 9, 26, 18, 0));
    expect(sabato.tipo === 'todo' && sabato.giorno).toBe('2026-09-26');
  });
});
