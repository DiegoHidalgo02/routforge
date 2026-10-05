/**
 * Spunta e completamento: quando è consentita, cosa scrive, cosa si mostra.
 * Fonte: MECCANISMI §3 (spunta diretta per tipo, unica operazione, annulla spunta), §4 (voci rimaste), §5 (revisione
 * delle fasi), §8 (la spunta azzera la marcatura «perso»), §24 (dal calendario persi e saltati non si spuntano, salvo i
 * todo), FUNZIONALITA §4.1, §4.3 («Saltata»), §4.4 («concluso»). Scenari: B2 (finestra di spunta), E2 (evento mai
 * perso, solo «concluso»). La finestra della routine è `canCheckRoutine` di lost.ts (D-MODULI-1).
 * Le notifiche del blocco le cancella e ri-arma il servizio (`src/app/completion.ts`, T-019). Decisioni: D-DETT-1,
 * D-DETT-3 (spunta diretta dal cerchio della card). Scenari della spunta dalla lista: A7, C10 (T-049).
 */
import { canCheckRoutine, effectiveEnd } from './lost';
import { canRegisterOutcome } from './outcome';
import { localDayKey } from './time';
import { STATI_TERMINALI, type Blocco, type StatoBlocco } from './types';

/**
 * Completamento consentito adesso dall'azione del dettaglio (§3): todo sempre, anche «non fatto» e da qualsiasi giorno;
 * routine solo nel giorno previsto (o dentro [inizio, fine] se a cavallo di mezzanotte), qualunque sia lo stato (B2:
 * persa alle 08:30, ancora spuntabile fino alle 23:59); evento con «Completa evento», senza vincolo di giorno; studio
 * mai (solo esito, §10–§11). La spunta diretta dal cerchio della card è `canCheckFromCalendar`.
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

/**
 * Spunta diretta dal cerchio della card del calendario (§3, D-DETT-3, T-049): todo sempre finché non è completato,
 * anche «non fatto»; routine solo nel giorno previsto e solo aperta (§24: dal calendario persi e saltati non si
 * spuntano, salvo i todo); evento («Completa evento») finché non è completato, senza vincolo di giorno; studio solo per
 * registrare l'esito di un'occorrenza di oggi già finita e non gestita (C10, `canRegisterOutcome` senza i persi).
 */
export function canCheckFromCalendar(b: Blocco, now: number): boolean {
  switch (b.tipo) {
    case 'todo':
    case 'evento':
      return b.stato !== 'completato';
    case 'routine':
      return (b.stato === 'programmato' || b.stato === 'in_corso') && canCheckRoutine(b, now);
    case 'studio':
      return b.stato === 'programmato' && canRegisterOutcome(b, now) && localDayKey(b.inizio) === localDayKey(now);
  }
}

/**
 * Il cerchio della card di Oggi (S1, `claude-design/docs/CONTROLLI.md`): fatto se completato; attivo se la spunta
 * diretta è consentita; assente per gli altri esiti chiusi (persi e saltati salvo i todo, §24; esiti di studio); spento
 * altrimenti (routine e studio fuori dal loro giorno, studio non ancora da registrare).
 */
export type Cerchio = 'fatto' | 'attivo' | 'spento' | 'assente';

export function checkCircle(b: Blocco, now: number): Cerchio {
  if (b.stato === 'completato') return 'fatto';
  if (canCheckFromCalendar(b, now)) return 'attivo';
  return STATI_TERMINALI.has(b.stato) ? 'assente' : 'spento';
}

/** Il passo della spunta diretta: revisione delle fasi, voci rimaste, esito dello studio o completamento immediato. */
export type PassoSpunta = 'revisione' | 'residuo' | 'esito' | 'completa';

/**
 * Cosa fa una spunta diretta consentita (§3–§5, §11): lo studio apre «Registra esito»; con le fasi nella definizione si
 * apre la revisione e si scrive solo al Conferma; con voci non spuntate si sceglie se creare il todo con le voci
 * rimaste (§4, D-DETT-2); altrimenti si completa subito (la lista vuota non è «tutto fatto», ma non ha voci da lasciare
 * indietro).
 */
export function directCheckStep(b: Pick<Blocco, 'tipo' | 'checklist'>, conFasi: boolean): PassoSpunta {
  if (b.tipo === 'studio') return 'esito';
  if (conFasi) return 'revisione';
  return b.checklist?.some((v) => !v.fatta) ? 'residuo' : 'completa';
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
