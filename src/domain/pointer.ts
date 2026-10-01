/**
 * Esiti e puntatore dell'unità.
 * Fonti: RoutForge_MECCANISMI.md §11; RoutForge_FORMATO_CORSO.md §4 (moduli bloccati).
 * Criteri: SCENARI C1 (puntatore iniziale), C3 (Completata / Indietro / Salta), C2 (progresso).
 *
 * Puntatore: unità in ordine modulo → unità; pendenti = non_iniziata / parziale / da_rivedere;
 * i blocchi di studio futuri `programmati` del corso, in ordine cronologico, ricevono la
 * i-esima pendente (oltre le pendenti: nessuna unità). Unità corrente = prima pendente.
 *
 * Decisione D-PTR-1 (FORMATO_CORSO §4 prevale su §11 perché più specifico): un modulo è
 * bloccato finché il precedente non ha tutti i criteri Go/No-Go a "sì"; il primo modulo è
 * sempre aperto; il puntatore NON entra in un modulo bloccato. Senza criteri, tutti i moduli
 * sono aperti (coerente con C1, dove il corso non ha criteri).
 */
import {
  STATI_UNITA_PENDENTI,
  type Blocco,
  type Esito,
  type StatoBlocco,
  type StatoUnita,
  type StatoModulo,
} from './types';

export interface UnitaPercorso {
  id: string;
  /** Numero del modulo (ordine dal nome file, FORMATO_CORSO §1). */
  moduloNumero: number;
  /** Posizione dell'unità dentro il modulo (ordine nel file). */
  ordine: number;
  stato: StatoUnita;
  /** Minuti accreditati (§11). */
  minuti: number;
  /** Progresso 0..1 (§11). */
  progresso: number;
  /** Ore stimate dal file del corso, se dichiarate (FORMATO_CORSO §3). */
  oreStimate?: number | null;
}

export interface ModuloPercorso {
  numero: number;
  /** true se tutti i criteri Go/No-Go del modulo sono "sì" (vacuamente vero senza criteri). */
  criteriSoddisfatti: boolean;
}

export interface BloccoStudioFuturo {
  id: string;
  inizio: number;
}

/** Un blocco come lo guarda il puntatore: quali ricevono l'unità e quale hanno adesso (§11). */
export type BloccoPuntatore = Pick<Blocco, 'id' | 'tipo' | 'stato' | 'inizio' | 'unitaId'>;

/** Tutti i criteri Go/No-Go del modulo a sì, vero anche senza criteri: il modulo è passato (FORMATO_CORSO §4). */
export const criteriaMet = (criteri: readonly { fatto: boolean }[]): boolean => criteri.every((c) => c.fatto);

/** Ordine di percorso: modulo → unità. */
export function sortedUnits<U extends UnitaPercorso>(units: readonly U[]): U[] {
  return [...units].sort((a, b) => a.moduloNumero - b.moduloNumero || a.ordine - b.ordine);
}

/**
 * Stato di ogni modulo (FORMATO_CORSO §4) — UNICA implementazione della regola, usata anche dal parser.
 * Il primo modulo è sempre aperto; un modulo è `bloccato` finché il precedente non è `passato`
 * (tutti i criteri Go/No-Go a sì; senza criteri è passato); la chiusura si propaga in avanti.
 */
export function statiModuli(moduli: readonly ModuloPercorso[]): Map<number, StatoModulo> {
  const stati = new Map<number, StatoModulo>();
  let precedentePassato = true; // il primo modulo è sempre aperto
  for (const m of [...moduli].sort((a, b) => a.numero - b.numero)) {
    stati.set(m.numero, !precedentePassato ? 'bloccato' : m.criteriSoddisfatti ? 'passato' : 'aperto');
    precedentePassato = precedentePassato && m.criteriSoddisfatti;
  }
  return stati;
}

/** Predicato "modulo aperto" per il puntatore. Senza moduli dichiarati, tutto è aperto. */
export function openModules(modules: readonly ModuloPercorso[] | undefined): (numero: number) => boolean {
  if (!modules || modules.length === 0) return () => true;
  const stati = statiModuli(modules);
  return (numero) => stati.has(numero) && stati.get(numero) !== 'bloccato';
}

/** Unità pendenti in ordine di percorso, solo nei moduli aperti. */
export function pendingUnits(units: readonly UnitaPercorso[], modules?: readonly ModuloPercorso[]): UnitaPercorso[] {
  const isOpen = openModules(modules);
  return sortedUnits(units).filter((u) => STATI_UNITA_PENDENTI.has(u.stato) && isOpen(u.moduloNumero));
}

/** Unità corrente del corso = prima pendente, o null se il percorso è finito/bloccato. */
export function currentUnit(
  units: readonly UnitaPercorso[],
  modules?: readonly ModuloPercorso[],
): UnitaPercorso | null {
  return pendingUnits(units, modules)[0] ?? null;
}

/**
 * Assegna alle occorrenze future (già filtrate: `programmate`, del corso, inizio > adesso)
 * la i-esima unità pendente. Oltre le pendenti → null (nessuna unità).
 * Ritorna una mappa blocco → unità.
 */
export function assignPointer(
  units: readonly UnitaPercorso[],
  futureBlocks: readonly BloccoStudioFuturo[],
  modules?: readonly ModuloPercorso[],
): Map<string, string | null> {
  const pending = pendingUnits(units, modules);
  const blocks = [...futureBlocks].sort((a, b) => a.inizio - b.inizio);
  const out = new Map<string, string | null>();
  blocks.forEach((b, i) => out.set(b.id, pending[i]?.id ?? null));
  return out;
}

/**
 * Il puntatore sui blocchi di un corso (§11), come differenza da applicare: i blocchi di studio futuri `programmati`
 * (inizio > adesso), in ordine cronologico, ricevono la i-esima unità pendente dei moduli aperti, oltre le pendenti
 * nessuna. Restituisce solo i blocchi il cui `unitaId` cambia: senza cambiamenti la mappa è vuota (INV-15). I blocchi
 * iniziati, chiusi o persi tengono la loro unità. Lo chiama il ciclo dello scheduler per ogni corso (D-SCHED-1).
 */
export function pointerPlan(
  unita: readonly UnitaPercorso[],
  moduli: readonly { numero: number; criteri: readonly { fatto: boolean }[] }[],
  blocchi: readonly BloccoPuntatore[],
  now: number,
): Map<string, string | null> {
  const futuri = blocchi.filter((b) => b.tipo === 'studio' && b.stato === 'programmato' && b.inizio > now);
  const percorso = moduli.map((m) => ({ numero: m.numero, criteriSoddisfatti: criteriaMet(m.criteri) }));
  const piano = new Map<string, string | null>();
  const attuale = new Map(futuri.map((b) => [b.id, b.unitaId ?? null]));
  for (const [id, unitaId] of assignPointer(unita, futuri, percorso))
    if (attuale.get(id) !== unitaId) piano.set(id, unitaId);
  return piano;
}

/** Progresso "Continua": min(0,95; minuti totali / (ore stimate × 60, o 180 se non stimate)). */
export function partialProgress(totalMinutes: number, estimatedHours?: number | null): number {
  const denominator = estimatedHours && estimatedHours > 0 ? estimatedHours * 60 : 180;
  return Math.min(0.95, totalMinutes / denominator);
}

/** Stato del blocco di studio per esito (tabella §11). */
export const STATO_ESITO = {
  completata: 'completato',
  continua: 'parziale',
  indietro: 'indietro',
  salta: 'saltato',
} as const satisfies Record<Esito, StatoBlocco>;

export interface InputEsito<U extends UnitaPercorso = UnitaPercorso> {
  unita: readonly U[];
  /** Unità pianificata sul blocco (o scelta nel setup). */
  unitaPianificataId: string;
  esito: Esito;
  /** Minuti accreditati all'unità principale. */
  minuti: number;
  /** Per "Indietro": l'unità precedente, se indicata; altrimenti agisce sulla pianificata. */
  unitaPrecedenteId?: string | null | undefined;
}

export interface RisultatoEsito<U extends UnitaPercorso = UnitaPercorso> {
  unita: U[];
  /** Stato risultante del blocco di studio (§11, tabella). */
  statoBlocco: (typeof STATO_ESITO)[Esito];
}

/**
 * Applica l'esito all'unità e restituisce lo stato del blocco (tabella §11).
 * Non tocca il puntatore: il chiamante lo ricalcola con `assignPointer`.
 */
export function applyOutcome<U extends UnitaPercorso>(input: InputEsito<U>): RisultatoEsito<U> {
  const { unita, unitaPianificataId, esito, minuti, unitaPrecedenteId } = input;
  const next = unita.map((u) => ({ ...u }));
  const planned = next.find((u) => u.id === unitaPianificataId);
  if (!planned) throw new Error(`applyOutcome: unità ${unitaPianificataId} non trovata`);

  // I minuti vanno sempre all'unità principale (§11, "Sempre").
  planned.minuti += Math.max(0, minuti);

  switch (esito) {
    case 'completata':
      planned.stato = 'completata';
      planned.progresso = 1;
      break;
    case 'continua':
      planned.stato = 'parziale';
      planned.progresso = partialProgress(planned.minuti, planned.oreStimate);
      break;
    case 'indietro': {
      const target = (unitaPrecedenteId && next.find((u) => u.id === unitaPrecedenteId)) || planned;
      target.stato = 'da_rivedere'; // progresso invariato
      break;
    }
    case 'salta':
      planned.stato = 'saltata'; // progresso invariato
  }
  return { unita: next, statoBlocco: STATO_ESITO[esito] };
}

/** Unità precedente nel percorso (ordine modulo → unità), o null se è la prima. */
export function previousUnitInPath(units: readonly UnitaPercorso[], unitId: string): UnitaPercorso | null {
  const sorted = sortedUnits(units);
  const i = sorted.findIndex((u) => u.id === unitId);
  return i > 0 ? (sorted[i - 1] ?? null) : null;
}
