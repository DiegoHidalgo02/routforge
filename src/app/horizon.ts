/**
 * Todo che rotolano a oggi (MECC §6): passo «spostamento todo» del ciclo dello scheduler (§9: dopo l'estensione delle
 * ricorrenze, prima di orfani e persi). La differenza la calcola il dominio (`src/domain/scheduler/horizon.ts`); qui
 * si leggono i blocchi e si scrive, in una transazione; senza cambiamenti non scrive nulla (INV-15). Restituisce gli id
 * dei todo il cui avviso «in ritardo» parte adesso: lo spedisce T-020, la chiamata a ogni ciclo è di T-013.
 * Criteri: SCENARI A1, A2. Decisione: D-HOR-1.
 */
import type { RoutForgeDb } from '../data/db';
import { blocksBetween, inTransaction, saveBlock } from '../data/repository';
import { shiftPeriod } from '../domain/calendar';
import { GIORNI_INDIETRO, rollPlan } from '../domain/scheduler/horizon';
import { localDayKey } from '../domain/time';

/** Sposta a oggi i todo con l'orizzonte non ancora scaduto (§6); `fuso` è quello corrente del dispositivo (D-TIME-2). */
export async function rollTodos(db: RoutForgeDb, now: number, fuso: string): Promise<string[]> {
  const oggi = localDayKey(now);
  return inTransaction(db, ['blocchi'], async () => {
    const piano = rollPlan(await blocksBetween(db, shiftPeriod(oggi, 'giorno', -GIORNI_INDIETRO), oggi), now);
    for (const b of piano.spostati) await saveBlock(db, b, now, fuso);
    return piano.avvisi;
  });
}
