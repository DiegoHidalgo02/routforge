/**
 * Insieme desiderato delle notifiche, identificatori e piano di riconciliazione.
 * Fonti: RoutForge_MECCANISMI.md §13.1 (livelli), §13.2 (trigger, posticipa), §13.3 (finestra, id, riconciliazione),
 * §13.4 (nessuna fascia silenziosa: D-NOTIF-3), §13.5 (digest), §13.6 e §10.4 («tempo scaduto», «blocco perso», «todo in ritardo», prova),
 * §10.1 (anticipo e avvio), §8 (scadenza di recupero, avviso «blocco perso»), §6 (avviso «todo in ritardo»).
 * Criteri: SCENARI F1, F2, F3, F4, F5, F6, A1, A3, A4, B4, B6, B7, C4, C8, D1, E3. Decisioni: D-NOTIF-1, D-NOTIF-2.
 *
 * - Fusione generale → tipo → istanza; le occorrenze usano il promemoria della definizione; fusione vuota → nulla.
 * - `programmato` → tutte le voci; `in_corso` → solo «esito» (F1); stati terminali e `perso` → nulla, salvo gli
 *   one-shot derivati dalle marcature del ciclo: «perso» da `persoIl`, «ritardo» da `ritardoIl` (10 s dopo).
 * - I posticipi (tocco + 10') si applicano qui, prima della finestra: il registro vede l'istante vero. Nessuna voce
 *   viene rinviata per l'orario: il silenzio è del sistema operativo (D-NOTIF-3).
 * - Finestra: scatti in [now, now + 14 giorni locali]; si arma solo ciò che scatta almeno 5 s dopo (`reconcilePlan`).
 * - Chiave `trigger:anticipo:bloccoId`, id nativo FNV-1a a 32 bit con segno, collisioni risolte con +1.
 */
import type { InizioSettimana } from '../settings';
import { MAX_ANTICIPO_SVEGLIA } from '../activity';
import { lostNotificationDue, recoveryDeadline } from '../lost';
import type { SessioneAttiva } from '../session';
import { addLocalDays, localDayKey, localInstant, minutes, startOfLocalDay } from '../time';
import { STATI_TERMINALI, type AnticipoPromemoria, type Blocco, type Ricorrenza, type TipoBlocco } from '../types';
import { digestContent, nextDigestInstant, type DigestNotifica, type ImpostazioniDigest } from './digest';

export type TriggerNotifica =
  | 'pre'
  | 'inizio'
  | 'verifica'
  | 'esito'
  | 'scadenza'
  | 'giorno'
  | 'tempo_scaduto'
  | 'perso'
  | 'ritardo'
  | 'digest'
  | 'prova';
export type AzioneNotifica = 'inizia' | 'segna_fatto' | 'registra_esito' | 'posticipa';

/** Un blocco come lo legge il servizio dalla tabella: con il giorno di parete e l'istante di creazione (D-NOTIF-2). */
export type BloccoNotifiche = Blocco & { giornoLocale?: string; createdAt?: number };

/** Una notifica dell'insieme desiderato (§13.3): semantica, i testi li produce la UI (D-NOTIF-1 n. 8). */
export interface NotificaPianificata {
  /** `trigger:anticipo:bloccoId`; per il tempo scaduto `CHIAVE_TEMPO_SCADUTO`, per il digest il giorno, per la prova `CHIAVE_PROVA`. */
  chiave: string;
  /** Istante di scatto (epoch ms). */
  istante: number;
  trigger: TriggerNotifica;
  /** Minuti d'anticipo; 0 per i trigger che non sono «pre». */
  anticipo: number;
  /** `null` per il tempo scaduto della sessione, il digest e la prova. */
  bloccoId: string | null;
  /** Canale (T-021); 'studio' per il tempo scaduto, 'todo' per digest e prova. */
  tipo: TipoBlocco;
  titolo: string;
  inizioBlocco: number | null;
  sveglia: boolean;
  silenzioso: boolean;
  azioni: AzioneNotifica[];
  /**
   * Solo todo: voci della checklist non spuntate (§4). «Segna fatto» allora apre l'app su «Voci rimaste» invece di
   * completare in sfondo, e la piattaforma lo deve sapere quando arma la notifica (A6, T-057).
   */
  vociAperte: boolean;
  /** Avviso one-shot (§13.6): parte all'istante della marcatura o della prova. */
  oneShot: boolean;
  /** Solo per il trigger «digest»: conteggio, arretrati e titoli (§13.5). */
  digest?: DigestNotifica;
}

export interface ImpostazioniTipo {
  attivo: boolean;
  anticipi: number[];
  silenzioso: boolean;
}
export interface ImpostazioniNotifiche {
  generale: boolean;
  perTipo: Record<TipoBlocco, ImpostazioniTipo>;
  digest: ImpostazioniDigest;
}

/** Default di §13.1 n. 2 (todo 30', studio 5', routine 10', evento 15') e §13.5 (digest alle 08:00). */
export const IMPOSTAZIONI_NOTIFICHE_DEFAULT: ImpostazioniNotifiche = {
  generale: true,
  perTipo: {
    todo: { attivo: true, anticipi: [30], silenzioso: false },
    studio: { attivo: true, anticipi: [5], silenzioso: false },
    routine: { attivo: true, anticipi: [10], silenzioso: false },
    evento: { attivo: true, anticipi: [15], silenzioso: false },
  },
  digest: { orario: '08:00' },
};

/** §13.3: si armano le notifiche che scattano entro 14 giorni, sui blocchi che iniziano entro 14 + 31. */
export const FINESTRA_NOTIFICHE_GIORNI = 14;
export const ORIZZONTE_BLOCCHI_GIORNI = 14 + 31;
/** §13.3: niente entro 5 s (vincolo d'armatura: una voce così vicina non si arma, ma se è già armata non si cancella). */
export const MIN_ANTICIPO_ARMATURA_MS = 5_000;
/** §13.2: «esito» a fine + 10'. */
export const RITARDO_ESITO_MS = minutes(10);
/** §13.2: evento tutto il giorno alle 08:00. */
export const ORARIO_TUTTO_IL_GIORNO = '08:00';
/** Una sola sessione attiva (§10.1): chiave fissa. */
export const CHIAVE_TEMPO_SCADUTO = 'tempo_scaduto:0:sessione';
/** §6, §8, §13.6: «todo in ritardo» e «blocco perso» partono ~10 s dopo la marcatura del ciclo. */
export const RITARDO_ONE_SHOT_MS = 10_000;
/** §13.2: «Posticipa» = +10' dal tocco. */
export const POSTICIPO_MS = minutes(10);
/** §13.6: la notifica di prova a +6 s. */
export const RITARDO_PROVA_MS = 6_000;
export const CHIAVE_PROVA = 'prova:0:prova';

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

/** Una voce di un blocco: chiave dal trigger e dall'anticipo, canale e azioni dal tipo. */
function voceDi(
  b: Blocco,
  imp: ImpostazioniNotifiche,
  trigger: TriggerNotifica,
  anticipo: number,
  istante: number,
  over: Partial<NotificaPianificata> = {},
): NotificaPianificata {
  return {
    chiave: notificationKey(trigger, anticipo, b.id),
    istante,
    trigger,
    anticipo,
    bloccoId: b.id,
    tipo: b.tipo,
    titolo: b.titolo ?? '',
    inizioBlocco: b.inizio,
    sveglia: false,
    silenzioso: imp.perTipo[b.tipo].silenzioso,
    azioni: AZIONI[b.tipo],
    vociAperte: b.tipo === 'todo' && (b.checklist ?? []).some((v) => !v.fatta),
    oneShot: false,
    ...over,
  };
}

/**
 * Le azioni che non aprono l'app (A6, §13.2): «Posticipa» e «Segna fatto» senza voci aperte, che completa subito con
 * l'operazione di §3; le altre portano l'app dove serve (setup, Dettaglio, esito).
 */
export const runsInBackground = (v: Pick<NotificaPianificata, 'vociAperte'>, azione: AzioneNotifica): boolean =>
  azione === 'posticipa' || (azione === 'segna_fatto' && !v.vociAperte);

/**
 * Gli avvisi one-shot di un blocco (§13.6), derivati dalle marcature del ciclo così che ogni riconciliazione li ritrovi
 * (D-NOTIF-2): «todo in ritardo» 10 s dopo `ritardoIl` (§6: una volta per todo, D-HOR-1), «blocco perso» 10 s dopo
 * `persoIl` se `lostNotificationDue` (§8: routine e studio, fine nelle ultime 2 ore; non dopo una sessione avviata, né
 * per un blocco nato dopo la sua fine). Canale silenzioso; seguono l'interruttore generale e quello del tipo.
 */
export function oneShotNotifications(b: BloccoNotifiche, imp: ImpostazioniNotifiche): NotificaPianificata[] {
  if (!imp.generale || !imp.perTipo[b.tipo].attivo) return [];
  const voci: NotificaPianificata[] = [];
  const oneShot = { silenzioso: true, oneShot: true } as const;
  if (b.tipo === 'todo' && b.ritardoIl != null && (b.stato === 'programmato' || b.stato === 'perso'))
    voci.push(
      voceDi(b, imp, 'ritardo', 0, b.ritardoIl + RITARDO_ONE_SHOT_MS, {
        ...oneShot,
        azioni: ['segna_fatto', 'posticipa'],
      }),
    );
  if (b.stato === 'perso' && b.persoIl != null && lostNotificationDue(b, b.persoIl))
    voci.push(
      voceDi(b, imp, 'perso', 0, b.persoIl + RITARDO_ONE_SHOT_MS, {
        ...oneShot,
        azioni: b.tipo === 'studio' ? ['registra_esito'] : [],
      }),
    );
  return voci;
}

/**
 * I blocchi di cui non si calcolano le voci: un dato rotto (un tipo sconosciuto, un promemoria personalizzato senza
 * anticipi), anche da un backup. Il servizio li toglie dall'insieme desiderato e li porta in Diagnostica, così non
 * fermano le voci degli altri (audit P1-2; come le ricorrenze che non si leggono nel ciclo, D-SCHED-1 n. 8).
 */
export function unreadableBlocks(
  blocchi: readonly BloccoNotifiche[],
  ricorrenze: readonly Ricorrenza[],
  imp: ImpostazioniNotifiche,
): string[] {
  const definizioni = new Map(ricorrenze.map((r) => [r.id, r]));
  return blocchi
    .filter((b) => {
      try {
        blockNotifications(b, b.ricorrenzaId ? definizioni.get(b.ricorrenzaId) : undefined, imp);
        return false;
      } catch {
        return true;
      }
    })
    .map((b) => b.id);
}

/** Tutte le voci di un blocco secondo §13.2 e §13.6, senza finestra né posticipi. */
export function blockNotifications(
  b: BloccoNotifiche,
  definizione: Ricorrenza | undefined,
  imp: ImpostazioniNotifiche,
): NotificaPianificata[] {
  const avvisi = oneShotNotifications(b, imp);
  if (STATI_TERMINALI.has(b.stato)) return avvisi;
  const anticipi = mergedReminders(b, definizione, imp);
  if (!anticipi) return avvisi;
  const voce = (trigger: TriggerNotifica, anticipo: number, istante: number, sveglia = false): NotificaPianificata =>
    // «Esito» ha anche Posticipa: §13.2 lo ammette «in corso solo per esito»
    voceDi(b, imp, trigger, anticipo, istante, {
      sveglia,
      ...(trigger === 'esito' && { azioni: ['registra_esito', 'posticipa'] }),
    });
  // Studio in corso: la verifica è cancellata, l'esito resta (F1; D-NOTIF-1 n. 2)
  const esito = b.tipo === 'studio' && b.fine !== null ? [voce('esito', 0, b.fine + RITARDO_ESITO_MS)] : [];
  if (b.stato === 'in_corso') return [...avvisi, ...esito];
  if (!b.conOrario)
    return b.tipo === 'evento'
      ? [...avvisi, voce('giorno', 0, localInstant(localDayKey(b.inizio), ORARIO_TUTTO_IL_GIORNO))]
      : avvisi;
  const pre = anticipi
    .filter((a) => a.minuti > 0)
    .sort((x, y) => y.minuti - x.minuti)
    .map((a) => voce('pre', a.minuti, b.inizio - minutes(a.minuti), a.sveglia));
  // «All'inizio» coincide col trigger puntuale e, se sveglia, lo rende sveglia (§13.1 n. 4)
  const zero = anticipi.find((a) => a.minuti === 0);
  const puntuale = (trigger: TriggerNotifica) => voce(trigger, 0, b.inizio, zero?.sveglia ?? false);
  // La verifica solo se il blocco non è mai stato avviato (§8): dopo una sessione abbandonata torna `programmato` ma
  // `minutiRitardo` resta dal primo avvio, come per l'avviso «perso» (audit P1-9)
  const verifica = b.minutiRitardo == null ? [voce('verifica', 0, recoveryDeadline(b))] : [];
  switch (b.tipo) {
    case 'evento':
      return zero ? [...avvisi, ...pre, puntuale('inizio')] : [...avvisi, ...pre];
    case 'todo':
      return [...avvisi, ...pre, puntuale('scadenza')];
    case 'routine':
      return [...avvisi, ...pre, puntuale('inizio'), ...verifica];
    case 'studio':
      return [...avvisi, ...pre, puntuale('inizio'), ...verifica, ...esito];
  }
}

/** Una voce senza blocco (tempo scaduto, digest, prova): senza anticipo, sveglia né azioni; il resto da `over`. */
const voceSenzaBlocco = (
  chiave: string,
  istante: number,
  trigger: TriggerNotifica,
  tipo: TipoBlocco,
  over: Partial<NotificaPianificata> = {},
): NotificaPianificata => ({
  chiave,
  istante,
  trigger,
  anticipo: 0,
  bloccoId: null,
  tipo,
  titolo: '',
  inizioBlocco: null,
  sveglia: false,
  silenzioso: false,
  azioni: [],
  vociAperte: false,
  oneShot: false,
  ...over,
});

/** «Tempo scaduto» (§10.4, §13.6): solo sessioni ancorate all'orologio; segue solo l'interruttore generale. */
export function sessionNotification(
  s: Pick<SessioneAttiva, 'fine' | 'bloccoId'> | null,
  titolo: string,
  imp: ImpostazioniNotifiche,
): NotificaPianificata | null {
  if (!imp.generale || !s || s.fine === null) return null;
  return voceSenzaBlocco(CHIAVE_TEMPO_SCADUTO, s.fine, 'tempo_scaduto', 'studio', { titolo, oneShot: true });
}

/** Il digest (§13.5): la prossima occorrenza dell'orario con il contenuto calcolato adesso; segue il tipo todo. */
export function digestNotification(
  blocchi: readonly BloccoNotifiche[],
  imp: ImpostazioniNotifiche,
  now: number,
  inizioSettimana: InizioSettimana = 1,
): NotificaPianificata | null {
  if (!imp.generale || !imp.perTipo.todo.attivo) return null;
  const istante = nextDigestInstant(now, imp.digest.orario);
  const digest = digestContent(blocchi, istante, inizioSettimana);
  if (!digest) return null;
  const chiave = notificationKey('digest', 0, localDayKey(istante));
  return voceSenzaBlocco(chiave, istante, 'digest', 'todo', { silenzioso: imp.perTipo.todo.silenzioso, digest });
}

/** La notifica di prova (§13.6, FUNZ §7.6): a +6 s, fuori dal registro; la arma il servizio su richiesta (T-032). */
export const testNotification = (now: number): NotificaPianificata =>
  voceSenzaBlocco(CHIAVE_PROVA, now + RITARDO_PROVA_MS, 'prova', 'todo', { oneShot: true });

/**
 * L'insieme desiderato adesso (§13.3): voci dei blocchi, digest e tempo scaduto; poi i posticipi (§13.2: tocco + 10',
 * solo sulle voci che esistono ancora e hanno l'azione, così lo stato coerente è già deciso); infine la finestra (da
 * adesso a 14 giorni: «non desiderato» significa cambiato o scattato, F6), ordinato per istante e poi per chiave.
 */
export function desiredSet(
  input: {
    blocchi: readonly BloccoNotifiche[];
    ricorrenze: readonly Ricorrenza[];
    impostazioni: ImpostazioniNotifiche;
    sessione: Pick<SessioneAttiva, 'fine' | 'bloccoId'> | null;
    titoloSessione: string;
    /** Chiave → istante del tocco «Posticipa» (`preferenze.posticipi`, D-NOTIF-2). */
    posticipi?: Readonly<Record<string, number>>;
    /** Primo giorno della settimana (Impostazioni, FUNZ §23): la fine dell'orizzonte dei todo nel digest. */
    inizioSettimana?: InizioSettimana;
  },
  now: number,
): NotificaPianificata[] {
  const imp = input.impostazioni;
  const definizioni = new Map(input.ricorrenze.map((r) => [r.id, r]));
  const tutte = input.blocchi.flatMap((b) =>
    blockNotifications(b, b.ricorrenzaId ? definizioni.get(b.ricorrenzaId) : undefined, imp),
  );
  const digest = digestNotification(input.blocchi, imp, now, input.inizioSettimana);
  if (digest) tutte.push(digest);
  const sessione = sessionNotification(input.sessione, input.titoloSessione, imp);
  if (sessione) tutte.push(sessione);
  const a = addLocalDays(now, FINESTRA_NOTIFICHE_GIORNI);
  return tutte
    .map((n) => {
      const tocco = input.posticipi?.[n.chiave];
      const posticipata = tocco !== undefined && n.azioni.includes('posticipa') && tocco + POSTICIPO_MS > n.istante;
      return posticipata ? { ...n, istante: tocco + POSTICIPO_MS } : n;
    })
    .filter((n) => n.istante >= now && n.istante <= a)
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
  a.vociAperte === b.vociAperte &&
  a.oneShot === b.oneShot &&
  a.azioni.join() === b.azioni.join() &&
  JSON.stringify(a.digest) === JSON.stringify(b.digest);

/**
 * Riconciliazione (§13.3): cancella ciò che è nel registro, non è desiderato e non è ancora scattato (F6); arma ciò che
 * manca o è cambiato (stesso id = sostituzione), purché scatti almeno 5 s dopo («niente entro 5 s»: una voce così
 * vicina resta com'è sulla piattaforma). Una voce già scattata non si cancella e resta nel registro fino alla fine di
 * domani, per «Ieri · gestite» della schermata Notifiche (§8, T-022); poi esce senza chiamare la piattaforma.
 * `riarmaTutto` alla prima riconciliazione del processo (D-NOTIF-1 n. 5).
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
  const armabile = now + MIN_ANTICIPO_ARMATURA_MS;
  const cambiata = (d: NotificaPianificata): boolean => {
    const r = perChiave.get(d.chiave);
    return !r || !stessaVoce(d, r);
  };
  // Una voce cambiata che scatta entro 5 s non si può riarmare (§13.3): la versione vecchia, se è ancora pendente sulla
  // piattaforma, si cancella (C4: «Anticipa» porta «inizio» ad adesso) e la sua riga esce dal registro
  const superate = desiderate
    .filter((d) => d.istante < armabile && cambiata(d))
    .map((d) => perChiave.get(d.chiave))
    .filter((r): r is VoceRegistro => r !== undefined && r.istante > now);
  const pendenti = [...registro.filter((r) => !volute.has(r.chiave) && r.istante > now), ...superate];
  const via = [...pendenti, ...registro.filter((r) => !volute.has(r.chiave) && r.istante < ieri)];
  const ids = assignNativeIds(
    desiderate.map((d) => d.chiave),
    new Map(registro.map((r) => [r.chiave, r.idNativo])),
  );
  const daArmare = desiderate
    .filter((d) => d.istante >= armabile && (riarmaTutto || cambiata(d)))
    .map((d) => ({ ...d, idNativo: ids.get(d.chiave) ?? nativeId(d.chiave) }));
  return { daCancellare: pendenti.map((r) => r.idNativo), daTogliere: via.map((r) => r.chiave), daArmare };
}
