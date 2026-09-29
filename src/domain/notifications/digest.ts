/**
 * Digest mattutino (MECCANISMI §13.5; FUNZ §7.3): alla prossima occorrenza dell'orario (default 08:00) i todo senza
 * orario di quel giorno più gli arretrati che vi si sposteranno (§6); corpo con il conteggio, gli arretrati e fino a
 * 3 titoli; vuoto → nessun digest. La voce dell'insieme desiderato la costruisce `desiredSet.ts`, che ricalcola il
 * contenuto a ogni riconciliazione. Criteri: SCENARI A4. Decisione: D-NOTIF-2 (arretrato = todo di un giorno passato
 * che rotolerà, o già rotolato, riconoscibile da `ritardoIl`; titoli nell'ordine della fascia senza orario, §6).
 */
import { isRollingTodo } from '../lost';
import { sortDay } from '../ordering';
import { addLocalDays, localDayKey, localInstant } from '../time';
import type { Blocco } from '../types';
import { quietShift, type OreSilenziose } from './quietHours';

export interface ImpostazioniDigest {
  /** Ora di parete "HH:MM" del digest (§13.5: default 08:00). */
  orario: string;
}

/** Il contenuto semantico del digest; i testi li produce la UI (D-NOTIF-1 n. 8). */
export interface DigestNotifica {
  totale: number;
  arretrati: number;
  titoli: string[];
}

/** §13.5: «fino a 3 titoli». */
export const TITOLI_DIGEST = 3;

/**
 * La prossima occorrenza dell'orario del digest (nominale, prima delle ore silenziose): oggi se il suo scatto, spostato
 * dalla fascia silenziosa se ci cade dentro (§13.4), non è ancora passato; altrimenti domani. Così una riconciliazione
 * fra l'orario nominale e la fine della fascia non cambia giorno al digest, che resterebbe cancellato.
 */
export function nextDigestInstant(now: number, orario: string, ore?: OreSilenziose): number {
  const oggi = localInstant(localDayKey(now), orario);
  const scatto = ore ? quietShift(oggi, ore) : oggi;
  return scatto >= now ? oggi : localInstant(localDayKey(addLocalDays(now, 1)), orario);
}

/**
 * I todo senza orario `programmati` del giorno del digest, più quelli di giorni passati che rotoleranno a quel giorno
 * (§6, `isRollingTodo`); arretrato = rotolerà, o è già rotolato (`ritardoIl`, D-HOR-1). `null` se non c'è nulla.
 */
export function digestContent(
  blocchi: readonly (Blocco & { giornoLocale?: string })[],
  istante: number,
): DigestNotifica | null {
  const giorno = localDayKey(istante);
  const inclusi: { blocco: Blocco; arretrato: boolean }[] = [];
  for (const b of blocchi) {
    if (b.tipo !== 'todo' || b.conOrario || b.stato !== 'programmato') continue;
    const suo = b.giornoLocale ?? localDayKey(b.inizio);
    if (suo === giorno) inclusi.push({ blocco: b, arretrato: b.ritardoIl != null });
    else if (suo < giorno && isRollingTodo(b, istante)) inclusi.push({ blocco: b, arretrato: true });
  }
  if (inclusi.length === 0) return null;
  return {
    totale: inclusi.length,
    arretrati: inclusi.filter((x) => x.arretrato).length,
    titoli: sortDay(inclusi.map((x) => x.blocco))
      .slice(0, TITOLI_DIGEST)
      .map((b) => b.titolo ?? ''),
  };
}
