// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type RoutForgeDb, type Tabelle } from '../data/db';
import { get, list, save, saveBlock } from '../data/repository';
import type { BozzaAttivita } from '../domain/activity';
import { occurrenceId } from '../domain/scheduler/occurrences';
import { local, localDayKey } from '../domain/time';
import { createActivity } from './activities';
import {
  checkFromCalendar,
  completeBlock,
  completeWithLeftover,
  createFollowUps,
  deleteBlock,
  readDetail,
  reopenBlock,
  restoreBlock,
  skipBlock,
  toggleChecklist,
} from './completion';
import { editRecurrence, generateOccurrences } from './recurrences';

const FUSO = 'Europe/Rome';
/** Mercoledì 23 settembre 2026 alle 08:00. */
const NOW = local(2026, 9, 23, 8, 0);
const comune = { note: '', promemoria: { modo: 'auto' } } as const;

const todoValigia = (checklist = ['Passaporto', 'Caricabatterie', 'Medicine']): BozzaAttivita => ({
  ...comune,
  tipo: 'todo',
  titolo: 'Prepara la valigia',
  giorno: '2026-09-23',
  orario: null,
  orizzonte: 'giorno',
  priorita: 'normale',
  checklist,
  corsoId: null,
});
/** «Mattina», ogni giorno alle 07:00–08:00 (B5). */
const routineMattina = (fasi = ['Sveglia', 'Skin-care', 'Meditazione']): BozzaAttivita => ({
  ...comune,
  tipo: 'routine',
  titolo: 'Mattina',
  giorni: [0, 1, 2, 3, 4, 5, 6],
  inizio: '07:00',
  fine: '08:00',
  dataInizio: '2026-09-23',
  termine: null,
  fasi,
});
/** «Dentista», giovedì 24 alle 10:00 (E1). */
const eventoDentista = (fasi = ['Stampare le analisi', 'Portare i documenti']): BozzaAttivita => ({
  ...comune,
  tipo: 'evento',
  titolo: 'Dentista',
  giorno: '2026-09-24',
  orario: { inizio: '10:00', fine: '11:00' },
  luogo: '',
  fasi,
});

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-completamento-${++n}`);
});
afterEach(() => db.delete());

async function crea(bozza: BozzaAttivita): Promise<string> {
  const r = await createActivity(db, bozza, NOW, FUSO);
  if (!r.ok) throw new Error(r.errori.join());
  return r.id;
}
const blocco = async (id: string) => (await get(db, 'blocchi', id))!;
const log = async (id: string) => (await get(db, 'logFasi', id))?.fasi.map((f) => [f.etichetta, f.stato]);
const oggi = (ricorrenzaId: string) => occurrenceId(ricorrenzaId, '2026-09-23', '07:00');
const fatte = (b: Tabelle['blocchi']) => b.checklist?.filter((v) => v.fatta).length;

describe('Checklist che completa il todo — SCENARI A3 (servizio)', () => {
  it('due voci su tre non completano (2/3); la terza completa; togliere una spunta riapre e conserva le altre', async () => {
    const id = await crea(todoValigia());
    await toggleChecklist(db, id, 0, NOW, FUSO);
    await toggleChecklist(db, id, 1, local(2026, 9, 23, 8, 1), FUSO);
    let b = await blocco(id);
    expect([b.stato, fatte(b)]).toEqual(['programmato', 2]);

    const alle802 = local(2026, 9, 23, 8, 2);
    await toggleChecklist(db, id, 2, alle802, FUSO);
    b = await blocco(id);
    expect(b).toMatchObject({ stato: 'completato', chiusoIl: alle802 });

    await toggleChecklist(db, id, 1, local(2026, 9, 23, 8, 3), FUSO);
    b = await blocco(id);
    expect(b).toMatchObject({ stato: 'programmato', chiusoIl: null });
    expect(b.checklist?.map((v) => v.fatta)).toEqual([true, false, true]);
  });
});

describe('Spunta diretta e riapertura del todo — MECCANISMI §3, §4 (servizio, S5)', () => {
  it('«Segna come fatto» completa e spunta tutte le voci; «Riapri» torna programmato e le azzera', async () => {
    const id = await crea(todoValigia());
    expect(await completeBlock(db, id, NOW, FUSO)).toBe(true);
    let b = await blocco(id);
    expect(b).toMatchObject({ stato: 'completato', chiusoIl: NOW });
    expect(fatte(b)).toBe(3);

    await reopenBlock(db, id, local(2026, 9, 23, 8, 5), FUSO);
    b = await blocco(id);
    expect(b).toMatchObject({ stato: 'programmato', chiusoIl: null });
    expect(fatte(b)).toBe(0);
  });
  it('un todo «non fatto» (perso) si spunta comunque, da qualsiasi giorno, e la marcatura si azzera', async () => {
    const id = await crea(todoValigia([]));
    const perso = local(2026, 9, 24, 0, 30);
    await saveBlock(db, { ...(await blocco(id)), stato: 'perso', persoIl: perso }, perso, FUSO);
    const venerdi = local(2026, 9, 25, 9, 0);
    expect(await completeBlock(db, id, venerdi, FUSO)).toBe(true);
    expect(await blocco(id)).toMatchObject({ stato: 'completato', chiusoIl: venerdi, persoIl: null });
  });
});

describe('Spunta diretta dal cerchio della card — MECCANISMI §3, §24, SCENARI A3, B2, B5, C10 (servizio, D-DETT-3)', () => {
  it('todo senza voci e routine senza fasi nel loro giorno: completati subito, con la stessa scrittura del dettaglio', async () => {
    const todo = await crea(todoValigia([]));
    expect(await checkFromCalendar(db, todo, NOW, FUSO)).toBe('completa');
    expect(await blocco(todo)).toMatchObject({ stato: 'completato', chiusoIl: NOW });

    const routine = oggi(await crea(routineMattina([])));
    expect(await checkFromCalendar(db, routine, NOW, FUSO)).toBe('completa');
    expect(await blocco(routine)).toMatchObject({ stato: 'completato', chiusoIl: NOW });
    expect(await log(routine)).toBeUndefined();
  });
  it('routine con fasi (B5) e todo con 2 voci su 3 (A3): nessuna scrittura, si apre la sheet del dettaglio', async () => {
    const routine = oggi(await crea(routineMattina()));
    const todo = await crea(todoValigia());
    await toggleChecklist(db, todo, 0, NOW, FUSO);
    await toggleChecklist(db, todo, 1, NOW, FUSO);
    const [primaRoutine, primaTodo] = [await blocco(routine), await blocco(todo)];

    expect(await checkFromCalendar(db, routine, NOW, FUSO)).toBe('revisione');
    expect(await checkFromCalendar(db, todo, NOW, FUSO)).toBe('residuo');
    expect(await blocco(routine)).toEqual(primaRoutine);
    expect(await blocco(todo)).toEqual(primaTodo);
    expect(await log(routine)).toBeUndefined();
  });
  it('routine fuori dal giorno previsto (B2), id sconosciuto: nessuna spunta diretta e nessuna scrittura', async () => {
    const routine = oggi(await crea(routineMattina([])));
    const giovedi = local(2026, 9, 24, 9, 0);
    expect(await checkFromCalendar(db, routine, giovedi, FUSO)).toBeNull();
    expect(await checkFromCalendar(db, 'nessuno', giovedi, FUSO)).toBeNull();
    expect((await blocco(routine)).stato).toBe('programmato');
  });
  it('evento senza fasi: «Completa evento» dal cerchio, da qualsiasi giorno; con le fasi la revisione (§3)', async () => {
    const evento = await crea(eventoDentista([]));
    expect(await checkFromCalendar(db, evento, NOW, FUSO)).toBe('completa');
    expect(await blocco(evento)).toMatchObject({ stato: 'completato', chiusoIl: NOW });
    const conFasi = await crea(eventoDentista());
    expect(await checkFromCalendar(db, conFasi, NOW, FUSO)).toBe('revisione');
    expect((await blocco(conFasi)).stato).toBe('programmato');
  });
  it('studio di oggi 09:00–10:00 alle 10:20, senza sessione: si apre «Registra esito», nessuna scrittura (C10)', async () => {
    const { id } = await saveBlock(
      db,
      {
        tipo: 'studio',
        stato: 'programmato',
        conOrario: true,
        inizio: local(2026, 9, 23, 9, 0),
        fine: local(2026, 9, 23, 10, 0),
      },
      NOW,
      FUSO,
    );
    const prima = await blocco(id);
    expect(await checkFromCalendar(db, id, local(2026, 9, 23, 10, 20), FUSO)).toBe('esito');
    expect(await blocco(id)).toEqual(prima);
  });
  it('lo stesso studio con l’unità proposta dal puntatore: dal cerchio si apre «Registra esito» (C10, audit P1-1)', async () => {
    await save(db, 'moduli', { id: 'm1', corsoId: 'c1', numero: 1, titolo: 'Tooling' } as never, NOW);
    const unita = { id: 'u1', corsoId: 'c1', moduloId: 'm1', numero: '1.1', titolo: 'Vite', stato: 'non_iniziata' };
    await save(db, 'unita', unita as never, NOW);
    const { id } = await saveBlock(
      db,
      {
        tipo: 'studio',
        stato: 'programmato',
        conOrario: true,
        inizio: local(2026, 9, 23, 9, 0),
        fine: local(2026, 9, 23, 10, 0),
        corsoId: 'c1',
        unitaId: 'u1',
      },
      NOW,
      FUSO,
    );
    expect(await checkFromCalendar(db, id, local(2026, 9, 23, 10, 20), FUSO)).toBe('esito');
  });
  it('routine persa nel suo giorno (§24 contro B2, 00_SINTESI §6 n. 26): niente dal cerchio, «Fatta» dal dettaglio', async () => {
    const id = oggi(await crea(routineMattina([])));
    const alle830 = local(2026, 9, 23, 8, 30);
    await saveBlock(db, { ...(await blocco(id)), stato: 'perso', persoIl: alle830 }, alle830, FUSO);
    const persa = await blocco(id);
    const alle9 = local(2026, 9, 23, 9, 0);
    expect(await checkFromCalendar(db, id, alle9, FUSO)).toBeNull();
    expect(await blocco(id)).toEqual(persa);
    expect(await completeBlock(db, id, alle9, FUSO)).toBe(true);
  });
  it('todo completato: niente; todo «non fatto» senza voci: completato con la marcatura azzerata (§3, §8)', async () => {
    const fatto = await crea(todoValigia([]));
    await completeBlock(db, fatto, NOW, FUSO);
    expect(await checkFromCalendar(db, fatto, local(2026, 9, 23, 9, 0), FUSO)).toBeNull();
    expect((await blocco(fatto)).chiusoIl).toBe(NOW);

    const perso = await crea(todoValigia([]));
    const mezzanotte = local(2026, 9, 24, 0, 30);
    await saveBlock(db, { ...(await blocco(perso)), stato: 'perso', persoIl: mezzanotte }, mezzanotte, FUSO);
    const venerdi = local(2026, 9, 25, 9, 0);
    expect(await checkFromCalendar(db, perso, venerdi, FUSO)).toBe('completa');
    expect(await blocco(perso)).toMatchObject({ stato: 'completato', chiusoIl: venerdi, persoIl: null });
  });
  it('routine saltata e blocco di studio: nessuna spunta diretta', async () => {
    const routine = oggi(await crea(routineMattina([])));
    await skipBlock(db, routine, local(2026, 9, 23, 7, 30), FUSO);
    const studio = await saveBlock(
      db,
      {
        tipo: 'studio',
        stato: 'programmato',
        conOrario: true,
        inizio: local(2026, 9, 23, 16, 0),
        fine: local(2026, 9, 23, 17, 0),
      },
      NOW,
      FUSO,
    );
    expect(await checkFromCalendar(db, routine, NOW, FUSO)).toBeNull();
    expect(await checkFromCalendar(db, studio.id, NOW, FUSO)).toBeNull();
    expect((await blocco(studio.id)).stato).toBe('programmato');
  });
  it('voci rimaste su un todo già completato (sheet rimasta aperta): nessun secondo todo derivato', async () => {
    const id = await crea(todoValigia());
    await toggleChecklist(db, id, 0, NOW, FUSO);
    expect(await completeWithLeftover(db, id, local(2026, 9, 23, 9, 0), FUSO)).not.toBeNull();
    expect(await completeWithLeftover(db, id, local(2026, 9, 23, 9, 5), FUSO)).toBeNull();
    expect(await list(db, 'blocchi')).toHaveLength(2);
  });
});

describe('Spunta solo nel giorno previsto — SCENARI B2 (servizio)', () => {
  it('martedì e giovedì la spunta non scrive nulla; mercoledì alle 00:00 completa', async () => {
    const id = oggi(await crea(routineMattina([])));
    const prima = await blocco(id);
    expect(await completeBlock(db, id, local(2026, 9, 22, 23, 0), FUSO)).toBe(false);
    expect(await completeBlock(db, id, local(2026, 9, 24, 0, 0), FUSO)).toBe(false);
    expect(await blocco(id)).toEqual(prima);
    expect(await completeBlock(db, id, local(2026, 9, 23, 0, 0), FUSO)).toBe(true);
    expect(await blocco(id)).toMatchObject({ stato: 'completato', chiusoIl: local(2026, 9, 23, 0, 0) });
  });
});

describe('Fasi a inversione — SCENARI B5 (servizio)', () => {
  it('conferma con «meditazione» saltata: completata, log 2 fatte + 1 saltata; annulla → il log sparisce; riconferma → 3 fatte, un solo log', async () => {
    const rid = await crea(routineMattina());
    const r = (await get(db, 'ricorrenze', rid))!;
    const meditazione = r.fasi.find((f) => f.etichetta === 'Meditazione')!.id;
    const id = oggi(rid);

    expect(await completeBlock(db, id, NOW, FUSO, [meditazione])).toBe(true);
    expect(await blocco(id)).toMatchObject({ stato: 'completato', chiusoIl: NOW });
    expect(await log(id)).toEqual([
      ['Sveglia', 'fatta'],
      ['Skin-care', 'fatta'],
      ['Meditazione', 'saltata'],
    ]);

    await reopenBlock(db, id, local(2026, 9, 23, 8, 1), FUSO);
    expect(await blocco(id)).toMatchObject({ stato: 'programmato', chiusoIl: null });
    expect(await log(id)).toBeUndefined();

    await completeBlock(db, id, local(2026, 9, 23, 8, 2), FUSO);
    expect((await log(id))?.map(([, stato]) => stato)).toEqual(['fatta', 'fatta', 'fatta']);
    expect(await list(db, 'logFasi')).toHaveLength(1);
  });
  it('rinominare «skin-care» in «viso» nel template non altera il log; il dettaglio chiuso mostra le etichette congelate', async () => {
    const rid = await crea(routineMattina());
    const r = (await get(db, 'ricorrenze', rid))!;
    const id = oggi(rid);
    await completeBlock(db, id, NOW, FUSO, [r.fasi[2]!.id]);

    const fasi = r.fasi.map((f) => (f.etichetta === 'Skin-care' ? { ...f, etichetta: 'Viso' } : f));
    await editRecurrence(db, { ...r, fasi }, local(2026, 9, 23, 9, 0), FUSO);

    const d = (await readDetail(db, id))!;
    expect(d.fasi.map((f) => f.etichetta)).toEqual(['Sveglia', 'Viso', 'Meditazione']);
    expect(d.log?.map((f) => f.etichetta)).toEqual(['Sveglia', 'Skin-care', 'Meditazione']);
  });
  it('«Saltata» chiude l’occorrenza senza log (FUNZ §4.3), solo nel giorno previsto', async () => {
    const id = oggi(await crea(routineMattina()));
    expect(await skipBlock(db, id, local(2026, 9, 24, 7, 0), FUSO)).toBe(false);
    const alle712 = local(2026, 9, 23, 7, 12);
    expect(await skipBlock(db, id, alle712, FUSO)).toBe(true);
    expect(await blocco(id)).toMatchObject({ stato: 'saltato', chiusoIl: alle712 });
    expect(await log(id)).toBeUndefined();
  });
  it('una routine già persa nel suo giorno si può ancora segnare «Saltata» (FUNZ §4.3, B2): la marcatura si azzera', async () => {
    const id = oggi(await crea(routineMattina()));
    const alle830 = local(2026, 9, 23, 8, 30);
    await saveBlock(db, { ...(await blocco(id)), stato: 'perso', persoIl: alle830 }, alle830, FUSO);
    expect(await skipBlock(db, id, local(2026, 9, 23, 9, 0), FUSO)).toBe(true);
    expect(await blocco(id)).toMatchObject({ stato: 'saltato', persoIl: null });
    expect(await skipBlock(db, id, local(2026, 9, 23, 9, 1), FUSO)).toBe(true);
  });
});

describe('Segna come fatto con voci rimaste — D-DETT-2 (servizio)', () => {
  it('completa il todo lasciando le voci com’erano e crea un todo con le voci rimaste: stesso titolo, priorità, orizzonte e giorno', async () => {
    const id = await crea(todoValigia());
    await toggleChecklist(db, id, 0, NOW, FUSO);
    const alle9 = local(2026, 9, 23, 9, 0);
    const nuovo = await completeWithLeftover(db, id, alle9, FUSO);
    const padre = await blocco(id);
    expect(padre).toMatchObject({ stato: 'completato', chiusoIl: alle9 });
    expect(padre.checklist?.map((v) => v.fatta)).toEqual([true, false, false]);
    expect(nuovo).not.toBeNull();
    expect(await blocco(nuovo!)).toMatchObject({
      tipo: 'todo',
      stato: 'programmato',
      titolo: 'Prepara la valigia',
      priorita: 'normale',
      orizzonte: 'giorno',
      giornoLocale: '2026-09-23',
      conOrario: false,
      checklist: [
        { testo: 'Caricabatterie', fatta: false },
        { testo: 'Medicine', fatta: false },
      ],
    });
  });
  it('senza voci rimaste non crea nulla e non completa: il chiamante usa la spunta normale', async () => {
    const id = await crea(todoValigia(['Passaporto']));
    await toggleChecklist(db, id, 0, NOW, FUSO); // completa il todo (A3)
    await reopenBlock(db, id, local(2026, 9, 23, 8, 1), FUSO);
    await toggleChecklist(db, id, 0, local(2026, 9, 23, 8, 2), FUSO);
    expect(await completeWithLeftover(db, id, local(2026, 9, 23, 8, 3), FUSO)).toBeNull();
    expect(await list(db, 'blocchi')).toHaveLength(1);
  });
});

describe('Checklist su un todo «non fatto» — MECCANISMI §4, §6 (servizio)', () => {
  it('spuntare l’ultima voce di un todo perso lo completa e azzera la marcatura', async () => {
    const id = await crea(todoValigia(['Passaporto']));
    const perso = local(2026, 9, 24, 0, 30);
    await saveBlock(db, { ...(await blocco(id)), stato: 'perso', persoIl: perso }, perso, FUSO);
    const venerdi = local(2026, 9, 25, 9, 0);
    await toggleChecklist(db, id, 0, venerdi, FUSO);
    expect(await blocco(id)).toMatchObject({ stato: 'completato', chiusoIl: venerdi, persoIl: null });
  });
});

describe('Evento con fasi e follow-up — SCENARI E1 (servizio)', () => {
  it('«Completa evento» con «stampare le analisi» saltata e follow-up «Stampa analisi»: evento completato, log 1 fatta + 1 saltata, todo senza orario per oggi con orizzonte mese', async () => {
    const id = await crea(eventoDentista());
    const stampare = (await blocco(id)).fasi!.find((f) => f.etichetta === 'Stampare le analisi')!.id;
    const giovedi = local(2026, 9, 24, 11, 5);

    expect(await completeBlock(db, id, giovedi, FUSO, [stampare])).toBe(true);
    expect(await blocco(id)).toMatchObject({ stato: 'completato', chiusoIl: giovedi });
    expect(await log(id)).toEqual([
      ['Stampare le analisi', 'saltata'],
      ['Portare i documenti', 'fatta'],
    ]);

    // Titolo = nome della fase (S5, D-DETT-1); scade il giorno dell'evento, orizzonte giorno (D-DETT-2; E1 allineato).
    const [todoId] = await createFollowUps(db, id, ['Stampare le analisi'], giovedi, FUSO);
    expect(await blocco(todoId!)).toMatchObject({
      tipo: 'todo',
      stato: 'programmato',
      titolo: 'Stampare le analisi',
      conOrario: false,
      orizzonte: 'giorno',
      giornoLocale: localDayKey(giovedi),
      orarioInizio: '12:00',
    });
    expect(await createFollowUps(db, 'nessuno', ['x'], giovedi, FUSO)).toEqual([]);
  });
  it('un evento senza fasi si chiude senza log e senza vincolo di giorno (anche «concluso», SCENARI E2)', async () => {
    const id = await crea(eventoDentista([]));
    const sabato = local(2026, 9, 26, 18, 0);
    expect(await completeBlock(db, id, sabato, FUSO)).toBe(true);
    expect(await blocco(id)).toMatchObject({ stato: 'completato', chiusoIl: sabato });
    expect(await log(id)).toBeUndefined();
  });
});

describe('Dettaglio — MECC §5 (servizio: template dalla definizione o dal blocco)', () => {
  it('routine: fasi della definizione; evento: fasi del blocco; id sconosciuto: niente', async () => {
    const rid = await crea(routineMattina());
    expect((await readDetail(db, oggi(rid)))?.fasi.map((f) => f.etichetta)).toEqual([
      'Sveglia',
      'Skin-care',
      'Meditazione',
    ]);
    const evento = await crea(eventoDentista());
    const d = (await readDetail(db, evento))!;
    expect(d.fasi.map((f) => f.etichetta)).toEqual(['Stampare le analisi', 'Portare i documenti']);
    expect(d.log).toBeNull();
    expect(await readDetail(db, 'nessuno')).toBeUndefined();
  });
});

describe('Elimina dal dettaglio — MECC §5, D-OCC-1 (servizio)', () => {
  it('evento: tombstone del blocco e del suo log; «Annulla» li ripristina', async () => {
    const id = await crea(eventoDentista());
    await completeBlock(db, id, local(2026, 9, 24, 11, 0), FUSO, [(await blocco(id)).fasi![0]!.id]);
    const d = (await readDetail(db, id))!;

    await deleteBlock(db, id, local(2026, 9, 24, 12, 0), FUSO);
    expect(await get(db, 'blocchi', id)).toBeUndefined();
    expect(await get(db, 'logFasi', id)).toBeUndefined();

    await restoreBlock(db, d, local(2026, 9, 24, 12, 1), FUSO);
    expect(await blocco(id)).toMatchObject({ stato: 'completato', titolo: 'Dentista', fasi: d.blocco.fasi });
    expect((await get(db, 'logFasi', id))?.fasi).toEqual(d.log);
  });
  it('occorrenza di routine: il giorno va in dateSaltate e la generazione non la ricrea, anche se oggi è già iniziata', async () => {
    const rid = await crea(routineMattina());
    const id = oggi(rid);
    await deleteBlock(db, id, local(2026, 9, 23, 9, 0), FUSO);
    const r = (await get(db, 'ricorrenze', rid))!;
    expect(r.dateSaltate).toEqual(['2026-09-23']);
    expect(await get(db, 'blocchi', id)).toBeUndefined();
    expect(await generateOccurrences(db, r, local(2026, 9, 23, 9, 5), FUSO)).toBe(0);

    const venerdi = occurrenceId(rid, '2026-09-25', '07:00');
    await deleteBlock(db, venerdi, local(2026, 9, 23, 9, 10), FUSO);
    expect((await get(db, 'ricorrenze', rid))!.dateSaltate).toEqual(['2026-09-23', '2026-09-25']);
    expect(await get(db, 'blocchi', venerdi)).toBeUndefined();
  });
  it('occorrenza spostata a un altro giorno (C4): in dateSaltate va il giorno dello slot, non quello attuale; l’occorrenza regolare del nuovo giorno resta', async () => {
    const rid = await crea(routineMattina());
    const id = oggi(rid);
    // Anticipata a domani mattina alle 06:00, come farebbe il trascinamento (T-015)
    const domani6 = local(2026, 9, 24, 6, 0);
    await saveBlock(db, { ...(await blocco(id)), inizio: domani6, fine: local(2026, 9, 24, 7, 0) }, NOW, FUSO);
    expect((await blocco(id)).giornoLocale).toBe('2026-09-24');
    const diDomani = occurrenceId(rid, '2026-09-24', '07:00');

    await deleteBlock(db, id, local(2026, 9, 23, 9, 0), FUSO);
    const r = (await get(db, 'ricorrenze', rid))!;
    expect(r.dateSaltate).toEqual(['2026-09-23']);
    expect(await get(db, 'blocchi', id)).toBeUndefined();
    expect(await get(db, 'blocchi', diDomani)).toBeDefined();
    expect(await generateOccurrences(db, r, local(2026, 9, 23, 9, 5), FUSO)).toBe(0);
  });
  it('«Annulla» toglie il giorno dalle date saltate e riporta l’occorrenza com’era', async () => {
    const rid = await crea(routineMattina());
    const id = oggi(rid);
    const d = (await readDetail(db, id))!;
    await deleteBlock(db, id, local(2026, 9, 23, 9, 0), FUSO);
    await restoreBlock(db, d, local(2026, 9, 23, 9, 1), FUSO);
    expect((await get(db, 'ricorrenze', rid))!.dateSaltate).toEqual([]);
    expect(await blocco(id)).toMatchObject({ id, stato: 'programmato', titolo: 'Mattina', inizio: d.blocco.inizio });
    expect(await generateOccurrences(db, (await get(db, 'ricorrenze', rid))!, local(2026, 9, 23, 9, 2), FUSO)).toBe(0);
  });
});

describe('Follow-up in una transazione — MECCANISMI §5, D-DETT-2 (audit P2-10)', () => {
  it('un errore al secondo follow-up non lascia il primo: il nuovo tentativo non crea doppioni', async () => {
    const id = await crea(eventoDentista());
    const giovedi = local(2026, 9, 24, 11, 5);
    // saveBlock scrive con db.blocchi, un'istanza diversa da db.table('blocchi')
    const blocchi = db.blocchi;
    const put = blocchi.put.bind(blocchi);
    let scritture = 0;
    vi.spyOn(blocchi, 'put').mockImplementation(((...a: Parameters<typeof put>) =>
      ++scritture === 2 ? Promise.reject(new Error('spazio esaurito')) : put(...a)) as never);
    const etichette = ['Stampare le analisi', 'Portare i documenti'];
    await expect(createFollowUps(db, id, etichette, giovedi, FUSO)).rejects.toThrow('spazio esaurito');
    expect((await list(db, 'blocchi')).filter((b) => b.tipo === 'todo')).toEqual([]);
    expect(await createFollowUps(db, id, etichette, giovedi, FUSO)).toHaveLength(2);
    expect((await list(db, 'blocchi')).filter((b) => b.tipo === 'todo')).toHaveLength(2);
  });
});
