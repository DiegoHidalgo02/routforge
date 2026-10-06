/**
 * Elenco dei corsi per Profilo → Corsi (S10; FUNZ §9.1, §9.3). Criterio: SCENARI H1 (corso salvato). Il materiale di
 * un'unità per la sessione e la pagina dell'unità (`readUnitMaterial`, FORMATO §4). Il corso con i moduli (`readCourse`, S11),
 * il modulo con la verifica e la spunta dei criteri Go/No-Go (`readModule`, `setCriterion`), l'unità (`readUnit`, S12).
 *
 * I numeri si contano dalle righe salvate, non dai mock: il corso di esempio è 2 moduli · 13 unità (D-SAMPLE-1).
 * `esempio` dà il badge «Esempio» (D-IMPORT-1). Ordine: dal più vecchio import al più recente.
 */
import type { RoutForgeDb } from '../data/db';
import { get, inTransaction, list, listBy, save } from '../data/repository';
import {
  sectionTitle,
  type ModuloImportato,
  type RisorsaImportata,
  type SezioneImportata,
} from '../domain/course/parser';
import { criteriaMet, sortedUnits, statiModuli } from '../domain/pointer';
import { courseDefaultUnit } from '../domain/session';
import { sessionMinutes } from '../domain/outcome';
import type { Esito, StatoModulo, StatoUnita } from '../domain/types';
import { recomputePointer } from './pointer';

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
  sezioni: (Pick<SezioneImportata, 'id' | 'tipo' | 'intestazione' | 'descrizione' | 'stato'> & {
    /** Il titolo accanto al badge nel Materiale della sessione (D-SEZ-1); S11 e S12 mostrano `intestazione`. */
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
      intestazione,
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

/**
 * Il modulo (S11 «Modulo → unità»; FUNZ §9.3, MECC §11, §16): intestazione, obiettivi, unità con lo stato e la verifica
 * (domande, esercizi, criteri Go/No-Go, No-Go, progetto, test di fit). Stati e puntatore come in `readCourse`. `null` se
 * il modulo non c'è.
 */
export interface VistaModulo {
  corso: { id: string; titolo: string };
  modulo: Pick<
    ModuloImportato,
    | 'id'
    | 'numero'
    | 'nn'
    | 'titolo'
    | 'tipo'
    | 'prerequisiti'
    | 'finestraIndicativa'
    | 'trasversali'
    | 'intro'
    | 'obiettivi'
    | 'domande'
    | 'esercizi'
    | 'criteri'
    | 'noGo'
    | 'riassunto'
    | 'progetto'
    | 'testDiFit'
  > & { stato: StatoModulo };
  /** Le unità con quante sezioni e quanti link hanno (S11 Modulo: «4 sezioni · 5 link»). */
  unita: (VistaCorso['moduli'][number]['unita'][number] & { sezioni: number; link: number })[];
  puntatore: VistaCorso['puntatore'];
}

export async function readModule(db: RoutForgeDb, corsoId: string, numero: number): Promise<VistaModulo | null> {
  const v = await readCourse(db, corsoId);
  const m = v?.moduli.find((x) => x.numero === numero);
  const riga = m && (await get(db, 'moduli', m.id));
  if (!v || !m || !riga) return null;
  const { corsoId: _c, createdAt: _a, updatedAt: _u, deletedAt: _d, markdown: _m, ...modulo } = riga;
  const [sezioni, risorse] = await Promise.all([
    listBy(db, 'sezioni', 'corsoId', corsoId),
    listBy(db, 'risorse', 'corsoId', corsoId),
  ]);
  return {
    corso: { id: v.scheda.id, titolo: v.scheda.titolo },
    modulo: { ...modulo, stato: m.stato },
    unita: m.unita.map((u) => {
      const sue = new Set(sezioni.filter((x) => x.unitaId === u.id).map((x) => x.id));
      return { ...u, sezioni: sue.size, link: risorse.filter((r) => sue.has(r.sezioneId)).length };
    }),
    puntatore: v.puntatore,
  };
}

/**
 * Spunta a mano un criterio Go/No-Go (S11; MECC §11, §16): solo quelli non automatici, che spunta il quiz (D-QUIZ-1).
 * Gli stati dei moduli cambiano, quindi si ricalcola il puntatore del corso.
 */
export async function setCriterion(
  db: RoutForgeDb,
  moduloId: string,
  indice: number,
  fatto: boolean,
  now: number,
  fuso: string,
): Promise<void> {
  await inTransaction(db, ['moduli', 'unita', 'blocchi'], async () => {
    const m = await get(db, 'moduli', moduloId);
    const c = m?.criteri[indice];
    if (!m || !c || c.auto || c.fatto === fatto) return;
    await save(db, 'moduli', { ...m, criteri: m.criteri.map((x, i) => (i === indice ? { ...x, fatto } : x)) }, now);
    await recomputePointer(db, m.corsoId, now, fuso);
  });
}

/**
 * L'unità (S12; FUNZ §9.3, §11, MECC §11): titolo, modulo e corso, stato, se è la prossima del puntatore, l'ultima
 * sessione che le ha dato minuti (con l'esito, se l'aveva sulla pianificata) e il materiale. `null` se non c'è.
 */
export interface VistaUnita {
  corso: { id: string; titolo: string };
  modulo: { numero: number; nn: string; titolo: string };
  unita: { id: string; numero: string; titolo: string; stato: StatoUnita };
  puntatore: boolean;
  ultimaSessione: { avvio: number; minuti: number; esito: Esito | null } | null;
  materiale: MaterialeUnita;
}

export async function readUnit(db: RoutForgeDb, unitaId: string): Promise<VistaUnita | null> {
  const u = await get(db, 'unita', unitaId);
  const [m, c, materiale, v] = u
    ? await Promise.all([
        get(db, 'moduli', u.moduloId),
        get(db, 'corsi', u.corsoId),
        readUnitMaterial(db, unitaId),
        readCourse(db, u.corsoId),
      ])
    : [];
  if (!u || !m || !c || !materiale) return null;
  // L'ultima sessione chiusa che ha dato minuti all'unità (multi-materia compresa, D3)
  const sessioni = (await list(db, 'sessioni'))
    .map((s) => ({ s, minuti: sessionMinutes(s.riepilogo).perUnita[unitaId] ?? 0 }))
    .filter((x) => x.minuti > 0)
    .sort((a, b) => b.s.avvio - a.s.avvio);
  const ultima = sessioni[0];
  return {
    corso: { id: c.id, titolo: c.titolo },
    modulo: { numero: m.numero, nn: m.nn, titolo: m.titolo },
    unita: { id: u.id, numero: u.numero, titolo: u.titolo, stato: u.stato },
    puntatore: v?.puntatore?.id === unitaId,
    ultimaSessione: ultima
      ? {
          avvio: ultima.s.avvio,
          minuti: ultima.minuti,
          esito: ultima.s.unitaId === unitaId ? (ultima.s.esito?.esito ?? null) : null,
        }
      : null,
    materiale,
  };
}
