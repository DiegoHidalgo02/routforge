/**
 * Occorrenze delle routine e delle routine di studio: generazione a 28 giorni (di più per un promemoria personalizzato
 * più lungo: D-OCC-2), modifica, eliminazione, riancoraggio.
 * Fonte: MECCANISMI §7 (orizzonte, idempotenza, filtri, fine ≤ inizio → giorno dopo, senza durata, campi ereditati,
 * modifica, eliminazione), §1 (il giorno è quello locale dell'inizio). Decisioni: D-DATA-2 (id = slot della
 * ricorrenza), D-TIME-2 (ora di parete e riancoraggio, INV-18), D-OCC-1 (scelte di T-011). Scenari: B1, B3, B4, B6.
 *
 * Schema «insieme desiderato → differenza da applicare» (docs/02_ARCHITETTURA.md §4): il servizio
 * (`src/app/recurrences.ts`) legge le occorrenze esistenti della ricorrenza, chiama queste funzioni e scrive solo la
 * differenza. Gli istanti nascono dall'ora di parete con il costruttore `Date` locale, cioè nel fuso corrente del
 * dispositivo (D-TIME-2).
 */
import { endsNextDay, MAX_ANTICIPO_MINUTI, wallDuration } from '../activity';
import { addLocalDays, localDayKey, localInstant, localTimeKey, localWeekday, MINUTE, startOfLocalDay } from '../time';
import type { Blocco, BloccoAncorato, Ricorrenza } from '../types';

/** Orizzonte della generazione: da oggi a oggi + 28 giorni, ultimo giorno incluso (§7, B1; D-OCC-1). */
export const ORIZZONTE_OCCORRENZE_GIORNI = 28;

/**
 * Giorni dell'orizzonte di una ricorrenza: 28 (§7), o il suo anticipo personalizzato più lungo (fino a 31 giorni,
 * §13.1) più uno, perché l'occorrenza esista prima che il suo avviso scatti (§13.3 considera i blocchi entro 14 + 31
 * giorni; audit P3-1, D-OCC-2).
 */
export function horizonDays(r: Pick<Ricorrenza, 'promemoria'>): number {
  // Una ricorrenza ricevuta o importata può portare qualunque valore: contano solo gli anticipi validi (§13.1), così un
  // promemoria assente o un anticipo enorme non fanno generare migliaia di occorrenze (revisione di P3-1)
  const p = r.promemoria as Ricorrenza['promemoria'] | undefined;
  const anticipi = (p?.modo === 'personalizzato' && Array.isArray(p.anticipi) ? p.anticipi : [])
    .map((a) => a.minuti)
    .filter((m) => Number.isInteger(m) && m >= 0 && m <= MAX_ANTICIPO_MINUTI);
  return Math.max(ORIZZONTE_OCCORRENZE_GIORNI, Math.ceil(Math.max(0, ...anticipi) / (24 * 60)) + 1);
}

/**
 * Id deterministico di un'occorrenza = slot della ricorrenza: ricorrenza, giorno locale e orario di parete d'inizio
 * della definizione (D-DATA-2). Non cambia se l'utente sposta l'occorrenza (C4) né al riancoraggio; cambiare l'orario
 * della definizione crea slot nuovi (B6).
 */
export const occurrenceId = (ricorrenzaId: string, giorno: string, orarioInizio: string): string =>
  `${ricorrenzaId}:${giorno}:${orarioInizio}`;

/**
 * Intervallo delle chiavi degli slot dell'orizzonte, da oggi all'ultimo giorno di `horizonDays` (§7): gli id di slot si ordinano per
 * ricorrenza, giorno e orario, e un'occorrenza spostata conserva il suo (D-DATA-2). Così la generazione legge solo gli
 * slot che confronta, non tutta la storia della routine (D-SCHED-1).
 */
export function horizonSlotRange(r: Pick<Ricorrenza, 'id' | 'promemoria'>, now: number): readonly [string, string] {
  const oggi = startOfLocalDay(now);
  const ultimo = localDayKey(addLocalDays(oggi, horizonDays(r)));
  // "~" viene dopo le cifre e i ":" dell'orario: chiude il giorno `ultimo` a ogni orario
  return [`${r.id}:${localDayKey(oggi)}`, `${r.id}:${ultimo}:~`];
}

/** Giorno locale dello slot, letto dall'id (D-DATA-2): resta quello anche se l'utente ha spostato l'occorrenza (C4). */
export const occurrenceDay = (id: string, ricorrenzaId: string): string =>
  id.slice(ricorrenzaId.length + 1, ricorrenzaId.length + 11);

/**
 * Un'occorrenza spostata dall'utente (C4, «Anticipa»): giorno o orario di parete diversi dal suo slot, che resta
 * nell'id (D-DATA-2). È un dato dell'utente: una definizione ricevuta non la riscrive né la toglie, e riportarla allo
 * slot con una modifica fatta qui è un gesto che viaggia (D-SYNC-6). Lo slot nel buco dell'ora legale ha l'orario che
 * gli dà l'orologio (02:30 → 03:30, D-TIME-3): lì non è spostata.
 */
export const isMovedOccurrence = (
  b: Pick<BloccoAncorato, 'id' | 'giornoLocale' | 'orarioInizio'>,
  ricorrenzaId: string,
): boolean => {
  const giorno = occurrenceDay(b.id, ricorrenzaId);
  const orario = b.id.slice(ricorrenzaId.length + 12);
  return b.giornoLocale !== giorno || b.orarioInizio !== localTimeKey(localInstant(giorno, orario));
};

/**
 * L'errore che rende illeggibile una ricorrenza (un dato rotto, anche da un backup o da un altro dispositivo), o `null`:
 * il ciclo la salta e la sync la scarta, con l'errore in Diagnostica (D-SCHED-1 n. 8; una sola prova, audit P3-20).
 */
export function recurrenceError(r: Ricorrenza, now: number): unknown {
  try {
    missingOccurrences(r, [], now);
    return null;
  } catch (e) {
    return e ?? new Error('ricorrenza illeggibile');
  }
}

/** Differenza da applicare a una modifica (§7): blocchi da scrivere (nuovi o riscritti), id da eliminare. */
export interface PianoOccorrenze {
  daScrivere: Blocco[];
  daEliminare: string[];
}

/**
 * Istanti di parete nel giorno dato: fine ≤ inizio → il giorno dopo; senza fine → `null` (§2, §7). Nel buco dell'ora
 * legale (un orario che quel giorno non esiste) l'inizio va avanti come l'orologio e il blocco lo segue con la sua
 * durata; nella sovrapposizione vale la prima delle due ore uguali (D-TIME-3).
 */
function wallInstants(
  giorno: string,
  orarioInizio: string,
  orarioFine: string | null,
): Pick<Blocco, 'inizio' | 'fine'> {
  const inizio = localInstant(giorno, orarioInizio);
  if (orarioFine === null) return { inizio, fine: null };
  if (localTimeKey(inizio) !== orarioInizio)
    return { inizio, fine: inizio + (wallDuration(orarioInizio, orarioFine) ?? 0) * MINUTE };
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

/** Le occorrenze previste nell'orizzonte (`horizonDays`) nei giorni scelti, entro le date e fuori dalle saltate (§7). */
function expectedOccurrences(r: Ricorrenza, now: number): Blocco[] {
  const oggi = startOfLocalDay(now);
  const out: Blocco[] = [];
  for (let i = 0, fine = horizonDays(r); i <= fine; i++) {
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
