/**
 * Elenco dei corsi per Profilo → Corsi (S10; FUNZ §9.1, §9.3). Criterio: SCENARI H1 (corso salvato). Il materiale di
 * un'unità per la sessione e la pagina dell'unità (`readUnitMaterial`, FORMATO §4).
 *
 * I numeri si contano dalle righe salvate, non dai mock: il corso di esempio è 2 moduli · 13 unità (D-SAMPLE-1).
 * `esempio` dà il badge «Esempio» (D-IMPORT-1). Ordine: dal più vecchio import al più recente.
 */
import type { RoutForgeDb } from '../data/db';
import { get, list, listBy } from '../data/repository';
import { sectionTitle, type RisorsaImportata, type SezioneImportata } from '../domain/course/parser';

export interface SchedaCorso {
  id: string;
  titolo: string;
  esempio: boolean;
  moduli: number;
  unita: number;
  completate: number;
  /** Percentuale di unità completate, intera (FUNZ §9.3). */
  pct: number;
  /** Tempo dedicato (FUNZ §9.3): somma dei minuti delle unità. */
  minuti: number;
}

export async function courseCards(db: RoutForgeDb): Promise<SchedaCorso[]> {
  const [corsi, moduli, unita] = await Promise.all([list(db, 'corsi'), list(db, 'moduli'), list(db, 'unita')]);
  return corsi
    .sort((a, b) => a.importatoIl - b.importatoIl)
    .map(({ id, titolo, esempio }) => {
      const sue = unita.filter((u) => u.corsoId === id);
      const completate = sue.filter((u) => u.stato === 'completata').length;
      return {
        id,
        titolo,
        esempio,
        moduli: moduli.filter((m) => m.corsoId === id).length,
        unita: sue.length,
        completate,
        pct: sue.length ? Math.round((completate / sue.length) * 100) : 0,
        minuti: sue.reduce((n, u) => n + u.minuti, 0),
      };
    });
}

/**
 * Il materiale di un'unità (FORMATO §4; scheda Materiale di S15, pagina dell'unità di S12): concetto core e sezioni
 * nell'ordine del file, ognuna col titolo da mostrare accanto al badge (`sectionTitle`) e con le sue risorse in ordine.
 * `null` se l'unità non c'è (eliminata, corso non importato).
 */
export interface MaterialeUnita {
  concettoCore: { titolo: string; testo: string } | null;
  sezioni: (Pick<SezioneImportata, 'id' | 'tipo' | 'descrizione' | 'stato'> & {
    titolo: string;
    risorse: RisorsaImportata[];
  })[];
}

export async function readUnitMaterial(db: RoutForgeDb, unitaId: string): Promise<MaterialeUnita | null> {
  const unita = await get(db, 'unita', unitaId);
  if (!unita) return null;
  const inOrdine = <T extends { ordine: number }>(x: T[]) => x.sort((a, b) => a.ordine - b.ordine);
  const sezioni = inOrdine(await listBy(db, 'sezioni', 'unitaId', unitaId));
  const risorse = await Promise.all(sezioni.map((s) => listBy(db, 'risorse', 'sezioneId', s.id)));
  return {
    concettoCore: unita.concettoCore,
    sezioni: sezioni.map(({ id, tipo, intestazione, descrizione, stato }, i) => ({
      id,
      tipo,
      titolo: sectionTitle(intestazione),
      descrizione,
      stato,
      risorse: inOrdine(risorse[i] ?? []).map(({ titolo, url, host, youtube }) => ({ titolo, url, host, youtube })),
    })),
  };
}
