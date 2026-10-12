// Sessione di studio (S15 Sessione Panel/Mobile/Desktop, 05 Sessione `setup`; FUNZ §11.1, MECC §10.1). Il setup su
// `/sessione/setup?blocco=<id>` (sessione sul blocco: il contesto lo decide l'orologio) o `?unita=<id>` (sessione
// libera, anche senza unità): cosa studiare, quanto, modalità, iperfocus; «Inizia» scrive la sessione attiva e porta a
// `/sessione`. Con una sessione già attiva il setup porta lì (D6). `/sessione` è il timer (T-017, MECC §10.2–§10.5),
// il banner «Sessione in corso» lo riapre; sotto il timer le schede Materiale · AI · Note (T-055). Le regole stanno in
// `domain/session.ts`, `domain/timer.ts` e `app/session.ts`. Decisioni: D-SESS-1, D-TIMER-1.
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  AlignLeft,
  Book,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleAlert,
  Clock,
  Lock,
  Pause,
  Play,
  RefreshCcw,
  Repeat,
  SkipForward,
  Target,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { unitScope } from '../app/ai';
import { readUnitMaterial, type MaterialeUnita } from '../app/courses';
import { appDb, watch } from '../app/db';
import { logError } from '../app/diagnostics';
import {
  abandonSession,
  anticipateSession,
  editActiveSession,
  endSession,
  startSession,
  setupInputs,
  type SessioneChiusaConStreak,
  type CorsoSetup,
  type IngressiSetup,
  type UnitaSetup,
  type VistaSessione,
} from '../app/session';
import { disableDoNotDisturb, enableDoNotDisturb, keepScreenOn } from '../app/sessionDevice';
import { countsByDefault, outcomeHints, sessionMinutes, type DatiEsito } from '../domain/outcome';
import { completedUnits } from '../domain/pointer';
import {
  lockedUnit,
  startContext,
  startPlan,
  type AzioneStudio,
  type Modalita,
  type SessioneAttiva,
} from '../domain/session';
import { MINUTE, localTimeKey } from '../domain/time';
import {
  abandonPlan,
  addInterruption,
  changeUnit,
  countInterval,
  currentStudyUnit,
  excludeInterval,
  exitLocked,
  focusPercent,
  pauseSession,
  segmentTimeline,
  resumeSession,
  SOGLIA_ABBANDONO,
  skipSegment,
  summary,
  timerState,
} from '../domain/timer';
import { GLOBALE, type AmbitoAperto } from '../domain/ai';
import type { Blocco, Esito } from '../domain/types';
import { ANNULLA_MS } from './avvisi';
import { ChatPanel } from './Chat';
import { cifre } from './Cifre';
import { adesso, useMinuto, useSecondo } from './clock';
import {
  durata as durataBreve,
  fmtData,
  fuso,
  NOME_ESITO,
  NOME_SEZIONE,
  orologio,
  titolo as titoloBlocco,
} from './format';
import { t, type Chiave } from './i18n';
import { CaricaCodice } from './Materials';
import { testoTimer, useSessionView } from './SessionBanner';
import s from './Session.module.css';

/** Un'azione della sessione che fallisce va in Diagnostica e la schermata prosegue col ripiego (INV-16; audit P2-5). */
const traccia =
  <T,>(ripiego: T) =>
  (e: unknown): T => {
    logError('interfaccia', e);
    return ripiego;
  };

/**
 * Esegue un'azione di sessione di un blocco di studio (S1 card Adesso, S5 footer): la ripresa porta al timer,
 * «Anticipa» sposta il blocco e poi apre il setup (§10.1), libera e ripasso aprono il setup sull'unità del blocco.
 */
export function useStudyAction(): (azione: AzioneStudio, b: Pick<Blocco, 'id' | 'unitaId'>) => void {
  const navigate = useNavigate();
  return (azione, b) => {
    if (azione === 'riprendi' || azione === 'inizia' || azione === 'recupera')
      return void navigate(`/sessione/setup?blocco=${encodeURIComponent(b.id)}`);
    if (azione === 'anticipa')
      return void anticipateSession(appDb, b.id, adesso(), fuso())
        .catch(traccia(false))
        .then(() => navigate(`/sessione/setup?blocco=${encodeURIComponent(b.id)}`));
    navigate(b.unitaId ? `/sessione/setup?unita=${encodeURIComponent(b.unitaId)}` : '/sessione/setup');
  };
}

/** Durate fisse del mock fuori dalla routine (S15): 25 · 50 · 90, personalizzata, cronometro (`null`). */
const DURATE = [25, 50, 90] as const;
const MODALITA: { id: Modalita; num?: string }[] = [
  { id: 'continua' },
  { id: 'p25', num: '25 · 5' },
  { id: 'p50', num: '50 · 10' },
  { id: 'p90', num: '90 · 20' },
];
const DURATA_PREDEFINITA = 50;

/** Durata come la scrive il mock: «45 min», «1h», «1h 30m». */
const inMinuti = (min: number) => (min < 60 ? `${min} ${t('minutiUnita')}` : durataBreve(min));

function useIngressi(bloccoId: string | null): IngressiSetup | undefined {
  const [ingressi, setIngressi] = useState<IngressiSetup>();
  useEffect(() => watch(() => setupInputs(appDb, bloccoId), setIngressi), [bloccoId]);
  return ingressi;
}

const unitaDi = (corsi: readonly CorsoSetup[], id: string | null) => {
  for (const c of corsi) {
    const u = c.unita.find((x) => x.id === id);
    if (u) return { corso: c, unita: u };
  }
  return null;
};

export function SessionSetup() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const bloccoId = params.get('blocco');
  const ingressi = useIngressi(bloccoId);
  const now = useMinuto();
  const [scelta, setScelta] = useState<string | null>();
  const [elenco, setElenco] = useState(false);
  const [durata, setDurata] = useState<number | null | 'personalizzata'>(DURATA_PREDEFINITA);
  const [minuti, setMinuti] = useState(DURATA_PREDEFINITA);
  const [modalita, setModalita] = useState<Modalita>('continua');
  const [iperfocus, setIperfocus] = useState(false);
  const [inAvvio, setInAvvio] = useState(false);

  if (!ingressi) return null;
  if (ingressi.attiva) return <Navigate to="/sessione" replace />;

  const b = ingressi.blocco?.tipo === 'studio' ? ingressi.blocco : null;
  const bloccata = lockedUnit(b, now);
  // Il contesto dice l'origine; da un blocco chiuso o in anticipo la sessione è libera (§10.1)
  const contesto = startContext(b, now);
  const predefinita = bloccata ?? params.get('unita') ?? b?.unitaId ?? null;
  const unitaId = bloccata ?? (scelta !== undefined ? scelta : predefinita);
  const materia = unitaDi(ingressi.corsi, unitaId);

  // Quanto e fino a quando li decide il dominio (routine: fine del blocco); all'avvio passa la scelta dell'utente, così
  // se la fine passa fra il disegno e il clic il recupero parte con la durata scelta
  const routine = contesto === 'routine';
  const senzaFine = !routine && durata === null;
  const sceltaUtente = {
    unitaId,
    corsoId: materia?.corso.id ?? null,
    durata: durata === 'personalizzata' ? minuti : durata,
    modalita,
    // L'iperfocus blocca l'uscita «fino alla fine»: col cronometro non c'è una fine (D-TIMER-1)
    iperfocus: iperfocus && !senzaFine,
  };
  const anteprima = startPlan(b, sceltaUtente, now).sessione;
  // Libera: ancorata al focus (§10.2), la fine prevista è quella senza pause
  const fineMs = anteprima.fine ?? (anteprima.durata === null ? null : now + anteprima.durata * MINUTE);
  const fine = fineMs === null ? '—' : localTimeKey(fineMs);

  const origine =
    contesto === 'routine' && b
      ? t('origineRoutine', { titolo: titoloBlocco(b), ora: b.orarioInizio })
      : contesto === 'recupero' && b
        ? // Con lo stato dell'occorrenza: «… di lun 21 set saltata» (S15 `recovery`)
          t(
            b.stato === 'saltato'
              ? 'origineRecuperoSaltata'
              : b.stato === 'perso'
                ? 'origineRecuperoPersa'
                : 'origineRecupero',
            {
              data: fmtData.format(b.inizio),
            },
          )
        : t(params.get('unita') ? 'origineLiberaUnita' : 'origineLibera');
  const titoloUnita: Chiave =
    bloccata === null ? 'cosaStudiare' : contesto === 'routine' ? 'unitaProposta' : 'unitaOccorrenza';

  const avvia = () => {
    if (inAvvio) return;
    setInAvvio(true);
    void startSession(appDb, b?.id ?? null, sceltaUtente, adesso(), fuso())
      .then(() => navigate('/sessione', { replace: true }))
      .catch((e: unknown) => {
        logError('interfaccia', e);
        setInAvvio(false);
      });
  };

  const scegli = (id: string | null) => {
    setScelta(id);
    setElenco(false);
  };
  const scheda = (u: UnitaSetup, corso: CorsoSetup, scelta: boolean) => (
    <SchedaUnita
      key={u.id}
      u={u}
      corso={corso}
      premuta={elenco ? scelta : undefined}
      disabilitata={bloccata !== null}
      onScegli={scegli}
    />
  );
  const nessuna = <SchedaNessuna premuta={elenco ? unitaId === null : undefined} onScegli={scegli} />;

  return (
    <div className={s.pagina}>
      <div className={s.barra}>
        <button type="button" className={s.indietro} aria-label={t('indietro')} onClick={() => navigate(-1)}>
          <ChevronLeft size={18} />
        </button>
      </div>
      <div className={s.corpo}>
        <div className={s.gruppo}>
          <span className={s.badge}>{t('tipoStudio')}</span>
          <h1 className={s.titolo}>{t('sessioneDiStudio')}</h1>
          <span className={s.origine} data-contesto={contesto}>
            {contesto === 'recupero' ? (
              <RefreshCcw size={14} />
            ) : contesto === 'routine' ? (
              <Repeat size={14} />
            ) : (
              <Play size={14} />
            )}
            <span>{origine}</span>
          </span>
        </div>

        <div className={s.gruppo}>
          <div className={s.intestazione}>
            <span className={s.etichetta}>
              <Target size={14} />
              {t(titoloUnita)}
            </span>
            {bloccata !== null ? (
              <span className={s.notaScura}>{t('assegnataPuntatore')}</span>
            ) : (
              ingressi.corsi.length > 0 && (
                <button type="button" className={s.cambia} aria-expanded={elenco} onClick={() => setElenco((x) => !x)}>
                  {t(elenco ? 'chiudi' : 'scegli')}
                </button>
              )
            )}
          </div>
          {elenco ? (
            <>
              {nessuna}
              {ingressi.corsi.map((c) => (
                <div key={c.id} className={s.corso}>
                  <span className={s.nota}>{c.titolo}</span>
                  {c.unita.map((u) => scheda(u, c, u.id === unitaId))}
                </div>
              ))}
            </>
          ) : materia ? (
            scheda(materia.unita, materia.corso, true)
          ) : (
            nessuna
          )}
        </div>

        <div className={s.gruppo}>
          <div className={s.intestazione}>
            <span className={s.etichetta}>
              <Clock size={14} />
              {t('durataCampo')}
            </span>
            <span className={s.fine}>
              {t('finePrevista')} <span className={s.valore}>{fine}</span>
            </span>
          </div>
          <div className={s.chips}>
            {routine ? (
              <button type="button" className={`${s.chip} ${s.cifre}`} aria-pressed>
                {t('dellaRoutine')} · {anteprima.durata}
              </button>
            ) : (
              [...DURATE, 'personalizzata' as const, null].map((d) => (
                <button
                  key={String(d)}
                  type="button"
                  className={`${s.chip} ${s.cifre}`}
                  aria-pressed={durata === d}
                  onClick={() => setDurata(d)}
                >
                  {d === null ? t('cronometro') : d === 'personalizzata' ? t('personalizzata') : d}
                </button>
              ))
            )}
          </div>
          {!routine && durata === 'personalizzata' && (
            <label className={s.campo}>
              <span className={s.nota}>{t('minutiPersonalizzati')}</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                value={minuti}
                onChange={(e) => setMinuti(Math.min(600, Math.max(1, Math.round(Number(e.target.value) || 1))))}
              />
            </label>
          )}
        </div>

        <div className={s.gruppo}>
          <span className={s.etichetta}>
            <AlignLeft size={14} />
            {t('modalita')}
          </span>
          <div className={s.chips}>
            {MODALITA.map((m) => (
              <button
                key={m.id}
                type="button"
                className={s.chip}
                aria-pressed={modalita === m.id}
                onClick={() => setModalita(m.id)}
              >
                {t(m.num ? 'pomodoro' : 'continua')}
                {m.num && <span className={s.num}>{m.num}</span>}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={sceltaUtente.iperfocus}
          disabled={senzaFine}
          className={s.interruttore}
          onClick={() => setIperfocus((x) => !x)}
        >
          <span className={s.colonna}>
            <span>{t('iperfocus')}</span>
            <span className={s.notaScura}>{t(senzaFine ? 'sbloccoSenzaFine' : 'iperfocusNota')}</span>
          </span>
          <span className={s.knob} />
        </button>
      </div>
      <div className={s.piede}>
        <button type="button" className={s.inizia} disabled={inAvvio} onClick={avvia}>
          <Play size={14} fill="currentColor" />
          {t('sessioneInizia')} ·{' '}
          <span className={s.cifre}>
            {anteprima.durata === null ? t('cronometro').toLowerCase() : inMinuti(anteprima.durata)}
          </span>
        </button>
      </div>
    </div>
  );
}

/** Card dell'unità (S15): surface-2, eyebrow «Modulo 00 · Unità 0.7», tag del puntatore, titolo e corso. */
function SchedaUnita(p: {
  u: UnitaSetup;
  corso: CorsoSetup;
  premuta: boolean | undefined;
  disabilitata?: boolean;
  onScegli: (id: string) => void;
}) {
  const { u, corso } = p;
  return (
    <button
      type="button"
      className={s.unita}
      aria-pressed={p.premuta}
      disabled={p.disabilitata}
      onClick={() => p.onScegli(u.id)}
    >
      <span className={s.unitaTesta}>
        <span className={s.eyebrow}>
          {t('modulo')} <span className={s.num}>{String(u.moduloNumero).padStart(2, '0')}</span> · {t('unita')}{' '}
          <span className={s.num}>{u.numero}</span>
        </span>
        {(corso.proposta === u.id || p.disabilitata) && <span className={s.tag}>{t('dalPuntatore')}</span>}
      </span>
      <span className={s.unitaTitolo}>{u.titolo}</span>
      {/* Il corso con le unità fatte sul totale (S15 «6 / 13 unità») */}
      <span className={s.unitaCorso}>
        {corso.titolo} ·{' '}
        <span className={s.num}>
          {t('unitaDelModulo', {
            fatte: completedUnits(corso.unita),
            totali: corso.unita.length,
          })}
        </span>
      </span>
    </button>
  );
}

function SchedaNessuna(p: { premuta: boolean | undefined; onScegli: (id: null) => void }) {
  return (
    <button type="button" className={s.unita} aria-pressed={p.premuta} onClick={() => p.onScegli(null)}>
      <span className={s.unitaTitolo}>{t('nessunaUnita')}</span>
    </button>
  );
}

const minutiDi = (ms: number) => Math.round(ms / MINUTE);

/** «Modulo 00 · Unità 0.7 · routine 16:00» (S15). */
function Sottotitolo({ v }: { v: VistaSessione }) {
  const origine =
    v.sessione.contesto === 'routine'
      ? t('fonteRoutine', { ora: v.orario ?? '' })
      : t(v.sessione.contesto === 'recupero' ? 'fonteRecupero' : 'fonteLibera');
  return (
    <span className={s.sottotitolo}>
      {v.unita && (
        <>
          {t('modulo')} <span className={s.num}>{String(v.unita.moduloNumero).padStart(2, '0')}</span> · {t('unita')}{' '}
          <span className={s.num}>{v.unita.numero}</span> ·{' '}
        </>
      )}
      {origine}
    </span>
  );
}

/**
 * Timer della sessione (S15 `timer`, `iperfocus`, sheet di chiusura; MECC §10.2–§10.5): i valori li deriva
 * `domain/timer.ts` dagli istanti salvati, ogni secondo. Schermo acceso finché il timer è aperto; in iperfocus schermo
 * intero, indietro assorbito, Non Disturbare se concesso, uscita con conferma. «Termina» apre lo sheet dell'esito (S16),
 * «Registra esito» chiude la sessione con l'esito e mostra la schermata finale (`done`). «Abbandona» dal 65% della durata
 * pianificata dice «Chiudi come Continua (n%)» e finisce nella stessa schermata (D-SESS-2, divergenza 38). Alla
 * riapertura dopo più di 30' senza battiti un avviso mostra l'intervallo non verificato (ora circa, durata, tempo
 * residuo) con «Conta nel focus», anche nell'iperfocus (§10.4, D-TIMER-2, divergenza 38). Decisioni: D-TIMER-1,
 * D-TIMER-2, D-ESITO-1, D-SESS-2.
 */
export function ActiveSession() {
  const vista = useSessionView();
  const ingressi = useIngressi(null);
  const navigate = useNavigate();
  const now = useSecondo();
  const [foglio, setFoglio] = useState(false);
  const [elenco, setElenco] = useState(false);
  const [uscita, setUscita] = useState<'no' | 'tentativo' | 'registrata'>('no');
  const [dnd, setDnd] = useState(false);
  const [inChiusura, setInChiusura] = useState(false);
  /** La chiusura registrata; `percento` solo per l'abbandono oltre soglia (D-SESS-2). */
  const [fatto, setFatto] = useState<{
    dati: DatiEsito;
    puntatore: string | null;
    minuti: number;
    percento: number | null;
    libera: boolean;
    /** La sessione aveva un'unità: senza, «proporrà l'unità giusta» non vale (C9). */
    unita: boolean;
    streak: { giorni: number; piu: boolean };
  } | null>(null);
  const attiva = Boolean(vista);
  const bloccata = vista ? exitLocked(vista.sessione, now) : false;

  useEffect(() => (attiva ? keepScreenOn() : undefined), [attiva]);
  useEffect(() => {
    if (!bloccata) return;
    let vivo = true;
    void enableDoNotDisturb().then((x) => {
      if (vivo) setDnd(x);
    });
    return () => {
      vivo = false;
      disableDoNotDisturb();
    };
  }, [bloccata]);
  useEffect(() => {
    if (!bloccata) return;
    // Indietro inattivo (D5): una voce di cronologia in più assorbe l'indietro, che chiede conferma
    const trattieni = () => window.history.pushState(window.history.state, '', window.location.href);
    trattieni();
    const indietro = () => {
      trattieni();
      setUscita('tentativo');
    };
    window.addEventListener('popstate', indietro);
    return () => window.removeEventListener('popstate', indietro);
  }, [bloccata]);
  useEffect(() => {
    if (uscita !== 'registrata') return;
    const id = setTimeout(() => setUscita('no'), ANNULLA_MS);
    return () => clearTimeout(id);
  }, [uscita]);

  if (fatto)
    return (
      <div className={s.fatto}>
        <span className={s.fattoIcona}>
          <Check size={30} strokeWidth={2.5} />
        </span>
        <span className={s.fattoTesti}>
          <h1 className={s.fattoTitolo}>{t('esitoDi', { esito: etichettaEsito(fatto.dati.esito) })}</h1>
          <span className={s.fattoTesto}>
            {fatto.percento !== null
              ? t('esitoAutomaticoTesto', { pct: fatto.percento })
              : !fatto.dati.contaNelPiano
                ? t('contaNo')
                : !fatto.libera && (fatto.dati.esito === 'completata' || fatto.dati.esito === 'continua')
                  ? t('esitoFattoTesto')
                  : fatto.unita
                    ? t('esitoLiberaTesto')
                    : null}
          </span>
        </span>
        <span className={`${s.righe} ${s.fattoRighe}`}>
          <Riga etichetta={t('giorniDiFila')} valore={String(fatto.streak.giorni)} piu={fatto.streak.piu} />
          <Riga etichetta={t('durataCampo')} valore={`${fatto.minuti} ${t('minutiUnita')}`} />
          <Riga etichetta={t('sicurezza')} valore={etichettaConfidenza(fatto.dati.confidenza)} />
          {fatto.puntatore && <Riga etichetta={t('puntatore')} valore={fatto.puntatore} puntatore />}
        </span>
        <button type="button" className={s.abbandona} onClick={() => navigate('/', { replace: true })}>
          {t('tornaOggi')}
        </button>
      </div>
    );
  if (vista === undefined) return null;
  // Durante la chiusura la sessione sparisce prima che arrivi la schermata finale
  if (vista === null) return inChiusura ? null : <Navigate to="/" replace />;

  const sx = vista.sessione;
  const st = timerState(sx, now);
  const tempo = testoTimer(st);
  const titolo = vista.unita?.titolo ?? t('sessioneDiStudio');
  const piano = sx.durata === null ? '' : inMinuti(sx.durata);
  const meta =
    st.restante === null
      ? t('metaCronometro')
      : st.finita
        ? t('oltreTotali', { durata: piano, totale: orologio(st.focus) })
        : t('restanoDi', { durata: piano });
  const stato = st.finita && st.restante !== null ? 'extra' : st.inPausa ? 'pausa' : 'corre';
  const barra = st.avanzamento !== null && (
    <div className={s.barraTimer}>
      <div className={s.riempimento} style={{ width: `${Math.round(st.avanzamento * 100)}%` }} />
    </div>
  );
  // Bloccata solo con una fine (`exitLocked`)
  const sblocco = t('sbloccoAlle', { ora: localTimeKey(st.fine ?? now) });

  const modifica = (f: (x: SessioneAttiva, n: number) => SessioneAttiva) => {
    const n = adesso();
    void editActiveSession(appDb, (x) => f(x, n), n).catch(traccia(null));
  };
  // Chiusa con un esito resta la schermata finale (S15 `done`), con la streak della chiusura: «+1» solo se l'ha fatta
  // crescere (§12, handoff §3 n. 48); senza esito (abbandono sotto la soglia, già chiusa altrove, errore) si torna a Oggi
  const chiudi = (
    chiusura: (n: number) => Promise<SessioneChiusaConStreak | null>,
    { puntatore = null, percento = false }: { puntatore?: string | null; percento?: boolean } = {},
  ) => {
    if (inChiusura) return;
    setInChiusura(true);
    void chiusura(adesso())
      .catch(traccia(null))
      .then((c) =>
        c?.esito
          ? setFatto({
              dati: c.esito,
              puntatore,
              minuti: minutiDi(c.riepilogo.focus),
              percento: percento ? focusPercent(c, c.chiusaIl) : null,
              libera: c.bloccoId === null,
              unita: c.unitaId !== null,
              streak: c.streak,
            })
          : navigate('/', { replace: true }),
      );
  };
  // Oltre la soglia l'abbandono registra Continua (D-SESS-2): la schermata finale lo conferma col focus in percentuale
  const abbandona = () => chiudi((n) => abandonSession(appDb, n, fuso()), { percento: true });
  const registra = (dati: DatiEsito, puntatore: string | null) =>
    chiudi((n) => endSession(appDb, n, fuso(), dati), { puntatore });
  const interruzione = (
    <button type="button" className={s.pill} onClick={() => modifica((x, n) => addInterruption(x, n))}>
      <CircleAlert size={12} strokeWidth={2} />
      {t('interruzione')} <span className={s.contoPill}>{sx.interruzioni.length}</span>
    </button>
  );
  const pillIperfocus = (
    <span className={s.pillIperfocus}>
      <Lock size={12} strokeWidth={2} />
      {t('iperfocus')}
    </span>
  );
  // Intervalli non verificati alla riapertura (§10.4, D-TIMER-2; S15): ora dell'ultimo battito, durata per eccesso,
  // tempo residuo; restano finché l'utente non li conta o li lascia fuori (handoff §3 n. 40). Anche nell'iperfocus,
  // dove l'ora di sblocco ne dipende
  const residuo = st.restante === null ? null : inMinuti(minutiDi(st.restante));
  const avvisiNonVerificati = sx.intervalliNonVerificati
    .filter((i) => !i.contato && !i.escluso)
    .map((i) => {
      const dati = { ora: localTimeKey(i.da), min: Math.ceil((i.a - i.da) / MINUTE) };
      return (
        <div key={i.da} className={s.nonVerificato} role="status">
          <span className={s.testoNonVerificato}>
            <Clock size={16} className={s.iconaNonVerificato} />
            <span>
              {cifre(
                residuo === null
                  ? t('nonVerificatoSenzaFine', dati)
                  : t('nonVerificato', { ...dati, restante: residuo }),
                s.num,
              )}
            </span>
          </span>
          <span className={s.azioniNonVerificato}>
            <button type="button" className={s.lasciaFuori} onClick={() => modifica((x) => excludeInterval(x, i.da))}>
              {t('lasciaFuori')}
            </button>
            <button type="button" className={s.contaStudio} onClick={() => modifica((x) => countInterval(x, i.da))}>
              {t('contaComeStudio')}
            </button>
          </span>
        </div>
      );
    });

  if (bloccata)
    return (
      <div className={s.iperfocus}>
        <div className={s.iperTesta}>
          {pillIperfocus}
          <span className={s.iperDnd}>{t(dnd ? 'nonDisturbareAttivo' : 'nonDisturbareNo')}</span>
        </div>
        <div className={s.iperCentro}>
          <div className={s.iperTitoli}>
            <span className={s.iperTitolo}>{titolo}</span>
            <Sottotitolo v={vista} />
          </div>
          <span className={s.tempoGrande} data-stato={stato}>
            {tempo}
          </span>
          {barra}
          <span className={s.meta}>{meta}</span>
          <span className={s.sblocco}>{sblocco}</span>
        </div>
        {avvisiNonVerificati}
        <div className={s.iperPiede}>
          {interruzione}
          <button type="button" className={s.pillEsci} onClick={() => setUscita('tentativo')}>
            {t('esci')}
          </button>
        </div>
        {uscita === 'tentativo' && (
          <Foglio titolo="uscita-titolo" scuro onEsc={() => setUscita('no')}>
            <div className={s.foglioTesta}>
              <span id="uscita-titolo" className={s.foglioTitolo}>
                {t('uscitaBloccata')}
              </span>
              <span className={s.foglioNota}>
                {sblocco}. {t('uscitaTesto')}
              </span>
            </div>
            <div className={s.foglioAzioni}>
              <button
                type="button"
                className={s.esciComunque}
                onClick={() => {
                  modifica((x, n) => addInterruption(x, n, true));
                  setUscita('registrata');
                }}
              >
                {t('esciComunque')}
              </button>
              <button type="button" className={s.inizia} onClick={() => setUscita('no')}>
                {t('resta')}
              </button>
            </div>
          </Foglio>
        )}
      </div>
    );

  const segmenti = segmentTimeline(sx);
  const seg = st.segmento;
  const r = foglio ? summary(sx, now) : null;
  // Il link dice che cosa farà «Abbandona» adesso (§10.5, D-SESS-2)
  const conEsito = r !== null && abandonPlan(sx, now).esito !== null;

  return (
    <div className={s.timer}>
      <div className={s.testaTimer} data-stato={stato}>
        <button type="button" className={s.indietro} aria-label={t('riduci')} onClick={() => navigate('/')}>
          <ChevronDown size={18} />
        </button>
        <span className={s.titoli}>
          <span className={s.titoloTimer}>{titolo}</span>
          <Sottotitolo v={vista} />
        </span>
        <div className={s.quadrante}>
          <span className={s.tempoBox}>
            <span className={s.tempo} data-stato={stato}>
              {tempo}
            </span>
            <span className={s.meta}>
              {meta}
              {stato === 'extra' ? (
                <span className={s.badgeExtra}>{t('tempoExtra')}</span>
              ) : stato === 'pausa' ? (
                <span className={s.badgePausa}>{t('inPausa')}</span>
              ) : (
                <span className={s.pulsa} />
              )}
            </span>
          </span>
          <span className={s.comandi}>
            <button
              type="button"
              className={s.tondo}
              aria-label={t(st.inPausa ? 'riprendi' : 'pausa')}
              onClick={() => modifica(st.inPausa ? resumeSession : pauseSession)}
            >
              {st.inPausa ? <Play size={16} fill="currentColor" /> : <Pause size={16} strokeWidth={2.25} />}
            </button>
            <button type="button" className={s.termina} onClick={() => setFoglio(true)}>
              {t('termina')}
            </button>
          </span>
        </div>
        {barra}
        <div className={s.strumenti}>
          {seg && (
            <>
              <span className={s.segmenti}>
                {segmenti.map((x, i) => (
                  <span
                    key={i}
                    className={s.segmento}
                    data-tipo={x.tipo}
                    data-fase={i < seg.indice ? 'fatto' : i === seg.indice ? 'corrente' : undefined}
                    style={{ width: Math.max(6, Math.round((x.fine - x.inizio) / MINUTE / 5)) }}
                  />
                ))}
                <span className={s.segConto}>
                  {seg.indice + 1} / {seg.totale}
                </span>
              </span>
              <button
                type="button"
                className={s.pill}
                disabled={seg.indice >= seg.totale - 1}
                onClick={() => modifica(skipSegment)}
              >
                {t('saltaSegmento')}
              </button>
            </>
          )}
          {interruzione}
          <button type="button" className={s.pill} aria-expanded={elenco} onClick={() => setElenco((x) => !x)}>
            {t('cambiaUnita')}
          </button>
          {sx.iperfocus && pillIperfocus}
        </div>
      </div>

      {avvisiNonVerificati}

      {!elenco && <Schede unitaId={currentStudyUnit(sx)} note={sx.note ?? ''} />}

      {elenco && ingressi && (
        <div className={s.elencoUnita}>
          <SchedaNessuna
            premuta={currentStudyUnit(sx) === null}
            onScegli={() => {
              modifica((x, n) => changeUnit(x, n, null));
              setElenco(false);
            }}
          />
          {ingressi.corsi.map((c) => (
            <div key={c.id} className={s.corso}>
              <span className={s.nota}>{c.titolo}</span>
              {c.unita.map((u) => (
                <SchedaUnita
                  key={u.id}
                  u={u}
                  corso={c}
                  premuta={currentStudyUnit(sx) === u.id}
                  onScegli={(id) => {
                    modifica((x, n) => changeUnit(x, n, id));
                    setElenco(false);
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {uscita === 'registrata' && (
        <div className={s.avviso} role="status">
          <CircleAlert size={16} />
          <span>{t('uscitaRegistrata')}</span>
        </div>
      )}

      {r && (
        <Foglio titolo="esito-titolo" onEsc={() => setFoglio(false)}>
          <SchedaEsito
            titoloId="esito-titolo"
            minuti={minutiDi(r.focus)}
            extra={minutiDi(r.extra)}
            perUnita={sessionMinutes(r).perUnita}
            unitaId={sx.unitaId}
            conta={sx.bloccoId ? 'routine' : 'libera'}
            contaIniziale={countsByDefault(sx)}
            confidenza
            annulla="continuaStudiare"
            onAnnulla={() => setFoglio(false)}
            inCorso={inChiusura}
            onRegistra={registra}
            // Il codice va nei «Tuoi» dell'unità studiata: senza unità non c'è dove allegarlo (CONTROLLI S15)
            codice={vista.unita && <CaricaCodice corsoId={vista.unita.corsoId} unitaId={vista.unita.id} />}
          >
            <button type="button" className={s.abbandonaLink} disabled={inChiusura} onClick={abbandona}>
              {conEsito
                ? t('chiudiComeContinua', { soglia: SOGLIA_ABBANDONO })
                : t(sx.bloccoId ? 'abbandonaBlocco' : 'abbandonaSessione')}
            </button>
          </SchedaEsito>
        </Foglio>
      )}
    </div>
  );
}

/** Gli esiti nell'ordine del foglio, con le icone; i nomi da `NOME_ESITO` (audit P3-12). */
const ESITI: { id: Esito; Icona: LucideIcon }[] = [
  { id: 'completata', Icona: Check },
  { id: 'continua', Icona: ArrowRight },
  { id: 'indietro', Icona: ArrowLeft },
  { id: 'salta', Icona: SkipForward },
];
const CONFIDENZA: Chiave[] = ['confidenza1', 'confidenza2', 'confidenza3', 'confidenza4', 'confidenza5'];
const etichettaEsito = (e: Esito): string => t(NOME_ESITO[e]);
const etichettaConfidenza = (c: number | null): string => {
  const chiave = c ? CONFIDENZA[c - 1] : undefined;
  return chiave ? t(chiave) : '—';
};

/**
 * Contenuto dello sheet dell'esito (S16 debrief; MECC §11, FUNZ §11.3): i quattro esiti con l'unità che nominano,
 * confidenza 1–5, nota, «Conta nel piano»; «Registra esito» si accende con un esito scelto. Lo usano la chiusura del
 * timer e «Registra esito» del Dettaglio, che non ha «Conta nel piano» (conta sempre) e, senza unità, nemmeno la
 * confidenza (§11). `onRegistra` riceve anche il testo del puntatore per la schermata finale. Decisione: D-ESITO-1.
 */
export function SchedaEsito(p: {
  titoloId: string;
  minuti: number;
  extra: number;
  unitaId: string | null;
  conta: 'routine' | 'libera' | null;
  contaIniziale: boolean;
  confidenza: boolean;
  annulla: Chiave;
  onAnnulla: () => void;
  inCorso: boolean;
  onRegistra: (dati: DatiEsito, puntatore: string | null) => void;
  children?: ReactNode;
  /**
   * Variante del foglio aperto dal cerchio di Oggi (S1 `sheet=esito`): la testa la dà il chiamante, niente confidenza
   * né nota, e i sottotitoli di Indietro e Salta nominano l'unità («La 0.6 torna da rivedere», TESTI).
   */
  compatta?: ReactNode;
  /** Minuti per unità come li accredita l'esito (`sessionMinutes`): con un'altra unità il riquadro (S15, D3). */
  perUnita?: Record<string, number>;
  /** La riga «Carica il codice prodotto» della chiusura della sessione (S15), sopra i bottoni. */
  codice?: ReactNode;
}) {
  const ingressi = useIngressi(null);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [confidenza, setConfidenza] = useState<number | null>(null);
  const [nota, setNota] = useState('');
  const [conta, setConta] = useState(p.contaIniziale);
  const materia = unitaDi(ingressi?.corsi ?? [], p.unitaId);
  const numero = (id: string) => materia?.corso.unita.find((u) => u.id === id)?.numero ?? '';
  const numeroDi = (id: string) => ingressi?.corsi.flatMap((c) => c.unita).find((u) => u.id === id)?.numero ?? '';
  // Multi-materia (MECC §10.3, D3): l'esito resta sull'unità pianificata, le altre hanno solo i minuti
  const perUnita = Object.entries(p.perUnita ?? {}).filter(([, min]) => min > 0);
  const multiMateria = perUnita.some(([id]) => id !== p.unitaId);
  const h = materia && outcomeHints(materia.corso.unita, materia.unita.id);
  const sotto: Record<Esito, string | null> = h
    ? {
        completata: h.successiva ? t('puntatorePassaA', { n: numero(h.successiva) }) : t('puntatoreAvanza'),
        continua: t('restaSulla', { n: materia.unita.numero }),
        indietro: p.compatta
          ? t('tornaDaRivedere', { n: h.precedente ? numero(h.precedente) : materia.unita.numero })
          : h.precedente
            ? t('ripetiLa', { n: numero(h.precedente) })
            : t('ripetiQuesta'),
        salta: p.compatta ? t('escePercorso', { n: materia.unita.numero }) : t('passaOltre'),
      }
    : { completata: null, continua: null, indietro: null, salta: null };
  const contaVale = p.conta === null || conta;
  const registra = () =>
    esito &&
    p.onRegistra(
      { esito, confidenza: p.confidenza ? confidenza : null, nota, contaNelPiano: contaVale },
      contaVale ? sotto[esito] : null,
    );

  return (
    <>
      {p.compatta ?? (
        <div className={s.foglioTesta}>
          <span id={p.titoloId} className={s.foglioTitolo}>
            {t('comeAndata')}
          </span>
          <span className={s.foglioNota}>
            <span className={s.num}>
              {p.minuti} {t('minutiUnita')}
            </span>
            {materia && (
              <>
                {' '}
                · {t('unita')} <span className={s.num}>{materia.unita.numero}</span>
              </>
            )}
            {p.extra > 0 && ` · ${t('extraBreve', { min: p.extra })}`}
          </span>
        </div>
      )}
      {multiMateria && (
        <div className={s.perUnita}>
          <span className={s.etichettaPerUnita}>{t('minutiPerUnita')}</span>
          {perUnita.map(([id, min]) => (
            <span key={id} className={s.rigaPerUnita} data-pianificata={id === p.unitaId || undefined}>
              <span>
                {t('unita')} <span className={s.num}>{numeroDi(id)}</span> ·{' '}
                {t(id === p.unitaId ? 'pianificata' : 'soloMinuti')}
              </span>
              <span className={s.num}>
                {min} {t('minutiUnita')}
              </span>
            </span>
          ))}
        </div>
      )}
      <div className={s.esiti}>
        {ESITI.map(({ id, Icona }) => (
          <button key={id} type="button" className={s.esito} aria-pressed={esito === id} onClick={() => setEsito(id)}>
            <span className={s.esitoTesta}>
              <Icona size={16} strokeWidth={2} />
              {t(NOME_ESITO[id])}
            </span>
            {sotto[id] && <span className={s.esitoSotto}>{sotto[id]}</span>}
          </button>
        ))}
      </div>
      {p.confidenza && !p.compatta && (
        <div className={s.gruppoEsito}>
          <span className={s.intestazione}>
            <span className={s.etichetta}>{t('quantoSicuro')}</span>
            <span className={s.etichettaConfidenza}>{etichettaConfidenza(confidenza)}</span>
          </span>
          <span className={s.confidenze} role="group" aria-label={t('quantoSicuro')}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={s.confidenza}
                aria-pressed={confidenza === n}
                onClick={() => setConfidenza(n)}
              >
                {n}
              </button>
            ))}
          </span>
        </div>
      )}
      {!p.compatta && (
        <textarea
          className={s.notaEsito}
          placeholder={t('notaSessione')}
          aria-label={t('notaSessione')}
          value={nota}
          onChange={(e) => setNota(e.target.value)}
        />
      )}
      {p.conta && (
        <button
          type="button"
          role="switch"
          aria-checked={conta}
          className={s.interruttore}
          onClick={() => setConta((x) => !x)}
        >
          <span className={s.colonna}>
            <span>{t('contaNelPiano')}</span>
            <span className={s.notaScura}>
              {t(conta ? (p.conta === 'routine' ? 'contaRoutine' : 'contaLibera') : 'contaNo')}
            </span>
          </span>
          <span className={s.knob} />
        </button>
      )}
      {p.codice}
      <div className={s.foglioAzioni}>
        <button type="button" className={s.continua} onClick={p.onAnnulla}>
          {t(p.annulla)}
        </button>
        <button type="button" className={s.inizia} disabled={!esito || p.inCorso} onClick={registra}>
          {t('registraEsito')}
        </button>
      </div>
      {p.children}
    </>
  );
}

/** Sheet dal basso (S16 debrief, «Uscita bloccata»): prende il fuoco all'apertura, Esc la chiude. */
function Foglio(p: { titolo: string; scuro?: boolean; onEsc: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { onEsc } = p;
  useEffect(() => ref.current?.focus(), []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onEsc();
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onEsc]);
  return (
    <div className={s.velo} data-scuro={p.scuro ? '' : undefined}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={p.titolo} tabIndex={-1} className={s.foglio}>
        <span className={s.maniglia} />
        {p.children}
      </div>
    </div>
  );
}

function Riga(p: { etichetta: string; valore: string; puntatore?: boolean; piu?: boolean }) {
  return (
    <span className={s.riga}>
      {p.etichetta}
      <span className={s.rigaValore} data-puntatore={p.puntatore || undefined}>
        {p.valore}
        {p.piu && <span className={s.piuUno}>{t('piuUno')}</span>}
      </span>
    </span>
  );
}

type Lato = 'ai' | 'note';
const LATI: { id: Lato; chiave: Chiave }[] = [
  { id: 'ai', chiave: 'ai' },
  { id: 'note', chiave: 'note' },
];

/**
 * Le schede sotto il timer (S15 `tab`, FUNZ §11.2): il Materiale dell'unità studiata adesso, la chat AI sull'unità (T-026)
 * e le Note della sessione. Su mobile tre schede; da 1024 px
 * il Materiale a sinistra e AI · Note a destra (S15 Desktop). Ogni pannello è montato una volta sola: due campi delle
 * note si sovrascriverebbero. Il conteggio «2» della scheda AI del mock non dice che cosa conti: non c'è (handoff n. 65).
 */
function Schede({ unitaId, note }: { unitaId: string | null; note: string }) {
  const [materiale, setMateriale] = useState(true);
  const [lato, setLato] = useState<Lato>('ai');
  const scheda = (premuta: boolean, chiave: Chiave, onClick: () => void) => (
    <button key={chiave} type="button" className={s.scheda} aria-pressed={premuta} onClick={onClick}>
      {t(chiave)}
    </button>
  );
  return (
    <>
      <div className={s.schede} role="group" aria-label={t('schede')}>
        {scheda(materiale, 'materiale', () => setMateriale(true))}
        {LATI.map(({ id, chiave }) =>
          scheda(!materiale && lato === id, chiave, () => {
            setMateriale(false);
            setLato(id);
          }),
        )}
      </div>
      <div className={s.colonne} data-materiale={materiale}>
        <div className={s.colonnaMateriale}>
          <span className={s.etichettaColonna}>
            <Book size={14} />
            {t('materiale')}
          </span>
          <div className={s.contenutoScheda}>
            {unitaId ? (
              <Materiale unitaId={unitaId} />
            ) : (
              <span className={s.vuotoScheda}>{t('nessunaUnitaAssegnata')}</span>
            )}
          </div>
        </div>
        <div className={s.colonnaLato}>
          <div className={s.schedeLato} role="group" aria-label={t('schede')}>
            {LATI.map(({ id, chiave }) => scheda(lato === id, chiave, () => setLato(id)))}
          </div>
          {/* Montati una volta sola: rimontare le note le farebbe ripartire da un valore forse non ancora salvato */}
          <div className={s.contenutoScheda} data-scheda="ai" hidden={lato !== 'ai'}>
            <ChatSessione unitaId={unitaId} />
          </div>
          <div className={s.contenutoScheda} data-scheda="note" hidden={lato !== 'note'}>
            <Note note={note} />
          </div>
        </div>
      </div>
    </>
  );
}

/** Concetto core e sezioni dell'unità con le risorse (S15 `tab=material`); testo semplice, senza HTML del corso. */
function Materiale({ unitaId }: { unitaId: string }) {
  const [m, setM] = useState<MaterialeUnita | null>();
  useEffect(() => watch(() => readUnitMaterial(appDb, unitaId), setM), [unitaId]);
  if (!m) return null;
  return (
    <>
      {m.concettoCore && (
        <div className={s.gruppoMateriale}>
          <span className={s.etichettaMateriale}>{t('concettoCore')}</span>
          <p className={s.concettoCore}>{m.concettoCore.testo}</p>
        </div>
      )}
      {m.sezioni.map((x) => (
        <div key={x.id} className={s.gruppoMateriale}>
          <span className={s.testaSezione}>
            <span className={s.badgeSezione}>{t(NOME_SEZIONE[x.tipo])}</span>
            {x.titolo}
          </span>
          {x.risorse.map((r, i) => (
            <a key={i} className={s.risorsa} href={r.url} target="_blank" rel="noopener noreferrer">
              <span className={s.testiRisorsa}>
                <span className={s.titoloRisorsa}>{r.titolo}</span>
                <span className={s.hostRisorsa}>{r.host}</span>
              </span>
              <ArrowUpRight size={14} className={s.frecciaRisorsa} />
            </a>
          ))}
          {x.descrizione && <p className={s.descrizione}>{x.descrizione}</p>}
        </div>
      ))}
    </>
  );
}

/** Ms di quiete prima di salvare le note mentre si scrive; all'uscita dal campo si salva subito. */
const NOTE_MS = 600;

/** Le note della sessione (S15 `tab=notes`): markdown, salvate sulla sessione attiva, restano nella sessione chiusa. */
function Note({ note }: { note: string }) {
  const [testo, setTesto] = useState(note);
  const salva = () => {
    if (testo !== note) void editActiveSession(appDb, (x) => ({ ...x, note: testo }), adesso()).catch(traccia(null));
  };
  // All'uscita dalla schermata (indietro di sistema, app chiusa) il testo non ancora salvato si salva lo stesso
  const ultimo = useRef({ testo, note });
  useEffect(() => {
    ultimo.current = { testo, note };
  });
  useEffect(
    () => () => {
      const u = ultimo.current;
      if (u.testo !== u.note)
        void editActiveSession(appDb, (x) => ({ ...x, note: u.testo }), adesso()).catch(traccia(null));
    },
    [],
  );
  useEffect(() => {
    if (testo === note) return;
    const id = setTimeout(
      () => void editActiveSession(appDb, (x) => ({ ...x, note: testo }), adesso()).catch(traccia(null)),
      NOTE_MS,
    );
    return () => clearTimeout(id);
  }, [testo, note]);
  return (
    <>
      <span className={s.testaNote}>
        {t('noteSessione')}
        {testo === note && (
          <span className={s.salvate}>
            {t('salvate')} <span className={s.puntoSalvate}>●</span>
          </span>
        )}
      </span>
      <textarea
        className={s.areaNote}
        value={testo}
        placeholder={t('scriviMentreStudi')}
        aria-label={t('noteSessione')}
        onChange={(e) => setTesto(e.currentTarget.value)}
        onBlur={salva}
      />
    </>
  );
}

/**
 * La scheda AI della sessione (S15 `tab=ai`; CONTROLLI: ambito = unità della sessione, senza unità la chat globale): il
 * pannello della chat di S19 senza la riga dell'ambito; una conversazione nuova a ogni apertura della sessione (T-026).
 */
function ChatSessione({ unitaId }: { unitaId: string | null }) {
  const [ambito, setAmbito] = useState<AmbitoAperto>();
  const [conversazione, setConversazione] = useState<string | null>(null);
  useEffect(() => {
    void (unitaId ? unitScope(appDb, unitaId) : Promise.resolve(null)).then((a) => setAmbito(a ?? GLOBALE));
  }, [unitaId]);
  return ambito ? (
    <ChatPanel ambito={ambito} conversazioneId={conversazione} onConversazione={setConversazione} compatta />
  ) : null;
}
