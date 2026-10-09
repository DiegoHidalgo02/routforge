/**
 * Repository minimi (D-DATA-1): leggono e scrivono, nessuna regola di business. Fonti: MECC §1, §25;
 * decisioni D-DATA-2 e D-TIME-2.
 *
 * - `save` crea o aggiorna: UUID v4 se manca l'id, `createdAt` conservato, `updatedAt` = now, `deletedAt` = null.
 *   Gli id deterministici (occorrenza = slot, log fasi = blocco, preferenze = chiave) li dà il chiamante: salvare di
 *   nuovo lo stesso id sovrascrive, e rianima una tombstone.
 * - `remove` lascia una tombstone minima (MECC §25: le eliminazioni si registrano e si propagano).
 * - `saveBlock` deriva giorno locale e ora di parete dagli istanti nel fuso del processo (D-TIME-2); se gli istanti
 *   non cambiano li conserva: un blocco passato non cambia giorno né orario dopo un viaggio (CONTESTO §3).
 * - `saveCourse` salva l'albero di un corso importato in una sola transazione (MECC §16, D-IMPORT-1).
 * - Le modifiche dell'utente nell'ambito della sync (`isSynced`) entrano nella coda `syncCoda` nella stessa
 *   transazione del record (T-033); le scritture del ciclo (`origine = 'ciclo'`) no: ogni dispositivo le ricalcola.
 * Il tempo arriva come parametro: `now` e, per i blocchi, il fuso corrente letto dalla porta Clock di `app`.
 */
import Dexie, { liveQuery } from 'dexie';
import type { CorsoImportato } from '../domain/course/parser';
import { isGenerata, isSynced, stripLocalFields, TABELLE_SINCRONIZZATE } from '../domain/sync';
import { localDayKey, localTimeKey } from '../domain/time';
import type { OraDiParete } from '../domain/types';
import type { CampiComuni, RoutForgeDb, Tabelle, Tombstone } from './db';

// La lib della radice è ES2022 senza DOM (D-TS-1): si dichiara solo la parte di Web Crypto che si usa.
declare const crypto: { randomUUID?(): string; getRandomValues(a: Uint8Array): Uint8Array };

/**
 * UUID v4: id dei record senza identità logica e del corso nuovo di ogni import (MECC §16).
 * `randomUUID` esiste solo in contesto sicuro (https, localhost): da telefono su http://<ip-del-pc> manca e il
 * salvataggio falliva; `getRandomValues` c'è anche lì, e con i bit di versione e variante dà lo stesso formato.
 */
export const newId = (): string =>
  crypto.randomUUID?.() ??
  '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (Number(c) ^ ((crypto.getRandomValues(new Uint8Array(1))[0] ?? 0) & (15 >> (Number(c) / 4)))).toString(16),
  );

type NomeTabella = keyof Tabelle;
type RigaBlocco = Tabelle['blocchi'];

/** Dati da salvare: tutto tranne i campi comuni; senza id si genera un UUID v4. */
export type Dati<T extends CampiComuni> = Omit<T, keyof CampiComuni> & { id?: string };
/** Un blocco senza i campi che deriva `saveBlock`. */
export type DatiBlocco = Dati<Omit<RigaBlocco, keyof OraDiParete | 'giornoLocale'>>;

const vivo = <T extends CampiComuni>(r: T | Tombstone | undefined): r is T => r !== undefined && r.deletedAt === null;
const tabella = <K extends NomeTabella>(db: RoutForgeDb, nome: K) => db.table<Tabelle[K] | Tombstone, string>(nome);

/**
 * Chi scrive un blocco (T-033): l'utente, la cui modifica si spedisce, o il ciclo (generazione, riancoraggio, persi,
 * ritardo, orfani, puntatore, occorrenze che seguono la definizione), le cui scritture ogni dispositivo ricalcola e che
 * quindi non si accodano: accodate, un riancoraggio rimbalzerebbe fra due fusi e un «perso» del ciclo vincerebbe su un
 * completamento più vecchio. Le altre tabelle sincronizzate le scrive solo l'utente, salvo il collegamento di una
 * routine di studio al corso di questo dispositivo (T-034), che il ciclo ricalcola.
 */
export type Origine = 'utente' | 'ciclo';
const SINCRONIZZATE: readonly string[] = TABELLE_SINCRONIZZATE;

/** Le tabelle di una scrittura: con la coda se il record è nell'ambito della sync (Dexie le vuole all'apertura). */
const conCoda = (db: RoutForgeDb, t: Dexie.Table, nome: NomeTabella, id: string) =>
  isSynced(nome, id) ? [t, db.syncCoda] : [t];

/**
 * Accoda la modifica dell'utente (T-033), con l'`updatedAt` del record: anche un gesto applicato più tardi con
 * l'istante del passato (D-NATIVO-3) parte, perché la coda non si ricava da `updatedAt`.
 */
async function accoda(
  db: RoutForgeDb,
  nome: NomeTabella,
  riga: { id: string; updatedAt: number },
  origine: Origine = 'utente',
) {
  if (origine !== 'utente' || !isSynced(nome, riga.id)) return;
  const istante = riga.updatedAt;
  await db.syncCoda.put({
    id: `${nome}:${riga.id}`,
    tabella: nome,
    recordId: riga.id,
    generata: false,
    createdAt: istante,
    updatedAt: istante,
    deletedAt: null,
  });
}

export async function get<K extends NomeTabella>(
  db: RoutForgeDb,
  nome: K,
  id: string,
): Promise<Tabelle[K] | undefined> {
  const r = await tabella(db, nome).get(id);
  return vivo(r) ? r : undefined;
}

/** Tutti i record vivi della tabella. */
export async function list<K extends NomeTabella>(db: RoutForgeDb, nome: K): Promise<Tabelle[K][]> {
  return (await tabella(db, nome).toArray()).filter((r): r is Tabelle[K] => vivo(r));
}

/**
 * Esegue `fn` in una transazione di scrittura sulle tabelle date: le chiamate ai repository al suo interno ne fanno
 * parte (tutto o niente; scritture serializzate, MECC §7). Dexie resta confinato in `data`.
 */
export const inTransaction = <T>(db: RoutForgeDb, tabelle: readonly NomeTabella[], fn: () => Promise<T>): Promise<T> =>
  // Con una tabella sincronizzata c'è anche la coda della sync, dove le scritture al suo interno accodano (T-033); senza,
  // la transazione non la blocca (chat, materiali e pratica non aspettano il ciclo)
  db.transaction('rw', tabelle.some((t) => SINCRONIZZATE.includes(t)) ? [...tabelle, 'syncCoda'] : [...tabelle], fn);

/** I record vivi con `indice` uguale a `valore` (un indice secondario di `SCHEMA_V1`, es. `ricorrenzaId`, MECC §7). */
export async function listBy<K extends NomeTabella>(
  db: RoutForgeDb,
  nome: K,
  indice: keyof Tabelle[K] & string,
  valore: string,
): Promise<Tabelle[K][]> {
  return (await tabella(db, nome).where(indice).equals(valore).toArray()).filter((r): r is Tabelle[K] => vivo(r));
}

/**
 * I record vivi con la chiave primaria fra `da` e `a` inclusi, in ordine di chiave. Serve dove l'id è logico e ordinato,
 * come gli slot delle occorrenze `<ricorrenza>:<giorno>:<orario>` (D-DATA-2): la generazione legge solo i giorni
 * dell'orizzonte invece di tutta la storia della routine (D-SCHED-1).
 */
export async function listKeyRange<K extends NomeTabella>(
  db: RoutForgeDb,
  nome: K,
  da: string,
  a: string,
): Promise<Tabelle[K][]> {
  return (await tabella(db, nome).where(':id').between(da, a, true, true).toArray()).filter((r): r is Tabelle[K] =>
    vivo(r),
  );
}

/** La parte di una riga che viaggia con la sync, senza i suoi istanti: uguale prima e dopo, non c'è nulla da spedire. */
const parteCheViaggia = (nome: NomeTabella, r: Tabelle[NomeTabella] | Tombstone) => {
  const { gestoIl: _gesto, ...resto } = stripLocalFields(nome, r) as { gestoIl?: number };
  return JSON.stringify({ ...resto, createdAt: 0, updatedAt: 0 });
};

/**
 * L'istante dell'ultimo gesto (`CampiComuni.gestoIl`, audit P0-2): adesso per un gesto dell'utente che cambia la parte che
 * viaggia; altrimenti quello del record di prima, o il suo `updatedAt` se la riga è di prima del campo.
 */
const ultimoGesto = (prev: CampiComuni | Tombstone | undefined, gesto: boolean, now: number): { gestoIl?: number } =>
  gesto ? { gestoIl: now } : vivo(prev) ? { gestoIl: prev.gestoIl ?? prev.updatedAt } : {};

/** I dati da scrivere senza un `gestoIl` arrivato con la riga letta: lo decide solo `ultimoGesto`. */
const senzaGesto = <T extends object>(dati: T): T => {
  const { gestoIl: _gesto, ...resto } = dati as T & { gestoIl?: number };
  return resto as T;
};

/**
 * Crea o aggiorna un record (i blocchi passano da `saveBlock`). Salvare l'id di una tombstone la rianima. Una scrittura
 * che non cambia la parte che viaggia (solo l'interruttore generale delle notifiche, o nulla) non si accoda: accodata,
 * la riga intera vincerebbe con un istante nuovo sulle modifiche altrui ai campi che viaggiano (D-SYNC-6).
 */
export async function save<K extends Exclude<NomeTabella, 'blocchi'>>(
  db: RoutForgeDb,
  nome: K,
  dati: Dati<Tabelle[K]>,
  now: number,
  origine: Origine = 'utente',
): Promise<Tabelle[K]> {
  const t = tabella(db, nome);
  const id = dati.id ?? newId();
  return db.transaction('rw', conCoda(db, t, nome, id), async () => {
    const prev = await t.get(id);
    const base = { ...senzaGesto(dati), id, createdAt: prev?.createdAt ?? now, updatedAt: now, deletedAt: null };
    // Il confronto solo per le righe che viaggiano: le altre possono essere grandi (il binario di un PDF)
    const viaggia = isSynced(nome, id);
    const cambia =
      viaggia && (!vivo(prev) || parteCheViaggia(nome, prev) !== parteCheViaggia(nome, base as Tabelle[K]));
    const rec = (viaggia ? { ...base, ...ultimoGesto(prev, cambia && origine === 'utente', now) } : base) as Tabelle[K];
    await t.put(rec);
    if (cambia) await accoda(db, nome, rec, origine);
    return rec;
  });
}

/**
 * Elimina lasciando una tombstone minima; un record assente o già eliminato resta com'è. Le occorrenze tolte perché
 * seguono una definizione ricevuta sono del ciclo (`origine`): le tombstone di chi l'ha modificata bastano (D-SYNC-6).
 */
export async function remove<K extends NomeTabella>(
  db: RoutForgeDb,
  nome: K,
  id: string,
  now: number,
  origine: Origine = 'utente',
): Promise<void> {
  const t = tabella(db, nome);
  await db.transaction('rw', conCoda(db, t, nome, id), async () => {
    const prev = await t.get(id);
    if (!vivo(prev)) return;
    const tombstone: Tombstone = { id, createdAt: prev.createdAt, updatedAt: now, deletedAt: now };
    await t.put(tombstone);
    await accoda(db, nome, tombstone, origine);
  });
}

/**
 * Cancellazione fisica, ammessa solo per le tabelle derivate del dispositivo, mai in backup né sync: il registro delle
 * notifiche, ricostruito a ogni riconciliazione (MECC §1, INV-14; T-019), e la coda della sync (T-033).
 */
export async function purge(
  db: RoutForgeDb,
  nome: 'registroNotifiche' | 'syncCoda',
  ids: readonly string[],
): Promise<void> {
  await tabella(db, nome).bulkDelete([...ids]);
}

/** Una riga com'è, tombstone compresa: la sync confronta anche le eliminazioni (T-033). */
export const rawRow = <K extends NomeTabella>(
  db: RoutForgeDb,
  nome: K,
  id: string,
): Promise<Tabelle[K] | Tombstone | undefined> => tabella(db, nome).get(id);

/** Quante voci ha la coda della sync, senza leggerle: le voci si cancellano fisicamente, quindi sono tutte vive (audit P3-10). */
export const queueSize = (db: RoutForgeDb): Promise<number> => db.syncCoda.count();

/**
 * Toglie dalla coda le voci spedite (T-033), solo se non sono cambiate dopo: una modifica arrivata durante il push ha un
 * `updatedAt` più recente e resta in coda.
 */
export async function dequeue(db: RoutForgeDb, spedite: readonly { id: string; updatedAt: number }[]): Promise<void> {
  await db.transaction('rw', db.syncCoda, async () => {
    const via: string[] = [];
    for (const s of spedite) {
      const v = await db.syncCoda.get(s.id);
      if (v && v.updatedAt <= s.updatedAt) via.push(s.id);
    }
    await purge(db, 'syncCoda', via);
  });
}

/**
 * La fusione al primo accesso (T-033, J4): accoda ogni riga dell'ambito della sync, tombstone comprese (un'eliminazione
 * fatta prima dell'accesso deve arrivare all'account), con le occorrenze generate marcate perché non sovrascrivano. Una
 * modifica dell'utente già in coda resta com'è. L'istante della voce è l'ultimo gesto della riga (`gestoIl`), non il suo
 * `updatedAt`: un «non fatto» scritto dal ciclo dopo un import non batte un completamento remoto più vecchio (audit P0-2).
 */
export async function enqueueAll(db: RoutForgeDb): Promise<void> {
  await db.transaction('rw', [...TABELLE_SINCRONIZZATE, 'syncCoda'], async () => {
    for (const nome of TABELLE_SINCRONIZZATE)
      for (const r of await allRows(db, nome)) {
        const id = `${nome}:${r.id}`;
        if (!isSynced(nome, r.id) || (await db.syncCoda.get(id))) continue;
        // Da un backup modificato a mano può arrivare qualunque valore: il servizio vuole un istante intero
        const gesto = (r as { gestoIl?: unknown }).gestoIl;
        const istante = Number.isSafeInteger(gesto) ? (gesto as number) : r.updatedAt;
        await db.syncCoda.put({
          id,
          tabella: nome,
          recordId: r.id,
          generata: nome === 'blocchi' && isGenerata(r),
          createdAt: istante,
          updatedAt: istante,
          deletedAt: null,
        });
      }
  });
}

/**
 * Scrive le righe ricevute dalla sync così come sono (T-033): niente coda, niente derivazione (la riga porta giorno,
 * orari e fuso del mittente; il ciclo la riancora al fuso di qui, D-TIME-2); una tombstone resta tombstone.
 */
export async function putRemote<K extends NomeTabella>(
  db: RoutForgeDb,
  nome: K,
  righe: readonly (Tabelle[K] | Tombstone)[],
): Promise<void> {
  await tabella(db, nome).bulkPut([...righe]);
}

/** I nomi delle tabelle del database aperto: il backup le porta tutte, anche quelle di una versione futura (T-030). */
export const tableNames = (db: RoutForgeDb): NomeTabella[] => db.tables.map((t) => t.name as NomeTabella);

/** Tutte le righe di una tabella, tombstone comprese: il backup le porta tutte (MECC §22, T-030). */
export const allRows = <K extends NomeTabella>(db: RoutForgeDb, nome: K): Promise<(Tabelle[K] | Tombstone)[]> =>
  tabella(db, nome).toArray();

/**
 * Tutte le righe delle tabelle date, in una transazione di sola lettura: una fotografia coerente, che una scrittura
 * arrivata a metà (il ciclo, una pagina della sync, l'import di un corso) non divide (il backup; audit P2-8).
 */
export const allTables = (db: RoutForgeDb, nomi: readonly NomeTabella[]): Promise<Record<string, object[]>> =>
  db.transaction('r', [...nomi], async () => {
    const righe: Record<string, object[]> = {};
    for (const nome of nomi) righe[nome] = await allRows(db, nome);
    return righe;
  });

/**
 * Azzeramento (MECC §22, T-030): l'import di un backup e «Elimina tutti i dati» svuotano ogni tabella e scrivono le
 * righe date, in una sola transazione (se fallisce, resta tutto com'era). L'altra cancellazione fisica oltre a `purge`:
 * l'azzeramento è totale per spec e i dati remoti restano finché l'utente non li cancella dall'account (INV-14). La coda
 * della sync si svuota con il resto: i dati importati partono con la fusione, perché anche lo stato della sync non c'è
 * più (T-033). Il registro delle notifiche resta: lo svuota dopo il servizio delle notifiche, che toglie anche quelle armate, così un
 * azzeramento fallito non le perde (D-BACKUP-2).
 */
export async function replaceAll(
  db: RoutForgeDb,
  righe: Partial<Record<NomeTabella, readonly object[]>>,
): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) {
      if (t.name === 'registroNotifiche') continue;
      await t.clear();
      const nuove = righe[t.name as NomeTabella];
      if (nuove?.length) await t.bulkPut([...nuove]);
    }
  });
}

/** Crea o aggiorna un blocco; `fuso` è il fuso corrente del dispositivo (D-TIME-2). */
export async function saveBlock(
  db: RoutForgeDb,
  dati: DatiBlocco,
  now: number,
  fuso: string,
  origine: Origine = 'utente',
): Promise<RigaBlocco> {
  return db.transaction('rw', [db.blocchi, db.syncCoda], async () => {
    const id = dati.id ?? newId();
    const prev = await db.blocchi.get(id);
    const derivato = {
      giornoLocale: localDayKey(dati.inizio),
      orarioInizio: localTimeKey(dati.inizio),
      orarioFine: dati.fine === null ? null : localTimeKey(dati.fine),
      fuso,
    };
    // Istanti invariati → vale l'ancoraggio memorizzato (il passato non si sposta), salvo quando il fuso corrente lo
    // riproduce uguale (stesso offset, es. Roma → Berlino): allora si registra il fuso corrente, così il riancoraggio
    // (T-013) converge invece di riscrivere il blocco a ogni ciclo (INV-15). Se cambia anche un solo istante si
    // ricalcola tutto nel fuso corrente: un blocco modificato è un blocco riancorato (D-DATA-2).
    const stessi = vivo(prev) && prev.inizio === dati.inizio && prev.fine === dati.fine ? prev : undefined;
    const ora =
      stessi &&
      (stessi.giornoLocale !== derivato.giornoLocale ||
        stessi.orarioInizio !== derivato.orarioInizio ||
        stessi.orarioFine !== derivato.orarioFine)
        ? {
            giornoLocale: stessi.giornoLocale,
            orarioInizio: stessi.orarioInizio,
            orarioFine: stessi.orarioFine,
            fuso: stessi.fuso,
          }
        : derivato;
    const rec: RigaBlocco = {
      ...senzaGesto(dati),
      ...ora,
      id,
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      deletedAt: null,
      ...ultimoGesto(prev, origine === 'utente', now),
    };
    await db.blocchi.put(rec);
    await accoda(db, 'blocchi', rec, origine);
    return rec;
  });
}

/**
 * Salva l'albero di un corso importato: tutto o niente, un errore non lascia un corso a metà (D-IMPORT-1). Gli id sono
 * quelli del parser, deterministici da `corso.id`; una risorsa è la sua sezione più la posizione (`…:teoria:R1`).
 * Ciò che il dominio calcola (stato dei moduli, conteggi, unità corrente) non si salva (D-DATA-2). `esempio` marca
 * il corso di esempio incluso (D-SAMPLE-1).
 */
export async function saveCourse(db: RoutForgeDb, corso: CorsoImportato, now: number, esempio = false): Promise<void> {
  const { id: corsoId, titolo, sottotitolo, importatoIl } = corso;
  // Le `save` interne diventano sotto-transazioni di questa: un errore annulla tutto.
  await db.transaction('rw', [db.corsi, db.moduli, db.unita, db.sezioni, db.risorse], async () => {
    await save(db, 'corsi', { id: corsoId, titolo, sottotitolo, importatoIl, esempio }, now);
    for (const { unita, stato, ...modulo } of corso.moduli) {
      await save(db, 'moduli', { ...modulo, corsoId }, now);
      for (const { sezioni, ...u } of unita) {
        await save(db, 'unita', { ...u, corsoId, moduloId: modulo.id }, now);
        for (const [i, { risorse, ...sezione }] of sezioni.entries()) {
          await save(db, 'sezioni', { ...sezione, corsoId, unitaId: u.id, ordine: i + 1 }, now);
          for (const [j, r] of risorse.entries()) {
            const riga = { ...r, id: `${sezione.id}:R${j + 1}`, corsoId, sezioneId: sezione.id, ordine: j + 1 };
            await save(db, 'risorse', riga, now);
          }
        }
      }
    }
  });
}

/**
 * Riesegue `query` a ogni scrittura sulle tabelle che legge e passa il risultato a `onChange` (query live di Dexie,
 * D-STACK-1). Restituisce la funzione che smette di osservare. Un errore della query non arriva a `onChange` e non
 * interrompe la UI (INV-16): la schermata resta all'ultimo valore e l'errore va a `onError`, che `app` collega alla
 * Diagnostica (`data` non la conosce; audit P1-13).
 */
export function watch<T>(
  query: () => Promise<T>,
  onChange: (v: T) => void,
  onError: (e: unknown) => void = () => {},
): () => void {
  const s = liveQuery(query).subscribe({ next: onChange, error: onError });
  return () => s.unsubscribe();
}

/** Le sessioni chiuse con l'avvio in [da, a) (MECC §20: sessioni del periodo = avvio nel periodo), indice `avvio`. */
export async function sessionsBetween(db: RoutForgeDb, da: number, a: number): Promise<Tabelle['sessioni'][]> {
  const righe = await tabella(db, 'sessioni').where('avvio').between(da, a, true, false).toArray();
  return righe.filter((x): x is Tabelle['sessioni'] => vivo(x));
}

/** Blocchi vivi dei giorni locali "YYYY-MM-DD" da `primo` a `ultimo` inclusi, per giorno e poi per inizio (indice `[giornoLocale+inizio]`). */
export async function blocksBetween(db: RoutForgeDb, primo: string, ultimo: string): Promise<RigaBlocco[]> {
  const righe = await db.blocchi
    .where('[giornoLocale+inizio]')
    .between([primo, Dexie.minKey], [ultimo, Dexie.maxKey])
    .toArray();
  return righe.filter((r): r is RigaBlocco => vivo(r));
}
