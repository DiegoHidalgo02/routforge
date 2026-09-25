/**
 * «+ Crea» (S4; FUNZ §3, MECC §2): valida la bozza con il dominio e salva il blocco (todo, evento) o la definizione
 * (routine, routine di studio) con le sue occorrenze (MECC §7: la generazione parte anche alla creazione); le
 * notifiche le riconcilia T-019. Il fuso corrente arriva dal chiamante (D-TIME-2). Gli id delle fasi sono UUID:
 * restano stabili a rinomine e riordini (MECC §5).
 */
import type { RoutForgeDb } from '../data/db';
import { inTransaction, newId, save, saveBlock } from '../data/repository';
import { validateActivity, type BozzaAttivita, type ErroreAttivita } from '../domain/activity';
import { generateOccurrences } from './recurrences';

export type EsitoCreazione = { ok: true; id: string } | { ok: false; errori: ErroreAttivita[] };

export async function createActivity(
  db: RoutForgeDb,
  bozza: BozzaAttivita,
  now: number,
  fuso: string,
): Promise<EsitoCreazione> {
  const v = validateActivity(bozza);
  if (!v.ok) return v;
  const fasi = v.fasi.map((etichetta, i) => ({ id: newId(), etichetta, ordine: i + 1 }));
  if (v.ricorrenza) {
    const { ricorrenza } = v;
    const id = await inTransaction(db, ['ricorrenze', 'blocchi'], async () => {
      const r = await save(db, 'ricorrenze', { ...ricorrenza, fasi, fuso }, now);
      await generateOccurrences(db, r, now, fuso);
      return r.id;
    });
    return { ok: true, id };
  }
  const b = await saveBlock(db, { ...v.blocco, ...(v.blocco.tipo === 'evento' ? { fasi } : {}) }, now, fuso);
  return { ok: true, id: b.id };
}
