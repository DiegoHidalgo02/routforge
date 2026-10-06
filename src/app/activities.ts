/**
 * «+ Crea» (S4; FUNZ §3, MECC §2): valida la bozza con il dominio e salva il blocco (todo, evento) o la definizione
 * (routine, routine di studio) con le sue occorrenze (MECC §7: la generazione parte anche alla creazione); le
 * notifiche le riconcilia T-019. Il fuso corrente arriva dal chiamante (D-TIME-2). Gli id delle fasi sono UUID:
 * restano stabili a rinomine e riordini (MECC §5).
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, newId, save, saveBlock } from '../data/repository';
import {
  editBlock,
  validateActivity,
  type BozzaAttivita,
  type ErroreAttivita,
  type FaseValida,
} from '../domain/activity';
import { enterGroup } from '../domain/ordering';
import { editRecurrence, generateOccurrences } from './recurrences';

/** Le fasi con il loro id (§5): quello che hanno già (Modifica), altrimenti un UUID; l'ordine è quello del form. */
const withIds = (fasi: readonly FaseValida[]) =>
  fasi.map((f, i) => ({ id: f.id ?? newId(), etichetta: f.etichetta, ordine: i + 1 }));

export type EsitoCreazione = { ok: true; id: string } | { ok: false; errori: ErroreAttivita[] };

export async function createActivity(
  db: RoutForgeDb,
  bozza: BozzaAttivita,
  now: number,
  fuso: string,
): Promise<EsitoCreazione> {
  const v = validateActivity(bozza);
  if (!v.ok) return v;
  const fasi = withIds(v.fasi);
  if (v.ricorrenza) {
    const { ricorrenza } = v;
    const id = await inTransaction(db, ['ricorrenze', 'blocchi'], async () => {
      const r = await save(db, 'ricorrenze', { ...ricorrenza, fasi, fuso }, now);
      await generateOccurrences(db, r, now, fuso);
      return r.id;
    });
    return { ok: true, id };
  }
  // Un todo nuovo entra nel suo gruppo di priorità in fondo (§6), anche quello delle voci rimaste (A7)
  const blocco = v.blocco.tipo === 'todo' ? enterGroup(v.blocco, now) : v.blocco;
  const b = await saveBlock(db, { ...blocco, ...(blocco.tipo === 'evento' ? { fasi } : {}) }, now, fuso);
  return { ok: true, id: b.id };
}

/**
 * «Modifica» dal Dettaglio (T-042; FUNZ §4, MECC §2, §4, §5, §7): valida la bozza come «+ Crea» e riscrive il blocco
 * (todo, evento: `editBlock`) o, per un'occorrenza di routine, la definizione (`editRecurrence`: vale dalle prossime
 * occorrenze, B6); le fasi tengono l'id che portano dal form (B5). Il tipo non si cambia. Le notifiche le riconcilia
 * T-019.
 */
export async function editActivity(
  db: RoutForgeDb,
  id: string,
  bozza: BozzaAttivita,
  now: number,
  fuso: string,
): Promise<EsitoCreazione> {
  const v = validateActivity(bozza);
  if (!v.ok) return v;
  return inTransaction(db, ['blocchi', 'ricorrenze', 'logFasi'], async () => {
    const prima = await get(db, 'blocchi', id);
    if (prima?.tipo !== bozza.tipo) return { ok: false, errori: [] };
    if (!v.ricorrenza) {
      await saveBlock(db, editBlock(prima, v.blocco, withIds(v.fasi), now), now, fuso);
      return { ok: true, id };
    }
    const r = prima.ricorrenzaId ? await get(db, 'ricorrenze', prima.ricorrenzaId) : undefined;
    if (!r) return { ok: false, errori: [] };
    const fasi = withIds(v.fasi);
    await editRecurrence(db, { ...r, ...v.ricorrenza, dateSaltate: r.dateSaltate, fasi, fuso }, now, fuso);
    return { ok: true, id: r.id };
  });
}
