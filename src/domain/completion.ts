/**
 * Spunta e completamento: quando è consentita, cosa scrive, cosa si mostra.
 * Fonte: MECCANISMI §3 (spunta diretta per tipo, unica operazione, annulla spunta), §8 (la spunta azzera la marcatura
 * «perso»), FUNZIONALITA §4.1, §4.3 («Saltata»), §4.4 («concluso»). Scenari: B2 (finestra di spunta), E2 (evento mai
 * perso, solo «concluso»). La finestra della routine è `canCheckRoutine` di lost.ts (D-MODULI-1).
 * Le notifiche del blocco le cancella e ri-arma il servizio (`src/app/completion.ts`, T-019). Decisione: D-DETT-1.
 */
import { canCheckRoutine, effectiveEnd } from './lost';
import type { Blocco, StatoBlocco } from './types';

/**
 * Completamento consentito adesso dall'azione del dettaglio (§3): todo sempre, anche «non fatto» e da qualsiasi giorno;
 * routine solo nel giorno previsto (o dentro [inizio, fine] se a cavallo di mezzanotte), qualunque sia lo stato (B2:
 * persa alle 08:30, ancora spuntabile fino alle 23:59); evento con «Completa evento», senza vincolo di giorno; studio
 * mai (solo esito, §10–§11). La spunta diretta dalla card del calendario (§3: l'evento non ce l'ha) è di T-010/T-015.
 */
export function canComplete(b: Pick<Blocco, 'tipo' | 'inizio' | 'fine'>, now: number): boolean {
  switch (b.tipo) {
    case 'todo':
    case 'evento':
      return true;
    case 'routine':
      return canCheckRoutine(b, now);
    case 'studio':
      return false;
  }
}

/** Il blocco completato adesso (§3): stato e istante; una marcatura «perso» precedente si azzera (§8). */
export const completed = <B extends Blocco>(b: B, now: number): B => ({
  ...b,
  stato: 'completato',
  chiusoIl: now,
  persoIl: null,
});

/** Annulla spunta (§3): torna `programmato` con l'istante azzerato. */
export const reopened = <B extends Blocco>(b: B): B => ({ ...b, stato: 'programmato', chiusoIl: null });

/** Occorrenza di routine segnata «Saltata» (FUNZ §4.3), nella stessa finestra della spunta; nessun log (§5). */
export const skipped = <B extends Blocco>(b: B, now: number): B => ({
  ...b,
  stato: 'saltato',
  chiusoIl: now,
  persoIl: null,
});

/** Stato mostrato (§3): un evento non completato con la fine passata è «concluso», mai perso (E2); gli altri restano. */
export function shownState(b: Blocco, now: number): StatoBlocco | 'concluso' {
  return b.tipo === 'evento' && b.stato === 'programmato' && effectiveEnd(b) < now ? 'concluso' : b.stato;
}
