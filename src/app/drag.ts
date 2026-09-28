/**
 * Trascinamento nella vista Giorno (MECC §15, FUNZ §2; S1 `drag`): il blocco rilasciato su un giorno della striscia o
 * su un orario si riscrive con la regola del dominio (`movedBlock`: giorno o orario nuovi, il perso torna
 * programmato), in una transazione. Restituisce l'annulla del toast, che rimette la riga di prima: giorno, orario,
 * stato e marcatura (SCENARI G3), purché il blocco sia ancora come l'ha lasciato lo spostamento: una spunta,
 * un'eliminazione o un altro spostamento arrivati nel frattempo restano. `null` se il rilascio non vale, senza
 * scrivere. Qui e nell'annulla T-019 ri-armerà le notifiche del blocco (§13.3: ogni mutazione di un singolo blocco). Il
 * puntatore di uno studio tornato programmato lo ricalcola il ciclo successivo, al più entro un minuto (D-SCHED-1).
 * Decisione: D-DRAG-1.
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, saveBlock } from '../data/repository';
import { movedBlock, type Rilascio } from '../domain/drag';

/** Sposta il blocco adesso; `fuso` è quello corrente del dispositivo (D-TIME-2). */
export async function moveBlock(
  db: RoutForgeDb,
  id: string,
  rilascio: Rilascio,
  now: number,
  fuso: string,
): Promise<((now: number) => Promise<void>) | null> {
  const fatto = await inTransaction(db, ['blocchi'], async () => {
    const prima = await get(db, 'blocchi', id);
    const spostato = prima ? movedBlock(prima, rilascio, now) : null;
    if (!prima || !spostato) return null;
    return { prima, scritto: await saveBlock(db, spostato, now, fuso) };
  });
  if (!fatto) return null;
  const { prima, scritto } = fatto;
  return (dopo) =>
    inTransaction(db, ['blocchi'], async () => {
      const ora = await get(db, 'blocchi', id);
      if (!ora || ora.stato !== scritto.stato || ora.inizio !== scritto.inizio || ora.fine !== scritto.fine) return;
      await saveBlock(db, prima, dopo, fuso);
    });
}
