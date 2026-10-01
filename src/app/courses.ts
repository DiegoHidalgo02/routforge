/**
 * Elenco dei corsi per Profilo → Corsi (S10; FUNZ §9.1, §9.3). Criterio: SCENARI H1 (corso salvato).
 *
 * I numeri si contano dalle righe salvate, non dai mock: il corso di esempio è 2 moduli · 13 unità (D-SAMPLE-1).
 * `esempio` dà il badge «Esempio» (D-IMPORT-1). Ordine: dal più vecchio import al più recente.
 */
import type { RoutForgeDb } from '../data/db';
import { list } from '../data/repository';

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
