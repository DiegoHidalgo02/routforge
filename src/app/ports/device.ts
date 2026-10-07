/**
 * Porte del dispositivo durante la sessione di studio (MECC §10.4; docs/02_ARCHITETTURA.md §6): schermo tenuto acceso e
 * Non Disturbare di sistema per l'iperfocus. Adapter web in `src/platform/device.ts` (Wake Lock; Non Disturbare non
 * esiste sul web), nativi con T-021. Un adapter non lancia eccezioni (INV-16).
 */
export interface ScreenAwake {
  /** Tiene lo schermo acceso finché non si chiama la funzione restituita. */
  keep(): () => void;
}

export interface DoNotDisturb {
  /** Attiva Non Disturbare; `false` se il permesso manca o la piattaforma non lo offre (l'iperfocus vale comunque). */
  enable(): Promise<boolean>;
  /** Ripristina lo stato di prima. */
  disable(): void;
  /** L'accesso a Non disturbare concesso all'app nelle impostazioni del sistema (Diagnostica, MECC §23). */
  access?(): Promise<boolean>;
}

/**
 * Il servizio in primo piano della sessione (MECC §10.4, D-TIMER-2; T-021): su Android una notifica fissa col cronometro
 * dall'avvio tiene vivo il processo, e coi battiti la continuità, anche con l'app chiusa; sul web non c'è. Non lancia.
 */
export interface SessioneInPrimoPiano {
  avvia(s: { titolo: string; avvio: number }): void;
  ferma(): void;
}
