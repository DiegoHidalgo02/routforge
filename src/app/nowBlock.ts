/**
 * Card «Adesso» (S1; FUNZ §2, MECC §14): gli ingressi della scelta. La regola (candidati, in corso, stato, hero) sta in
 * `domain/nowBlock.ts`; qui si leggono i blocchi di ieri, di oggi e di domani — un candidato sta in
 * [inizio − 30', fine + 30']: la fine di un blocco con orario cade al più il giorno dopo l'inizio (fine ≤ inizio = giorno
 * dopo, §2 e §7; senza durata = 23:59, D-NOW-1) e un blocco di domani è candidato da 30' prima della mezzanotte.
 * L'orologio batte nella schermata: la scelta si ricalcola con `heroBlock` a ogni minuto senza rileggere. Nessuna
 * chiusura (§14). Criteri: SCENARI G1, G2, E3. Decisione: D-NOW-2.
 */
import type { RoutForgeDb } from '../data/db';
import { blocksBetween, get, list } from '../data/repository';
import { shiftPeriod } from '../domain/calendar';
import type { SessioneAttiva } from '../domain/session';
import type { BloccoCalendario } from './calendar';
import { readActiveSession } from './session';

/**
 * Un blocco come lo mostra la card Adesso: orari di parete e, per lo studio, il titolo del corso e il numero
 * dell'unità puntata (sottotitolo «corso · Unità n.n» di S1).
 */
export type BloccoAdesso = BloccoCalendario & { corsoTitolo?: string; unitaNumero?: string };

export interface IngressiAdesso {
  /** I blocchi vivi di ieri, di oggi e di domani, in ordine d'inizio: il dominio sceglie fra questi. */
  blocchi: BloccoAdesso[];
  /** La sessione attiva, per l'azione dello studio (Riprendi, T-016). */
  attiva: SessioneAttiva | null;
}

/** Gli ingressi della card Adesso per il giorno locale `oggi` ("YYYY-MM-DD"). */
export async function nowInputs(db: RoutForgeDb, oggi: string): Promise<IngressiAdesso> {
  const blocchi = await blocksBetween(db, shiftPeriod(oggi, 'giorno', -1), shiftPeriod(oggi, 'giorno', 1));
  const corsi = new Map((await list(db, 'corsi')).map((c) => [c.id, c.titolo]));
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
    attiva: await readActiveSession(db),
  };
}
