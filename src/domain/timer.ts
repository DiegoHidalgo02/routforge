/**
 * Timer della sessione di studio: regimi, pause, pomodoro, tempo extra, iperfocus, chiusura e riepilogo.
 * Fonte: RoutForge_MECCANISMI.md §10.2–§10.5 (FUNZ §11.2) — criteri: SCENARI D1, D2, D3, D4, D5, D7 (lato dominio).
 * Decisioni: D-TIMER-1, D-TIMER-2, D-SESS-2.
 *
 * - Tutto deriva da istanti assoluti salvati nella sessione attiva (avvio, pause, salti, cambi d'unità, battiti): nessun
 *   contatore, così il timer riprende giusto dopo la chiusura dell'app (D4).
 * - Tempo attivo = trascorso − pause dell'utente − intervalli non verificati non contati = focus (§10.2, §10.4); le
 *   pause dei segmenti del pomodoro contano nel focus e nel totale (§10.3) e il riepilogo le riporta a parte.
 * - Continuità (D-TIMER-2): il battito (`beat`, dal servizio subito alla riapertura e ogni minuto) registra come
 *   intervallo non verificato più di 30' dall'ultimo battito; l'intervallo resta fuori dal focus e dalle pause finché
 *   l'utente non lo conta (`countInterval`). La fine ancorata all'orologio non si sposta; quella ancorata al focus segue
 *   il focus confermato.
 * - Ancorata all'orologio (`fine` presente): finisce a `fine`, la pausa non la sposta; ancorata al focus (libera con
 *   durata): finisce quando il focus arriva alla durata; cronometro (senza durata): mai finita.
 * - Oltre la fine il timer prosegue: tempo extra = tempo attivo dopo la fine (orologio) o focus − durata (focus).
 * - Pomodoro: i segmenti di `planSegments` scorrono sul tempo attivo, avanzano da soli tranne l'ultimo; «salta» chiude
 *   il segmento corrente in quell'istante. Il tempo per unità esclude le pause dei segmenti.
 * - Iperfocus: uscita bloccata finché la sessione non è finita o non c'è un'uscita forzata (interruzione «iperfocus»);
 *   senza una fine (cronometro) nessun blocco.
 * - «Abbandona» dal 65% della durata pianificata in su (focus, pause e tempo extra esclusi) chiude come terminata prima
 *   con l'esito Continua; solo con un blocco e una durata (D-SESS-2). La durata pianificata è quella della sessione, la
 *   stessa del tempo extra: per una routine avviata in ritardo è il tempo fino alla fine del blocco.
 */
import type { DatiEsito } from './outcome';
import { planSegments, PRESETS, type PresetPomodoro, type TipoSegmento } from './pomodoro';
import type { IntervalloNonVerificato, Modalita, SessioneAttiva } from './session';
import { MINUTE, minutes } from './time';

const PRESET: Record<Exclude<Modalita, 'continua'>, PresetPomodoro> = { p25: '25/5', p50: '50/10', p90: '90/20' };

/** Più di 30 minuti dall'ultimo battito = intervallo non verificato (§10.4, D-TIMER-2: la soglia degli orfani di §8). */
export const SOGLIA_NON_VERIFICATO = minutes(30);

/** Millisecondi di pausa dell'utente prima di `t`. */
const pausedBefore = (s: SessioneAttiva, t: number): number =>
  s.pause.reduce((acc, p) => acc + Math.max(0, Math.min(p.fine ?? t, t) - p.inizio), 0);

/** Ms degli intervalli non verificati non contati prima di `t` (§10.4); disgiunti dalle pause, che `beat` chiude. */
const unverifiedBefore = (s: SessioneAttiva, t: number): number =>
  s.intervalliNonVerificati.reduce((acc, i) => acc + (i.contato ? 0 : Math.max(0, Math.min(i.a, t) - i.da)), 0);

/** Tempo attivo (trascorso − pause − intervalli non contati) all'istante `t`. */
const activeAt = (s: SessioneAttiva, t: number): number =>
  Math.max(0, t - s.avvio - pausedBefore(s, t) - unverifiedBefore(s, t));

/**
 * Battito di continuità (§10.4, D-TIMER-2): registra l'istante; se dall'ultimo battito sono passati più di 30' registra
 * l'intervallo come non verificato. Una pausa rimasta aperta è verificata solo fino all'ultimo battito: si chiude lì,
 * così l'intervallo non conta nemmeno come pausa volontaria e «Conta come studio» ha effetto.
 */
export function beat(s: SessioneAttiva, now: number): SessioneAttiva {
  if (now - s.ultimoBattito <= SOGLIA_NON_VERIFICATO) return { ...s, ultimoBattito: now };
  const nonVerificato: IntervalloNonVerificato = { da: s.ultimoBattito, a: now, contato: false };
  return {
    ...s,
    ultimoBattito: now,
    pause: s.pause.map((p) => (p.fine === null ? { ...p, fine: Math.max(p.inizio, s.ultimoBattito) } : p)),
    intervalliNonVerificati: [...s.intervalliNonVerificati, nonVerificato],
  };
}

/** «Conta come studio» (§10.4): l'intervallo non verificato che inizia a `da` entra nel focus. */
export const countInterval = (s: SessioneAttiva, da: number): SessioneAttiva => ({
  ...s,
  intervalliNonVerificati: s.intervalliNonVerificati.map((i) => (i.da === da ? { ...i, contato: true } : i)),
});

/** «Lascia fuori» (S15, handoff §3 n. 40): l'intervallo che inizia a `da` resta fuori dal focus e l'avviso si chiude. */
export const excludeInterval = (s: SessioneAttiva, da: number): SessioneAttiva => ({
  ...s,
  intervalliNonVerificati: s.intervalliNonVerificati.map((i) => (i.da === da ? { ...i, escluso: true } : i)),
});

/** Durata pianificata in ms (§10.2): fine − avvio se ancorata all'orologio, altrimenti la durata; `null` col cronometro. */
const plannedMs = (s: SessioneAttiva): number | null =>
  s.durata === null ? null : s.fine !== null ? s.fine - s.avvio : s.durata * MINUTE;

export const isPaused = (s: SessioneAttiva): boolean => s.pause.some((p) => p.fine === null);

/** Segmento del pomodoro sul tempo attivo (ms dall'avvio): `fine` è la fine naturale, o l'istante del salto. */
export interface SegmentoTimer {
  tipo: TipoSegmento;
  inizio: number;
  fine: number;
  saltato: boolean;
}

/**
 * Segmenti del pomodoro (§10.3) sul tempo attivo. Con una durata l'alternanza studio/pausa del preset tassella il tempo
 * fino alla fine (ultimo troncato, come `planSegments`), anche dopo un «salta», che anticipa i segmenti seguenti: la
 * durata resta tassellata (D-TIMER-1); ancorata all'orologio, la durata è fine − avvio. Senza durata i 4 cicli di
 * `planSegments` (D-POMO-1). L'ultimo segmento non si salta e prosegue nel tempo extra.
 */
export function segmentTimeline(s: SessioneAttiva): SegmentoTimer[] {
  if (s.modalita === 'continua') return [];
  const preset = PRESET[s.modalita];
  const fisso = s.durata === null ? planSegments(preset, null) : null;
  const totale = plannedMs(s) ?? Infinity;
  const salti = s.salti.map((x) => activeAt(s, x)).sort((a, b) => a - b);
  const out: SegmentoTimer[] = [];
  let inizio = 0;
  let j = 0;
  for (let i = 0; ; i++) {
    const seg = fisso?.[i];
    if (fisso ? !seg : inizio >= totale) break;
    const tipo: TipoSegmento = seg?.tipo ?? (i % 2 === 0 ? 'studio' : 'pausa');
    const naturale = seg ? inizio + seg.minuti * MINUTE : Math.min(inizio + PRESETS[preset][tipo] * MINUTE, totale);
    const ultimo = fisso ? i === fisso.length - 1 : naturale >= totale;
    while (j < salti.length && (salti[j] ?? 0) < inizio) j++;
    const salto = !ultimo && j < salti.length && (salti[j] ?? 0) < naturale ? salti[j++] : undefined;
    out.push({ tipo, inizio, fine: salto ?? naturale, saltato: salto !== undefined });
    inizio = salto ?? naturale;
  }
  return out;
}

export interface StatoTimer {
  /** Tempo trascorso − pause, in ms (§10.2). */
  focus: number;
  inPausa: boolean;
  /** Traguardo raggiunto: fine dell'orologio passata o focus arrivato alla durata; il cronometro non finisce mai. */
  finita: boolean;
  /** Ms alla fine; `null` per il cronometro. Negativo non è mai: oltre la fine è 0 e conta `extra`. */
  restante: number | null;
  /** Ms oltre la durata pianificata (§10.4). */
  extra: number;
  /** Istante della fine: quello del blocco (orologio) o adesso + il focus che manca (focus); `null` = cronometro. */
  fine: number | null;
  /** Frazione 0–1 della durata pianificata; `null` per il cronometro. */
  avanzamento: number | null;
  /** Segmento corrente del pomodoro; `restante` è `null` sull'ultimo oltre la sua fine. */
  segmento: { indice: number; totale: number; tipo: TipoSegmento; restante: number | null } | null;
}

export function timerState(s: SessioneAttiva, now: number): StatoTimer {
  const focus = activeAt(s, now);
  const inPausa = isPaused(s);
  let restante: number | null = null;
  let extra = 0;
  let fine: number | null = null;
  let avanzamento: number | null = null;
  if (s.fine !== null) {
    restante = Math.max(0, s.fine - now);
    extra = now > s.fine ? focus - activeAt(s, s.fine) : 0;
    fine = s.fine;
    avanzamento = s.fine > s.avvio ? Math.min(1, (now - s.avvio) / (s.fine - s.avvio)) : 1;
  } else if (s.durata !== null) {
    const durata = s.durata * MINUTE;
    restante = Math.max(0, durata - focus);
    extra = Math.max(0, focus - durata);
    fine = now + restante;
    avanzamento = durata > 0 ? Math.min(1, focus / durata) : 1;
  }
  const segmenti = segmentTimeline(s);
  const indice = segmenti.findIndex((x, i) => focus < x.fine || i === segmenti.length - 1);
  const corrente = segmenti[indice];
  return {
    focus,
    inPausa,
    finita: restante === 0,
    restante,
    extra,
    fine,
    avanzamento,
    segmento: corrente
      ? {
          indice,
          totale: segmenti.length,
          tipo: corrente.tipo,
          restante: focus < corrente.fine ? corrente.fine - focus : null,
        }
      : null,
  };
}

/** Pausa (§10.2): non sposta la fine ancorata all'orologio, allunga quella ancorata al focus. */
export const pauseSession = (s: SessioneAttiva, now: number): SessioneAttiva =>
  isPaused(s) ? s : { ...s, pause: [...s.pause, { inizio: now, fine: null }] };

export const resumeSession = (s: SessioneAttiva, now: number): SessioneAttiva =>
  isPaused(s)
    ? { ...s, pause: s.pause.map((p) => (p.fine === null ? { ...p, fine: Math.max(p.inizio, now) } : p)) }
    : s;

/** Interruzione annotata (§10.4); `iperfocus` = uscita forzata dall'iperfocus. */
export const addInterruption = (s: SessioneAttiva, now: number, iperfocus = false): SessioneAttiva => ({
  ...s,
  interruzioni: [...s.interruzioni, { istante: now, iperfocus }],
});

/** Cambio d'unità a metà (§10.3): l'esito resta sull'unità pianificata (`unitaId`), questa riceve solo i minuti. */
export const changeUnit = (s: SessioneAttiva, now: number, unitaId: string | null): SessioneAttiva => ({
  ...s,
  cambiUnita: [...s.cambiUnita, { istante: now, unitaId }],
});

/** «Salta segmento» (§10.3): chiude il segmento corrente adesso; l'ultimo non si salta. */
export function skipSegment(s: SessioneAttiva, now: number): SessioneAttiva {
  const seg = timerState(s, now).segmento;
  return seg && seg.indice < seg.totale - 1 ? { ...s, salti: [...s.salti, now] } : s;
}

/** L'unità a cui va il tempo adesso: l'ultima cambiata, o quella pianificata. */
export const currentStudyUnit = (s: SessioneAttiva): string | null =>
  s.cambiUnita.length ? (s.cambiUnita[s.cambiUnita.length - 1]?.unitaId ?? null) : s.unitaId;

/** Iperfocus (§10.4): uscita bloccata fino alla fine; un'uscita forzata la sblocca. */
export function exitLocked(s: SessioneAttiva, now: number): boolean {
  if (!s.iperfocus || s.interruzioni.some((i) => i.iperfocus)) return false;
  // Senza una fine (cronometro) non c'è «fino alla fine»: nessun blocco (D-TIMER-1; il setup non lo offre)
  const st = timerState(s, now);
  return st.restante !== null && !st.finita;
}

/** Riepilogo della chiusura (§10.5); durate in ms. */
export interface Riepilogo {
  focus: number;
  extra: number;
  pauseSegmento: number;
  numeroPause: number;
  durataPause: number;
  interruzioni: number;
  /** Interruzioni «iperfocus» = uscite d'emergenza (§20). */
  usciteEmergenza: number;
  perUnita: Record<string, number>;
  /** Segmenti del pomodoro, studio e pausa, arrivati alla fine naturale o alla fine della sessione (i saltati no). */
  segmentiCompletati: number;
}

export function summary(s: SessioneAttiva, now: number): Riepilogo {
  const { focus, extra, finita } = timerState(s, now);
  const segmenti = segmentTimeline(s);
  const pauseSeg = segmenti.filter((x) => x.tipo === 'pausa').map((x) => [x.inizio, Math.min(x.fine, focus)] as const);
  const sovrapposte = (a: number, b: number) =>
    pauseSeg.reduce((acc, [x, y]) => acc + Math.max(0, Math.min(b, y) - Math.max(a, x)), 0);
  const tappe = [
    { da: 0, unitaId: s.unitaId },
    ...s.cambiUnita.map((c) => ({ da: activeAt(s, c.istante), unitaId: c.unitaId })),
  ];
  const perUnita: Record<string, number> = {};
  tappe.forEach((x, i) => {
    const a = Math.min(x.da, focus);
    const b = Math.min(tappe[i + 1]?.da ?? focus, focus);
    if (x.unitaId && b > a) perUnita[x.unitaId] = (perUnita[x.unitaId] ?? 0) + (b - a) - sovrapposte(a, b);
  });
  return {
    focus,
    extra,
    pauseSegmento: sovrapposte(0, focus),
    numeroPause: s.pause.length,
    durataPause: pausedBefore(s, now),
    interruzioni: s.interruzioni.length,
    usciteEmergenza: s.interruzioni.filter((i) => i.iperfocus).length,
    perUnita,
    // A sessione finita conta anche il segmento in corso: con l'orologio le pause ne accorciano il tempo (D-TIMER-1)
    segmentiCompletati: segmenti.filter((x) => !x.saltato && (x.fine <= focus || (finita && x.inizio < focus))).length,
  };
}

/** Tipo di chiusura (§10.5). */
export type TipoChiusura = 'completata' | 'terminata_prima' | 'abbandonata';

/** La sessione chiusa, come si salva in `sessioni` (docs/02_ARCHITETTURA.md §3). */
export interface SessioneChiusa extends SessioneAttiva {
  chiusura: TipoChiusura;
  chiusaIl: number;
  riepilogo: Riepilogo;
}

/**
 * Chiude la sessione adesso: una pausa aperta si chiude qui. `completata` se il traguardo è raggiunto, o per il
 * cronometro che non ne ha (D-TIMER-1); altrimenti `terminata_prima`. `forzata` la impone: `abbandonata` se l'utente
 * abbandona, `terminata_prima` per l'abbandono oltre soglia (`abandonPlan`).
 */
export function closeSession(
  s: SessioneAttiva,
  now: number,
  forzata?: Exclude<TipoChiusura, 'completata'>,
): SessioneChiusa {
  const chiusa = resumeSession(s, now);
  const chiusura: TipoChiusura =
    forzata ?? (chiusa.durata === null || timerState(chiusa, now).finita ? 'completata' : 'terminata_prima');
  return { ...chiusa, chiusura, chiusaIl: now, riepilogo: summary(chiusa, now) };
}

/** Dal 65% della durata pianificata «Abbandona» chiude con l'esito Continua (§10.5, D-SESS-2); in percento. */
export const SOGLIA_ABBANDONO = 65;

/**
 * Percento intero della durata pianificata già studiata (focus: pause escluse; tetto 100, il tempo extra non lo alza):
 * `null` senza blocco o col cronometro, dove la soglia dell'abbandono non vale (§10.5, D-SESS-2).
 */
export function focusPercent(s: SessioneAttiva, now: number): number | null {
  const durata = s.bloccoId === null ? null : plannedMs(s);
  if (durata === null) return null;
  return durata > 0 ? Math.min(100, Math.floor((activeAt(s, now) * 100) / durata)) : 100;
}

/**
 * «Abbandona» (§10.5, D-SESS-2): dal 65% in su la sessione si chiude come terminata prima con l'esito Continua che conta
 * nel piano, senza confidenza né nota; sotto, abbandonata senza esito.
 */
export function abandonPlan(
  s: SessioneAttiva,
  now: number,
): { chiusura: Exclude<TipoChiusura, 'completata'>; esito: DatiEsito | null } {
  const percento = focusPercent(s, now);
  return percento !== null && percento >= SOGLIA_ABBANDONO
    ? { chiusura: 'terminata_prima', esito: { esito: 'continua', confidenza: null, nota: '', contaNelPiano: true } }
    : { chiusura: 'abbandonata', esito: null };
}
