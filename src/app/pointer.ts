/**
 * Puntatore di un corso (MECC §11; `CoursePointer.recompute` di docs/02_ARCHITETTURA.md §4): le occorrenze di studio
 * future `programmate` del corso ricevono, in ordine, le unità pendenti dei moduli aperti (D-PTR-1). La regola sta nel
 * dominio (`pointerPlan`); qui si leggono unità, moduli e blocchi e si scrivono, in una transazione, solo gli `unitaId`
 * che cambiano: senza cambiamenti nessuna scrittura (INV-15). Lo chiama il ciclo dello scheduler per ogni corso
 * (D-SCHED-1); dopo ogni esito lo chiamerà T-018. I blocchi si leggono per stato: quelli `programmati` sono pochi,
 * mentre quelli di un corso crescono con la storia. Criterio: SCENARI C1.
 */
import type { RoutForgeDb } from '../data/db';
import { inTransaction, listBy, saveBlock } from '../data/repository';
import { pointerPlan } from '../domain/pointer';
import { logError } from './diagnostics';

/** Ricalcola il puntatore del corso adesso; `fuso` è quello corrente del dispositivo (D-TIME-2). */
export async function recomputePointer(db: RoutForgeDb, corsoId: string, now: number, fuso: string): Promise<void> {
  await inTransaction(db, ['blocchi', 'unita', 'moduli'], async () => {
    const unita = await listBy(db, 'unita', 'corsoId', corsoId);
    const moduli = await listBy(db, 'moduli', 'corsoId', corsoId);
    const blocchi = (await listBy(db, 'blocchi', 'stato', 'programmato')).filter((b) => b.corsoId === corsoId);
    let piano: ReturnType<typeof pointerPlan>;
    try {
      piano = pointerPlan(unita, moduli, blocchi, now);
    } catch (e) {
      // Un modulo o un'unità che non si leggono (dato rotto, anche da un backup) fermano solo il puntatore di questo
      // corso: senza scritture la sotto-transazione si chiude bene e il ciclo prosegue (audit P1-2, D-SCHED-1 n. 8)
      logError('ciclo', `puntatore del corso ${corsoId} non calcolato: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    for (const b of blocchi)
      if (piano.has(b.id)) await saveBlock(db, { ...b, unitaId: piano.get(b.id) ?? null }, now, fuso, 'ciclo');
  });
}
