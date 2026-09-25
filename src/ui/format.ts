// Formattazioni condivise dalle schermate (lingua di `pickLanguage`, MECC §23).
import { lingua, t } from './i18n';

/** Durata in minuti nella forma breve dei mock: «30m», «1h», «1h 30m». */
export const durata = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return t('minutiBrevi', { m });
  return m ? t('durata', { h, m: String(m).padStart(2, '0') }) : t('oreBrevi', { h });
};

/** Iniziale maiuscola nella lingua dell'app (i nomi di giorni e mesi di `Intl` nascono minuscoli). */
export const maiuscola = (x: string): string => x.charAt(0).toLocaleUpperCase(lingua) + x.slice(1);
