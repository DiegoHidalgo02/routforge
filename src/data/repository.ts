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
 * Il tempo arriva come parametro: `now` e, per i blocchi, il fuso corrente letto dalla porta Clock di `app`.
 */
import Dexie, { liveQuery } from 'dexie';
import type { CorsoImportato } from '../domain/course/parser';
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
  db.transaction(
    'rw',
    tabelle.map((t) => db.table(t)),
    fn,
  );

/** I record vivi con `indice` uguale a `valore` (un indice secondario di `SCHEMA_V1`, es. `ricorrenzaId`, MECC §7). */
export async function listBy<K extends NomeTabella>(
  db: RoutForgeDb,
  nome: K,
  indice: keyof Tabelle[K] & string,
  valore: string,
): Promise<Tabelle[K][]> {
  const righe = await tabella(db, nome).where(indice).equals(valore).toArray();
  return righe.filter((r): r is Tabelle[K] => vivo(r));
}

/** Crea o aggiorna un record (i blocchi passano da `saveBlock`). Salvare l'id di una tombstone la rianima. */
export async function save<K extends Exclude<NomeTabella, 'blocchi'>>(
  db: RoutForgeDb,
  nome: K,
  dati: Dati<Tabelle[K]>,
  now: number,
): Promise<Tabelle[K]> {
  const t = tabella(db, nome);
  return db.transaction('rw', t, async () => {
    const id = dati.id ?? newId();
    const prev = await t.get(id);
    const rec = { ...dati, id, createdAt: prev?.createdAt ?? now, updatedAt: now, deletedAt: null } as Tabelle[K];
    await t.put(rec);
    return rec;
  });
}

/** Elimina lasciando una tombstone minima; un record assente o già eliminato resta com'è. */
export async function remove<K extends NomeTabella>(db: RoutForgeDb, nome: K, id: string, now: number): Promise<void> {
  const t = tabella(db, nome);
  await db.transaction('rw', t, async () => {
    const prev = await t.get(id);
    if (!vivo(prev)) return;
    const tombstone: Tombstone = { id, createdAt: prev.createdAt, updatedAt: now, deletedAt: now };
    await t.put(tombstone);
  });
}

/** Crea o aggiorna un blocco; `fuso` è il fuso corrente del dispositivo (D-TIME-2). */
export async function saveBlock(db: RoutForgeDb, dati: DatiBlocco, now: number, fuso: string): Promise<RigaBlocco> {
  return db.transaction('rw', db.blocchi, async () => {
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
    const rec: RigaBlocco = { ...dati, ...ora, id, createdAt: prev?.createdAt ?? now, updatedAt: now, deletedAt: null };
    await db.blocchi.put(rec);
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
 * interrompe la UI (INV-16): la schermata resta all'ultimo valore; la registrazione in Diagnostica arriva con T-032.
 */
export function watch<T>(query: () => Promise<T>, onChange: (v: T) => void): () => void {
  const s = liveQuery(query).subscribe({ next: onChange, error: () => {} });
  return () => s.unsubscribe();
}

/** Blocchi vivi di un giorno locale "YYYY-MM-DD", in ordine d'inizio (indice `[giornoLocale+inizio]`). */
export const blocksOfDay = (db: RoutForgeDb, giornoLocale: string): Promise<RigaBlocco[]> =>
  blocksBetween(db, giornoLocale, giornoLocale);

/** Blocchi vivi dei giorni locali da `primo` a `ultimo` inclusi, per giorno e poi per inizio (stesso indice). */
export async function blocksBetween(db: RoutForgeDb, primo: string, ultimo: string): Promise<RigaBlocco[]> {
  const righe = await db.blocchi
    .where('[giornoLocale+inizio]')
    .between([primo, Dexie.minKey], [ultimo, Dexie.maxKey])
    .toArray();
  return righe.filter((r): r is RigaBlocco => vivo(r));
}
