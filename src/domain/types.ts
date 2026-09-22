/**
 * Tipi del modello dei dati di RoutForge — dominio puro.
 * Fonte: RoutForge_MECCANISMI.md §1 (Modello dei dati).
 *
 * Regola: questo modulo non importa nulla da UI, DB o piattaforma.
 * Tutti gli istanti sono epoch ms assoluti; il "giorno" di un blocco è il
 * giorno LOCALE dell'inizio (vedi time.ts).
 */

/** I quattro tipi di attività (§1: Blocco). */
export type BlockKind = 'todo' | 'evento' | 'routine' | 'studio';

/** Stati di un blocco (§1). I primi due sono aperti, gli altri terminali. */
export type BlockState =
  | 'programmato'
  | 'in_corso'
  | 'completato'
  | 'parziale'
  | 'indietro'
  | 'saltato'
  | 'perso';

/** Stati di un'unità (§1). Le prime tre sono "pendenti" e alimentano il puntatore. */
export type UnitState = 'non_iniziata' | 'parziale' | 'da_rivedere' | 'completata' | 'saltata';

/** Orizzonte di un todo (§6). */
export type Horizon = 'giorno' | 'settimana' | 'mese';

/** Esito di chiusura di una sessione di studio (§11). */
export type Outcome = 'completata' | 'continua' | 'indietro' | 'salta';

/**
 * Una singola occorrenza sul calendario (§1: Blocco).
 * Campi minimi necessari ai meccanismi puri; la persistenza aggiunge il resto.
 */
export interface Block {
  id: string;
  kind: BlockKind;
  state: BlockState;
  /** Istante d'inizio (epoch ms). Per i blocchi senza orario è l'ancora fissa (§1). */
  start: number;
  /** Istante di fine (epoch ms). `null` = routine senza durata (§7). */
  end: number | null;
  /** false = todo senza orario o evento tutto il giorno (§1: ancore fisse). */
  hasTime: boolean;
  /** Solo todo (§6). */
  horizon?: Horizon;
  /** Solo blocchi di studio: unità puntata, se c'è (§11). */
  unitId?: string | null;
  courseId?: string | null;
  /** Istante della marcatura "perso" (§8); assente se mai perso. */
  lostAt?: number | null;
}

/** Stato terminale = non più aperto (§1). */
export const TERMINAL_STATES: ReadonlySet<BlockState> = new Set([
  'completato',
  'parziale',
  'indietro',
  'saltato',
  'perso',
]);

/** Stati "pendenti" di un'unità: alimentano il puntatore (§1, §11). */
export const PENDING_UNIT_STATES: ReadonlySet<UnitState> = new Set([
  'non_iniziata',
  'parziale',
  'da_rivedere',
]);
