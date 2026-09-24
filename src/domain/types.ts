/**
 * Tipi del modello dei dati di RoutForge — dominio puro.
 * Fonte: RoutForge_MECCANISMI.md §1 (Modello dei dati).
 *
 * Regola: questo modulo non importa nulla da UI, DB o piattaforma.
 * Tutti gli istanti sono epoch ms assoluti; il "giorno" di un blocco è il
 * giorno LOCALE dell'inizio (vedi time.ts).
 */

/** I quattro tipi di attività (§1: Blocco). */
export type TipoBlocco = 'todo' | 'evento' | 'routine' | 'studio';

/** Stati di un blocco (§1). I primi due sono aperti, gli altri terminali. */
export type StatoBlocco =
  | 'programmato'
  | 'in_corso'
  | 'completato'
  | 'parziale'
  | 'indietro'
  | 'saltato'
  | 'perso';

/** Stati di un'unità (§1). Le prime tre sono "pendenti" e alimentano il puntatore. */
export type StatoUnita = 'non_iniziata' | 'parziale' | 'da_rivedere' | 'completata' | 'saltata';

/** Orizzonte di un todo (§6). */
export type Orizzonte = 'giorno' | 'settimana' | 'mese';

/** Stato di un modulo del corso (FORMATO_CORSO §4). */
export type StatoModulo = 'bloccato' | 'aperto' | 'passato';

/** Esito di chiusura di una sessione di studio (§11). */
export type Esito = 'completata' | 'continua' | 'indietro' | 'salta';

/**
 * Una singola occorrenza sul calendario (§1: Blocco).
 * Campi minimi necessari ai meccanismi puri; la persistenza aggiunge il resto.
 */
export interface Blocco {
  id: string;
  tipo: TipoBlocco;
  stato: StatoBlocco;
  /** Istante d'inizio (epoch ms). Per i blocchi senza orario è l'ancora fissa (§1). */
  inizio: number;
  /** Istante di fine (epoch ms). `null` = routine senza durata (§7). */
  fine: number | null;
  /** false = todo senza orario o evento tutto il giorno (§1: ancore fisse). */
  conOrario: boolean;
  /** Solo todo (§6). */
  orizzonte?: Orizzonte;
  /** Solo blocchi di studio: unità puntata, se c'è (§11). */
  unitaId?: string | null;
  corsoId?: string | null;
  /** Istante della marcatura "perso" (§8); assente se mai perso. */
  persoIl?: number | null;
}

/** Stato terminale = non più aperto (§1). */
export const STATI_TERMINALI: ReadonlySet<StatoBlocco> = new Set([
  'completato',
  'parziale',
  'indietro',
  'saltato',
  'perso',
]);

/** Stati "pendenti" di un'unità: alimentano il puntatore (§1, §11). */
export const STATI_UNITA_PENDENTI: ReadonlySet<StatoUnita> = new Set([
  'non_iniziata',
  'parziale',
  'da_rivedere',
]);
