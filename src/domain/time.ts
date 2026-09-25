/**
 * Helper temporali del dominio.
 * Fonte: RoutForge_CONTESTO.md §3 ("tutte le regole usano il giorno e l'ora LOCALI
 * del dispositivo; fuso orario e ora legale non devono spostare i blocchi di giorno").
 *
 * Tutta l'aritmetica sui giorni passa dal costruttore Date(y, m, d, …) locale,
 * che è robusto all'ora legale (un "giorno" può durare 23 o 25 ore).
 */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Minuti → millisecondi. */
export const minutes = (n: number): number => n * MINUTE;

/** Chiave del giorno locale, es. "2026-09-22". Usata come identità del giorno. */
export function localDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Orario locale "HH:MM" che contiene `ms`: l'ora di parete di un'attività (D-TIME-2). */
export function localTimeKey(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 00:00:00.000 locale del giorno che contiene `ms`. */
export function startOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * 23:59:00.000 locale del giorno che contiene `ms`.
 * Nota: la spec usa "23:59" come fine dei blocchi senza fine (§1, §6, §8);
 * da qui derivano scadenze come "perso alle 00:29 del giorno dopo" (B4, A1).
 */
export function endOfLocalDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 0, 0).getTime();
}

/** Somma `n` giorni locali (n può essere negativo). */
export function addLocalDays(ms: number, n: number): number {
  const d = new Date(ms);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + n,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds(),
  ).getTime();
}

/** Costruttore comodo per test e fixture: data/ora LOCALE. Mese 1-based. */
export function local(y: number, month1: number, day: number, h = 0, min = 0, s = 0): number {
  return new Date(y, month1 - 1, day, h, min, s, 0).getTime();
}

/** Giorno della settimana locale: 0 = domenica … 6 = sabato. */
export function localWeekday(ms: number): number {
  return new Date(ms).getDay();
}

/** true se i due istanti cadono nello stesso giorno locale. */
export function sameLocalDay(a: number, b: number): boolean {
  return localDayKey(a) === localDayKey(b);
}
