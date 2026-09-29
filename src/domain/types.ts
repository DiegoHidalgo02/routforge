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
export type StatoBlocco = 'programmato' | 'in_corso' | 'completato' | 'parziale' | 'indietro' | 'saltato' | 'perso';

/** Stati di un'unità (§1). Le prime tre sono "pendenti" e alimentano il puntatore. */
export type StatoUnita = 'non_iniziata' | 'parziale' | 'da_rivedere' | 'completata' | 'saltata';

/** Orizzonte di un todo (§6). */
export type Orizzonte = 'giorno' | 'settimana' | 'mese';

/** Priorità di un todo senza orario (§2, §6). */
export type Priorita = 'alta' | 'normale' | 'bassa';

/** Voce della checklist di un todo (§4): nasce non spuntata. */
export interface VoceChecklist {
  testo: string;
  fatta: boolean;
}

/** Un anticipo del promemoria personalizzato (§13.1): minuti prima dell'inizio (0 = all'inizio), sveglia o notifica. */
export interface AnticipoPromemoria {
  minuti: number;
  sveglia: boolean;
}

/** Promemoria per istanza o per definizione (§2, §13.1): Auto / Off / Personalizzato. */
export type Promemoria =
  { modo: 'auto' } | { modo: 'off' } | { modo: 'personalizzato'; anticipi: AnticipoPromemoria[] };

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
  /** Solo occorrenze di routine/studio: la ricorrenza che le ha generate (§7). */
  ricorrenzaId?: string | null;
  /** Istante della marcatura "perso" (§8); assente se mai perso. */
  persoIl?: number | null;
  /** Istante in cui l'utente ha chiuso il blocco: completato (§3) o saltato (FUNZ §4.3); `null` da riaperto. Gli esiti di studio arrivano con T-018. */
  chiusoIl?: number | null;
  /** Solo todo: istante dell'avviso «todo in ritardo» (§6, §13.6), una volta per todo; assente se mai avvisato (D-HOR-1). */
  ritardoIl?: number | null;
  /**
   * Solo todo con orario: l'ora di parete "HH:MM" scelta dall'utente, ricordata quando un ciclo sposta il todo in un
   * varco perché era occupata (§6, punto 1); `null` o assente quando il todo è al suo orario. Modifica e trascinamento
   * la azzerano (T-042, T-015; D-HOR-1).
   */
  orarioOriginale?: string | null;
  /** Solo studio: minuti di cui «Anticipa sessione» ha spostato prima il blocco (§10.1, C4; puntualità di §20). */
  minutiAnticipo?: number | null;
  /** Solo studio: ritardo all'avvio in routine o recupero, adesso − inizio in minuti, mai negativo (§10.1, C5; D-SESS-1). */
  minutiRitardo?: number | null;
  // Campi della creazione (§2): assenti nei blocchi di prova dei meccanismi che non li usano.
  titolo?: string;
  note?: string;
  /** Solo todo senza orario (§2). */
  priorita?: Priorita;
  /** Solo todo (§2, §4). */
  checklist?: VoceChecklist[];
  /** Solo eventi (§2). */
  luogo?: string;
  /** Solo eventi: il template delle fasi sta sul blocco, che è la sua definizione (§2, §5). */
  fasi?: FaseTemplate[];
  /** Override per istanza (§2); le occorrenze di routine ereditano quello della ricorrenza (§7). */
  promemoria?: Promemoria;
}

/**
 * Ora locale di parete (D-TIME-2): gli orari come li vede l'utente, ovunque si trovi, e il fuso in cui sono stati
 * calcolati gli istanti. Al cambio di fuso i blocchi futuri si riancorano a questi orari; il passato li conserva.
 */
export interface OraDiParete {
  /** "HH:MM" locale d'inizio. */
  orarioInizio: string;
  /** "HH:MM" locale di fine; `null` = senza durata (§7). Fine ≤ inizio = il giorno dopo (§2, §7). */
  orarioFine: string | null;
  /** Nome IANA del fuso (es. "Europe/Rome"): arriva come dato dalla porta Clock di `app`, mai da Intl nel dominio. */
  fuso: string;
}

/** Un blocco con il suo ancoraggio di parete memorizzato: giorno locale, orari e fuso di calcolo (D-TIME-2). */
export type BloccoAncorato = Blocco & OraDiParete & { giornoLocale: string };

/** Voce del template delle fasi (§5): l'identificatore stabile regge rinomine e riordini. */
export interface FaseTemplate {
  id: string;
  etichetta: string;
  ordine: number;
}

/** Stato di una fase nel log (§5): al completamento tutte `fatte` tranne quelle marcate `saltate`. */
export type StatoFase = 'fatta' | 'saltata';

/** Voce del log fasi (§1, §5): fotografia `[id, etichetta, stato]` di ogni fase del template al Conferma. */
export interface FaseLog {
  id: string;
  etichetta: string;
  stato: StatoFase;
}

/** Definizione di una routine o routine di studio (§1: Ricorrenza; campi §2, §5, §7). */
export interface Ricorrenza extends OraDiParete {
  id: string;
  tipo: Extract<TipoBlocco, 'routine' | 'studio'>;
  /** Default "Studio" per le routine di studio (§7). */
  titolo: string;
  note: string;
  /** Giorni della settimana, almeno uno (§2): 0 = domenica … 6 = sabato, come `localWeekday`. */
  giorni: number[];
  /** Giorno locale "YYYY-MM-DD" d'inizio (§2: default oggi). */
  dataInizio: string;
  /** Ultimo giorno locale incluso; `null` = mai (§2). La ricorrenza è attiva finché fine assente o ≥ oggi (§7). */
  dataFine: string | null;
  /** Giorni locali "YYYY-MM-DD" esclusi (§7). */
  dateSaltate: string[];
  /** Solo routine di studio, opzionale (§2). */
  corsoId: string | null;
  /** Template delle fasi (§5); vuoto per le routine di studio (§2). */
  fasi: FaseTemplate[];
  /** Override sulla definizione, ereditato dalle istanze (§2). */
  promemoria: Promemoria;
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
export const STATI_UNITA_PENDENTI: ReadonlySet<StatoUnita> = new Set(['non_iniziata', 'parziale', 'da_rivedere']);
