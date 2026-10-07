/**
 * Il contenuto del widget della schermata Home (MECCANISMI §21; T-023; D-DESIGN-1 n. 17): il mini mese col pallino nel
 * colore del tipo prevalente del giorno (a parità studio, routine, todo, evento: `heaviestType`), oggi in evidenza e i
 * weekend attenuati; l'agenda di oggi nell'ordine della giornata (`sortDay`) coi completati barrati; «Prossima»: il
 * blocco di §14 (`selectNowBlock`), altrimenti il primo futuro con orario. Niente sessione, todo ad alta priorità né
 * carte (D-DESIGN-1 n. 17). I testi (mese, giorni, «Prossima») li scrive la UI: qui solo i dati.
 */
import { monthGrid } from './calendar';
import { effectiveEnd } from './lost';
import { selectNowBlock } from './nowBlock';
import { sortDay } from './ordering';
import { heaviestType, isDone } from './progress';
import type { InizioSettimana } from './settings';
import { localDayKey, localInstant, localTimeKey, localWeekday } from './time';
import { STATI_TERMINALI, type Blocco, type TipoBlocco } from './types';

export interface RigaWidget {
  id: string;
  titolo: string;
  tipo: TipoBlocco;
  /** «HH:MM» per un blocco con orario, `null` senza. */
  ora: string | null;
}

export interface ContenutoWidget {
  /** «AAAA-MM» del mese mostrato. */
  mese: string;
  giorni: { giorno: string; delMese: boolean; oggi: boolean; weekend: boolean; tipo: TipoBlocco | null }[];
  agenda: (RigaWidget & { fatto: boolean })[];
  /** Con la fine effettiva (§8): il widget la nasconde quando scade mentre l'app è chiusa. */
  prossima: (RigaWidget & { fine: number }) | null;
}

const riga = (b: Blocco & { id: string }): RigaWidget => ({
  id: b.id,
  titolo: b.titolo ?? '',
  tipo: b.tipo,
  ora: b.conOrario ? localTimeKey(b.inizio) : null,
});

export function widgetContent(
  blocchi: readonly (Blocco & { id: string })[],
  now: number,
  inizioSettimana: InizioSettimana = 1,
): ContenutoWidget {
  const oggi = localDayKey(now);
  const perGiorno = new Map<string, (Blocco & { id: string })[]>();
  for (const b of blocchi) {
    const k = localDayKey(b.inizio);
    perGiorno.set(k, [...(perGiorno.get(k) ?? []), b]);
  }
  const prossima =
    selectNowBlock(blocchi, now)?.blocco ??
    blocchi
      .filter((b) => b.conOrario && b.inizio > now && !STATI_TERMINALI.has(b.stato))
      .sort((a, b) => a.inizio - b.inizio)[0];
  return {
    mese: oggi.slice(0, 7),
    giorni: monthGrid(oggi, inizioSettimana).map(({ giorno, delMese }) => {
      const giornoSettimana = localWeekday(localInstant(giorno, '12:00'));
      return {
        giorno,
        delMese,
        oggi: giorno === oggi,
        weekend: giornoSettimana === 0 || giornoSettimana === 6,
        tipo: heaviestType(perGiorno.get(giorno) ?? []),
      };
    }),
    agenda: sortDay(perGiorno.get(oggi) ?? []).map((b) => ({ ...riga(b), fatto: isDone(b) })),
    prossima: prossima ? { ...riga(prossima), fine: effectiveEnd(prossima) } : null,
  };
}
