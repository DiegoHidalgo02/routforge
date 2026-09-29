/**
 * Insieme desiderato delle notifiche, identificatori e piano di riconciliazione.
 * Fonti: RoutForge_MECCANISMI.md §13.1 (livelli), §13.2 (trigger), §13.3 (finestra, id, riconciliazione), §13.6 e §10.4
 * («tempo scaduto»), §10.1 (anticipo e avvio), §8 (scadenza di recupero).
 * Criteri: SCENARI F1, F2, F4, F6, A3, B4, B6, B7, C4, D1, E3. Decisione: D-NOTIF-1.
 *
 * - Fusione generale → tipo → istanza; le occorrenze usano il promemoria della definizione; fusione vuota → nulla.
 * - `programmato` → tutte le voci; `in_corso` → solo «esito» (F1); stati terminali e `perso` → nulla.
 * - Finestra: scatti in [now + 5 s, now + 14 giorni locali].
 * - Chiave `trigger:anticipo:bloccoId`, id nativo FNV-1a a 32 bit con segno, collisioni risolte con +1.
 */
import { MAX_ANTICIPO_SVEGLIA } from '../activity';
import { recoveryDeadline } from '../lost';
import type { SessioneAttiva } from '../session';
import { addLocalDays, localDayKey, localInstant, minutes, startOfLocalDay } from '../time';
import { STATI_TERMINALI, type AnticipoPromemoria, type Blocco, type Ricorrenza, type TipoBlocco } from '../types';

export type TriggerNotifica = 'pre' | 'inizio' | 'verifica' | 'esito' | 'scadenza' | 'giorno' | 'tempo_scaduto';
export type AzioneNotifica = 'inizia' | 'segna_fatto' | 'registra_esito' | 'posticipa';

/** Una notifica dell'insieme desiderato (§13.3): semantica, i testi li produce la UI (D-NOTIF-1 n. 8). */
export interface NotificaPianificata {
  /** `trigger:anticipo:bloccoId`; per il tempo scaduto `CHIAVE_TEMPO_SCADUTO`. */
  chiave: string;
  /** Istante di scatto (epoch ms). */
  istante: number;
  trigger: TriggerNotifica;
  /** Minuti d'anticipo; 0 per i trigger che non sono «pre». */
  anticipo: number;
  /** `null` per il tempo scaduto della sessione. */
  bloccoId: string | null;
  /** Canale (T-021); 'studio' per il tempo scaduto. */
  tipo: TipoBlocco;
  titolo: string;
  inizioBlocco: number | null;
  sveglia: boolean;
  silenzioso: boolean;
  azioni: AzioneNotifica[];
  /** Avviso one-shot: le ore silenziose non lo spostano (§13.4, T-020). */
  oneShot: boolean;
}

export interface ImpostazioniTipo {
  attivo: boolean;
  anticipi: number[];
  silenzioso: boolean;
}
export interface ImpostazioniNotifiche {
  generale: boolean;
  perTipo: Record<TipoBlocco, ImpostazioniTipo>;
}

/** Default di §13.1 n. 2: todo 30', studio 5', routine 10', evento 15'. */
export const IMPOSTAZIONI_NOTIFICHE_DEFAULT: ImpostazioniNotifiche = {
  generale: true,
  perTipo: {
    todo: { attivo: true, anticipi: [30], silenzioso: false },
    studio: { attivo: true, anticipi: [5], silenzioso: false },
    routine: { attivo: true, anticipi: [10], silenzioso: false },
    evento: { attivo: true, anticipi: [15], silenzioso: false },
  },
};

/** §13.3: si armano le notifiche che scattano entro 14 giorni, sui blocchi che iniziano entro 14 + 31. */
export const FINESTRA_NOTIFICHE_GIORNI = 14;
export const ORIZZONTE_BLOCCHI_GIORNI = 14 + 31;
/** §13.3: niente entro 5 s. */
export const MIN_ANTICIPO_ARMATURA_MS = 5_000;
/** §13.2: «esito» a fine + 10'. */
export const RITARDO_ESITO_MS = minutes(10);
/** §13.2: evento tutto il giorno alle 08:00. */
export const ORARIO_TUTTO_IL_GIORNO = '08:00';
/** Una sola sessione attiva (§10.1): chiave fissa. */
export const CHIAVE_TEMPO_SCADUTO = 'tempo_scaduto:0:sessione';

export const notificationKey = (trigger: TriggerNotifica, anticipo: number, bloccoId: string): string =>
  `${trigger}:${anticipo}:${bloccoId}`;

/**
 * Anticipi dopo la fusione dei livelli (§13.1); `null` = nessun promemoria. Le occorrenze ereditano la definizione.
 * La sveglia viene solo dal Personalizzato, su blocchi con orario e anticipi ≤ 7 h (§13.1 n. 4).
 */
export function mergedReminders(
  b: Blocco,
  definizione: Ricorrenza | undefined,
  imp: ImpostazioniNotifiche,
): AnticipoPromemoria[] | null {
  const tipo = imp.perTipo[b.tipo];
  if (!imp.generale || !tipo.attivo) return null;
  const p = (b.ricorrenzaId ? definizione?.promemoria : undefined) ?? b.promemoria ?? { modo: 'auto' };
  const anticipi =
    p.modo === 'off'
      ? []
      : p.modo === 'auto'
        ? tipo.anticipi.map((minuti) => ({ minuti, sveglia: false }))
        : p.anticipi.map((a) => ({ ...a, sveglia: a.sveglia && b.conOrario && a.minuti <= MAX_ANTICIPO_SVEGLIA }));
  return anticipi.length > 0 ? anticipi : null;
}

const AZIONI: Record<TipoBlocco, AzioneNotifica[]> = {
  studio: ['inizia', 'posticipa'],
  todo: ['segna_fatto', 'posticipa'],
  routine: ['posticipa'],
  evento: ['posticipa'],
};

/** Tutte le voci di un blocco secondo §13.2, senza finestra. */
export function blockNotifications(
  b: Blocco,
  definizione: Ricorrenza | undefined,
  imp: ImpostazioniNotifiche,
): NotificaPianificata[] {
  if (STATI_TERMINALI.has(b.stato)) return [];
  const anticipi = mergedReminders(b, definizione, imp);
  if (!anticipi) return [];
  const voce = (trigger: TriggerNotifica, anticipo: number, istante: number, sveglia = false): NotificaPianificata => ({
    chiave: notificationKey(trigger, anticipo, b.id),
    istante,
    trigger,
    anticipo,
    bloccoId: b.id,
    tipo: b.tipo,
    titolo: b.titolo ?? '',
    inizioBlocco: b.inizio,
    sveglia,
    silenzioso: imp.perTipo[b.tipo].silenzioso,
    // «Esito» ha anche Posticipa: §13.2 lo ammette «in corso solo per esito»
    azioni: trigger === 'esito' ? ['registra_esito', 'posticipa'] : AZIONI[b.tipo],
    oneShot: false,
  });
  // Studio in corso: la verifica è cancellata, l'esito resta (F1; D-NOTIF-1 n. 2)
  const esito = b.tipo === 'studio' && b.fine !== null ? [voce('esito', 0, b.fine + RITARDO_ESITO_MS)] : [];
  if (b.stato === 'in_corso') return esito;
  if (!b.conOrario)
    return b.tipo === 'evento' ? [voce('giorno', 0, localInstant(localDayKey(b.inizio), ORARIO_TUTTO_IL_GIORNO))] : [];
  const pre = anticipi
    .filter((a) => a.minuti > 0)
    .sort((x, y) => y.minuti - x.minuti)
    .map((a) => voce('pre', a.minuti, b.inizio - minutes(a.minuti), a.sveglia));
  // «All'inizio» coincide col trigger puntuale e, se sveglia, lo rende sveglia (§13.1 n. 4)
  const zero = anticipi.find((a) => a.minuti === 0);
  const puntuale = (trigger: TriggerNotifica) => voce(trigger, 0, b.inizio, zero?.sveglia ?? false);
  switch (b.tipo) {
    case 'evento':
      return zero ? [...pre, puntuale('inizio')] : pre;
    case 'todo':
      return [...pre, puntuale('scadenza')];
    case 'routine':
      return [...pre, puntuale('inizio'), voce('verifica', 0, recoveryDeadline(b))];
    case 'studio':
      return [...pre, puntuale('inizio'), voce('verifica', 0, recoveryDeadline(b)), ...esito];
  }
}

/** «Tempo scaduto» (§10.4, §13.6): solo sessioni ancorate all'orologio; segue solo l'interruttore generale. */
export function sessionNotification(
  s: Pick<SessioneAttiva, 'fine' | 'bloccoId'> | null,
  titolo: string,
  imp: ImpostazioniNotifiche,
): NotificaPianificata | null {
  if (!imp.generale || !s || s.fine === null) return null;
  return {
    chiave: CHIAVE_TEMPO_SCADUTO,
    istante: s.fine,
    trigger: 'tempo_scaduto',
    anticipo: 0,
    bloccoId: null,
    tipo: 'studio',
    titolo,
    inizioBlocco: null,
    sveglia: false,
    silenzioso: false,
    azioni: [],
    oneShot: true,
  };
}

/** L'insieme desiderato adesso (§13.3): finestra applicata, ordinato per istante e poi per chiave. */
export function desiredSet(
  input: {
    blocchi: readonly Blocco[];
    ricorrenze: readonly Ricorrenza[];
    impostazioni: ImpostazioniNotifiche;
    sessione: Pick<SessioneAttiva, 'fine' | 'bloccoId'> | null;
    titoloSessione: string;
  },
  now: number,
): NotificaPianificata[] {
  const definizioni = new Map(input.ricorrenze.map((r) => [r.id, r]));
  const tutte = input.blocchi.flatMap((b) =>
    blockNotifications(b, b.ricorrenzaId ? definizioni.get(b.ricorrenzaId) : undefined, input.impostazioni),
  );
  const sessione = sessionNotification(input.sessione, input.titoloSessione, input.impostazioni);
  if (sessione) tutte.push(sessione);
  const da = now + MIN_ANTICIPO_ARMATURA_MS;
  const a = addLocalDays(now, FINESTRA_NOTIFICHE_GIORNI);
  return tutte
    .filter((n) => n.istante >= da && n.istante <= a)
    .sort((x, y) => x.istante - y.istante || (x.chiave < y.chiave ? -1 : x.chiave > y.chiave ? 1 : 0));
}

/** Id nativo deterministico (§13.3): FNV-1a a 32 bit, intero con segno (vincolo Android). */
export function nativeId(chiave: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < chiave.length; i++) {
    h ^= chiave.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h | 0;
}

/** Id per chiavi nuove: in ordine di chiave, +1 finché l'id è già in uso; le chiavi di `occupati` tengono il loro. */
export function assignNativeIds(
  chiavi: readonly string[],
  occupati: ReadonlyMap<string, number>,
  hash: (chiave: string) => number = nativeId,
): Map<string, number> {
  const usati = new Set(occupati.values());
  const ids = new Map<string, number>();
  for (const chiave of [...chiavi].sort()) {
    const noto = occupati.get(chiave);
    if (noto !== undefined) {
      ids.set(chiave, noto);
      continue;
    }
    let id = hash(chiave);
    while (usati.has(id)) id = (id + 1) | 0;
    usati.add(id);
    ids.set(chiave, id);
  }
  return ids;
}

/** Una voce armata, come sta nel registro (MECC §1). */
export interface VoceRegistro extends NotificaPianificata {
  idNativo: number;
}

const stessaVoce = (a: NotificaPianificata, b: NotificaPianificata): boolean =>
  a.istante === b.istante &&
  a.trigger === b.trigger &&
  a.anticipo === b.anticipo &&
  a.bloccoId === b.bloccoId &&
  a.tipo === b.tipo &&
  a.titolo === b.titolo &&
  a.inizioBlocco === b.inizioBlocco &&
  a.sveglia === b.sveglia &&
  a.silenzioso === b.silenzioso &&
  a.oneShot === b.oneShot &&
  a.azioni.join() === b.azioni.join();

/**
 * Riconciliazione (§13.3): cancella ciò che è nel registro, non è desiderato e non è ancora scattato; arma ciò che manca
 * o è cambiato (stesso id = sostituzione). Una voce già scattata non si cancella (è consegnata) e resta nel registro
 * fino alla fine di domani, per «Ieri · gestite» della schermata Notifiche (§8, T-022); poi esce senza chiamare la
 * piattaforma. `riarmaTutto` alla prima riconciliazione del processo (D-NOTIF-1 n. 5).
 */
export function reconcilePlan(
  desiderate: readonly NotificaPianificata[],
  registro: readonly VoceRegistro[],
  riarmaTutto: boolean,
  now: number,
): { daCancellare: number[]; daTogliere: string[]; daArmare: VoceRegistro[] } {
  const perChiave = new Map(registro.map((r) => [r.chiave, r]));
  const volute = new Set(desiderate.map((d) => d.chiave));
  const ieri = startOfLocalDay(addLocalDays(now, -1));
  const pendenti = registro.filter((r) => !volute.has(r.chiave) && r.istante > now);
  const via = [...pendenti, ...registro.filter((r) => !volute.has(r.chiave) && r.istante < ieri)];
  const ids = assignNativeIds(
    desiderate.map((d) => d.chiave),
    new Map(registro.map((r) => [r.chiave, r.idNativo])),
  );
  const daArmare = desiderate
    .filter((d) => {
      const r = perChiave.get(d.chiave);
      return riarmaTutto || !r || !stessaVoce(d, r);
    })
    .map((d) => ({ ...d, idNativo: ids.get(d.chiave) ?? nativeId(d.chiave) }));
  return { daCancellare: pendenti.map((r) => r.idNativo), daTogliere: via.map((r) => r.chiave), daArmare };
}
