/**
 * Gesti sulle notifiche native (MECC §13.2; T-021, T-051): le azioni rapide e il tocco. Posticipa = +10' con la stessa
 * chiave (`snoozeNotification`, F5); il tocco registra l'istante di risposta della verifica (§20 «risposto») e apre
 * l'esito per «esito» e «perso» di uno studio, l'unità per lo studio, il Dettaglio per il resto; «Inizia» apre il setup
 * della sessione sul blocco; «Registra esito» il foglio dell'esito; «Segna fatto» è la spunta diretta: completa, o apre
 * il Dettaglio sul foglio che serve (voci rimaste, revisione delle fasi, esito). Il punto di composizione porta poi l'app
 * alla destinazione; nessuna eccezione arriva all'adapter (INV-16).
 */
import type { RoutForgeDb } from '../data/db';
import { get, saveBlock } from '../data/repository';
import type { PassoSpunta } from '../domain/completion';
import { checkFromCalendar } from './completion';
import { logError } from './diagnostics';
import { snoozeNotification } from './notifications';
import type { GestoNotifica, VoceToccata } from './ports/notifications';

/** Dove aprire l'app dopo il gesto, con la vista del Dettaglio; `null` = nulla da aprire. */
export type Destinazione = { percorso: string; vista?: Exclude<PassoSpunta, 'completa'> } | null;

const enc = encodeURIComponent;

/** La rotta di un blocco aperto da una notifica o dal widget (§13.2, §21): lo studio apre l'unità, il resto il Dettaglio. */
export const blockRoute = (b: {
  id: string;
  tipo: string;
  corsoId?: string | null;
  unitaId?: string | null;
}): string =>
  b.tipo === 'studio' && b.corsoId && b.unitaId
    ? `/corsi/${enc(b.corsoId)}/unita/${enc(b.unitaId)}`
    : `/attivita/${enc(b.id)}`;

/** La rotta di un blocco per id; Oggi se il blocco non c'è più. */
export const blockRouteById = async (db: RoutForgeDb, id: string): Promise<string> => {
  const b = await get(db, 'blocchi', id).catch(() => undefined);
  return b ? blockRoute(b) : '/';
};

export async function notificationGesture(
  db: RoutForgeDb,
  voce: VoceToccata,
  gesto: GestoNotifica,
  now: number,
  fuso: string,
): Promise<Destinazione> {
  try {
    return await applyGesture(db, voce, gesto, now, fuso);
  } catch (e) {
    logError('notifiche', e);
    return voce.bloccoId ? { percorso: `/attivita/${enc(voce.bloccoId)}` } : { percorso: '/' };
  }
}

/**
 * Un gesto fatto ad app chiusa, col suo istante (A6, T-057): `false` se non si è applicato, così resta nella coda nativa
 * e si riprova (audit P2-28). L'errore va in Diagnostica (INV-16).
 */
export async function backgroundGesture(
  db: RoutForgeDb,
  voce: VoceToccata,
  gesto: GestoNotifica,
  istante: number,
  fuso: string,
): Promise<boolean> {
  try {
    await applyGesture(db, voce, gesto, istante, fuso);
    return true;
  } catch (e) {
    logError('notifiche', e);
    return false;
  }
}

async function applyGesture(
  db: RoutForgeDb,
  voce: VoceToccata,
  gesto: GestoNotifica,
  now: number,
  fuso: string,
): Promise<Destinazione> {
  const b = voce.bloccoId ? await get(db, 'blocchi', voce.bloccoId) : undefined;
  // Qualunque gesto sulla notifica della verifica è una risposta (§13.2 «per quel trigger», §20)
  if (b && voce.trigger === 'verifica') await saveBlock(db, { ...b, toccoVerificaIl: now }, now, fuso);
  if (gesto === 'posticipa') {
    await snoozeNotification(db, voce.chiave, now);
    return null;
  }
  if (!voce.bloccoId) return { percorso: voce.trigger === 'tempo_scaduto' ? '/sessione' : '/' };
  if (!b) return { percorso: '/' };
  const dettaglio = `/attivita/${enc(b.id)}`;
  if (gesto === 'inizia') return { percorso: `/sessione/setup?blocco=${enc(b.id)}` };
  if (gesto === 'registra_esito') return { percorso: dettaglio, vista: 'esito' };
  if (gesto === 'segna_fatto') {
    const passo = await checkFromCalendar(db, b.id, now, fuso);
    if (passo === 'completa') return null;
    return passo ? { percorso: dettaglio, vista: passo } : { percorso: dettaglio };
  }
  if (b.tipo === 'studio' && (voce.trigger === 'esito' || voce.trigger === 'perso'))
    return { percorso: dettaglio, vista: 'esito' };
  return { percorso: blockRoute(b) };
}
