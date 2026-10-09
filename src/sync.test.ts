// La sync fra due dispositivi (MECC §25; T-033): il servizio di `app/sync.ts` col servizio in memoria di
// `platform/syncMemory.ts`, composti come in `main.tsx`; per questo il test sta alla radice di `src`, fuori dagli strati
// (`app` non importa da `platform`, nemmeno nei test).
// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type RoutForgeDb } from './data/db';
import { allRows, get, list, newId, replaceAll, save, saveBlock } from './data/repository';
import type { BozzaAttivita } from './domain/activity';
import { desiredSet, IMPOSTAZIONI_NOTIFICHE_DEFAULT } from './domain/notifications/desiredSet';
import { lockedUnit } from './domain/session';
import { CHIAVE_STATO_SYNC, courseFingerprint } from './domain/sync';
import { local, MINUTE } from './domain/time';
import { CODICE_FINTO, createSyncStore, memorySyncBackend, type ArchivioSync } from './platform/syncMemory';
import { createActivity } from './app/activities';
import { completeBlock } from './app/completion';
import { importSampleCourse } from './app/courseImport';
import type { Clock } from './app/ports/clock';
import type { SyncBackend } from './app/ports/sync';
import { deleteRecurrence, editRecurrence, generateOccurrences } from './app/recurrences';
import { eraseAllData } from './app/backup';
import { readDiagnostics } from './app/diagnostics';
import { runCycle } from './app/scheduler';
import { setupInputs } from './app/session';
import { createSyncService, registerSyncService, type SyncService } from './app/sync';

const FUSO = 'Europe/Rome';
const EMAIL = 'diego@example.com';
// Martedì 22 settembre 2026, 09:00
const ADESSO = local(2026, 9, 22, 9, 0);
let ora = ADESSO;
const clock: Clock = {
  now: () => ora,
  fuso: () => FUSO,
  every: () => () => undefined,
  onForeground: () => () => undefined,
  inForeground: () => true,
};

interface Dispositivo {
  db: RoutForgeDb;
  sync: SyncService;
  online: boolean;
}
let archivio: ArchivioSync;
let n = 0;
const aperti: RoutForgeDb[] = [];
function dispositivo(nome: string, opzioni: { pagina?: number; dopoRicezione?: () => void } = {}): Dispositivo {
  const db = openDb(`test-sync-${nome}-${++n}`);
  aperti.push(db);
  const d: Dispositivo = { db, online: true } as Dispositivo;
  const rete = { online: () => d.online, onOnline: () => () => undefined };
  d.sync = createSyncService(
    db,
    memorySyncBackend(archivio, () => ora, newId),
    rete,
    clock,
    { nome, piattaforma: 'web' },
    opzioni,
  );
  return d;
}
const accedi = async (d: Dispositivo) => {
  expect(await d.sync.verifyCode(EMAIL, CODICE_FINTO)).toBe(true);
  await d.sync.run();
};

beforeEach(() => {
  archivio = createSyncStore();
  ora = ADESSO;
});
afterEach(async () => {
  await Promise.all(aperti.splice(0).map((db) => db.delete()));
});

const comune = { note: '', promemoria: { modo: 'auto' } } as const;
const todo = (titolo: string): BozzaAttivita => ({
  ...comune,
  tipo: 'todo',
  titolo,
  giorno: '2026-09-22',
  orario: { inizio: '18:00', durata: 30 },
  orizzonte: 'giorno',
  priorita: 'normale',
  checklist: [],
  corsoId: null,
});
async function crea(db: RoutForgeDb, bozza: BozzaAttivita): Promise<string> {
  const r = await createActivity(db, bozza, ora, FUSO);
  if (!r.ok) throw new Error(r.errori.join());
  return r.id;
}
const titoli = async (db: RoutForgeDb) =>
  (await list(db, 'blocchi'))
    .filter((b) => b.tipo === 'todo')
    .map((b) => b.titolo)
    .sort();

describe('Due dispositivi — SCENARI J1', () => {
  it('todo creato e completato offline sul telefono: online il tablet lo riceve già completato, senza notifiche armate', async () => {
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet');
    await accedi(telefono);
    await accedi(tablet);
    telefono.online = false;
    const id = await crea(telefono.db, todo('Chiama Marco'));
    ora = ADESSO + 10 * MINUTE;
    expect(await completeBlock(telefono.db, id, ora, FUSO)).toBe(true);
    await telefono.sync.run();
    expect(telefono.sync.snapshot()).toMatchObject({ fase: 'offline' });
    expect(telefono.sync.snapshot().inCoda).toBeGreaterThan(0);
    expect(await get(tablet.db, 'blocchi', id)).toBeUndefined();

    telefono.online = true;
    await telefono.sync.run();
    await tablet.sync.run();
    const ricevuto = await get(tablet.db, 'blocchi', id);
    expect(ricevuto).toMatchObject({ titolo: 'Chiama Marco', stato: 'completato', chiusoIl: ADESSO + 10 * MINUTE });
    const notifiche = desiredSet(
      {
        blocchi: await list(tablet.db, 'blocchi'),
        ricorrenze: [],
        impostazioni: IMPOSTAZIONI_NOTIFICHE_DEFAULT,
        sessione: null,
        titoloSessione: '',
      },
      ora,
    );
    expect(notifiche.filter((x) => x.bloccoId === id)).toEqual([]);
    expect(telefono.sync.snapshot()).toMatchObject({ fase: 'in_pari', inCoda: 0 });
  });
});

describe('Conflitto — SCENARI J2', () => {
  const routine: BozzaAttivita = {
    ...comune,
    tipo: 'routine',
    titolo: 'Corsa',
    giorni: [1, 2, 3, 4, 5],
    inizio: '07:00',
    fine: '08:00',
    dataInizio: '2026-09-22',
    termine: null,
    fasi: [],
  };
  const orari = async (db: RoutForgeDb, ricorrenzaId: string) => {
    const futuri = (await list(db, 'blocchi')).filter(
      (b) => b.ricorrenzaId === ricorrenzaId && b.stato === 'programmato' && b.inizio > ora,
    );
    return [...new Set(futuri.map((b) => b.orarioInizio))];
  };

  for (const primo of ['telefono', 'tablet'] as const)
    it(`telefono 18:00 alle 10:00, tablet 19:00 alle 10:05, offline: entrambi 19:00 (spedisce prima il ${primo})`, async () => {
      const telefono = dispositivo('telefono');
      const tablet = dispositivo('tablet');
      await accedi(telefono);
      const id = await crea(telefono.db, routine);
      await telefono.sync.run();
      await accedi(tablet);
      expect(await get(tablet.db, 'ricorrenze', id)).toMatchObject({ orarioInizio: '07:00' });
      telefono.online = false;
      tablet.online = false;
      const r = (await get(telefono.db, 'ricorrenze', id))!;
      ora = local(2026, 9, 22, 10, 0);
      await editRecurrence(telefono.db, { ...r, orarioInizio: '18:00', orarioFine: '19:00' }, ora, FUSO);
      ora = local(2026, 9, 22, 10, 5);
      await editRecurrence(tablet.db, { ...r, orarioInizio: '19:00', orarioFine: '20:00' }, ora, FUSO);
      telefono.online = true;
      tablet.online = true;
      const [a, b] = primo === 'telefono' ? [telefono, tablet] : [tablet, telefono];
      await a.sync.run();
      await b.sync.run();
      await a.sync.run();
      await b.sync.run();
      for (const d of [telefono, tablet]) {
        expect(await get(d.db, 'ricorrenze', id)).toMatchObject({ orarioInizio: '19:00' });
        expect(await orari(d.db, id)).toEqual(['19:00']);
      }
    });
});

describe('Routine di studio senza corso — SCENARI J3', () => {
  const studio = (corsoId: string): BozzaAttivita => ({
    ...comune,
    tipo: 'studio',
    titolo: 'Studio',
    corsoId,
    giorni: [0, 1, 2, 3, 4, 5, 6],
    inizio: '18:00',
    fine: '19:00',
    dataInizio: '2026-09-22',
    termine: null,
  });
  const future = async (db: RoutForgeDb, ricorrenzaId: string) =>
    (await list(db, 'blocchi'))
      .filter((b) => b.ricorrenzaId === ricorrenzaId && b.stato === 'programmato' && b.inizio > ora)
      .sort((x, y) => x.inizio - y.inizio);

  it('senza il corso le occorrenze non hanno unità e il setup è libero; dopo l’import dello stesso corso le future puntano alle unità', async () => {
    let cicli = 0;
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet', { dopoRicezione: () => void cicli++ });
    await accedi(telefono);
    const { corso } = await importSampleCourse(telefono.db, ora);
    const id = await crea(telefono.db, studio(corso.id));
    await runCycle(telefono.db, ora, FUSO);
    // Sul telefono il puntatore ha dato le unità; poi l'utente sposta di mezz'ora la prima occorrenza (C4)
    const prima = (await future(telefono.db, id))[0]!;
    expect(prima.unitaId).toMatch(new RegExp(`^${corso.id}:`));
    const spostata = { ...prima, inizio: prima.inizio + 30 * MINUTE, fine: prima.fine! + 30 * MINUTE };
    await saveBlock(telefono.db, spostata, ora, FUSO);
    await telefono.sync.run();
    // La routine parte con l'impronta del corso: titolo e contenuto
    const remota = () => [...archivio.righe.values()].find((x) => x.busta.tabella === 'ricorrenze')!.busta.dati;
    expect(remota()).toMatchObject({ corsoId: corso.id, impronta: courseFingerprint(corso.titolo, corso.moduli) });

    await accedi(tablet);
    // Lo spostamento fatto sul telefono arriva com'è, con l'unità del telefono: «Inizia sessione» alla sua ora apre il
    // setup libero, senza un'unità imposta che qui non esiste
    expect(await get(tablet.db, 'blocchi', prima.id)).toMatchObject({
      inizio: spostata.inizio,
      unitaId: prima.unitaId,
    });
    const allOra = spostata.inizio + 5 * MINUTE;
    expect(lockedUnit((await setupInputs(tablet.db, prima.id)).blocco, allOra)).toBeNull();
    // Dopo la ricezione i cicli dello scheduler (MECC §25): qui come li esegue `main.tsx`
    expect(cicli).toBe(1);
    await runCycle(tablet.db, ora, FUSO);
    const senza = await future(tablet.db, id);
    expect(senza.length).toBeGreaterThan(0);
    // Le occorrenze non hanno unità, nemmeno quella arrivata con l'unità del telefono
    expect(senza[0]).toMatchObject({ id: prima.id, inizio: spostata.inizio });
    expect(senza.map((b) => b.unitaId)).toEqual(senza.map(() => null));

    // L'import dello stesso ZIP (qui il corso di esempio) ricollega la routine: le occorrenze future puntano alle unità
    ora = ADESSO;
    const qui = (await importSampleCourse(tablet.db, ora)).corso;
    await runCycle(tablet.db, ora, FUSO);
    // Il collegamento è di questo dispositivo: non entra in coda (INV-21)
    expect(await list(tablet.db, 'syncCoda')).toEqual([]);
    expect(await get(tablet.db, 'ricorrenze', id)).toMatchObject({ corsoId: qui.id });
    const dopo = await future(tablet.db, id);
    expect(dopo.every((b) => b.corsoId === qui.id)).toBe(true);
    expect(dopo[0]).toMatchObject({ id: prima.id, inizio: spostata.inizio, unitaId: `${qui.id}:M0:U0.1` });
    // Il servizio resta col corso del telefono
    await tablet.sync.run();
    expect(cicli).toBe(1);
    expect(remota()).toMatchObject({ corsoId: corso.id });
  });

  it('col corso su entrambi, un’occorrenza spostata sul telefono arriva al tablet col corso e un’unità del tablet', async () => {
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet');
    await accedi(telefono);
    const { corso } = await importSampleCourse(telefono.db, ora);
    const id = await crea(telefono.db, studio(corso.id));
    await runCycle(telefono.db, ora, FUSO);
    await telefono.sync.run();
    const qui = (await importSampleCourse(tablet.db, ora)).corso;
    await accedi(tablet);
    await runCycle(tablet.db, ora, FUSO);
    expect(await get(tablet.db, 'ricorrenze', id)).toMatchObject({ corsoId: qui.id });
    // Sul telefono l'utente sposta l'occorrenza di domani: arriva col corso e l'unità del telefono
    const domani = (await future(telefono.db, id))[1]!;
    await saveBlock(
      telefono.db,
      { ...domani, inizio: domani.inizio + 30 * MINUTE, fine: domani.fine! + 30 * MINUTE },
      ora,
      FUSO,
    );
    await telefono.sync.run();
    await tablet.sync.run();
    await runCycle(tablet.db, ora, FUSO);
    const ricevuta = await get(tablet.db, 'blocchi', domani.id);
    expect(ricevuta).toMatchObject({ corsoId: qui.id, inizio: domani.inizio + 30 * MINUTE });
    expect(ricevuta?.unitaId).toMatch(new RegExp(`^${qui.id}:`));
    // Il servizio rimanda la routine com'è (seq nuovo, stessi dati): il collegamento al corso di qui resta (D-SYNC-6)
    const chiave = [...archivio.righe.keys()].find((k) => k.endsWith(`:ricorrenze:${id}`))!;
    const riga = archivio.righe.get(chiave)!;
    archivio.righe.set(chiave, { ...riga, busta: { ...riga.busta, seq: ++archivio.seq } });
    await tablet.sync.run();
    expect(await get(tablet.db, 'ricorrenze', id)).toMatchObject({ corsoId: qui.id });
  });
});

describe('Primo accesso con dati locali — SCENARI J4', () => {
  it('20 attività locali e 30 nell’account: dopo la sync 50 da entrambe le parti, nessuna persa né doppia', async () => {
    const altro = dispositivo('altro');
    await accedi(altro);
    for (let i = 0; i < 30; i++) await crea(altro.db, todo(`remota ${i}`));
    await altro.sync.run();
    const nuovo = dispositivo('nuovo', { pagina: 7 });
    for (let i = 0; i < 20; i++) await crea(nuovo.db, todo(`locale ${i}`));
    await accedi(nuovo);
    await altro.sync.run();
    expect(await titoli(nuovo.db)).toHaveLength(50);
    expect(await titoli(altro.db)).toEqual(await titoli(nuovo.db));
    expect(new Set(await titoli(nuovo.db)).size).toBe(50);
  });

  it('le preferenze coincidono per chiave: vince la più recente; la chiave AI e lo stato della sync restano', async () => {
    const altro = dispositivo('altro');
    await accedi(altro);
    await save(altro.db, 'preferenze', { id: 'impostazioni', valore: { inizioSettimana: 0 } }, ADESSO);
    await save(altro.db, 'preferenze', { id: 'chiaveAi', valore: 'AIza-segreta' }, ADESSO);
    await altro.sync.run();
    const nuovo = dispositivo('nuovo');
    ora = ADESSO + MINUTE;
    await save(nuovo.db, 'preferenze', { id: 'impostazioni', valore: { inizioSettimana: 1 } }, ora);
    await accedi(nuovo);
    await altro.sync.run();
    for (const d of [altro, nuovo])
      expect((await get(d.db, 'preferenze', 'impostazioni'))?.valore).toEqual({ inizioSettimana: 1 });
    expect(await get(nuovo.db, 'preferenze', 'chiaveAi')).toBeUndefined();
    expect(JSON.stringify([...archivio.righe.values()])).not.toContain('AIza-segreta');
  });
});

describe('Uscita — SCENARI J5', () => {
  it('uscendo le attività restano e le modifiche non partono; rientrando si riallineano, anche sull’altro dispositivo', async () => {
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet');
    await accedi(telefono);
    await accedi(tablet);
    const prima = await crea(telefono.db, todo('Prima'));
    await telefono.sync.run();
    await telefono.sync.signOut();
    expect(telefono.sync.snapshot()).toMatchObject({ fase: 'senza_account', account: null });
    expect(await get(telefono.db, 'blocchi', prima)).toBeDefined();
    const dopo = await crea(telefono.db, todo('Dopo'));
    await telefono.sync.run();
    expect(telefono.sync.snapshot().inCoda).toBeGreaterThan(0);
    await tablet.sync.run();
    expect(await get(tablet.db, 'blocchi', dopo)).toBeUndefined();
    await accedi(telefono);
    await tablet.sync.run();
    expect(await get(tablet.db, 'blocchi', dopo)).toMatchObject({ titolo: 'Dopo' });
    expect(await titoli(telefono.db)).toEqual(['Dopo', 'Prima']);
  });
});

describe('Casi limite della sync — MECCANISMI §25 (T-033)', () => {
  it('un dispositivo scollegato da un altro esce: dati e coda restano, fase «scollegato»', async () => {
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet');
    await accedi(telefono);
    await accedi(tablet);
    const io = telefono.sync.snapshot().dispositivi.find((x) => x.corrente)!;
    await tablet.sync.revokeDevice(io.id);
    const id = await crea(telefono.db, todo('Dopo la revoca'));
    await telefono.sync.run();
    expect(telefono.sync.snapshot().fase).toBe('scollegato');
    expect(await get(telefono.db, 'blocchi', id)).toBeDefined();
    expect(telefono.sync.snapshot().inCoda).toBeGreaterThan(0);
  });

  it('«Cancella i dati remoti» svuota il servizio, non i dispositivi', async () => {
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet');
    await accedi(telefono);
    await accedi(tablet);
    await crea(telefono.db, todo('Resta qui'));
    await telefono.sync.run();
    await tablet.sync.run();
    expect(await telefono.sync.eraseRemote()).toBe(true);
    expect(archivio.righe.size).toBe(0);
    expect(await titoli(telefono.db)).toEqual(['Resta qui']);
    expect(await titoli(tablet.db)).toEqual(['Resta qui']);
  });

  it('un gesto applicato con l’istante del passato (D-NATIVO-3) parte lo stesso: la coda non dipende da updatedAt', async () => {
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet');
    await accedi(telefono);
    await accedi(tablet);
    const id = await crea(telefono.db, todo('Segna fatto ad app chiusa'));
    await telefono.sync.run();
    await tablet.sync.run();
    ora = ADESSO + 30 * MINUTE;
    await completeBlock(telefono.db, id, ADESSO + 5 * MINUTE, FUSO);
    await telefono.sync.run();
    await tablet.sync.run();
    expect(await get(tablet.db, 'blocchi', id)).toMatchObject({ stato: 'completato' });
  });

  it('dopo l’import di un backup (stato della sync azzerato) la fusione riparte, senza doppioni', async () => {
    const telefono = dispositivo('telefono');
    await accedi(telefono);
    await crea(telefono.db, todo('Uno'));
    await telefono.sync.run();
    const righe = await allRows(telefono.db, 'blocchi');
    await replaceAll(telefono.db, { blocchi: righe });
    expect(await get(telefono.db, 'preferenze', CHIAVE_STATO_SYNC)).toBeUndefined();
    await telefono.sync.run();
    expect(await titoli(telefono.db)).toEqual(['Uno']);
    expect(telefono.sync.snapshot()).toMatchObject({ fase: 'in_pari', inCoda: 0 });
  });

  it('«Elimina tutti i dati» esce dall’account prima di azzerare: il dispositivo vuoto non si riscarica l’account', async () => {
    const telefono = dispositivo('telefono');
    await accedi(telefono);
    await crea(telefono.db, todo('Nell’account'));
    await telefono.sync.run();
    registerSyncService(telefono.sync);
    await eraseAllData(telefono.db);
    await telefono.sync.run();
    expect(telefono.sync.snapshot()).toMatchObject({ fase: 'senza_account', account: null });
    expect(await titoli(telefono.db)).toEqual([]);
  });

  it('buste costruite ad arte dal servizio si scartano: niente chiave AI altrui, niente coda, la sync continua', async () => {
    const telefono = dispositivo('telefono');
    await accedi(telefono);
    await save(telefono.db, 'preferenze', { id: 'chiaveAi', valore: 'AIza-mia' }, ora);
    const userId = [...archivio.account.values()][0]!;
    const avvelena = (tabella: string, id: string, dati: Record<string, unknown>) => {
      const seq = ++archivio.seq;
      archivio.righe.set(`${userId}:${tabella}:${id}:${seq}`, {
        userId,
        busta: {
          tabella: tabella as never,
          id,
          dati,
          updatedAt: ora + 1,
          deletedAt: null,
          generata: false,
          dispositivo: 'zzz',
          seq,
        },
      });
    };
    avvelena('syncCoda', 'preferenze:chiaveAi', {
      id: 'preferenze:chiaveAi',
      tabella: 'preferenze',
      recordId: 'chiaveAi',
    });
    avvelena('preferenze', 'impostazioni', { id: 'chiaveAi', valore: 'AIza-altrui' });
    avvelena('materiali', 'm1', { id: 'm1' });
    await telefono.sync.run();
    expect((await get(telefono.db, 'preferenze', 'chiaveAi'))?.valore).toBe('AIza-mia');
    expect(JSON.stringify([...archivio.righe.values()])).not.toContain('AIza-mia');
    expect(telefono.sync.snapshot()).toMatchObject({ fase: 'in_pari', inCoda: 0 });
  });

  it('una routine eliminata su un dispositivo non lascia occorrenze programmate sull’altro', async () => {
    const a = dispositivo('a');
    const b = dispositivo('b');
    await accedi(a);
    const id = await crea(a.db, {
      ...comune,
      tipo: 'routine',
      titolo: 'Corsa',
      giorni: [0, 1, 2, 3, 4, 5, 6],
      inizio: '07:00',
      fine: '08:00',
      dataInizio: '2026-09-22',
      termine: null,
      fasi: [],
    });
    await a.sync.run();
    await accedi(b);
    // B si apre un giorno dopo: il suo ciclo genera uno slot che A non ha mai avuto
    ora = ADESSO + 24 * 60 * MINUTE;
    await generateOccurrences(b.db, (await get(b.db, 'ricorrenze', id))!, ora, FUSO);
    ora = ADESSO + MINUTE;
    await deleteRecurrence(a.db, id, ora);
    await a.sync.run();
    ora = ADESSO + 24 * 60 * MINUTE;
    await b.sync.run();
    const rimaste = (await list(b.db, 'blocchi')).filter((x) => x.ricorrenzaId === id && x.stato === 'programmato');
    expect(rimaste).toEqual([]);
    expect(await get(b.db, 'ricorrenze', id)).toBeUndefined();
    // Le tombstone di A bastano: B non rispedisce quelle delle sue occorrenze (nessun rimbalzo, D-SYNC-6)
    const idB = b.sync.snapshot().dispositivi.find((x) => x.corrente)!.id;
    expect([...archivio.righe.values()].filter((x) => x.busta.dispositivo === idB)).toEqual([]);
  });

  it('uno spostamento fatto da uscito resta al rientro, quando la routine arriva di nuovo: vince il gesto più recente (D-SYNC-6)', async () => {
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet');
    await accedi(telefono);
    const id = await crea(telefono.db, {
      ...comune,
      tipo: 'routine',
      titolo: 'Corsa',
      giorni: [0, 1, 2, 3, 4, 5, 6],
      inizio: '07:00',
      fine: '08:00',
      dataInizio: '2026-09-22',
      termine: null,
      fasi: [],
    });
    await telefono.sync.run();
    await accedi(tablet);
    await tablet.sync.signOut();
    ora = ADESSO + MINUTE;
    const domani = (await list(tablet.db, 'blocchi')).find(
      (b) => b.ricorrenzaId === id && b.giornoLocale === '2026-09-23',
    )!;
    await saveBlock(
      tablet.db,
      { ...domani, inizio: domani.inizio + 60 * MINUTE, fine: domani.fine! + 60 * MINUTE },
      ora,
      FUSO,
    );
    // Il rientro riparte dal cursore 0: la routine arriva di nuovo, prima che lo spostamento parta
    await accedi(tablet);
    await telefono.sync.run();
    for (const d of [tablet, telefono])
      expect(await get(d.db, 'blocchi', domani.id)).toMatchObject({ orarioInizio: '08:00' });
  });

  it('una modifica più vecchia di quella sul servizio perde anche qui: la riga del servizio torna col pull dopo (D-SYNC-6)', async () => {
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet');
    await accedi(telefono);
    await accedi(tablet);
    const id = await crea(telefono.db, todo('Chiama Marco'));
    await telefono.sync.run();
    await tablet.sync.run();
    // Alle 10:30 il tablet lo rinomina; alle 11:00 il telefono riceve e poi applica un «Segna fatto» delle 10:00 dato ad
    // app chiusa (D-NATIVO-3): il servizio tiene le 10:30
    ora = ADESSO + 90 * MINUTE;
    await saveBlock(tablet.db, { ...(await get(tablet.db, 'blocchi', id))!, titolo: 'Chiama Marco e Anna' }, ora, FUSO);
    await tablet.sync.run();
    ora = ADESSO + 120 * MINUTE;
    await telefono.sync.run();
    expect(await completeBlock(telefono.db, id, ADESSO + 60 * MINUTE, FUSO)).toBe(true);
    await telefono.sync.run();
    await telefono.sync.run();
    for (const d of [telefono, tablet])
      expect(await get(d.db, 'blocchi', id)).toMatchObject({ titolo: 'Chiama Marco e Anna', stato: 'programmato' });
  });

  it('un dispositivo che il servizio non conosce (app chiusa prima della registrazione, altra scheda) si registra e non esce', async () => {
    const db = openDb(`test-sync-scheda-${++n}`);
    aperti.push(db);
    const backend = memorySyncBackend(archivio, () => ora, newId);
    const rete = { online: () => true, onOnline: () => () => undefined };
    const sync = createSyncService(db, backend, rete, clock, { nome: 'scheda', piattaforma: 'web' });
    await backend.verifyCode(EMAIL, CODICE_FINTO);
    await sync.run();
    expect(sync.snapshot()).toMatchObject({ fase: 'in_pari' });
    expect(sync.snapshot().dispositivi).toMatchObject([{ nome: 'scheda', corrente: true }]);
  });

  const quotidiana = {
    ...comune,
    tipo: 'routine' as const,
    titolo: 'Corsa',
    giorni: [0, 1, 2, 3, 4, 5, 6],
    inizio: '07:00',
    fine: '08:00',
    dataInizio: '2026-09-22',
    termine: null,
    fasi: [],
  };
  const sposta = async (d: Dispositivo, id: string, minuti: number) => {
    const b = (await get(d.db, 'blocchi', id))!;
    await saveBlock(d.db, { ...b, inizio: b.inizio + minuti * MINUTE, fine: b.fine! + minuti * MINUTE }, ora, FUSO);
  };

  it('uno spostamento più recente di una modifica della routine fatta offline altrove resta su tutti (D-SYNC-6)', async () => {
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet');
    await accedi(telefono);
    const id = await crea(telefono.db, quotidiana);
    await telefono.sync.run();
    await accedi(tablet);
    const mercoledi = `${id}:2026-09-23:07:00`;
    // Alle 10:00 il telefono, offline, toglie il mercoledì; alle 10:05 il tablet sposta l'occorrenza di mercoledì
    telefono.online = false;
    ora = local(2026, 9, 22, 10, 0);
    const r = (await get(telefono.db, 'ricorrenze', id))!;
    await editRecurrence(telefono.db, { ...r, giorni: [0, 1, 2, 4, 5, 6] }, ora, FUSO);
    ora = local(2026, 9, 22, 10, 5);
    await sposta(tablet, mercoledi, 60);
    await tablet.sync.run();
    telefono.online = true;
    await telefono.sync.run();
    await tablet.sync.run();
    for (const d of [telefono, tablet])
      expect(await get(d.db, 'blocchi', mercoledi)).toMatchObject({ orarioInizio: '08:00' });
  });

  it('chi modifica la routine riporta allo slot un’occorrenza spostata altrove, e il ripristino arriva agli altri (D-SYNC-6)', async () => {
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet');
    await accedi(telefono);
    const id = await crea(telefono.db, quotidiana);
    await telefono.sync.run();
    await accedi(tablet);
    const mercoledi = `${id}:2026-09-23:07:00`;
    ora = local(2026, 9, 22, 10, 0);
    await sposta(tablet, mercoledi, 60);
    await tablet.sync.run();
    await telefono.sync.run();
    expect(await get(telefono.db, 'blocchi', mercoledi)).toMatchObject({ orarioInizio: '08:00' });
    // Alle 10:05 il telefono rinomina la routine: lo spostamento torna allo slot (§7) anche sul tablet
    ora = local(2026, 9, 22, 10, 5);
    const r = (await get(telefono.db, 'ricorrenze', id))!;
    await editRecurrence(telefono.db, { ...r, titolo: 'Corsa lenta' }, ora, FUSO);
    await telefono.sync.run();
    await tablet.sync.run();
    for (const d of [telefono, tablet])
      expect(await get(d.db, 'blocchi', mercoledi)).toMatchObject({ orarioInizio: '07:00', titolo: 'Corsa lenta' });
  });

  it('una routine rimandata uguale dal servizio non riporta allo slot uno spostamento già spedito (D-SYNC-6)', async () => {
    const telefono = dispositivo('telefono');
    const tablet = dispositivo('tablet');
    await accedi(telefono);
    const id = await crea(telefono.db, quotidiana);
    await telefono.sync.run();
    await accedi(tablet);
    const mercoledi = `${id}:2026-09-23:07:00`;
    await sposta(tablet, mercoledi, 60);
    await tablet.sync.run();
    // Il servizio rimanda la routine com'è (il push di un altro dispositivo ha perso): nuovo seq, stessi dati
    const chiave = [...archivio.righe.keys()].find((k) => k.endsWith(`:ricorrenze:${id}`))!;
    const riga = archivio.righe.get(chiave)!;
    archivio.righe.set(chiave, { ...riga, busta: { ...riga.busta, seq: ++archivio.seq } });
    await tablet.sync.run();
    expect(await get(tablet.db, 'blocchi', mercoledi)).toMatchObject({ orarioInizio: '08:00' });
  });

  it('«Elimina tutti i dati» mentre il push aspetta la risposta: lo stato della sync non torna nei dati azzerati (D-SYNC-6)', async () => {
    const db = openDb(`test-sync-lento-${++n}`);
    aperti.push(db);
    const backend = memorySyncBackend(archivio, () => ora, newId);
    let spinto = false;
    let sblocca = () => {};
    // La risposta del push arriva tardi: il servizio ha già scritto
    const lento: SyncBackend = {
      ...backend,
      async push(buste) {
        await backend.push(buste);
        spinto = true;
        await new Promise<void>((fatto) => (sblocca = fatto));
      },
    };
    const rete = { online: () => true, onOnline: () => () => undefined };
    const sync = createSyncService(db, lento, rete, clock, { nome: 'lento', piattaforma: 'web' });
    expect(await sync.verifyCode(EMAIL, CODICE_FINTO)).toBe(true);
    await sync.run();
    await crea(db, todo('Prima'));
    const giro = sync.run();
    await vi.waitFor(() => expect(spinto).toBe(true));
    registerSyncService(sync);
    await eraseAllData(db);
    sblocca();
    await giro;
    expect(await get(db, 'preferenze', CHIAVE_STATO_SYNC)).toBeUndefined();
  });
});

describe('Fusione dopo l’import di un backup — MECCANISMI §25, D-SYNC-4 n. 4 (audit P0-2)', () => {
  it('una scrittura del ciclo sul tablet non batte il completamento fatto prima sul telefono: completato su entrambi', async () => {
    const telefono = dispositivo('telefono');
    await accedi(telefono);
    const id = await crea(telefono.db, todo('Chiama Marco'));
    await telefono.sync.run();
    // Il tablet nuovo prende i dati dal backup del telefono (l'import azzera e scrive le righe), ancora senza account
    const tablet = dispositivo('tablet');
    await replaceAll(tablet.db, { blocchi: await allRows(telefono.db, 'blocchi') });
    // Alle 19:00 il telefono completa il todo e sincronizza
    ora = ADESSO + 600 * MINUTE;
    expect(await completeBlock(telefono.db, id, ora, FUSO)).toBe(true);
    await telefono.sync.run();
    // Il giorno dopo il ciclo del tablet giudica il todo rimasto programmato nel backup, poi il tablet entra nell'account
    ora = local(2026, 9, 23, 9, 0);
    await runCycle(tablet.db, ora, FUSO);
    expect((await get(tablet.db, 'blocchi', id))?.stato).not.toBe('programmato');
    await accedi(tablet);
    await telefono.sync.run();
    for (const d of [telefono, tablet]) expect(await get(d.db, 'blocchi', id)).toMatchObject({ stato: 'completato' });
  });
});

describe('Righe che il servizio rifiuta sempre — MECCANISMI §25 (audit P1-11)', () => {
  it('una nota oltre il tetto del servizio non ferma la coda: le altre modifiche partono, la riga va in Diagnostica e resta', async () => {
    const db = openDb(`test-sync-tetto-${++n}`);
    aperti.push(db);
    const base = memorySyncBackend(archivio, () => ora, newId);
    // Come `push_records` nell'SQL: una riga oltre 1 MB viola il `check` di `records` e fa fallire l'intero lotto
    const severo: SyncBackend = {
      ...base,
      push: (buste) =>
        buste.some((b) => JSON.stringify(b.dati).length > 1024 * 1024)
          ? Promise.reject(new Error('violates check constraint "records_dati_check"'))
          : base.push(buste),
    };
    const rete = { online: () => true, onOnline: () => () => undefined };
    const sync = createSyncService(db, severo, rete, clock, { nome: 'telefono', piattaforma: 'web' });
    expect(await sync.verifyCode(EMAIL, CODICE_FINTO)).toBe(true);
    await sync.run();
    // «Appunti» è già sul servizio; poi la sua nota diventa enorme
    const grande = await crea(db, todo('Appunti'));
    await sync.run();
    ora = ADESSO + 10 * MINUTE;
    const nota = 'x'.repeat(1100 * 1024);
    await saveBlock(db, { ...(await get(db, 'blocchi', grande))!, note: nota }, ora, FUSO);
    await crea(db, todo('Chiama Marco'));
    await sync.run();
    const tablet = dispositivo('tablet');
    await accedi(tablet);
    expect(await titoli(tablet.db)).toEqual(['Appunti', 'Chiama Marco']);
    const { eventi } = await readDiagnostics(db, ora);
    expect(eventi.some((e) => e.sorgente === 'sync' && e.messaggio.includes(grande))).toBe(true);
    // La voce resta in coda: uscendo e rientrando (cursore da 0) la versione più vecchia del servizio non la sovrascrive
    await sync.signOut();
    expect(await sync.verifyCode(EMAIL, CODICE_FINTO)).toBe(true);
    await sync.run();
    expect((await get(db, 'blocchi', grande))?.note).toBe(nota);
  });
});
