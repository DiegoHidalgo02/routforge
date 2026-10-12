/**
 * Passi «reset orfani» e «marcatura persi» del ciclo dello scheduler.
 * Fonte: MECCANISMI §8 (orfani `in corso`; marcatura `perso` con l'istante; notifica «blocco perso» per routine e
 * studio con la fine nelle ultime 2 ore, una volta per blocco), §6 (il todo «non fatto» e il suo avviso «in ritardo»,
 * una volta per todo), §9 (gli orfani tornano `programmati` prima del giudizio). Decisioni: D-HOR-1 (`ritardoIl`),
 * D-SCHED-1. Scenari: A1, B7, C8, E2.
 *
 * Schema «differenza da applicare» (docs/02_ARCHITETTURA.md §4): il servizio (`src/app/scheduler.ts`) legge i blocchi,
 * questi piani restituiscono i blocchi da riscrivere e gli id da avvisare; gli avvisi li spedisce T-020. La regola di
 * ogni giudizio sta in `lost.ts` (`isOrphan`, `shouldMarkLost`, `lostNotificationDue`) e in `horizon.ts`
 * (`lateNoticeDue`): qui si compongono soltanto.
 */
import { createdAfterEnd, isOrphan, lostNotificationDue, shouldMarkLost } from '../lost';
import type { InizioSettimana } from '../settings';
import type { Blocco } from '../types';
import { lateNoticeDue } from './horizon';

/**
 * Gli orfani `in corso` riportati a `programmato` (§8): la marcatura dei persi li giudica subito dopo (§9). `altrove`:
 * per id, il gesto con cui un blocco arrivato `in_corso` è stato avviato su un altro dispositivo (audit P3-4).
 */
export function orphanPlan<B extends Blocco & { gestoIl?: number }>(
  blocchi: readonly B[],
  bloccoSessioneAttiva: string | null,
  now: number,
  altrove: Readonly<Record<string, number>> = {},
): B[] {
  return blocchi
    .filter((b) => isOrphan(b, bloccoSessioneAttiva, now, altrove[b.id]))
    .map((b) => ({ ...b, stato: 'programmato' }));
}

export interface PianoPersi<B extends Blocco> {
  /** I blocchi da riscrivere `persi` con l'istante della marcatura e, per il todo mai avvisato, `ritardoIl` (D-HOR-1). */
  persi: B[];
  /** Todo il cui avviso «in ritardo» parte adesso (§6, §13.6). */
  avvisiRitardo: string[];
  /** Routine e studio persi adesso con la fine nelle ultime 2 ore: avviso «blocco perso» (§8, §13.6). */
  avvisiPerso: string[];
}

/**
 * La marcatura dei persi (§8; §6 per i todo): i blocchi da giudicare adesso diventano `perso` con `persoIl`. Il todo
 * «non fatto» mai avvisato riceve `ritardoIl` e il suo avviso; routine e studio con la fine nelle ultime 2 ore ricevono
 * l'avviso «blocco perso». Un blocco già marcato non è più `programmato`: un secondo piano non lo tocca (INV-15).
 */
export function lostPlan<B extends Blocco & { giornoLocale?: string }>(
  blocchi: readonly B[],
  now: number,
  inizioSettimana: InizioSettimana = 1,
): PianoPersi<B> {
  const piano: PianoPersi<B> = { persi: [], avvisiRitardo: [], avvisiPerso: [] };
  for (const b of blocchi) {
    if (!shouldMarkLost(b, now, inizioSettimana)) continue;
    // Un todo scritto per un orario già passato non riceve l'avviso «in ritardo» appena scritto (audit P3-5)
    const ritardo = lateNoticeDue(b) && !createdAfterEnd(b);
    piano.persi.push({ ...b, stato: 'perso', persoIl: now, ...(ritardo && { ritardoIl: now }) });
    if (ritardo) piano.avvisiRitardo.push(b.id);
    if (lostNotificationDue(b, now)) piano.avvisiPerso.push(b.id);
  }
  return piano;
}
