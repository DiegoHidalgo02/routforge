/**
 * Riprogrammazione per trascinamento (vista Giorno).
 * Fonte: MECCANISMI §15 (chi si trascina; aggancio a passi di 5' negli spazi liberi fra gli altri blocchi; durata
 * dichiarata o quella del form Crea; rilascio su un giorno della striscia; il perso rilasciato su un giorno o un orario
 * futuro torna programmato), §1 (ancora 12:00–23:59 dei todo senza orario), FUNZIONALITA §2. Decisioni: D-DESIGN-1
 * n. 2 (i persi di ogni tipo), D-HOR-1 (orario originale azzerato), D-TIME-2 (ora di parete), D-DRAG-1 (letture di
 * §15). Scenario: G3.
 *
 * Schema «differenza da applicare»: il servizio (`src/app/drag.ts`) scrive il blocco di `movedBlock`; giorno locale e
 * ora di parete li ricalcola `saveBlock`.
 */
import { ANCORA_TODO, DURATA_TODO } from './activity';
import { FINESTRA_SLOT, PASSO } from './scheduler/horizon';
import { wallInstants } from './scheduler/occurrences';
import { addLocalDays, endOfLocalDay, localDayKey, localInstant, minutes } from './time';
import type { Blocco, BloccoAncorato } from './types';

/** Si trascinano i todo senza orario ancora da fare e i blocchi persi di ogni tipo (§15, D-DESIGN-1 n. 2). */
export const canDrag = (b: Pick<Blocco, 'tipo' | 'stato' | 'conOrario'>): boolean =>
  b.stato === 'perso' || (b.tipo === 'todo' && !b.conOrario && b.stato === 'programmato');

/** Dove si rilascia: un giorno della striscia settimanale, oppure l'inizio agganciato su un orario della vista Giorno. */
export type Rilascio = { giorno: string } | { inizio: number };

/** Durata sul nuovo orario (§15): quella dichiarata; 30' per il todo senza orario; `null` per la routine senza durata. */
export const dropDuration = (b: Pick<Blocco, 'inizio' | 'fine' | 'conOrario'>): number | null =>
  !b.conOrario ? minutes(DURATA_TODO) : b.fine === null ? null : b.fine - b.inizio;

/**
 * I blocchi fra cui ci si aggancia (§15, D-DRAG-1): quelli con orario della giornata, anche terminali (sono card al
 * loro posto), senza quello trascinato, in ordine d'inizio. Il punto d'inserimento è un indice di questa lista.
 */
export const dropReferences = <B extends Pick<Blocco, 'id' | 'conOrario' | 'inizio'>>(
  giornata: readonly B[],
  id: string,
): B[] => giornata.filter((b) => b.conOrario && b.id !== id).sort((a, b) => a.inizio - b.inizio);

/**
 * Inizio agganciato al punto d'inserimento `indice` fra i riferimenti (`dropReferences`) (§15, D-DRAG-1): dopo il blocco
 * che finisce per ultimo fra quelli sopra (una routine senza durata occupa il suo inizio), per eccesso al multiplo di
 * 5'; sopra il primo, finisce quando quello inizia (per difetto); in un giorno senza blocchi con orario, all'inizio
 * della finestra dei todo (08:00, §6). Mai prima di adesso. `null` se esce dal giorno o se lo spazio non c'è più:
 * l'inizio passerebbe oltre quello del blocco sotto (già iniziato, o sovrapposto a quelli sopra). Può sovrapporsi al
 * blocco sotto: G3 aggancia 15:40–16:10 prima di un blocco delle 16:00.
 */
export function dropStart(
  orari: readonly Pick<Blocco, 'inizio' | 'fine'>[],
  indice: number,
  durata: number | null,
  giorno: string,
  now: number,
): number | null {
  const sopra = orari.slice(0, indice);
  const sotto = orari[indice];
  const s = sopra.length
    ? Math.ceil(Math.max(...sopra.map((b) => b.fine ?? b.inizio)) / PASSO) * PASSO
    : sotto
      ? Math.floor((sotto.inizio - (durata ?? 0)) / PASSO) * PASSO
      : localInstant(giorno, FINESTRA_SLOT.inizio);
  const inizio = Math.max(s, Math.ceil(now / PASSO) * PASSO, localInstant(giorno, '00:00'));
  if (sotto && inizio > sotto.inizio) return null;
  return localDayKey(inizio) === giorno ? inizio : null;
}

/** L'ora di parete che il blocco tiene rilasciato su un giorno (§15): la sua; il todo senza orario resta senza. */
export const timeOnDay = (b: Pick<BloccoAncorato, 'conOrario' | 'orarioInizio'>): string | null =>
  b.conOrario ? b.orarioInizio : null;

/**
 * I giorni della striscia su cui si rilascia (D-DRAG-1): la settimana mostrata, se non ha giorni passati; altrimenti i
 * sette giorni da oggi, perché un giorno passato non vale mai e un perso sta sempre nel passato (anche la settimana
 * scorsa, e di domenica «domani» è la settimana dopo).
 */
export function dropDays(settimana: readonly string[], oggi: string): string[] {
  if ((settimana[0] ?? oggi) >= oggi) return [...settimana];
  return Array.from({ length: 7 }, (_, i) => localDayKey(addLocalDays(localInstant(oggi, '12:00'), i)));
}

/**
 * Il blocco dopo il rilascio (§15), o `null` se non si trascina o il rilascio non vale. Su un giorno tiene l'ora di
 * parete di inizio e di fine (D-TIME-2; il todo senza orario la sua ancora); su un orario diventa con orario, con
 * `dropDuration`. Torna `programmato` senza la marcatura «perso»; il todo perde l'orario originale del rotolamento
 * (D-HOR-1). Vale solo nel futuro: con orario non ancora iniziato, senza orario da oggi in poi; mai sul giorno in cui è
 * già (D-DRAG-1).
 */
export function movedBlock<B extends BloccoAncorato>(b: B, r: Rilascio, now: number): B | null {
  if (!canDrag(b)) return null;
  let istanti: Pick<Blocco, 'inizio' | 'fine'>;
  if ('giorno' in r) {
    if (r.giorno === b.giornoLocale) return null;
    const inizio = localInstant(r.giorno, ANCORA_TODO);
    istanti = b.conOrario
      ? wallInstants(r.giorno, b.orarioInizio, b.orarioFine)
      : { inizio, fine: b.fine === null ? null : endOfLocalDay(inizio) };
  } else {
    const durata = dropDuration(b);
    istanti = { inizio: r.inizio, fine: durata === null ? null : r.inizio + durata };
  }
  const conOrario = b.conOrario || 'inizio' in r;
  const futuro = conOrario ? istanti.inizio >= now : localDayKey(istanti.inizio) >= localDayKey(now);
  if (!futuro) return null;
  return {
    ...b,
    ...istanti,
    stato: 'programmato',
    conOrario,
    persoIl: null,
    ...(b.tipo === 'todo' && { orarioOriginale: null }),
  };
}
