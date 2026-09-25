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
 * Il tempo arriva come parametro: `now` e, per i blocchi, il fuso corrente letto dalla porta Clock di `app`.
 */
import Dexie from 'dexie';
import { localDayKey, localTimeKey } from '../domain/time';
import type { OraDiParete } from '../domain/types';
import type { CampiComuni, RoutForgeDb, Tabelle, Tombstone } from './db';

// La lib della radice è ES2022 senza DOM (D-TS-1): si dichiara solo la parte di Web Crypto che si usa.
// ponytail: randomUUID vuole un contesto sicuro (https, localhost, WebView Android); iOS da verificare in T-036.
declare const crypto: { randomUUID(): string };

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

/** Crea o aggiorna un record (i blocchi passano da `saveBlock`). Salvare l'id di una tombstone la rianima. */
export async function save<K extends Exclude<NomeTabella, 'blocchi'>>(
  db: RoutForgeDb,
  nome: K,
  dati: Dati<Tabelle[K]>,
  now: number,
): Promise<Tabelle[K]> {
  const t = tabella(db, nome);
  return db.transaction('rw', t, async () => {
    const id = dati.id ?? crypto.randomUUID();
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
    const id = dati.id ?? crypto.randomUUID();
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

/** Blocchi vivi di un giorno locale "YYYY-MM-DD", in ordine d'inizio (indice `[giornoLocale+inizio]`). */
export async function blocksOfDay(db: RoutForgeDb, giornoLocale: string): Promise<RigaBlocco[]> {
  const righe = await db.blocchi
    .where('[giornoLocale+inizio]')
    .between([giornoLocale, Dexie.minKey], [giornoLocale, Dexie.maxKey])
    .toArray();
  return righe.filter((r): r is RigaBlocco => vivo(r));
}
