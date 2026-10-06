/**
 * Elenco dei corsi per Profilo → Corsi (S10; FUNZ §9.1, §9.3). Criterio: SCENARI H1 (corso salvato). Il materiale di
 * un'unità per la sessione e la pagina dell'unità (`readUnitMaterial`, FORMATO §4). Il corso con i moduli (`readCourse`, S11).
 *
 * I numeri si contano dalle righe salvate, non dai mock: il corso di esempio è 2 moduli · 13 unità (D-SAMPLE-1).
 * `esempio` dà il badge «Esempio» (D-IMPORT-1). Ordine: dal più vecchio import al più recente.
 */
import type { RoutForgeDb } from '../data/db';
import { get, list, listBy } from '../data/repository';
import { sectionTitle, type RisorsaImportata, type SezioneImportata } from '../domain/course/parser';
import { criteriaMet, sortedUnits, statiModuli } from '../domain/pointer';
import { courseDefaultUnit } from '../domain/session';
import type { StatoModulo, StatoUnita } from '../domain/types';

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
  /** L'unità che il corso propone adesso (S10 «Prossima», MECC §11); `null` a corso finito. */
  prossima: { id: string; numero: string; titolo: string } | null;
}

export async function courseCards(db: RoutForgeDb): Promise<SchedaCorso[]> {
  const [corsi, moduli, unita] = await Promise.all([list(db, 'corsi'), list(db, 'moduli'), list(db, 'unita')]);
  return corsi
    .sort((a, b) => a.importatoIl - b.importatoIl)
    .map(({ id, titolo, esempio }) => {
      const sue = sortedUnits(unita.filter((u) => u.corsoId === id));
      const completate = sue.filter((u) => u.stato === 'completata').length;
      const percorso = moduli
        .filter((m) => m.corsoId === id)
        .map((m) => ({ numero: m.numero, criteriSoddisfatti: criteriaMet(m.criteri) }));
      const p = sue.find((u) => u.id === courseDefaultUnit(sue, percorso));
      return {
        id,
        titolo,
        esempio,
        moduli: moduli.filter((m) => m.corsoId === id).length,
        unita: sue.length,
        completate,
        pct: sue.length ? Math.round((completate / sue.length) * 100) : 0,
        minuti: sue.reduce((n, u) => n + u.minuti, 0),
        prossima: p ? { id: p.id, numero: p.numero, titolo: p.titolo } : null,
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

/**
 * Il corso con i suoi moduli (S11 «Corso → moduli»; FUNZ §9.3, MECC §11): avanzamento, la prima routine di studio del
 * corso, l'unità del puntatore e i moduli in ordine con lo stato (`statiModuli`: aperto, bloccato, passato) e le unità.
 * `null` se il corso non c'è.
 */
export interface VistaCorso {
  scheda: SchedaCorso;
  importatoIl: number;
  routine: { giorni: number[]; orarioInizio: string } | null;
  puntatore: { id: string; numero: string; titolo: string } | null;
  moduli: {
    id: string;
    numero: number;
    nn: string;
    titolo: string;
    tipo: string;
    finestraIndicativa: string;
    stato: StatoModulo;
    unita: { id: string; numero: string; titolo: string; stato: StatoUnita }[];
    /** «Verifica del modulo» (S11): domande, esercizi, criteri Go/No-Go soddisfatti sul totale, progetto. */
    domande: number;
    esercizi: string[];
    criteri: { fatti: number; totali: number };
    progetto: string | null;
  }[];
}

export async function readCourse(db: RoutForgeDb, corsoId: string): Promise<VistaCorso | null> {
  const corso = await get(db, 'corsi', corsoId);
  if (!corso) return null;
  const [moduli, unita, ricorrenze] = await Promise.all([
    listBy(db, 'moduli', 'corsoId', corsoId),
    listBy(db, 'unita', 'corsoId', corsoId),
    listBy(db, 'ricorrenze', 'corsoId', corsoId),
  ]);
  const percorso = moduli.map((m) => ({ numero: m.numero, criteriSoddisfatti: criteriaMet(m.criteri) }));
  const stati = statiModuli(percorso);
  const ordinate = sortedUnits(unita);
  const proposta = courseDefaultUnit(ordinate, percorso);
  const u = ordinate.find((x) => x.id === proposta);
  const r = ricorrenze.filter((x) => x.tipo === 'studio').sort((a, b) => a.createdAt - b.createdAt)[0];
  const completate = unita.filter((x) => x.stato === 'completata').length;
  const puntatore = u ? { id: u.id, numero: u.numero, titolo: u.titolo } : null;
  return {
    scheda: {
      id: corso.id,
      titolo: corso.titolo,
      esempio: corso.esempio,
      moduli: moduli.length,
      unita: unita.length,
      completate,
      pct: unita.length ? Math.round((completate / unita.length) * 100) : 0,
      minuti: unita.reduce((n, x) => n + x.minuti, 0),
      prossima: puntatore,
    },
    importatoIl: corso.importatoIl,
    routine: r ? { giorni: r.giorni, orarioInizio: r.orarioInizio } : null,
    puntatore,
    moduli: moduli
      .sort((a, b) => a.numero - b.numero)
      .map((m) => ({
        id: m.id,
        numero: m.numero,
        nn: m.nn,
        titolo: m.titolo,
        tipo: m.tipo,
        finestraIndicativa: m.finestraIndicativa,
        stato: stati.get(m.numero) ?? 'bloccato',
        unita: ordinate
          .filter((x) => x.moduloId === m.id)
          .map(({ id, numero, titolo, stato }) => ({ id, numero, titolo, stato })),
        domande: m.domande.length,
        esercizi: m.esercizi,
        criteri: { fatti: m.criteri.filter((c) => c.fatto).length, totali: m.criteri.length },
        progetto: m.progetto?.titolo ?? null,
      })),
  };
}
