/**
 * Occorrenze delle routine e delle routine di studio: generazione a 28 giorni, modifica, eliminazione, riancoraggio.
 * Fonte: MECCANISMI §7 (orizzonte, idempotenza, filtri, fine ≤ inizio → giorno dopo, senza durata, campi ereditati,
 * modifica, eliminazione), §1 (il giorno è quello locale dell'inizio). Decisioni: D-DATA-2 (id = slot della
 * ricorrenza), D-TIME-2 (ora di parete e riancoraggio, INV-18), D-OCC-1 (scelte di T-011). Scenari: B1, B3, B4, B6.
 *
 * Schema «insieme desiderato → differenza da applicare» (docs/02_ARCHITETTURA.md §4): il servizio
 * (`src/app/recurrences.ts`) legge le occorrenze esistenti della ricorrenza, chiama queste funzioni e scrive solo la
 * differenza. Gli istanti nascono dall'ora di parete con il costruttore `Date` locale, cioè nel fuso corrente del
 * dispositivo (D-TIME-2).
 */
import { endsNextDay } from '../activity';
import { addLocalDays, localDayKey, localInstant, localWeekday, startOfLocalDay } from '../time';
import type { Blocco, BloccoAncorato, Ricorrenza } from '../types';

/** Orizzonte della generazione: da oggi a oggi + 28 giorni, ultimo giorno incluso (§7, B1; D-OCC-1). */
export const ORIZZONTE_OCCORRENZE_GIORNI = 28;

/**
 * Id deterministico di un'occorrenza = slot della ricorrenza: ricorrenza, giorno locale e orario di parete d'inizio
 * della definizione (D-DATA-2). Non cambia se l'utente sposta l'occorrenza (C4) né al riancoraggio; cambiare l'orario
 * della definizione crea slot nuovi (B6).
 */
export const occurrenceId = (ricorrenzaId: string, giorno: string, orarioInizio: string): string =>
  `${ricorrenzaId}:${giorno}:${orarioInizio}`;

/**
 * Intervallo delle chiavi degli slot dell'orizzonte, da oggi a oggi + 28 inclusi (§7): gli id di slot si ordinano per
 * ricorrenza, giorno e orario, e un'occorrenza spostata conserva il suo (D-DATA-2). Così la generazione legge solo gli
 * slot che confronta, non tutta la storia della routine (D-SCHED-1).
 */
export function horizonSlotRange(ricorrenzaId: string, now: number): readonly [string, string] {
  const oggi = startOfLocalDay(now);
  const ultimo = localDayKey(addLocalDays(oggi, ORIZZONTE_OCCORRENZE_GIORNI));
  // "~" viene dopo le cifre e i ":" dell'orario: chiude il giorno `ultimo` a ogni orario
  return [`${ricorrenzaId}:${localDayKey(oggi)}`, `${ricorrenzaId}:${ultimo}:~`];
}

/** Giorno locale dello slot, letto dall'id (D-DATA-2): resta quello anche se l'utente ha spostato l'occorrenza (C4). */
export const occurrenceDay = (id: string, ricorrenzaId: string): string =>
  id.slice(ricorrenzaId.length + 1, ricorrenzaId.length + 11);

/** Differenza da applicare a una modifica (§7): blocchi da scrivere (nuovi o riscritti), id da eliminare. */
export interface PianoOccorrenze {
  daScrivere: Blocco[];
  daEliminare: string[];
}

/** Istanti di parete nel giorno dato: fine ≤ inizio → il giorno dopo; senza fine → `null` (§2, §7). */
function wallInstants(
  giorno: string,
  orarioInizio: string,
  orarioFine: string | null,
): Pick<Blocco, 'inizio' | 'fine'> {
  const inizio = localInstant(giorno, orarioInizio);
  if (orarioFine === null) return { inizio, fine: null };
  const fine = localInstant(giorno, orarioFine);
  return { inizio, fine: endsNextDay(orarioInizio, orarioFine) ? addLocalDays(fine, 1) : fine };
}

/** L'occorrenza `programmata` della ricorrenza nel giorno dato, con i campi ereditati (§7); le fasi restano sulla definizione. */
function occurrenceOf(r: Ricorrenza, giorno: string): Blocco {
  return {
    id: occurrenceId(r.id, giorno, r.orarioInizio),
    tipo: r.tipo,
    stato: 'programmato',
    ...wallInstants(giorno, r.orarioInizio, r.orarioFine),
    conOrario: true,
    ricorrenzaId: r.id,
    corsoId: r.corsoId,
    // Senza unità finché il puntatore non la assegna (§7, §11; T-013)
    ...(r.tipo === 'studio' ? { unitaId: null } : {}),
    titolo: r.titolo,
    note: r.note,
    promemoria: r.promemoria,
  };
}

/** Le occorrenze previste da oggi a oggi + 28 nei giorni scelti, entro le date e fuori dalle date saltate (§7). */
function expectedOccurrences(r: Ricorrenza, now: number): Blocco[] {
  const oggi = startOfLocalDay(now);
  const out: Blocco[] = [];
  for (let i = 0; i <= ORIZZONTE_OCCORRENZE_GIORNI; i++) {
    const inizioGiorno = addLocalDays(oggi, i);
    const giorno = localDayKey(inizioGiorno);
    if (!r.giorni.includes(localWeekday(inizioGiorno))) continue;
    if (giorno < r.dataInizio || (r.dataFine !== null && giorno > r.dataFine) || r.dateSaltate.includes(giorno))
      continue;
    out.push(occurrenceOf(r, giorno));
  }
  return out;
}

/** Occorrenze mancanti nell'orizzonte: quelle il cui slot non è fra le esistenti, spostate comprese (§7, D-DATA-2). */
export function missingOccurrences(r: Ricorrenza, esistenti: readonly Pick<Blocco, 'id'>[], now: number): Blocco[] {
  const vivi = new Set(esistenti.map((b) => b.id));
  return expectedOccurrences(r, now).filter((b) => !vivi.has(b.id));
}

/**
 * Modifica della definizione (§7): le occorrenze future `programmate` (inizio > adesso) che non sono più previste si
 * eliminano; quelle ancora previste si riscrivono con la definizione nuova (istanti compresi); le mancanti si creano.
 * Passato, completato e perso restano com'erano (B6).
 */
export function editPlan(
  r: Ricorrenza,
  esistenti: readonly Pick<Blocco, 'id' | 'stato' | 'inizio'>[],
  now: number,
): PianoOccorrenze {
  const previste = expectedOccurrences(r, now);
  const idPrevisti = new Set(previste.map((b) => b.id));
  const vivi = new Set(esistenti.map((b) => b.id));
  const future = new Set(esistenti.filter((b) => b.stato === 'programmato' && b.inizio > now).map((b) => b.id));
  return {
    daScrivere: previste.filter((b) => !vivi.has(b.id) || future.has(b.id)),
    daEliminare: [...future].filter((id) => !idPrevisti.has(id)),
  };
}

/** Eliminazione della routine (§7): tutte le occorrenze `programmate`, anche passate; completate e perse restano. */
export const removableOccurrences = (esistenti: readonly Pick<Blocco, 'id' | 'stato'>[]): string[] =>
  esistenti.filter((b) => b.stato === 'programmato').map((b) => b.id);

/**
 * Riancoraggio al cambio di fuso (D-TIME-2, INV-18): i blocchi `programmati` da oggi in poi calcolati in un altro fuso
 * tornano alla stessa ora di parete nel fuso corrente: istanti ricalcolati, `fuso` aggiornato. I giorni passati e i
 * blocchi chiusi conservano i loro istanti. Oggi conta come futuro anche a orario passato: il giudizio «perso» viene
 * dopo, su istanti già corretti (D-OCC-1). Con lo stesso fuso la differenza è vuota (INV-15).
 */
export function reanchor(blocchi: readonly BloccoAncorato[], fusoCorrente: string, now: number): BloccoAncorato[] {
  const oggi = localDayKey(now);
  return blocchi
    .filter((b) => b.stato === 'programmato' && b.fuso !== fusoCorrente && b.giornoLocale >= oggi)
    .map((b) => ({ ...b, ...wallInstants(b.giornoLocale, b.orarioInizio, b.orarioFine), fuso: fusoCorrente }));
}
