/**
 * Riordino dei todo senza orario nella vista Giorno (MECC §15, §6; FUNZ §2; S1 `drag=lift`, `move`): il todo va a una
 * posizione del suo gruppo di priorità e si scrive la sua chiave d'ordine (quelle del gruppo solo se fra i nuovi vicini
 * non c'è spazio: `reorder` del dominio), in una transazione. Nessun orario, giorno, stato, orizzonte o notifica cambia (G3): la riconciliazione delle notifiche
 * segue la scrittura e non trova differenze. Nessun «Annulla» (§15).
 */
import type { RoutForgeDb } from '../data/db';
import { blocksBetween, get, inTransaction, saveBlock } from '../data/repository';
import { reorder } from '../domain/ordering';

/** Il todo `id` alla posizione `a` del suo gruppo; `false` senza scrivere se non si riordina. */
export async function reorderTodo(db: RoutForgeDb, id: string, a: number, now: number, fuso: string): Promise<boolean> {
  return inTransaction(db, ['blocchi'], async () => {
    const b = await get(db, 'blocchi', id);
    if (!b) return false;
    const giorno = await blocksBetween(db, b.giornoLocale, b.giornoLocale);
    const chiavi = reorder(giorno, id, a);
    if (!chiavi) return false;
    for (const x of giorno) {
      const ordine = chiavi.get(x.id);
      if (ordine !== undefined) await saveBlock(db, { ...x, ordine }, now, fuso);
    }
    return true;
  });
}
