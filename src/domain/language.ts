// Lingua dell'interfaccia — MECCANISMI §23, FUNZIONALITA §22 (D-I18N-1). Nessuno scenario la cita.
// Prima lingua del dispositivo, in ordine di preferenza, fra le sei dell'app; altrimenti inglese. Le preferenze del
// dispositivo arrivano come parametro: leggerle (e farlo una sola volta per processo) spetta a chi chiama.

export const LINGUE = ['it', 'en', 'es', 'pt', 'fr', 'de'] as const;
export type Lingua = (typeof LINGUE)[number];

/** `preferite`: tag di lingua del dispositivo in ordine di preferenza (`['pt-BR', 'en']`). */
export function pickLanguage(preferite: readonly string[]): Lingua {
  for (const tag of preferite) {
    const primaria = tag.split(/[-_]/)[0]?.toLowerCase();
    const lingua = LINGUE.find((l) => l === primaria);
    if (lingua) return lingua;
  }
  return 'en';
}
