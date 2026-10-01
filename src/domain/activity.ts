/**
 * Creazione delle quattro attività: campi, vincoli e valori di default.
 * Fonte: MECCANISMI §2 (tabella dei campi), §4 (limiti della checklist), §13.1 (anticipi e sveglie), §1 (ancore dei
 * blocchi senza orario), §7 (fine ≤ inizio → giorno dopo per routine e studio; per l'evento è un errore, S4 Crea). FUNZIONALITA §3.
 * Decisioni: D-CREA-1, D-DESIGN-1 (n. 19–20).
 *
 * `validateActivity` riceve la bozza del form e restituisce gli errori oppure il blocco (todo, evento) o la
 * definizione (routine, routine di studio) pronti da salvare. I campi che la variante scelta non usa si scartano
 * (priorità di un todo con orario, promemoria di un todo senza orario, anticipi di un evento tutto il giorno); i valori
 * fuori dai limiti sono errori (D-CREA-1). Le occorrenze delle routine le genera T-011; gli id (anche delle fasi) li dà il servizio.
 */
import { isDayKey, shiftPeriod } from './calendar';
import { endOfLocalDay, localInstant, minutes } from './time';
import type { Blocco, Orizzonte, Priorita, Promemoria, Ricorrenza } from './types';

/** Ancora dei todo senza orario: 12:00–23:59 del loro giorno (§1), anche quando rotolano (§6). */
export const ANCORA_TODO = '12:00';

/** Gradini della durata di un todo con orario, in minuti (§2). */
export const GRADINI_DURATA = [5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 210, 240] as const;
/** Durata predefinita del form «+ Crea» per un todo con orario, in minuti: anche quella del todo senza orario che si trascina su un orario (§15). */
export const DURATA_TODO = 30;
/** Anticipi proposti dal promemoria personalizzato, in minuti: 1 g, 1 h, 30/15/10/5', all'inizio (§13.1). */
export const ANTICIPI = [1440, 60, 30, 15, 10, 5, 0] as const;
/** Anticipo libero fino a 31 giorni (§13.1). */
export const MAX_ANTICIPO_MINUTI = 31 * 24 * 60;
/** Sveglia a schermo intero solo per anticipi ≤ 7 h (§13.1). */
export const MAX_ANTICIPO_SVEGLIA = 7 * 60;
/** Checklist: massimo 60 voci da 120 caratteri (§4). */
export const MAX_VOCI_CHECKLIST = 60;
export const MAX_CARATTERI_VOCE = 120;
/** Titolo di default delle routine di studio (§2, §7). */
export const TITOLO_STUDIO = 'Studio';

/** Fine di una ricorrenza: `null` = mai; altrimenti dopo N giorni/settimane/mesi (§2). */
export type Termine = null | { n: number; unita: 'giorni' | 'settimane' | 'mesi' };

interface BozzaComune {
  titolo: string;
  note: string;
  promemoria: Promemoria;
}

/** I campi del form «+ Crea» per tipo (§2). Orari "HH:MM", giorni "YYYY-MM-DD", giorni della settimana 0 = domenica. */
export type BozzaAttivita =
  | (BozzaComune & {
      tipo: 'todo';
      giorno: string;
      /** `null` = senza orario (default §2). */
      orario: { inizio: string; durata: number } | null;
      orizzonte: Orizzonte;
      priorita: Priorita;
      checklist: string[];
      corsoId: string | null;
    })
  | (BozzaComune & {
      tipo: 'evento';
      giorno: string;
      /** `null` = tutto il giorno (§2). */
      orario: { inizio: string; fine: string } | null;
      luogo: string;
      fasi: string[];
    })
  | (BozzaComune & {
      tipo: 'routine';
      giorni: number[];
      inizio: string;
      /** `null` = senza durata (§2). */
      fine: string | null;
      dataInizio: string;
      termine: Termine;
      fasi: string[];
    })
  | (BozzaComune & {
      tipo: 'studio';
      corsoId: string | null;
      giorni: number[];
      inizio: string;
      fine: string;
      dataInizio: string;
      termine: Termine;
    });

export type ErroreAttivita =
  | 'titolo'
  | 'giorni'
  | 'data'
  | 'orario'
  | 'fine'
  | 'durata'
  | 'checklist_voci'
  | 'checklist_testo'
  | 'termine'
  | 'anticipo'
  | 'sveglia';

export type NuovoBlocco = Omit<Blocco, 'id' | 'fasi'>;
export type NuovaRicorrenza = Omit<Ricorrenza, 'id' | 'fasi' | 'fuso'>;

/** Esito: gli errori, oppure il blocco o la definizione con le etichette delle fasi (gli id li dà il servizio). */
export type Validazione =
  | { ok: false; errori: ErroreAttivita[] }
  | { ok: true; fasi: string[]; blocco: NuovoBlocco; ricorrenza?: undefined }
  | { ok: true; fasi: string[]; ricorrenza: NuovaRicorrenza; blocco?: undefined };

const ORARIO = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Istante locale del giorno "YYYY-MM-DD" all'orario "HH:MM"; `null` se uno dei due non è valido (`2026-02-31` no). */
const at = (giorno: string, orario: string): number | null =>
  isDayKey(giorno) && ORARIO.test(orario) ? localInstant(giorno, orario) : null;

/**
 * Ultimo giorno incluso di una ricorrenza che parte il `dataInizio` e termina dopo N unità (D-CREA-1): il giorno prima
 * dello stesso giorno N periodi dopo (`shiftPeriod`: nei mesi al più l'ultimo del mese, 31 gen + 1 mese → 28/29 feb).
 */
export function recurrenceLastDay(dataInizio: string, termine: NonNullable<Termine>): string {
  const vista = termine.unita === 'giorni' ? 'giorno' : termine.unita === 'settimane' ? 'settimana' : 'mese';
  return shiftPeriod(shiftPeriod(dataInizio, vista, termine.n), 'giorno', -1);
}

/** Durata di parete fra due orari "HH:MM", in minuti: fine ≤ inizio = il giorno dopo (§2, §7); `null` se malformati. */
export function wallDuration(inizio: string, fine: string): number | null {
  const a = ORARIO.exec(inizio);
  const b = ORARIO.exec(fine);
  if (!a || !b) return null;
  const d = +b[1]! * 60 + +b[2]! - (+a[1]! * 60 + +a[2]!);
  return d > 0 ? d : d + 24 * 60;
}

/** true se la fine cade il giorno dopo l'inizio: fine ≤ inizio (§2, §7). */
export const endsNextDay = (inizio: string, fine: string): boolean =>
  ORARIO.test(inizio) && ORARIO.test(fine) && fine <= inizio;

const pulite = (voci: readonly string[]): string[] => voci.map((v) => v.trim()).filter((v) => v !== '');

function checkReminder(p: Promemoria, conOrario: boolean, errori: ErroreAttivita[]): Promemoria {
  // Evento tutto il giorno: un solo trigger alle 08:00 del giorno (§13.2), gli anticipi non valgono → Auto (D-CREA-1)
  if (!conOrario) return p.modo === 'off' ? p : { modo: 'auto' };
  if (p.modo !== 'personalizzato') return p;
  // Un anticipo è o notifica o sveglia (§13.1): un anticipo ripetuto conta una volta, sveglia se lo è una delle due
  const anticipi = new Map<number, boolean>();
  for (const a of p.anticipi) {
    if (!Number.isInteger(a.minuti) || a.minuti < 0 || a.minuti > MAX_ANTICIPO_MINUTI) errori.push('anticipo');
    else if (a.sveglia && a.minuti > MAX_ANTICIPO_SVEGLIA) errori.push('sveglia');
    anticipi.set(a.minuti, a.sveglia || (anticipi.get(a.minuti) ?? false));
  }
  return { modo: 'personalizzato', anticipi: [...anticipi].map(([minuti, sveglia]) => ({ minuti, sveglia })) };
}

function checkRecurrence(
  b: { giorni: number[]; dataInizio: string; termine: Termine; inizio: string; fine: string | null },
  errori: ErroreAttivita[],
): Pick<NuovaRicorrenza, 'giorni' | 'dataInizio' | 'dataFine' | 'orarioInizio' | 'orarioFine'> {
  const giorni = [...new Set(b.giorni)].sort((x, y) => x - y);
  if (giorni.length === 0 || giorni.some((g) => !Number.isInteger(g) || g < 0 || g > 6)) errori.push('giorni');
  if (at(b.dataInizio, '00:00') === null) errori.push('data');
  if (!ORARIO.test(b.inizio) || (b.fine !== null && !ORARIO.test(b.fine))) errori.push('orario');
  const t = b.termine;
  if (t && (!Number.isInteger(t.n) || t.n < 1)) errori.push('termine');
  const dataFine = t && errori.length === 0 ? recurrenceLastDay(b.dataInizio, t) : null;
  // Fine ≤ inizio = il giorno dopo (§2, §7): lo applica la generazione delle occorrenze (T-011)
  return { giorni, dataInizio: b.dataInizio, dataFine, orarioInizio: b.inizio, orarioFine: b.fine };
}

/** Valida la bozza del form «+ Crea» (§2) e la trasforma in ciò che si salva. */
export function validateActivity(b: BozzaAttivita): Validazione {
  const errori: ErroreAttivita[] = [];
  const titolo = b.titolo.trim();
  const note = b.note.trim();
  if (titolo === '' && b.tipo !== 'studio') errori.push('titolo');

  if (b.tipo === 'todo') {
    const conOrario = b.orario !== null;
    const inizio = at(b.giorno, b.orario ? b.orario.inizio : ANCORA_TODO);
    if (at(b.giorno, '00:00') === null) errori.push('data');
    else if (inizio === null) errori.push('orario');
    if (b.orario && !(GRADINI_DURATA as readonly number[]).includes(b.orario.durata)) errori.push('durata');
    const checklist = pulite(b.checklist);
    if (checklist.length > MAX_VOCI_CHECKLIST) errori.push('checklist_voci');
    if (checklist.some((v) => v.length > MAX_CARATTERI_VOCE)) errori.push('checklist_testo');
    const promemoria = conOrario ? checkReminder(b.promemoria, true, errori) : ({ modo: 'auto' } as const);
    if (errori.length > 0 || inizio === null) return { ok: false, errori };
    return {
      ok: true,
      fasi: [],
      blocco: {
        tipo: 'todo',
        stato: 'programmato',
        titolo,
        note,
        // Senza orario: ancora 12:00–23:59 (§1)
        inizio,
        fine: b.orario ? inizio + minutes(b.orario.durata) : endOfLocalDay(inizio),
        conOrario,
        orizzonte: b.orizzonte,
        ...(conOrario ? {} : { priorita: b.priorita }),
        checklist: checklist.map((testo) => ({ testo, fatta: false })),
        corsoId: b.corsoId,
        promemoria,
      },
    };
  }

  if (b.tipo === 'evento') {
    // Tutto il giorno: ancora 00:00–23:59 (§1)
    const inizio = at(b.giorno, b.orario ? b.orario.inizio : '00:00');
    const fine = b.orario ? at(b.giorno, b.orario.fine) : inizio === null ? null : endOfLocalDay(inizio);
    if (at(b.giorno, '00:00') === null) errori.push('data');
    else if (inizio === null || fine === null) errori.push('orario');
    // Fine ≤ inizio è un errore per l'evento (S4 Crea, D-DESIGN-1 n. 19); routine e studio passano al giorno dopo
    else if (fine <= inizio) errori.push('fine');
    const promemoria = checkReminder(b.promemoria, b.orario !== null, errori);
    if (errori.length > 0 || inizio === null || fine === null) return { ok: false, errori };
    return {
      ok: true,
      fasi: pulite(b.fasi),
      blocco: {
        tipo: 'evento',
        stato: 'programmato',
        titolo,
        note,
        inizio,
        fine,
        conOrario: b.orario !== null,
        luogo: b.luogo.trim(),
        promemoria,
      },
    };
  }

  const ricorrenza = checkRecurrence(b, errori);
  const promemoria = checkReminder(b.promemoria, true, errori);
  if (errori.length > 0) return { ok: false, errori };
  return {
    ok: true,
    fasi: b.tipo === 'routine' ? pulite(b.fasi) : [],
    ricorrenza: {
      tipo: b.tipo,
      titolo: titolo === '' ? TITOLO_STUDIO : titolo,
      note,
      ...ricorrenza,
      dateSaltate: [],
      corsoId: b.tipo === 'studio' ? b.corsoId : null,
      promemoria,
    },
  };
}
