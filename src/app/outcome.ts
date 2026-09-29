/**
 * Esiti di studio (MECC §11, §12; `SessionService.registerOutcome` di docs/02_ARCHITETTURA.md §4): unità, blocco,
 * streak e puntatore in una transazione. Le regole stanno in `domain/outcome.ts`, `domain/pointer.ts` e
 * `domain/streak.ts`; qui si leggono e si scrivono le righe. La chiusura del timer (`endSession`) chiama `writeOutcome`
 * nella sua transazione; «Registra esito» senza sessione è `registerOutcome`. La streak si persiste qui, in
 * `preferenze.streak`, e si legge con `currentStreak` (D-SCHED-1). Criteri: SCENARI C2, C3, C6, C7, C9. D-ESITO-1.
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, listBy, save, saveBlock, type DatiBlocco } from '../data/repository';
import { canRegisterOutcome, outcomeBlock, outcomeUnits, plannedMinutes, type DatiEsito } from '../domain/outcome';
import { creditStreak, currentStreak, EMPTY_STREAK, outcomeCountsForStreak, type StatoStreak } from '../domain/streak';
import { recomputePointer } from './pointer';

/** Riga di `preferenze` della streak (MECC §1). */
export const CHIAVE_STREAK = 'streak';

/** Tabelle che un esito scrive: da includere nella transazione del chiamante. */
export const TABELLE_ESITO = ['blocchi', 'unita', 'moduli', 'preferenze'] as const;

async function readStreakState(db: RoutForgeDb): Promise<StatoStreak> {
  const v = (await get(db, 'preferenze', CHIAVE_STREAK))?.valore;
  // Una riga illeggibile vale come nessuna streak
  return typeof v === 'object' && v !== null && 'conteggio' in v && typeof v.conteggio === 'number'
    ? (v as StatoStreak)
    : EMPTY_STREAK;
}

/** La streak da mostrare adesso (§12): 0 se l'ultimo giorno contato non è oggi né ieri. */
export const readStreak = async (db: RoutForgeDb, now: number): Promise<number> =>
  currentStreak(await readStreakState(db), now);

/**
 * Scrive l'esito dentro la transazione del chiamante (tabelle `TABELLE_ESITO`): unità (la pianificata, la precedente per
 * Indietro, le altre toccate con i minuti), blocco, streak per Completata e Continua, puntatore del corso.
 */
export async function writeOutcome(
  db: RoutForgeDb,
  p: {
    blocco: DatiBlocco;
    unitaId: string | null;
    minuti: number;
    minutiPerUnita: Readonly<Record<string, number>>;
    dati: DatiEsito;
  },
  now: number,
  fuso: string,
): Promise<void> {
  const pianificata = p.unitaId ? await get(db, 'unita', p.unitaId) : undefined;
  const percorso = pianificata ? await listBy(db, 'unita', 'corsoId', pianificata.corsoId) : [];
  const altre = await Promise.all(
    Object.keys(p.minutiPerUnita)
      .filter((id) => !percorso.some((u) => u.id === id))
      .map((id) => get(db, 'unita', id)),
  );
  const unita = [...percorso, ...altre.filter((u) => u !== undefined)];
  for (const u of outcomeUnits(unita, pianificata?.id ?? null, p.dati, p.minutiPerUnita))
    await save(db, 'unita', u, now);
  await saveBlock(db, outcomeBlock(p.blocco, p.dati, p.minuti, now, pianificata ?? null), now, fuso);
  // §12: solo un esito che conta nel piano (la chiusura arriva qui solo se conta; il controllo resta per chi chiama)
  if (p.dati.contaNelPiano && outcomeCountsForStreak(p.dati.esito))
    await save(db, 'preferenze', { id: CHIAVE_STREAK, valore: creditStreak(await readStreakState(db), now) }, now);
  if (pianificata) await recomputePointer(db, pianificata.corsoId, now, fuso);
}

/**
 * «Registra esito» senza sessione (§11, C6): minuti = durata pianificata, senza confidenza per un blocco senza unità.
 * `false` senza scrivere se il blocco non è (più) un esito pendente.
 */
export function registerOutcome(
  db: RoutForgeDb,
  bloccoId: string,
  dati: Omit<DatiEsito, 'contaNelPiano'>,
  now: number,
  fuso: string,
): Promise<boolean> {
  return inTransaction(db, TABELLE_ESITO, async () => {
    const b = await get(db, 'blocchi', bloccoId);
    if (!b || !canRegisterOutcome(b, now)) return false;
    const minuti = plannedMinutes(b, dati.esito);
    const unitaId = b.unitaId ?? null;
    await writeOutcome(
      db,
      {
        blocco: b,
        unitaId,
        minuti,
        minutiPerUnita: unitaId ? { [unitaId]: minuti } : {},
        dati: { ...dati, confidenza: unitaId ? dati.confidenza : null, contaNelPiano: true },
      },
      now,
      fuso,
    );
    return true;
  });
}
