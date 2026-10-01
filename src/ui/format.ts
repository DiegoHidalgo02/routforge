// Formattazioni condivise dalle schermate (lingua di `pickLanguage`, MECC §23).
import type { BloccoCalendario } from '../app/calendar';
import type { Blocco, TipoBlocco } from '../domain/types';
import { lingua, t, type Chiave } from './i18n';

/** Fuso corrente del dispositivo per le scritture delle schermate (la porta `Clock` è dei servizi, D-SCHED-1 n. 9). */
export const fuso = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** «mar 22 set»: sigla del giorno, numero e mese breve (S4, S5, S15). */
export const fmtData = new Intl.DateTimeFormat(lingua, { weekday: 'short', day: 'numeric', month: 'short' });

/** Lunedì → domenica come nei mock; 0 = domenica (`localWeekday`). */
export const SETTIMANA = [1, 2, 3, 4, 5, 6, 0];

/** Durata in minuti nella forma breve dei mock: «30m», «1h», «1h 30m». */
export const durata = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return t('minutiBrevi', { m });
  return m ? t('durata', { h, m: String(m).padStart(2, '0') }) : t('oreBrevi', { h });
};

/** Tempo del timer «24:19», «1:05:00»; `perEccesso` per il conto alla rovescia, che mostra 50:00 all'avvio. */
export const orologio = (ms: number, perEccesso = false): string => {
  const sec = Math.max(0, perEccesso ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const due = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(sec / 3600);
  const mm = `${due(Math.floor((sec % 3600) / 60))}:${due(sec % 60)}`;
  return h ? `${h}:${mm}` : mm;
};

/** Iniziale maiuscola nella lingua dell'app (i nomi di giorni e mesi di `Intl` nascono minuscoli). */
export const maiuscola = (x: string): string => x.charAt(0).toLocaleUpperCase(lingua) + x.slice(1);

/** Chiave del nome di ogni tipo di attività (badge delle card, S1). */
export const TIPO: Record<TipoBlocco, Chiave> = {
  todo: 'tipoTodo',
  studio: 'tipoStudio',
  routine: 'tipoRoutine',
  evento: 'tipoEvento',
};

/** Titolo di un blocco sul calendario: il suo, o il nome del tipo. */
export const titolo = (b: Pick<Blocco, 'titolo' | 'tipo'>): string => b.titolo || t(TIPO[b.tipo]);

/** Sottotitolo della card di S1: «Persa · era alle …», conto della checklist o luogo dell'evento; altrimenti vuoto. */
export function sottotitolo(b: BloccoCalendario): string {
  if (b.stato === 'perso' && b.conOrario) return t('persaEraAlle', { ora: b.orarioInizio });
  const lista = b.checklist ?? [];
  if (lista.length) return t('checklistConto', { fatte: lista.filter((v) => v.fatta).length, totale: lista.length });
  return b.luogo ?? '';
}
