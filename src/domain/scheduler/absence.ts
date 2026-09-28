/**
 * Ritorno dopo un'assenza (MECC §9; FUNZ §2 «Ritorno dopo un'assenza»): se dall'ultima apertura sono passati almeno
 * 2 giorni e c'è almeno un corso, all'apertura un messaggio una tantum dice che il piano si è già riallineato, senza
 * contare le attività perse. I giorni sono giorni locali di calendario (`localDaysBetween`), non 48 ore; senza
 * un'ultima apertura non c'è assenza; l'avviso non chiuso vale solo nel giorno dell'apertura. Il servizio
 * `app/absence.ts` legge e aggiorna l'ultima apertura a ogni apertura. Criterio: test con «ultima apertura» (T-014).
 * Decisione: D-ASSENZA-1.
 */
import { localDayKey, localDaysBetween } from '../time';

/** Soglia di §9: giorni locali fra l'ultima apertura e questa. */
export const GIORNI_ASSENZA = 2;

/** L'avviso di ritorno: i giorni passati dall'ultima apertura e il giorno locale dell'apertura che lo ha prodotto. */
export interface AvvisoAssenza {
  giorni: number;
  giorno: string;
}

/** L'avviso dell'apertura `now`, o `null`: prima apertura, meno di 2 giorni o nessun corso (§9). */
export function absenceNotice(ultimaApertura: number | null, now: number, corsi: number): AvvisoAssenza | null {
  if (ultimaApertura === null || corsi === 0) return null;
  const giorni = localDaysBetween(ultimaApertura, now);
  return giorni >= GIORNI_ASSENZA ? { giorni, giorno: localDayKey(now) } : null;
}

/** L'avviso non ancora chiuso si mostra solo nel giorno dell'apertura: il giorno dopo non è più vero (D-ASSENZA-1). */
export const noticeOfDay = (avviso: AvvisoAssenza | null, oggi: string): AvvisoAssenza | null =>
  avviso?.giorno === oggi ? avviso : null;
