/**
 * Ore silenziose (MECCANISMI §13.4; FUNZ §7.4): una fascia di ore di parete, anche a cavallo di mezzanotte; una notifica
 * che ci cade dentro si sposta alla fine della fascia (il giorno dopo se la fascia scavalca la mezzanotte). Vale per i
 * trigger pianificati, il digest e i posticipi, non per gli avvisi one-shot: lo decide `desiredSet`, prima della
 * finestra, così il registro vede l'istante vero. Criteri: SCENARI F3. Decisione: D-NOTIF-2 (inizio della fascia
 * incluso, fine esclusa; spente per default).
 */
import { addLocalDays, localDayKey, localInstant } from '../time';

export interface OreSilenziose {
  attive: boolean;
  /** Ora di parete "HH:MM" d'inizio della fascia (inclusa). */
  dalle: string;
  /** Ora di parete "HH:MM" di fine della fascia (esclusa); non dopo `dalle` = il giorno seguente. */
  alle: string;
}

/** L'istante spostato alla fine della fascia se ci cade dentro; altrimenti com'era. */
export function quietShift(istante: number, ore: OreSilenziose): number {
  if (!ore.attive || ore.dalle === ore.alle) return istante;
  // La fascia che contiene l'istante può essere iniziata ieri (a cavallo di mezzanotte) oppure oggi
  for (const giorno of [localDayKey(addLocalDays(istante, -1)), localDayKey(istante)]) {
    const da = localInstant(giorno, ore.dalle);
    const stessoGiorno = localInstant(giorno, ore.alle);
    const a = stessoGiorno > da ? stessoGiorno : localInstant(localDayKey(addLocalDays(da, 1)), ore.alle);
    if (istante >= da && istante < a) return a;
  }
  return istante;
}
