import { describe, expect, it } from 'vitest';
import {
  GRADINI_DURATA,
  creationDays,
  editBlock,
  endsNextDay,
  recurrenceLastDay,
  recurrenceTerm,
  startDay,
  validateActivity,
  wallDuration,
  type BozzaAttivita,
} from './activity';
import { local } from './time';

type Bozza<T extends BozzaAttivita['tipo']> = Extract<BozzaAttivita, { tipo: T }>;
const auto = { modo: 'auto' } as const;
const todo = (x: Partial<Bozza<'todo'>> = {}): Bozza<'todo'> => ({
  tipo: 'todo',
  titolo: 'Spesa',
  note: '',
  promemoria: auto,
  giorno: '2026-09-22',
  orario: null,
  orizzonte: 'giorno',
  priorita: 'normale',
  checklist: [],
  corsoId: null,
  ...x,
});
const evento = (x: Partial<Bozza<'evento'>> = {}): Bozza<'evento'> => ({
  tipo: 'evento',
  titolo: 'Dentista',
  note: '',
  promemoria: auto,
  giorno: '2026-09-22',
  orario: { inizio: '15:00', fine: '16:00' },
  luogo: '',
  fasi: [],
  ...x,
});
const routine = (x: Partial<Bozza<'routine'>> = {}): Bozza<'routine'> => ({
  tipo: 'routine',
  titolo: 'Corsa',
  note: '',
  promemoria: auto,
  giorni: [1, 3, 5],
  inizio: '07:00',
  fine: '08:00',
  dataInizio: '2026-09-22',
  termine: null,
  fasi: [],
  ...x,
});
const studio = (x: Partial<Bozza<'studio'>> = {}): Bozza<'studio'> => ({
  tipo: 'studio',
  titolo: '',
  note: '',
  promemoria: auto,
  corsoId: null,
  giorni: [1],
  inizio: '09:00',
  fine: '10:00',
  dataInizio: '2026-09-22',
  termine: null,
  ...x,
});
const errori = (b: BozzaAttivita) => {
  const v = validateActivity(b);
  return v.ok ? [] : v.errori;
};

describe('Obbligatori — MECCANISMI §2', () => {
  it('titolo obbligatorio per todo, evento e routine; spazi = vuoto', () => {
    expect(errori(todo({ titolo: '  ' }))).toEqual(['titolo']);
    expect(errori(evento({ titolo: '' }))).toEqual(['titolo']);
    expect(errori(routine({ titolo: '' }))).toEqual(['titolo']);
  });

  it('routine e routine di studio: almeno un giorno', () => {
    expect(errori(routine({ giorni: [] }))).toEqual(['giorni']);
    expect(errori(studio({ giorni: [] }))).toEqual(['giorni']);
    expect(errori(studio({ giorni: [7] }))).toEqual(['giorni']);
  });

  it('routine di studio senza titolo → "Studio"; corso opzionale', () => {
    const v = validateActivity(studio());
    expect(v.ok && v.ricorrenza?.titolo).toBe('Studio');
    expect(v.ok && v.ricorrenza?.corsoId).toBeNull();
  });

  it('data e orari malformati sono errori', () => {
    expect(errori(todo({ giorno: '2026-02-31' }))).toEqual(['data']);
    expect(errori(todo({ orario: { inizio: '25:00', durata: 30 } }))).toEqual(['orario']);
    expect(errori(evento({ orario: { inizio: '15:00', fine: '9' } }))).toEqual(['orario']);
    expect(errori(routine({ dataInizio: 'oggi' }))).toEqual(['data']);
  });
});

describe('Todo — MECCANISMI §2, §1', () => {
  it('senza orario (default): ancora 12:00–23:59, priorità conservata, promemoria solo digest', () => {
    const v = validateActivity(
      todo({ priorita: 'alta', promemoria: { modo: 'personalizzato', anticipi: [{ minuti: 60, sveglia: true }] } }),
    );
    expect(v.ok && v.blocco).toMatchObject({
      tipo: 'todo',
      stato: 'programmato',
      inizio: local(2026, 9, 22, 12, 0),
      fine: local(2026, 9, 22, 23, 59),
      conOrario: false,
      orizzonte: 'giorno',
      priorita: 'alta',
      promemoria: { modo: 'auto' },
    });
  });

  it('con orario: fine = inizio + durata; la priorità (solo senza orario) si scarta', () => {
    const v = validateActivity(todo({ orario: { inizio: '18:00', durata: 30 }, priorita: 'alta' }));
    expect(v.ok && v.blocco).toMatchObject({
      inizio: local(2026, 9, 22, 18, 0),
      fine: local(2026, 9, 22, 18, 30),
      conOrario: true,
    });
    expect(v.ok && v.blocco && 'priorita' in v.blocco).toBe(false);
  });

  it('durata solo tra i gradini da 5 a 240 minuti', () => {
    expect(GRADINI_DURATA).toEqual([5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 210, 240]);
    for (const durata of GRADINI_DURATA) expect(errori(todo({ orario: { inizio: '08:00', durata } }))).toEqual([]);
    for (const durata of [0, 35, 241])
      expect(errori(todo({ orario: { inizio: '08:00', durata } }))).toEqual(['durata']);
  });

  it('orizzonte giorno / settimana / mese conservato', () => {
    for (const orizzonte of ['giorno', 'settimana', 'mese'] as const) {
      const v = validateActivity(todo({ orizzonte }));
      expect(v.ok && v.blocco?.orizzonte).toBe(orizzonte);
    }
  });
});

describe('Checklist — MECCANISMI §4', () => {
  it('voci vuote scartate, le altre nascono non spuntate', () => {
    const v = validateActivity(todo({ checklist: [' Passaporto ', '', '  ', 'Medicine'] }));
    expect(v.ok && v.blocco?.checklist).toEqual([
      { testo: 'Passaporto', fatta: false },
      { testo: 'Medicine', fatta: false },
    ]);
  });

  it('massimo 60 voci da 120 caratteri', () => {
    const voci = (n: number) => Array.from({ length: n }, (_, i) => `v${i}`);
    expect(errori(todo({ checklist: voci(60) }))).toEqual([]);
    expect(errori(todo({ checklist: voci(61) }))).toEqual(['checklist_voci']);
    expect(errori(todo({ checklist: ['x'.repeat(120)] }))).toEqual([]);
    expect(errori(todo({ checklist: ['x'.repeat(121)] }))).toEqual(['checklist_testo']);
  });
});

describe('Evento — MECCANISMI §2, §1', () => {
  it('tutto il giorno: ancora 00:00–23:59', () => {
    const v = validateActivity(evento({ orario: null, luogo: ' Studio Rossi ' }));
    expect(v.ok && v.blocco).toMatchObject({
      inizio: local(2026, 9, 22, 0, 0),
      fine: local(2026, 9, 22, 23, 59),
      conOrario: false,
      luogo: 'Studio Rossi',
    });
  });

  it('fine ≤ inizio è un errore (S4 Crea, D-DESIGN-1 n. 19)', () => {
    expect(errori(evento({ orario: { inizio: '22:00', fine: '01:00' } }))).toEqual(['fine']);
    expect(errori(evento({ orario: { inizio: '10:00', fine: '10:00' } }))).toEqual(['fine']);
  });

  it('fasi: etichette pulite, in ordine', () => {
    const v = validateActivity(evento({ fasi: ['Stampare le analisi', ' ', 'Portare i documenti'] }));
    expect(v.ok && v.fasi).toEqual([{ etichetta: 'Stampare le analisi' }, { etichetta: 'Portare i documenti' }]);
  });
});

describe('Routine e routine di studio — MECCANISMI §2, §7', () => {
  it('definizione: giorni ordinati, orari di parete, fine assente = mai', () => {
    const v = validateActivity(routine({ giorni: [5, 1, 3, 1] }));
    expect(v.ok && v.ricorrenza).toEqual({
      tipo: 'routine',
      titolo: 'Corsa',
      note: '',
      giorni: [1, 3, 5],
      orarioInizio: '07:00',
      orarioFine: '08:00',
      dataInizio: '2026-09-22',
      dataFine: null,
      dateSaltate: [],
      corsoId: null,
      promemoria: { modo: 'auto' },
    });
  });

  it('senza durata solo per la routine; fine ≤ inizio resta alla generazione (giorno dopo)', () => {
    const v = validateActivity(routine({ fine: null, fasi: ['Sveglia', 'Meditazione'] }));
    expect(v.ok && v.ricorrenza?.orarioFine).toBeNull();
    expect(v.ok && v.fasi).toEqual([{ etichetta: 'Sveglia' }, { etichetta: 'Meditazione' }]);
    expect(errori(studio({ inizio: '23:00', fine: '01:00' }))).toEqual([]);
  });

  it('fine dopo N giorni / settimane / mesi: ultimo giorno incluso (D-CREA-1)', () => {
    expect(recurrenceLastDay('2026-09-22', { n: 1, unita: 'giorni' })).toBe('2026-09-22');
    expect(recurrenceLastDay('2026-09-22', { n: 4, unita: 'settimane' })).toBe('2026-10-19');
    expect(recurrenceLastDay('2026-01-31', { n: 1, unita: 'mesi' })).toBe('2026-02-27');
    expect(recurrenceLastDay('2026-10-01', { n: 1, unita: 'mesi' })).toBe('2026-10-31');
    const v = validateActivity(routine({ termine: { n: 2, unita: 'settimane' } }));
    expect(v.ok && v.ricorrenza?.dataFine).toBe('2026-10-05');
    expect(errori(routine({ termine: { n: 0, unita: 'giorni' } }))).toEqual(['termine']);
  });
});

describe('Durata di parete — MECCANISMI §2, §7', () => {
  it('fine ≤ inizio ⇒ il giorno dopo', () => {
    expect(wallDuration('07:00', '08:30')).toBe(90);
    expect(wallDuration('23:00', '01:00')).toBe(120);
    expect(wallDuration('09:00', '09:00')).toBe(24 * 60);
    expect(wallDuration('9', '10:00')).toBeNull();
  });
});

describe('Promemoria — MECCANISMI §2, §13.1', () => {
  const personalizzato = (anticipi: { minuti: number; sveglia: boolean }[]) =>
    ({ modo: 'personalizzato', anticipi }) as const;

  it('Auto, Off e Personalizzato con più anticipi fino a 31 giorni', () => {
    expect(errori(evento({ promemoria: { modo: 'off' } }))).toEqual([]);
    const p = personalizzato([
      { minuti: 1440, sveglia: false },
      { minuti: 0, sveglia: true },
      { minuti: 31 * 24 * 60, sveglia: false },
    ]);
    const v = validateActivity(routine({ promemoria: p }));
    expect(v.ok && v.ricorrenza?.promemoria).toEqual(p);
    expect(errori(evento({ promemoria: personalizzato([{ minuti: 31 * 24 * 60 + 1, sveglia: false }]) }))).toEqual([
      'anticipo',
    ]);
  });

  it('sveglia a schermo intero solo per anticipi ≤ 7 h', () => {
    expect(errori(evento({ promemoria: personalizzato([{ minuti: 7 * 60, sveglia: true }]) }))).toEqual([]);
    expect(errori(evento({ promemoria: personalizzato([{ minuti: 7 * 60 + 1, sveglia: true }]) }))).toEqual([
      'sveglia',
    ]);
  });

  it('evento tutto il giorno: avviso alle 08:00, gli anticipi non valgono → Auto; Off resta Off (§13.2, D-CREA-1)', () => {
    const v = validateActivity(evento({ orario: null, promemoria: personalizzato([{ minuti: 60, sveglia: true }]) }));
    expect(v.ok && v.blocco?.promemoria).toEqual({ modo: 'auto' });
    const off = validateActivity(evento({ orario: null, promemoria: { modo: 'off' } }));
    expect(off.ok && off.blocco?.promemoria).toEqual({ modo: 'off' });
  });

  it('un anticipo è o notifica o sveglia: ripetuto conta una volta', () => {
    const v = validateActivity(
      todo({
        orario: { inizio: '18:00', durata: 30 },
        promemoria: personalizzato([
          { minuti: 60, sveglia: false },
          { minuti: 60, sveglia: true },
        ]),
      }),
    );
    expect(v.ok && v.blocco?.promemoria).toEqual(personalizzato([{ minuti: 60, sveglia: true }]));
  });

  it('anticipi negativi o non interi e sveglie oltre 7 h anche sui todo con orario', () => {
    const conOrario = { inizio: '18:00', durata: 30 };
    expect(errori(todo({ orario: conOrario, promemoria: personalizzato([{ minuti: -5, sveglia: false }]) }))).toEqual([
      'anticipo',
    ]);
    expect(errori(todo({ orario: conOrario, promemoria: personalizzato([{ minuti: 2.5, sveglia: false }]) }))).toEqual([
      'anticipo',
    ]);
    expect(errori(todo({ orario: conOrario, promemoria: personalizzato([{ minuti: 480, sveglia: true }]) }))).toEqual([
      'sveglia',
    ]);
  });
});

describe('Casi limite — MECCANISMI §2, §7', () => {
  it('todo alle 23:50 da 30 minuti finisce il giorno dopo', () => {
    const v = validateActivity(todo({ orario: { inizio: '23:50', durata: 30 } }));
    expect(v.ok && v.blocco?.fine).toBe(local(2026, 9, 23, 0, 20));
  });

  it('date inesistenti e fine malformata sono errori', () => {
    expect(errori(evento({ giorno: '2026-02-31' }))).toEqual(['data']);
    expect(errori(routine({ dataInizio: '2026-02-31' }))).toEqual(['data']);
    expect(errori(routine({ fine: '8' }))).toEqual(['orario']);
    expect(errori(routine({ termine: { n: 1.5, unita: 'mesi' } }))).toEqual(['termine']);
  });

  it('fine ricorrenza in anno bisestile e a cavallo del cambio d’ora', () => {
    expect(recurrenceLastDay('2028-01-31', { n: 1, unita: 'mesi' })).toBe('2028-02-28');
    expect(recurrenceLastDay('2026-10-20', { n: 1, unita: 'settimane' })).toBe('2026-10-26');
  });

  it('endsNextDay: fine ≤ inizio', () => {
    expect(endsNextDay('23:00', '01:00')).toBe(true);
    expect(endsNextDay('09:00', '09:00')).toBe(true);
    expect(endsNextDay('09:00', '10:00')).toBe(false);
    expect(endsNextDay('9', '10:00')).toBe(false);
  });
});

describe('Crea dal giorno selezionato — SCENARI G5', () => {
  // Oggi è mercoledì 23 settembre 2026: da Crea si parte fra il 23 e il 29
  it('il foglio parte dal giorno selezionato in Oggi se cade fra oggi e oggi + 6 (venerdì 25, lunedì 28)', () => {
    expect(creationDays('2026-09-23')).toEqual(['2026-09-23', '2026-09-29']);
    expect(startDay('2026-09-25', '2026-09-23')).toBe('2026-09-25');
    expect(startDay('2026-09-28', '2026-09-23')).toBe('2026-09-28');
    expect(startDay('2026-09-29', '2026-09-23')).toBe('2026-09-29');
  });
  it('con un giorno già passato, oltre il 29, nessuno o non valido, parte da oggi', () => {
    for (const g of ['2026-09-22', '2026-09-30', null, '2026-02-30'])
      expect(startDay(g, '2026-09-23')).toBe('2026-09-23');
  });
});

describe('Modifica — MECCANISMI §4, §5, §6, SCENARI A3, B5', () => {
  const blocco = (b: BozzaAttivita) => {
    const v = validateActivity(b);
    if (!v.ok || !v.blocco) throw new Error('bozza');
    return v.blocco;
  };
  const NOW = local(2026, 9, 22, 9, 0);

  it('A3: le voci tengono la spunta che portano dal form, anche uguali o rinominate; la lista non tocca lo stato', () => {
    const prima = {
      ...blocco(todo({ checklist: ['x', 'x'] })),
      id: 'v',
      stato: 'completato' as const,
      checklist: [
        { testo: 'x', fatta: true },
        { testo: 'x', fatta: false },
      ],
      corsoId: 'c1',
      ritardoIl: NOW,
    };
    const stessa = editBlock(prima, blocco(todo({ checklist: prima.checklist })), [], NOW);
    expect(stessa.checklist).toEqual(prima.checklist);
    const dopo = editBlock(
      prima,
      blocco(todo({ titolo: 'Valigia', checklist: [{ testo: 'Passaporto', fatta: true }, ' ', 'Cuffie'] })),
      [],
      NOW,
    );
    expect(dopo).toMatchObject({ id: 'v', titolo: 'Valigia', stato: 'completato', ritardoIl: NOW, corsoId: 'c1' });
    expect(dopo.checklist).toEqual([
      { testo: 'Passaporto', fatta: true },
      { testo: 'Cuffie', fatta: false },
    ]);
    expect(editBlock(prima, blocco(todo({ checklist: [] })), [], NOW).stato).toBe('completato');
  });

  it('D-HOR-1, §6: orario cambiato o tolto → via l’orario originale; giorno, priorità o orario tolto → in fondo al gruppo', () => {
    const conOrario = {
      ...blocco(todo({ orario: { inizio: '18:00', durata: 30 } })),
      id: 't',
      orarioOriginale: '17:00',
    };
    const alle = (inizio: string) => blocco(todo({ orario: { inizio, durata: 30 } }));
    expect(editBlock(conOrario, alle('18:00'), [], NOW).orarioOriginale).toBe('17:00');
    expect(editBlock(conOrario, alle('19:00'), [], NOW).orarioOriginale).toBeNull();
    const aMezzogiorno = { ...alle('12:00'), id: 'm', orarioOriginale: '11:00' };
    expect(editBlock(aMezzogiorno, blocco(todo()), [], NOW)).toMatchObject({ orarioOriginale: null, ordine: NOW });
    const senza = { ...blocco(todo()), id: 's', ordine: 5 };
    expect(editBlock(senza, blocco(todo({ titolo: 'Latte' })), [], NOW).ordine).toBe(5);
    expect(editBlock(senza, blocco(todo({ priorita: 'alta' })), [], NOW).ordine).toBe(NOW);
    expect(editBlock(senza, blocco(todo({ giorno: '2026-09-23' })), [], NOW).ordine).toBe(NOW);
  });

  it('B5: la fase tiene l’id che porta dal form; le righe vuote spariscono con il loro id', () => {
    const v = validateActivity(
      evento({ fasi: [{ testo: 'Analisi del sangue', id: 'a' }, { testo: ' ', id: 'b' }, 'Ricetta'] }),
    );
    expect(v.ok && v.fasi).toEqual([{ etichetta: 'Analisi del sangue', id: 'a' }, { etichetta: 'Ricetta' }]);
  });

  it('il termine torna dalla fine della definizione e ridà la stessa fine (D-CREA-1)', () => {
    for (const inizio of ['2026-01-31', '2028-02-29', '2026-09-22'])
      for (const unita of ['giorni', 'settimane', 'mesi'] as const)
        for (const n of [1, 2, 4, 8, 12]) {
          const fine = recurrenceLastDay(inizio, { n, unita });
          const termine = recurrenceTerm(inizio, fine);
          expect(termine && recurrenceLastDay(inizio, termine)).toBe(fine);
        }
    expect(recurrenceTerm('2026-09-22', recurrenceLastDay('2026-09-22', { n: 4, unita: 'settimane' }))).toEqual({
      n: 4,
      unita: 'settimane',
    });
    expect(recurrenceTerm('2026-09-22', null)).toBeNull();
    expect(recurrenceTerm('2026-09-22', '2026-09-01')).toBeNull();
  });
});
