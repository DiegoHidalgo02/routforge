/**
 * «Il tuo progresso oggi» e «Prossime attività» di Oggi (S1; FUNZ §2, `claude-design/docs/DATI-UI.md`): i blocchi della
 * settimana di oggi, il focus delle sessioni di oggi e di ieri (MECC §20: sessioni del periodo = avvio nel periodo) e i
 * primi due giorni con attività dopo oggi, cercati nei prossimi `GIORNI_PROSSIMI` (le routine generano quattro
 * settimane, §7). Le regole stanno in `domain/progress.ts`. Criteri: SCENARI A7, C10 («Completate»). Decisione: D-PROG-1.
 */
import type { RoutForgeDb } from '../data/db';
import { sessionsBetween } from '../data/repository';
import { shiftPeriod, weekOf } from '../domain/calendar';
import { upcomingDays } from '../domain/progress';
import { localInstant } from '../domain/time';
import { calendarDays, type BloccoCalendario } from './calendar';

/** Quanti giorni dopo oggi si guardano per «Prossime attività». */
export const GIORNI_PROSSIMI = 28;

export interface IngressiProgresso {
  /** I giorni della settimana di oggi, da lunedì, con i loro blocchi. */
  settimana: Map<string, BloccoCalendario[]>;
  /** Focus delle sessioni avviate oggi e ieri (ms). */
  focusOggi: number;
  focusIeri: number;
  /** I primi due giorni dopo oggi con attività, con i loro blocchi nell'ordine della vista. */
  prossimi: [string, readonly BloccoCalendario[]][];
}

/** Focus delle sessioni avviate nel giorno locale `giorno` (§20). */
async function focusOf(db: RoutForgeDb, giorno: string): Promise<number> {
  const da = localInstant(giorno, '00:00');
  const a = localInstant(shiftPeriod(giorno, 'giorno', 1), '00:00');
  return (await sessionsBetween(db, da, a)).reduce((somma, s) => somma + s.riepilogo.focus, 0);
}

/** Gli ingressi del progresso per il giorno locale `oggi` ("YYYY-MM-DD"). */
export async function progressInputs(db: RoutForgeDb, oggi: string): Promise<IngressiProgresso> {
  const avanti = Array.from({ length: GIORNI_PROSSIMI }, (_, i) => shiftPeriod(oggi, 'giorno', i + 1));
  const [settimana, futuro, focusOggi, focusIeri] = await Promise.all([
    calendarDays(db, weekOf(oggi)),
    calendarDays(db, avanti),
    focusOf(db, oggi),
    focusOf(db, shiftPeriod(oggi, 'giorno', -1)),
  ]);
  return { settimana, focusOggi, focusIeri, prossimi: upcomingDays(futuro, oggi) };
}
