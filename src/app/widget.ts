/**
 * Il widget segue i blocchi (MECC §21; T-023): il contenuto si ricalcola a ogni cambiamento dei blocchi del mese, a ogni
 * minuto (la «Prossima», il cambio di giorno, l'inizio settimana) e al ritorno in primo piano, e arriva alla porta solo
 * se è cambiato. Le impostazioni si leggono fuori dalla query live, che altrimenti smetterebbe di seguire le letture
 * successive. Restituisce lo stop.
 */
import type { RoutForgeDb } from '../data/db';
import { blocksBetween, watch } from '../data/repository';
import { monthGrid } from '../domain/calendar';
import { MINUTE, localDayKey } from '../domain/time';
import { widgetContent } from '../domain/widget';
import { logError } from './diagnostics';
import type { Clock } from './ports/clock';
import type { Widget } from './ports/widget';
import { readSettings } from './settings';

/** Primo e ultimo giorno della griglia del mese di oggi, con la settimana dal lunedì o dalla domenica. */
function intervallo(now: number): [string, string] {
  const giorni = [0, 1].flatMap((inizio) => monthGrid(localDayKey(now), inizio as 0 | 1).map((g) => g.giorno)).sort();
  return [giorni[0]!, giorni[giorni.length - 1]!];
}

export function followWidget(db: RoutForgeDb, clock: Clock, porta: Widget): () => void {
  let ultimo = '';
  const ricalcola = () =>
    void (async () => {
      const now = clock.now();
      const { inizioSettimana } = await readSettings(db);
      const c = widgetContent(await blocksBetween(db, ...intervallo(now)), now, inizioSettimana);
      const testo = JSON.stringify(c);
      if (testo === ultimo) return;
      // Ricordato solo se arrivato: un rifiuto del plugin si riprova al ricalcolo successivo (revisione di T-023)
      await porta.aggiorna(c);
      ultimo = testo;
    })().catch((e: unknown) => logError('dispositivo', e));
  const stop = [
    watch(
      () => blocksBetween(db, ...intervallo(clock.now())),
      ricalcola,
      (e) => logError('dispositivo', e),
    ),
    clock.every(MINUTE, ricalcola),
    clock.onForeground(ricalcola),
  ];
  return () => stop.forEach((smetti) => smetti());
}
