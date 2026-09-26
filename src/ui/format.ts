// Formattazioni condivise dalle schermate (lingua di `pickLanguage`, MECC §23).
import type { BloccoCalendario } from '../app/calendar';
import type { Blocco, TipoBlocco } from '../domain/types';
import { lingua, t, type Chiave } from './i18n';

/** Durata in minuti nella forma breve dei mock: «30m», «1h», «1h 30m». */
export const durata = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return t('minutiBrevi', { m });
  return m ? t('durata', { h, m: String(m).padStart(2, '0') }) : t('oreBrevi', { h });
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
