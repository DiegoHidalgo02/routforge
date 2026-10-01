/**
 * Registrazione dell'esito di studio: unità, blocco, blocco retroattivo, minuti.
 * Fonte: RoutForge_MECCANISMI.md §11 (Registrazione, tabella, «Sempre», blocco senza unità), §8 (esiti pendenti)
 * — criteri: SCENARI C2, C3, C6, C7, C9. Decisione: D-ESITO-1.
 *
 * - «Conta nel piano»: default sì da un blocco; per una libera, sì se è stata scelta un'unità. Una libera che conta
 *   crea un blocco di studio retroattivo con inizio e fine della sessione.
 * - Unità: l'esito va sull'unità pianificata (`applyOutcome`); Indietro fa tornare da rivedere l'unità precedente nel
 *   percorso del corso, o la pianificata se è la prima; le altre unità toccate ricevono solo minuti; la confidenza va
 *   sulla pianificata, se scelta.
 * - Blocco: stato della tabella, marcatura persa azzerata, istante, confidenza, nota e minuti; un blocco senza unità
 *   riceve quella scelta nel setup (C9).
 * - Senza sessione («Registra esito»): minuti = durata pianificata, 0 con Salta o senza durata.
 * Streak (§12) in `streak.ts`, puntatore (§11) in `pointer.ts`: li applica il servizio.
 */
import { effectiveEnd } from './lost';
import { applyOutcome, previousUnitInPath, STATO_ESITO, type UnitaPercorso } from './pointer';
import { MINUTE } from './time';
import { STATI_UNITA_PENDENTI, type Blocco, type Esito, type StatoUnita } from './types';

/** Ciò che l'utente sceglie nello sheet dell'esito (FUNZ §11.3, S16). */
export interface DatiEsito {
  esito: Esito;
  /** 1–5; `null` se non scelta. */
  confidenza: number | null;
  nota: string;
  contaNelPiano: boolean;
}

/** Un'unità come la scrive l'esito: il percorso più corso e confidenza. */
export type UnitaEsito = UnitaPercorso & { corsoId: string; confidenza: number | null };

/** Default di «conta nel piano» (§11). */
export const countsByDefault = (s: { bloccoId: string | null; unitaId: string | null }): boolean =>
  s.bloccoId !== null || s.unitaId !== null;

/** «Registra esito» senza sessione: minuti = durata pianificata; 0 con Salta o senza durata (§11). */
export function plannedMinutes(b: Pick<Blocco, 'inizio' | 'fine'>, esito: Esito): number {
  return esito === 'salta' || b.fine === null ? 0 : Math.round((b.fine - b.inizio) / MINUTE);
}

/**
 * «Registra esito» senza sessione (§8 esiti pendenti): blocco di studio perso, o programmato con la fine passata. Un
 * blocco in corso ha la sua sessione, che registra l'esito alla chiusura.
 */
export const canRegisterOutcome = (b: Blocco, now: number): boolean =>
  b.tipo === 'studio' && (b.stato === 'perso' || (b.stato === 'programmato' && now >= effectiveEnd(b)));

/** Minuti della sessione chiusa dal riepilogo (ms): focus e ripartizione per unità, arrotondati al minuto. */
export function sessionMinutes(r: { focus: number; perUnita: Readonly<Record<string, number>> }): {
  minuti: number;
  perUnita: Record<string, number>;
} {
  const perUnita = Object.fromEntries(Object.entries(r.perUnita).map(([id, ms]) => [id, Math.round(ms / MINUTE)]));
  return { minuti: Math.round(r.focus / MINUTE), perUnita };
}

/**
 * Le unità che l'esito cambia (§11), fra `unita` (quelle del corso della pianificata e le altre toccate): la pianificata
 * secondo la tabella con i suoi minuti e la confidenza, per Indietro l'unità precedente nel percorso, le altre toccate
 * solo con i minuti. Senza unità pianificata cambiano solo i minuti delle toccate.
 */
export function outcomeUnits<U extends UnitaEsito>(
  unita: readonly U[],
  pianificataId: string | null,
  dati: DatiEsito,
  minutiPerUnita: Readonly<Record<string, number>>,
): U[] {
  const cambiate = new Map<string, U>();
  for (const u of unita) {
    const m = minutiPerUnita[u.id] ?? 0;
    if (u.id !== pianificataId && m > 0) cambiate.set(u.id, { ...u, minuti: u.minuti + m });
  }
  const p = unita.find((u) => u.id === pianificataId);
  if (!p) return [...cambiate.values()];
  const percorso = unita.filter((u) => u.corsoId === p.corsoId);
  // Una saltata è fuori dal percorso: Indietro non la rimette in gioco (D-ESITO-1)
  const candidate = percorso.filter((u) => u.id === p.id || u.stato !== 'saltata');
  const precedente = dati.esito === 'indietro' ? (previousUnitInPath(candidate, p.id)?.id ?? null) : null;
  const r = applyOutcome({
    unita: percorso,
    unitaPianificataId: p.id,
    esito: dati.esito,
    minuti: minutiPerUnita[p.id] ?? 0,
    unitaPrecedenteId: precedente,
  });
  for (const u of r.unita)
    if (u.id === p.id) cambiate.set(u.id, { ...u, confidenza: dati.confidenza ?? p.confidenza });
    else if (u.id === precedente) cambiate.set(u.id, { ...(cambiate.get(u.id) ?? u), stato: u.stato });
  return [...cambiate.values()];
}

/**
 * Il blocco dopo l'esito (§11). Un blocco senza unità riceve quella scelta nel setup e il suo corso (C9); un parziale
 * ripreso somma i minuti della nuova sessione a quelli del primo esito (D-ESITO-1).
 */
export function outcomeBlock<B extends Omit<Blocco, 'id'>>(
  b: B,
  dati: DatiEsito,
  minuti: number,
  now: number,
  unita: { id: string; corsoId: string } | null = null,
): B {
  return {
    ...b,
    stato: STATO_ESITO[dati.esito],
    persoIl: null,
    chiusoIl: now,
    confidenza: dati.confidenza,
    notaEsito: dati.nota.trim() || null,
    minuti: b.stato === 'parziale' ? (b.minuti ?? 0) + minuti : minuti,
    unitaId: b.unitaId ?? unita?.id ?? null,
    corsoId: b.corsoId ?? (b.unitaId ? null : (unita?.corsoId ?? null)),
  };
}

/** Blocco di studio retroattivo di una sessione libera che conta (§11, C7): inizio e fine della sessione. */
export const retroactiveBlock = (
  inizio: number,
  fine: number,
  unitaId: string | null,
  corsoId: string | null,
): Omit<Blocco, 'id'> => ({ tipo: 'studio', stato: 'programmato', inizio, fine, conOrario: true, unitaId, corsoId });

/**
 * Le unità che lo sheet nomina accanto agli esiti (S16), dal percorso del corso in ordine: dopo Completata la prima
 * pendente diversa dalla pianificata, per Indietro la precedente non saltata. Solo testo: ignora i moduli bloccati, il
 * puntatore vero lo ricalcola il servizio con i moduli (D-PTR-1, D-ESITO-1).
 */
export function outcomeHints(
  percorso: readonly { id: string; stato: StatoUnita }[],
  pianificataId: string,
): { successiva: string | null; precedente: string | null } {
  const candidate = percorso.filter((u) => u.id === pianificataId || u.stato !== 'saltata');
  const i = candidate.findIndex((u) => u.id === pianificataId);
  return {
    successiva: percorso.find((u) => u.id !== pianificataId && STATI_UNITA_PENDENTI.has(u.stato))?.id ?? null,
    precedente: i > 0 ? (candidate[i - 1]?.id ?? null) : null,
  };
}
