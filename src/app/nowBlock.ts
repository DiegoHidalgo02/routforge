/**
 * Blocco «Adesso / prossimo» (S1; FUNZ §2, MECC §14): gli ingressi della scelta e la chiusura per oggi. La regola
 * (candidati, in corso, stato, chiusura per giorno e per blocco) sta in `domain/nowBlock.ts`; qui si leggono i blocchi
 * di ieri, di oggi e di domani — un candidato sta in [inizio − 30', fine + 30']: la fine di un blocco con orario cade
 * al più il giorno dopo l'inizio (fine ≤ inizio = giorno dopo, §2 e §7; senza durata = 23:59, D-NOW-1) e un blocco di
 * domani è candidato da 30' prima della mezzanotte — e le chiusure
 * memorizzate in `preferenze` (id = chiave, D-DATA-2). L'orologio batte nella schermata: la scelta si ricalcola con
 * `selectNowBlock` a ogni minuto senza rileggere. Criteri: SCENARI G1, G2, E3. Decisione: D-NOW-2.
 */
import type { RoutForgeDb } from '../data/db';
import { blocksBetween, get, inTransaction, list, save, watch } from '../data/repository';
import { shiftPeriod } from '../domain/calendar';
import { dismissKey } from '../domain/nowBlock';
import { localDayKey } from '../domain/time';
import type { Blocco } from '../domain/types';
import type { SessioneAttiva } from '../domain/session';
import type { BloccoCalendario } from './calendar';
import { readActiveSession } from './session';

/**
 * Un blocco come lo mostra il blocco Adesso: orari di parete e, per lo studio, il titolo del corso e il numero
 * dell'unità puntata (sottotitolo «corso · Unità n.n» di S1).
 */
export type BloccoAdesso = BloccoCalendario & { corsoTitolo?: string; unitaNumero?: string };

export interface IngressiAdesso {
  /** I blocchi vivi di ieri, di oggi e di domani, in ordine d'inizio: il dominio sceglie fra questi. */
  blocchi: BloccoAdesso[];
  /** Chiavi di chiusura `giorno|blocco` (`dismissKey`) memorizzate. */
  chiusi: ReadonlySet<string>;
  /** La sessione attiva, per l'azione dello studio (Riprendi, T-016). */
  attiva: SessioneAttiva | null;
}

/** Riga di `preferenze` con le chiavi di chiusura del giorno corrente (le altre si potano a ogni chiusura). */
export const CHIAVE_ADESSO_CHIUSO = 'adessoChiuso';

async function chiusure(db: RoutForgeDb): Promise<string[]> {
  const valore = (await get(db, 'preferenze', CHIAVE_ADESSO_CHIUSO))?.valore;
  return Array.isArray(valore) ? valore.filter((k): k is string => typeof k === 'string') : [];
}

/** Gli ingressi del blocco Adesso per il giorno locale `oggi` ("YYYY-MM-DD"). */
export async function nowInputs(db: RoutForgeDb, oggi: string): Promise<IngressiAdesso> {
  const blocchi = await blocksBetween(db, shiftPeriod(oggi, 'giorno', -1), shiftPeriod(oggi, 'giorno', 1));
  const corsi = new Map((await list(db, 'corsi')).map((c) => [c.id, c.titolo]));
  const chiusi = new Set(await chiusure(db));
  const numero = async (unitaId: string | null | undefined) =>
    unitaId ? (await get(db, 'unita', unitaId))?.numero : undefined;
  return {
    blocchi: await Promise.all(
      blocchi.map(async (b) => {
        if (b.tipo !== 'studio') return b;
        const corsoTitolo = b.corsoId ? corsi.get(b.corsoId) : undefined;
        const unitaNumero = await numero(b.unitaId);
        return {
          ...b,
          ...(corsoTitolo !== undefined && { corsoTitolo }),
          ...(unitaNumero !== undefined && { unitaNumero }),
        };
      }),
    ),
    chiusi,
    attiva: await readActiveSession(db),
  };
}

/** Osserva gli ingressi: `onChange` riceve subito e dopo ogni scrittura su blocchi, corsi o preferenze. Restituisce lo stop. */
export const watchNowInputs = (db: RoutForgeDb, oggi: string, onChange: (i: IngressiAdesso) => void): (() => void) =>
  watch(() => nowInputs(db, oggi), onChange);

/** Chiude il blocco Adesso per oggi (§14): la chiave vale per questo blocco e questo giorno; le chiavi di altri giorni si potano. */
export async function dismissNowBlock(db: RoutForgeDb, block: Pick<Blocco, 'id'>, now: number): Promise<void> {
  const chiave = dismissKey(block, now);
  const prefisso = `${localDayKey(now)}|`;
  await inTransaction(db, ['preferenze'], async () => {
    const vive = (await chiusure(db)).filter((k) => k.startsWith(prefisso) && k !== chiave);
    await save(db, 'preferenze', { id: CHIAVE_ADESSO_CHIUSO, valore: [...vive, chiave] }, now);
  });
}
