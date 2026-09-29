// Sessione di studio (S15 Sessione Panel/Mobile/Desktop, 05 Sessione `setup`; FUNZ §11.1, MECC §10.1). Il setup su
// `/sessione/setup?blocco=<id>` (sessione sul blocco: il contesto lo decide l'orologio) o `?unita=<id>` (sessione
// libera, anche senza unità): cosa studiare, quanto, modalità, iperfocus; «Inizia» scrive la sessione attiva e porta a
// `/sessione`. Con una sessione già attiva il setup porta lì (D6). `/sessione` è il segnaposto del timer (T-017): cosa
// è in corso e «Abbandona». Le regole stanno in `domain/session.ts` e `app/session.ts`. Decisione: D-SESS-1.
import { ChevronLeft, Clock, Crosshair, ListIcon, Play, RefreshCcw, Repeat } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { appDb } from '../app/db';
import {
  abandonSession,
  anticipateSession,
  startSession,
  watchSetupInputs,
  type CorsoSetup,
  type IngressiSetup,
  type UnitaSetup,
} from '../app/session';
import { lockedUnit, startContext, startPlan, type AzioneStudio, type Modalita } from '../domain/session';
import { MINUTE, localTimeKey } from '../domain/time';
import type { Blocco } from '../domain/types';
import { useMinuto } from './clock';
import { durata as durataBreve, titolo as titoloBlocco } from './format';
import { lingua, t, type Chiave } from './i18n';
import s from './Session.module.css';

const fuso = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
/** L'istante del clic (fuori dal render: `react-hooks/purity`). */
const adesso = () => Date.now();
const fmtGiorno = new Intl.DateTimeFormat(lingua, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Esegue un'azione di sessione di un blocco di studio (S1 blocco Adesso, S5 footer): la ripresa porta al timer,
 * «Anticipa» sposta il blocco e poi apre il setup (§10.1), libera e ripasso aprono il setup sull'unità del blocco.
 */
export function useStudyAction(): (azione: AzioneStudio, b: Pick<Blocco, 'id' | 'unitaId'>) => void {
  const navigate = useNavigate();
  return (azione, b) => {
    if (azione === 'riprendi' || azione === 'inizia' || azione === 'recupera')
      return void navigate(`/sessione/setup?blocco=${encodeURIComponent(b.id)}`);
    if (azione === 'anticipa')
      return void anticipateSession(appDb, b.id, adesso(), fuso())
        .catch(() => false)
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
  useEffect(() => watchSetupInputs(appDb, bloccoId, setIngressi), [bloccoId]);
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
  const sceltaUtente = {
    unitaId,
    corsoId: materia?.corso.id ?? null,
    durata: durata === 'personalizzata' ? minuti : durata,
    modalita,
    iperfocus,
  };
  const anteprima = startPlan(b, sceltaUtente, now).sessione;
  // Libera: ancorata al focus (§10.2), la fine prevista è quella senza pause
  const fineMs = anteprima.fine ?? (anteprima.durata === null ? null : now + anteprima.durata * MINUTE);
  const fine = fineMs === null ? '—' : localTimeKey(fineMs);

  const origine =
    contesto === 'routine' && b
      ? t('origineRoutine', { titolo: titoloBlocco(b), ora: b.orarioInizio })
      : contesto === 'recupero' && b
        ? t('origineRecupero', { data: fmtGiorno.format(b.inizio) })
        : t('origineLibera');
  const titoloUnita: Chiave =
    bloccata === null ? 'cosaStudiare' : contesto === 'routine' ? 'unitaProposta' : 'unitaOccorrenza';

  const avvia = () => {
    if (inAvvio) return;
    setInAvvio(true);
    void startSession(appDb, b?.id ?? null, sceltaUtente, adesso(), fuso())
      .then(() => navigate('/sessione', { replace: true }))
      .catch(() => setInAvvio(false));
  };

  const scheda = (u: UnitaSetup, corso: CorsoSetup, scelta: boolean) => (
    <button
      key={u.id}
      type="button"
      className={s.unita}
      aria-pressed={elenco ? scelta : undefined}
      disabled={bloccata !== null}
      onClick={() => {
        setScelta(u.id);
        setElenco(false);
      }}
    >
      <span className={s.unitaTesta}>
        <span className={s.eyebrow}>
          {t('modulo')} <span className={s.num}>{String(u.moduloNumero).padStart(2, '0')}</span> · {t('unita')}{' '}
          <span className={s.num}>{u.numero}</span>
        </span>
        {corso.proposta === u.id && <span className={s.tag}>{t('dalPuntatore')}</span>}
      </span>
      <span className={s.unitaTitolo}>{u.titolo}</span>
      <span className={s.unitaCorso}>{corso.titolo}</span>
    </button>
  );
  const nessuna = (
    <button
      type="button"
      className={s.unita}
      aria-pressed={elenco ? unitaId === null : undefined}
      onClick={() => {
        setScelta(null);
        setElenco(false);
      }}
    >
      <span className={s.unitaTitolo}>{t('nessunaUnita')}</span>
    </button>
  );

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
              <Crosshair size={14} />
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
              <>
                {DURATE.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`${s.chip} ${s.cifre}`}
                    aria-pressed={durata === d}
                    onClick={() => setDurata(d)}
                  >
                    {d}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${s.chip} ${s.cifre}`}
                  aria-pressed={durata === 'personalizzata'}
                  onClick={() => setDurata('personalizzata')}
                >
                  {t('personalizzata')}
                </button>
                <button
                  type="button"
                  className={`${s.chip} ${s.cifre}`}
                  aria-pressed={durata === null}
                  onClick={() => setDurata(null)}
                >
                  {t('cronometro')}
                </button>
              </>
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
            <ListIcon size={14} />
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
          aria-checked={iperfocus}
          className={s.interruttore}
          onClick={() => setIperfocus((x) => !x)}
        >
          <span className={s.colonna}>
            <span>{t('iperfocus')}</span>
            <span className={s.notaScura}>{t('iperfocusNota')}</span>
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

/** Segnaposto del timer (T-017): cosa è in corso, da quando, fino a quando, e l'abbandono (§10.5). */
export function ActiveSession() {
  const ingressi = useIngressi(null);
  const navigate = useNavigate();
  if (!ingressi) return null;
  const a = ingressi.attiva;
  if (!a) return <Navigate to="/" replace />;
  const materia = unitaDi(ingressi.corsi, a.unitaId);
  return (
    <div className={s.pagina}>
      <div className={s.corpo}>
        <div className={s.gruppo}>
          <span className={s.inCorso}>{t('sessioneInCorso')}</span>
          <h1 className={s.titolo}>{materia?.unita.titolo ?? t('sessioneDiStudio')}</h1>
          {materia && (
            <span className={s.nota}>
              {materia.corso.titolo} · {t('unita')} <span className={s.num}>{materia.unita.numero}</span>
            </span>
          )}
          <span className={s.origine}>
            <Clock size={14} />
            <span>
              {t('avviataAlle', { ora: localTimeKey(a.avvio) })}
              {a.fine !== null && ` · ${t('finePrevista')} ${localTimeKey(a.fine)}`}
            </span>
          </span>
        </div>
      </div>
      <div className={s.piede}>
        <button
          type="button"
          className={s.abbandona}
          onClick={() =>
            void abandonSession(appDb, adesso(), fuso())
              .catch(() => undefined)
              .then(() => navigate('/', { replace: true }))
          }
        >
          {t('abbandona')}
        </button>
      </div>
    </div>
  );
}
