/**
 * Setup della sessione di studio: contesto di avvio, azioni, anticipo, materia.
 * Fonte: RoutForge_MECCANISMI.md §10.1 (FUNZ §4.2, §11.1) — criteri: SCENARI C4, C5, C9 (setup), D6 (lato servizio).
 * Decisione: D-SESS-1.
 *
 * - Contesto deciso dall'orologio: nessun blocco → libera; blocco perso o fine passata → recupero; programmato e
 *   adesso < inizio − 5' → anticipo (sessione libera, il blocco resta intatto); altrimenti routine.
 * - Routine: fine = fine del blocco; recupero: durata scelta (fine = avvio + durata, cronometro senza fine); in entrambi
 *   blocco → `in_corso` con ritardo = adesso − inizio (mai negativo, D-SESS-1). Libera: nessun effetto sui blocchi.
 * - «Anticipa sessione» sposta il blocco di oggi ad adesso con la stessa durata e registra i minuti di anticipo.
 * - Materia: blocco con unità puntata → quella; senza unità → scelta libera (corso → unità corrente, o prima non
 *   completata né saltata; oppure nessuna); libera → quella scelta, anche nessuna.
 * Il timer (regimi, pomodoro, iperfocus) è di T-017; gli esiti di T-018.
 */
import { effectiveEnd } from './lost';
import { currentUnit, sortedUnits, type ModuloPercorso, type UnitaPercorso } from './pointer';
import { minutes, MINUTE, sameLocalDay } from './time';
import type { Blocco, StatoBlocco } from './types';

export type Contesto = 'anticipo' | 'routine' | 'recupero' | 'libera';
/** Continua o pomodoro 25/5, 50/10, 90/20 (FUNZ §11.1, MECC §10.3). */
export type Modalita = 'continua' | 'p25' | 'p50' | 'p90';

/** «adesso < inizio − 5'» (§10.1). */
export const SOGLIA_ANTICIPO = minutes(5);

/** Ciò che l'utente decide nel setup (FUNZ §11.1). `durata` in minuti; `null` = cronometro. */
export interface SceltaSessione {
  unitaId: string | null;
  corsoId: string | null;
  durata: number | null;
  modalita: Modalita;
  iperfocus: boolean;
}

/**
 * Valore di `preferenze.sessioneAttiva` (MECC §1; D-SCHED-1: il ciclo ne legge `bloccoId`). `fine` è l'istante
 * ancorato all'orologio (routine, recupero con durata); `null` per la libera e il cronometro.
 */
export interface SessioneAttiva extends SceltaSessione {
  bloccoId: string | null;
  contesto: Exclude<Contesto, 'anticipo'>;
  avvio: number;
  fine: number | null;
}

/** Le azioni di sessione di un blocco di studio (S1 blocco Adesso, S5 footer): la prima è la primaria. */
export type AzioneStudio = 'inizia' | 'anticipa' | 'libera' | 'recupera' | 'riprendi' | 'ripasso';

/** Stati da cui una sessione parte sul blocco; gli altri esiti chiusi danno il ripasso (§10.1). */
const AVVIABILI: ReadonlySet<StatoBlocco> = new Set(['programmato', 'in_corso', 'parziale', 'perso']);

export function sessionContext(b: Blocco | null, now: number): Contesto {
  if (!b) return 'libera';
  if (b.stato === 'perso' || now >= effectiveEnd(b)) return 'recupero';
  if (b.stato === 'programmato' && now < b.inizio - SOGLIA_ANTICIPO) return 'anticipo';
  return 'routine';
}

/**
 * «Di oggi» per l'avvio (§10.1): il giorno locale dell'inizio, oppure adesso dentro l'orario del blocco, così una
 * routine 23:30–00:30 si avvia ancora alle 00:10 (D-SESS-1).
 */
const isToday = (b: Blocco, now: number): boolean =>
  sameLocalDay(b.inizio, now) || (now >= b.inizio && now < effectiveEnd(b));

/**
 * Il contesto con cui partirebbe adesso la sessione dal blocco: libera in anticipo, da un blocco già chiuso (ripasso) o
 * da un parziale o in corso di un altro giorno, che hanno già un esito o un avvio e non si recuperano (D-SESS-1).
 */
export function startContext(b: Blocco | null, now: number): SessioneAttiva['contesto'] {
  if (!b || b.tipo !== 'studio' || !AVVIABILI.has(b.stato)) return 'libera';
  if ((b.stato === 'parziale' || b.stato === 'in_corso') && !isToday(b, now)) return 'libera';
  const contesto = sessionContext(b, now);
  return contesto === 'anticipo' ? 'libera' : contesto;
}

/**
 * Azioni di sessione per un blocco di studio. `attiva` = la sessione in corso, se c'è: il suo blocco si riprende. Una
 * sessione diversa già attiva la gestisce il setup, che porta al timer (D6).
 */
export function studyActions(b: Blocco, now: number, attiva: Pick<SessioneAttiva, 'bloccoId'> | null): AzioneStudio[] {
  if (attiva && attiva.bloccoId === b.id) return ['riprendi'];
  if (!AVVIABILI.has(b.stato)) return ['ripasso'];
  const contesto = startContext(b, now);
  if (contesto === 'recupero' && b.stato !== 'parziale' && b.stato !== 'in_corso') return ['recupera'];
  // «Inizia» solo se il blocco è di oggi (§10.1); in anticipo c'è anche la libera che non lo tocca (S5 `anticipo`)
  if (!isToday(b, now)) return ['libera'];
  // Parziale e in corso (orfano) si riprendono (§10.1 «ripresa»)
  if (b.stato === 'parziale' || b.stato === 'in_corso') return ['riprendi'];
  return sessionContext(b, now) === 'anticipo' ? ['anticipa', 'libera'] : ['inizia'];
}

/** «Anticipa sessione»: il blocco di oggi in anticipo parte adesso con la stessa durata; `null` se non vale. */
export function anticipatedBlock<B extends Blocco>(b: B, now: number): B | null {
  if (b.tipo !== 'studio' || sessionContext(b, now) !== 'anticipo' || !sameLocalDay(b.inizio, now)) return null;
  const durata = effectiveEnd(b) - b.inizio;
  return { ...b, inizio: now, fine: now + durata, minutiAnticipo: Math.round((b.inizio - now) / MINUTE) };
}

/** L'unità imposta dal blocco (unità puntata di una sessione sul blocco); `null` = si sceglie nel setup. */
export function lockedUnit(b: Blocco | null, now: number): string | null {
  return startContext(b, now) === 'libera' ? null : (b?.unitaId ?? null);
}

/** Il corso scelto nel setup propone l'unità corrente, o la prima né completata né saltata; altrimenti nessuna. */
export function courseDefaultUnit(units: readonly UnitaPercorso[], modules?: readonly ModuloPercorso[]): string | null {
  return (
    currentUnit(units, modules)?.id ??
    sortedUnits(units).find((u) => u.stato !== 'completata' && u.stato !== 'saltata')?.id ??
    null
  );
}

/**
 * Avvio: la sessione attiva e, per routine e recupero, il blocco da riscrivere `in_corso` nella stessa transazione
 * (D-SCHED-1). In anticipo, o da un blocco già chiuso, la sessione è libera e il blocco resta com'è (`blocco: null`,
 * come per la ripresa di un parziale).
 */
export function startPlan<B extends Blocco>(
  b: B | null,
  scelta: SceltaSessione,
  now: number,
): { sessione: SessioneAttiva; blocco: B | null } {
  const contesto = startContext(b, now);
  if (!b || contesto === 'libera')
    return { sessione: { ...scelta, bloccoId: null, contesto: 'libera', avvio: now, fine: null }, blocco: null };
  const materia = b.unitaId ? { unitaId: b.unitaId, corsoId: b.corsoId ?? null } : {};
  const fineBlocco = effectiveEnd(b);
  const tempo =
    contesto === 'routine'
      ? { durata: Math.ceil((fineBlocco - now) / MINUTE), fine: fineBlocco }
      : { durata: scelta.durata, fine: scelta.durata === null ? null : now + minutes(scelta.durata) };
  // Il parziale tiene il suo esito finché la ripresa non ne scrive un altro (T-018): un abbandono o un crash non lo
  // riportano a `programmato` né lo fanno marcare perso; la sessione lo punta comunque. Il ritardo è quello del primo
  // avvio (D-SESS-1)
  const ritardo = b.minutiRitardo ?? Math.max(0, Math.round((now - b.inizio) / MINUTE));
  return {
    sessione: { ...scelta, ...materia, ...tempo, bloccoId: b.id, contesto, avvio: now },
    blocco: b.stato === 'parziale' ? null : { ...b, stato: 'in_corso', minutiRitardo: ritardo },
  };
}
