/**
 * Statistiche: definizioni. Fonte: MECCANISMI §20 (Panoramica, Comportamenti, Studio), §12 (costanza) — criteri: SCENARI
 * B4 (mappa di calore a 0 per i blocchi senza durata; routine senza durata), B5 (la fase con l'etichetta attuale del
 * template), B7 (risposto al trigger), D5 (uscite d'emergenza). Decisione: D-STATS-1.
 *
 * Funzioni pure sui dati che il servizio legge: blocchi, sessioni chiuse, log e template delle fasi. Periodo 7 · 30 · 90
 * giorni o «tutto»: i blocchi del periodo hanno l'inizio nel periodo, le sessioni l'avvio. «Completati» = stato
 * `completato` (disciplina, tasso dei persi); «completati/parziali» = `completato` o `parziale` (giorni con attività,
 * mappa, fasce, costanza per giorno). La durata media di una sessione è il suo focus; le settimane iniziano il lunedì, o
 * la domenica se così dicono le Impostazioni (FUNZ §23, `inizioSettimana`).
 */
import { recoveryDeadline } from './lost';
import type { DatiEsito } from './outcome';
import { weekOffset, type InizioSettimana } from './settings';
import { studyDays } from './streak';
import { addLocalDays, localDayKey, localInstant, localTimeKey, localWeekday, MINUTE, startOfLocalDay } from './time';
import { plannedMs, type SessioneChiusa } from './timer';
import type { Blocco, FaseLog, FaseTemplate, Ricorrenza, TipoBlocco } from './types';

export type Periodo = 7 | 30 | 90 | 'tutto';
/** Intervallo [da, a) in epoch ms. */
export interface Intervallo {
  da: number;
  a: number;
}

/** Il periodo che finisce oggi: gli ultimi N giorni locali con oggi; «tutto» dall'inizio. */
export function periodRange(periodo: Periodo, now: number): Intervallo {
  const a = startOfLocalDay(addLocalDays(now, 1));
  return { da: periodo === 'tutto' ? 0 : startOfLocalDay(addLocalDays(now, -(periodo - 1))), a };
}

/** Il periodo precedente di pari durata, per il delta (§20); `null` per «tutto». */
export const previousRange = (periodo: Periodo, now: number): Intervallo | null =>
  periodo === 'tutto'
    ? null
    : {
        da: startOfLocalDay(addLocalDays(now, -(2 * periodo - 1))),
        a: startOfLocalDay(addLocalDays(now, -(periodo - 1))),
      };

const dentro = (t: number, r: Intervallo) => t >= r.da && t < r.a;
/** «Completati» di §20. */
const completato = (b: Pick<Blocco, 'stato'>) => b.stato === 'completato';
/** «Completati/parziali» di §20. */
const fatto = (b: Pick<Blocco, 'stato'>) => b.stato === 'completato' || b.stato === 'parziale';
const somma = <T>(xs: readonly T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0);

/** La parte di una sessione chiusa che serve alle statistiche; `esito` nelle righe salvate dopo T-018. */
export type SessioneStatistica = Pick<
  SessioneChiusa,
  'bloccoId' | 'avvio' | 'fine' | 'durata' | 'modalita' | 'iperfocus' | 'chiusura' | 'riepilogo'
> & { esito?: DatiEsito | null };

/** Niente da mostrare (S20 vuoto): nessuna sessione e nessun blocco giudicato, in tutto. */
export const statsEmpty = (sessioni: readonly unknown[], blocchi: readonly Pick<Blocco, 'stato'>[]): boolean =>
  sessioni.length === 0 && !blocchi.some((b) => completato(b) || b.stato === 'perso' || b.stato === 'saltato');

/**
 * Focus del periodo in minuti (§20): il focus delle sessioni con l'avvio nel periodo; senza alcuna sessione salvata, i
 * minuti accreditati ai blocchi di studio del periodo (ripiego).
 */
export function focusMinutes(
  sessioni: readonly SessioneStatistica[],
  blocchi: readonly Pick<Blocco, 'tipo' | 'inizio' | 'minuti'>[],
  r: Intervallo,
): number {
  if (sessioni.length === 0)
    return somma(
      blocchi.filter((b) => b.tipo === 'studio' && dentro(b.inizio, r)),
      (b) => b.minuti ?? 0,
    );
  return Math.round(
    somma(
      sessioni.filter((s) => dentro(s.avvio, r)),
      (s) => s.riepilogo.focus,
    ) / MINUTE,
  );
}

/** Il primo giorno della settimana dell'istante, a mezzanotte locale. */
const primoGiorno = (t: number, inizio: InizioSettimana) =>
  startOfLocalDay(addLocalDays(t, -weekOffset(localWeekday(t), inizio)));

/**
 * Le barre per settimana di §20, dalla settimana più vecchia del periodo (con «tutto», da quella del primo dato): inizio
 * della settimana e somma dei valori `[istante, valore]` che vi cadono.
 */
function perWeek(
  voci: readonly (readonly [number, number])[],
  r: Intervallo,
  inizio: InizioSettimana,
): { settimana: number; valore: number }[] {
  const nel = voci.filter(([t]) => dentro(t, r));
  const prima = r.da > 0 ? r.da : Math.min(r.a - 1, ...nel.map(([t]) => t));
  const barre: { settimana: number; valore: number }[] = [];
  for (let w = primoGiorno(prima, inizio); w < r.a; w = startOfLocalDay(addLocalDays(w, 7))) {
    const fine = startOfLocalDay(addLocalDays(w, 7));
    barre.push({
      settimana: w,
      valore: somma(
        nel.filter(([t]) => t >= w && t < fine),
        ([, v]) => v,
      ),
    });
  }
  return barre;
}

/** Le settimane delle barre (S20, vince il design: D-STATS-1): le ultime 12, fino a quella corrente, qualunque sia il periodo. */
export const SETTIMANE_BARRE = 12;
export function barWeeks(now: number, inizio: InizioSettimana = 1): Intervallo {
  const corrente = primoGiorno(now, inizio);
  return {
    da: startOfLocalDay(addLocalDays(corrente, -7 * (SETTIMANE_BARRE - 1))),
    a: startOfLocalDay(addLocalDays(corrente, 7)),
  };
}

/** Sessioni concluse per settimana sulle barre e la loro media (S20 «Sessioni a settimana · media»). */
export function weeklySessions(
  sessioni: readonly Pick<SessioneStatistica, 'avvio'>[],
  barre: Intervallo,
  inizio: InizioSettimana = 1,
): { settimane: { settimana: number; numero: number }[]; media: number } {
  const settimane = perWeek(
    sessioni.map((s) => [s.avvio, 1]),
    barre,
    inizio,
  ).map((b) => ({ settimana: b.settimana, numero: b.valore }));
  return { settimane, media: settimane.length ? somma(settimane, (w) => w.numero) / settimane.length : 0 };
}

/** Blocchi persi per settimana sul giorno previsto (§20, «andamento»), sulle barre. */
export const weeklyLost = (
  blocchi: readonly Pick<Blocco, 'stato' | 'inizio'>[],
  barre: Intervallo,
  inizio: InizioSettimana = 1,
): { settimana: number; numero: number }[] =>
  perWeek(
    blocchi.filter((b) => b.stato === 'perso').map((b) => [b.inizio, 1]),
    barre,
    inizio,
  ).map((b) => ({ settimana: b.settimana, numero: b.valore }));

/** Le barre del focus per settimana (§20), in minuti, con lo stesso ripiego del totale (`focusMinutes`). */
export function weeklyFocus(
  sessioni: readonly SessioneStatistica[],
  blocchi: readonly Pick<Blocco, 'tipo' | 'inizio' | 'minuti'>[],
  r: Intervallo,
  inizio: InizioSettimana = 1,
): { settimana: number; minuti: number }[] {
  const voci: (readonly [number, number])[] = sessioni.length
    ? sessioni.map((s) => [s.avvio, s.riepilogo.focus / MINUTE])
    : blocchi.filter((b) => b.tipo === 'studio').map((b) => [b.inizio, b.minuti ?? 0]);
  return perWeek(voci, r, inizio).map((b) => ({ settimana: b.settimana, minuti: Math.round(b.valore) }));
}

/** Sessioni concluse del periodo e focus medio in minuti (§20). */
export function sessionCount(
  sessioni: readonly SessioneStatistica[],
  r: Intervallo,
): { numero: number; media: number } {
  const nel = sessioni.filter((s) => dentro(s.avvio, r));
  const tot = somma(nel, (s) => s.riepilogo.focus);
  return { numero: nel.length, media: nel.length ? Math.round(tot / nel.length / MINUTE) : 0 };
}

/**
 * Disciplina (§20): completati / (completati + persi + saltati) sui blocchi del periodo, globale e per tipo; `null` se
 * non c'è niente da giudicare.
 */
export function discipline(
  blocchi: readonly Pick<Blocco, 'tipo' | 'stato' | 'inizio'>[],
  r: Intervallo,
): { globale: number | null; perTipo: Record<TipoBlocco, number | null> } {
  const quota = (xs: readonly Pick<Blocco, 'stato'>[]) => {
    const fatti = xs.filter(completato).length;
    const giudicati = fatti + xs.filter((b) => b.stato === 'perso' || b.stato === 'saltato').length;
    return giudicati ? fatti / giudicati : null;
  };
  const nel = blocchi.filter((b) => dentro(b.inizio, r));
  const tipo = (t: TipoBlocco) => quota(nel.filter((b) => b.tipo === t));
  return {
    globale: quota(nel),
    perTipo: { todo: tipo('todo'), evento: tipo('evento'), routine: tipo('routine'), studio: tipo('studio') },
  };
}

/** Giorni della mappa di calore (§20): gli ultimi 84, oggi compreso. */
export const GIORNI_MAPPA = 84;
/** Minimo della scala della mappa: un giorno con meno di 60' non sembra pieno (§20). */
export const MINIMO_SCALA = 60;

/**
 * Giorni con attività e mappa di calore (§20): sugli ultimi 84 giorni, oggi compreso anche per un blocco spuntato prima
 * del suo orario, i giorni con blocchi completati/parziali e i loro minuti; un blocco senza orario o senza durata vale 0
 * (B4). `livello` = minuti / max(massimo, 60), fra 0 e 1.
 */
/** I minuti di un blocco (B4): senza orario o senza durata 0; li contano mappa delle attività e Giornata chiusa (audit P3-13). */
export const blockMinutes = (b: Pick<Blocco, 'conOrario' | 'inizio' | 'fine'>): number =>
  b.conOrario && b.fine !== null ? Math.max(0, Math.round((b.fine - b.inizio) / MINUTE)) : 0;

export function activityMap(
  blocchi: readonly Pick<Blocco, 'stato' | 'inizio' | 'fine' | 'conOrario'>[],
  now: number,
): { giorni: number; mappa: { giorno: string; minuti: number; livello: number }[] } {
  const minuti = new Map<string, number>();
  const r = { da: startOfLocalDay(addLocalDays(now, -(GIORNI_MAPPA - 1))), a: startOfLocalDay(addLocalDays(now, 1)) };
  for (const b of blocchi) {
    if (!fatto(b) || !dentro(b.inizio, r)) continue;
    const g = localDayKey(b.inizio);
    minuti.set(g, (minuti.get(g) ?? 0) + blockMinutes(b));
  }
  const scala = Math.max(MINIMO_SCALA, ...minuti.values());
  const mappa = Array.from({ length: GIORNI_MAPPA }, (_, i) => {
    const giorno = localDayKey(addLocalDays(r.da, i));
    const m = minuti.get(giorno) ?? 0;
    return { giorno, minuti: m, livello: m / scala };
  });
  return { giorni: minuti.size, mappa };
}

/**
 * Il record della costanza (§12, §20): la serie più lunga di giorni consecutivi con un esito Completata o Continua
 * (blocco di studio completato o parziale) nel giorno dell'esito, mai sotto la streak attuale.
 */
export function longestStreak(
  blocchi: readonly Pick<Blocco, 'tipo' | 'stato' | 'inizio' | 'chiusoIl'>[],
  attuale: number,
): number {
  const giorni = studyDays(blocchi);
  let migliore = attuale;
  let serie = 0;
  let ieri: string | null = null;
  for (const g of giorni) {
    const prima = localDayKey(addLocalDays(localInstant(g, '12:00'), -1));
    serie = ieri !== null && prima === ieri ? serie + 1 : 1;
    migliore = Math.max(migliore, serie);
    ieri = g;
  }
  return migliore;
}

/** Soglia della puntualità di §20: avviato «in orario» con al più 5' di ritardo. */
export const SOGLIA_PUNTUALITA = 5;
/** Quota dei persi nello stesso momento da cui la frase dice «Quasi tutti» invece di «Più spesso» (D-STATS-1). */
export const SOGLIA_QUASI_TUTTI = 0.75;

/**
 * Studio (§20; SCENARI D5), in minuti: esiti dei blocchi di studio del periodo (Completata, Continua, Indietro, Salta
 * più persi) e delle sessioni libere che hanno un esito; iperfocus (sessioni su totali, minuti, uscite d'emergenza =
 * interruzioni «iperfocus», abbandoni, tempo extra in iperfocus); tempo extra; focus e piano delle sessioni con una
 * durata pianificata (efficienza); pause, interruzioni, pomodoro e segmenti; sessioni per settimana e la loro media;
 * minuti per unità con l'ultima sessione; puntualità dei blocchi avviati, recuperi dopo la fine compresi (SCENARI C5:
 * «in ritardo > 5'»; D-STATS-1 n. 10, audit P1-10): scarto medio (anticipo negativo), quota entro 5', ritardi oltre 5',
 * anticipi e anticipo medio.
 */
export function studyStats(
  blocchi: readonly Pick<Blocco, 'tipo' | 'stato' | 'inizio' | 'fine' | 'minutiRitardo' | 'minutiAnticipo'>[],
  sessioni: readonly SessioneStatistica[],
  r: Intervallo,
) {
  const studi = blocchi.filter((b) => b.tipo === 'studio' && dentro(b.inizio, r));
  const nel = sessioni.filter((s) => dentro(s.avvio, r));
  const libere = nel.filter((s) => s.bloccoId === null && s.esito);
  const conta = (stati: Blocco['stato'][], esiti: DatiEsito['esito'][]) =>
    studi.filter((b) => stati.includes(b.stato)).length +
    libere.filter((s) => s.esito && esiti.includes(s.esito.esito)).length;
  const iper = nel.filter((s) => s.iperfocus);
  const min = (xs: readonly SessioneStatistica[], f: (s: SessioneStatistica) => number) =>
    Math.round(somma(xs, f) / MINUTE);
  const conPiano = nel.filter((s) => plannedMs(s) !== null);
  const pomodoro = nel.filter((s) => s.modalita !== 'continua');
  const unita = new Map<string, { unitaId: string; minuti: number; ultima: number; sessioni: number }>();
  for (const s of nel)
    for (const [unitaId, ms] of Object.entries(s.riepilogo.perUnita)) {
      const u = unita.get(unitaId) ?? { unitaId, minuti: 0, ultima: s.avvio, sessioni: 0 };
      unita.set(unitaId, {
        unitaId,
        minuti: u.minuti + ms / MINUTE,
        ultima: Math.max(u.ultima, s.avvio),
        sessioni: u.sessioni + 1,
      });
    }
  const scarti = studi
    .filter((b) => b.minutiRitardo != null)
    .map((b) => ((b.minutiAnticipo ?? 0) > 0 ? -(b.minutiAnticipo ?? 0) : (b.minutiRitardo ?? 0)));
  const anticipi = scarti.filter((x) => x < 0);
  const media = (xs: readonly number[]) => (xs.length ? Math.round(somma(xs, (x) => x) / xs.length) : null);
  return {
    esiti: {
      completata: conta(['completato'], ['completata']),
      continua: conta(['parziale'], ['continua']),
      indietro: conta(['indietro'], ['indietro']),
      saltaPersa: conta(['saltato', 'perso'], ['salta']),
    },
    iperfocus: {
      sessioni: iper.length,
      totali: nel.length,
      minuti: min(iper, (s) => s.riepilogo.focus),
      uscite: somma(iper, (s) => s.riepilogo.usciteEmergenza),
      abbandoni: iper.filter((s) => s.chiusura === 'abbandonata').length,
      extra: min(iper, (s) => s.riepilogo.extra),
    },
    extra: min(nel, (s) => s.riepilogo.extra),
    pianificato: { focus: min(conPiano, (s) => s.riepilogo.focus), piano: min(conPiano, (s) => plannedMs(s) ?? 0) },
    pause: { numero: somma(nel, (s) => s.riepilogo.numeroPause), minuti: min(nel, (s) => s.riepilogo.durataPause) },
    interruzioni: somma(nel, (s) => s.riepilogo.interruzioni),
    pomodoro: { sessioni: pomodoro.length, segmenti: somma(pomodoro, (s) => s.riepilogo.segmentiCompletati) },
    unita: [...unita.values()].map((u) => ({ ...u, minuti: Math.round(u.minuti) })).sort((a, b) => b.ultima - a.ultima),
    puntualita: {
      scarto: media(scarti),
      entro: scarti.length ? scarti.filter((x) => x <= SOGLIA_PUNTUALITA).length / scarti.length : null,
      ritardi: scarti.filter((x) => x > SOGLIA_PUNTUALITA).length,
      anticipi: anticipi.length,
      anticipoMedio: media(anticipi.map((x) => -x)),
    },
  };
}

/**
 * Trigger (§20; SCENARI B7): routine e studi con orario del periodo con la scadenza di recupero (la verifica,
 * `recoveryDeadline`: metà durata, o inizio + 30' senza durata) passata senza avvio né chiusura prima; «risposto» =
 * chiuso o avviato dopo la scadenza, col tocco sulla notifica della verifica (`toccoVerificaIl`, lo scrive l'adapter
 * nativo di T-021) o con l'esito Completata o Continua. `persi` = scattati e persi comunque;
 * `tasso` = risposti / scattati (S20 «recuperi dopo l'avviso»).
 */
export function triggerResponse(
  blocchi: readonly Pick<
    Blocco,
    'tipo' | 'stato' | 'inizio' | 'fine' | 'conOrario' | 'chiusoIl' | 'minutiRitardo' | 'toccoVerificaIl'
  >[],
  r: Intervallo,
  now: number,
): { scattati: number; risposti: number; persi: number; tasso: number | null } {
  const avvio = (b: Pick<Blocco, 'inizio' | 'minutiRitardo'>) =>
    b.minutiRitardo == null ? null : b.inizio + b.minutiRitardo * MINUTE;
  const scattati = blocchi.filter((b) => {
    if ((b.tipo !== 'routine' && b.tipo !== 'studio') || !b.conOrario || !dentro(b.inizio, r)) return false;
    const d = recoveryDeadline(b);
    const a = avvio(b);
    return d <= now && !(b.chiusoIl != null && b.chiusoIl < d) && !(a !== null && a < d);
  });
  const risposti = scattati.filter((b) => {
    const d = recoveryDeadline(b);
    const a = avvio(b);
    return (
      (b.chiusoIl != null && b.chiusoIl >= d) ||
      (a !== null && a >= d) ||
      (b.toccoVerificaIl != null && b.toccoVerificaIl >= d) ||
      fatto(b)
    );
  }).length;
  return {
    scattati: scattati.length,
    risposti,
    persi: scattati.filter((b) => b.stato === 'perso').length,
    tasso: scattati.length ? risposti / scattati.length : null,
  };
}

/** Fascia di §20 dell'ora locale: 0 = 06–12, 1 = 12–18, 2 = 18–24, 3 = 00–06. */
const fascia = (t: number) => {
  const h = new Date(t).getHours();
  return h < 6 ? 3 : h < 12 ? 0 : h < 18 ? 1 : 2;
};

/** Il log delle fasi di un'occorrenza (§5): `id` = id del blocco. */
export interface LogFasi {
  id: string;
  ricorrenzaId: string | null;
  fasi: readonly FaseLog[];
}

/**
 * Comportamenti (§20; SCENARI B4, B5), per il periodo:
 * - fasce 06–12 / 12–18 / 18–24 / 00–06 in minuti, dal focus delle sessioni, senza sessioni dalla durata dei blocchi
 *   completati/parziali (mai entrambe);
 * - costanza per giorno della settimana (0 = domenica, la card del design): quota delle settimane intere prima della
 *   corrente, 4 per 7 e 30 giorni, 12 per 90 e «tutto», in cui quel giorno ha un blocco completato/parziale (D-STATS-1);
 * - persi: numero e il momento (giorno della settimana e fascia insieme) più frequente con la sua quota, per la frase
 *   del design («Quasi tutti il venerdì dopo le 18»: vince il design sul tasso, il giorno e il tipo di §20, D-STATS-1);
 *   l'andamento per settimana è `weeklyLost`, sulle 12 settimane delle barre;
 * - fasi: per fase del template (della routine o dell'evento) con l'etichetta e il titolo attuali (B5), saltate su
 *   registrate; le tre più saltate;
 * - routine senza durata: per routine, completate su giudicate (B4), in ordine d'orario.
 */
export function behaviourStats(
  blocchi: readonly Pick<
    Blocco,
    'id' | 'tipo' | 'stato' | 'inizio' | 'fine' | 'conOrario' | 'ricorrenzaId' | 'titolo' | 'fasi'
  >[],
  sessioni: readonly SessioneStatistica[],
  logFasi: readonly LogFasi[],
  ricorrenze: readonly Pick<Ricorrenza, 'id' | 'titolo' | 'fasi'>[],
  periodo: Periodo,
  now: number,
  inizio: InizioSettimana = 1,
) {
  const r = periodRange(periodo, now);
  const nel = blocchi.filter((b) => dentro(b.inizio, r));
  const ses = sessioni.filter((s) => dentro(s.avvio, r));
  const voci: (readonly [number, number])[] = ses.length
    ? ses.map((s) => [s.avvio, s.riepilogo.focus / MINUTE])
    : nel
        .filter((b) => fatto(b) && b.conOrario && b.fine !== null)
        .map((b) => [b.inizio, ((b.fine ?? b.inizio) - b.inizio) / MINUTE]);
  const fasce = [0, 0, 0, 0];
  for (const [t, m] of voci) fasce[fascia(t)]! += m;

  const settimane = periodo === 'tutto' ? 12 : Math.min(12, Math.max(4, Math.floor(periodo / 7)));
  const attivi = new Set(blocchi.filter(fatto).map((b) => localDayKey(b.inizio)));
  const da = startOfLocalDay(addLocalDays(primoGiorno(now, inizio), -7 * settimane));
  const costanza = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 7 * settimane; i++) {
    const g = addLocalDays(da, i);
    if (attivi.has(localDayKey(g))) costanza[localWeekday(g)]! += 1;
  }

  const persi = nel.filter((b) => b.stato === 'perso');
  const momenti = new Map<string, { giorno: number; fascia: number; n: number }>();
  for (const b of persi) {
    const m = { giorno: localWeekday(b.inizio), fascia: fascia(b.inizio) };
    const k = `${m.giorno}|${m.fascia}`;
    momenti.set(k, { ...m, n: (momenti.get(k)?.n ?? 0) + 1 });
  }
  const momento = [...momenti.values()].sort((a, b) => b.n - a.n)[0];

  const blocco = new Map(nel.map((b) => [b.id, b]));
  const ricorrenza = new Map(ricorrenze.map((x) => [x.id, x]));
  const fasi = new Map<string, { etichetta: string; padre: string | null; saltate: number; totali: number }>();
  for (const log of logFasi) {
    const b = blocco.get(log.id);
    if (!b) continue;
    const ric = log.ricorrenzaId ? ricorrenza.get(log.ricorrenzaId) : undefined;
    const template: readonly FaseTemplate[] = (ric ? ric.fasi : b.fasi) ?? [];
    for (const f of log.fasi) {
      const k = `${log.ricorrenzaId ?? log.id}:${f.id}`;
      const c = fasi.get(k) ?? {
        etichetta: template.find((x) => x.id === f.id)?.etichetta ?? f.etichetta,
        padre: ric?.titolo ?? b.titolo ?? null,
        saltate: 0,
        totali: 0,
      };
      fasi.set(k, { ...c, saltate: c.saltate + (f.stato === 'saltata' ? 1 : 0), totali: c.totali + 1 });
    }
  }

  const senza = new Map<string, { titolo: string | null; ora: string | null; fatte: number; totali: number }>();
  for (const b of nel) {
    if (b.tipo !== 'routine' || b.fine !== null || !(completato(b) || b.stato === 'perso' || b.stato === 'saltato'))
      continue;
    const k = b.ricorrenzaId ?? b.id;
    const c = senza.get(k) ?? {
      titolo: (b.ricorrenzaId && ricorrenza.get(b.ricorrenzaId)?.titolo) || b.titolo || null,
      ora: b.conOrario ? localTimeKey(b.inizio) : null,
      fatte: 0,
      totali: 0,
    };
    senza.set(k, { ...c, fatte: c.fatte + (completato(b) ? 1 : 0), totali: c.totali + 1 });
  }

  return {
    fasce: fasce.map(Math.round),
    costanza: costanza.map((n) => n / settimane),
    persi: {
      numero: persi.length,
      momento: momento ? { giorno: momento.giorno, fascia: momento.fascia, quota: momento.n / persi.length } : null,
    },
    fasi: [...fasi.values()]
      .filter((f) => f.saltate > 0)
      .sort((a, b) => b.saltate / b.totali - a.saltate / a.totali || b.saltate - a.saltate)
      .slice(0, 3),
    senzaDurata: [...senza.values()].sort((a, b) => (a.ora ?? '').localeCompare(b.ora ?? '')),
  };
}
