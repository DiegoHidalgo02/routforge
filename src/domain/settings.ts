/**
 * Impostazioni dell'aspetto e del calendario. Fonti: FUNZIONALITA §23 (animazioni auto/sempre/mai, celebrazioni sobria ·
 * piena · off con la sobria predefinita, feedback aptico, inizio settimana lunedì o domenica); claude-design/CLAUDE.md
 * (Celebrazioni). Criterio: T-032 («Inizio settimana» cambia la vista Settimana e la fine dell'orizzonte).
 *
 * Una riga salvata illeggibile o incompleta non blocca l'app: ogni campo non valido vale il suo predefinito.
 */

export type Animazioni = 'auto' | 'sempre' | 'mai';
export type Celebrazioni = 'sobria' | 'piena' | 'off';
/** Primo giorno della settimana come `getDay()`: 1 = lunedì, 0 = domenica. */
export type InizioSettimana = 0 | 1;

/** Giorni dal primo giorno della settimana (0–6) per un giorno della settimana come `getDay()` (FUNZ §23). */
export const weekOffset = (giornoSettimana: number, inizio: InizioSettimana): number =>
  (giornoSettimana - inizio + 7) % 7;

export interface Impostazioni {
  animazioni: Animazioni;
  celebrazioni: Celebrazioni;
  aptico: boolean;
  inizioSettimana: InizioSettimana;
}

export const IMPOSTAZIONI_DEFAULT: Impostazioni = {
  animazioni: 'auto',
  celebrazioni: 'sobria',
  aptico: true,
  inizioSettimana: 1,
};

const fra = <T>(v: unknown, ammessi: readonly T[], predefinito: T): T =>
  ammessi.includes(v as T) ? (v as T) : predefinito;

/** Le impostazioni da una riga salvata, campo per campo. */
export function readableSettings(v: unknown): Impostazioni {
  const x = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>;
  const d = IMPOSTAZIONI_DEFAULT;
  return {
    animazioni: fra(x.animazioni, ['auto', 'sempre', 'mai'] as const, d.animazioni),
    celebrazioni: fra(x.celebrazioni, ['sobria', 'piena', 'off'] as const, d.celebrazioni),
    aptico: fra(x.aptico, [true, false], d.aptico),
    inizioSettimana: fra(x.inizioSettimana, [0, 1] as const, d.inizioSettimana),
  };
}
