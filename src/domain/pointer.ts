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
import { PENDING_UNIT_STATES, type Outcome, type UnitState } from './types';

export interface UnitRef {
  id: string;
  /** Numero del modulo (ordine dal nome file, FORMATO_CORSO §1). */
  moduleOrder: number;
  /** Posizione dell'unità dentro il modulo (ordine nel file). */
  order: number;
  state: UnitState;
  /** Minuti accreditati (§11). */
  minutes: number;
  /** Progresso 0..1 (§11). */
  progress: number;
  /** Ore stimate dal file del corso, se dichiarate (FORMATO_CORSO §3). */
  estimatedHours?: number | null;
}

export interface ModuleRef {
  order: number;
  /** true se tutti i criteri Go/No-Go del modulo sono "sì" (vacuamente vero senza criteri). */
  criteriaAllMet: boolean;
}

export interface FutureStudyBlock {
  id: string;
  start: number;
}

/** Ordine di percorso: modulo → unità. */
export function sortedUnits(units: readonly UnitRef[]): UnitRef[] {
  return [...units].sort((a, b) => a.moduleOrder - b.moduleOrder || a.order - b.order);
}

/**
 * Insieme dei moduli aperti (FORMATO_CORSO §4). Se `modules` è assente, tutto è aperto.
 * Un modulo è aperto se è il primo oppure se il precedente ha tutti i criteri a sì
 * (e a sua volta è aperto: la chiusura si propaga in avanti).
 */
export function openModules(modules: readonly ModuleRef[] | undefined): ((moduleOrder: number) => boolean) {
  if (!modules || modules.length === 0) return () => true;
  const sorted = [...modules].sort((a, b) => a.order - b.order);
  const open = new Set<number>();
  let previousPassed = true; // il primo modulo è sempre aperto
  for (const m of sorted) {
    if (previousPassed) open.add(m.order);
    previousPassed = previousPassed && m.criteriaAllMet;
  }
  return (order) => open.has(order);
}

/** Unità pendenti in ordine di percorso, solo nei moduli aperti. */
export function pendingUnits(units: readonly UnitRef[], modules?: readonly ModuleRef[]): UnitRef[] {
  const isOpen = openModules(modules);
  return sortedUnits(units).filter((u) => PENDING_UNIT_STATES.has(u.state) && isOpen(u.moduleOrder));
}

/** Unità corrente del corso = prima pendente, o null se il percorso è finito/bloccato. */
export function currentUnit(units: readonly UnitRef[], modules?: readonly ModuleRef[]): UnitRef | null {
  return pendingUnits(units, modules)[0] ?? null;
}

/**
 * Assegna alle occorrenze future (già filtrate: `programmate`, del corso, inizio > adesso)
 * la i-esima unità pendente. Oltre le pendenti → null (nessuna unità).
 * Ritorna una mappa blocco → unità.
 */
export function assignPointer(
  units: readonly UnitRef[],
  futureBlocks: readonly FutureStudyBlock[],
  modules?: readonly ModuleRef[],
): Map<string, string | null> {
  const pending = pendingUnits(units, modules);
  const blocks = [...futureBlocks].sort((a, b) => a.start - b.start);
  const out = new Map<string, string | null>();
  blocks.forEach((b, i) => out.set(b.id, pending[i]?.id ?? null));
  return out;
}

/** Progresso del corso = completate / totali (§11). */
export function courseProgress(units: readonly UnitRef[]): { completed: number; total: number; ratio: number } {
  const total = units.length;
  const completed = units.filter((u) => u.state === 'completata').length;
  return { completed, total, ratio: total === 0 ? 0 : completed / total };
}

/** Progresso "Continua": min(0,95; minuti totali / (ore stimate × 60, o 180 se non stimate)). */
export function partialProgress(totalMinutes: number, estimatedHours?: number | null): number {
  const denominator = estimatedHours && estimatedHours > 0 ? estimatedHours * 60 : 180;
  return Math.min(0.95, totalMinutes / denominator);
}

export interface ApplyOutcomeInput {
  units: readonly UnitRef[];
  /** Unità pianificata sul blocco (o scelta nel setup). */
  plannedUnitId: string;
  outcome: Outcome;
  /** Minuti accreditati all'unità principale. */
  minutes: number;
  /** Per "Indietro": l'unità precedente, se indicata; altrimenti agisce sulla pianificata. */
  previousUnitId?: string | null | undefined;
}

export interface ApplyOutcomeResult {
  units: UnitRef[];
  /** Stato risultante del blocco di studio (§11, tabella). */
  blockState: 'completato' | 'parziale' | 'indietro' | 'saltato';
}

/**
 * Applica l'esito all'unità e restituisce lo stato del blocco (tabella §11).
 * Non tocca il puntatore: il chiamante lo ricalcola con `assignPointer`.
 */
export function applyOutcome(input: ApplyOutcomeInput): ApplyOutcomeResult {
  const { units, plannedUnitId, outcome, minutes, previousUnitId } = input;
  const next = units.map((u) => ({ ...u }));
  const planned = next.find((u) => u.id === plannedUnitId);
  if (!planned) throw new Error(`applyOutcome: unità ${plannedUnitId} non trovata`);

  // I minuti vanno sempre all'unità principale (§11, "Sempre").
  planned.minutes += Math.max(0, minutes);

  switch (outcome) {
    case 'completata':
      planned.state = 'completata';
      planned.progress = 1;
      return { units: next, blockState: 'completato' };
    case 'continua':
      planned.state = 'parziale';
      planned.progress = partialProgress(planned.minutes, planned.estimatedHours);
      return { units: next, blockState: 'parziale' };
    case 'indietro': {
      const target = (previousUnitId && next.find((u) => u.id === previousUnitId)) || planned;
      target.state = 'da_rivedere'; // progresso invariato
      return { units: next, blockState: 'indietro' };
    }
    case 'salta':
      planned.state = 'saltata'; // progresso invariato
      return { units: next, blockState: 'saltato' };
  }
}

/** Unità precedente nel percorso (ordine modulo → unità), o null se è la prima. */
export function previousUnitInPath(units: readonly UnitRef[], unitId: string): UnitRef | null {
  const sorted = sortedUnits(units);
  const i = sorted.findIndex((u) => u.id === unitId);
  return i > 0 ? (sorted[i - 1] ?? null) : null;
}
