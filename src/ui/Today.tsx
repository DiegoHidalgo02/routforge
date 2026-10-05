// Oggi (S1 Oggi Mobile/Desktop, 10 Mese; FUNZ §2, MECC §24): viste Giorno, Settimana e Mese sullo stesso periodo.
// Giorno: striscia della settimana, fascia senza orario per priorità (in cima su mobile, in coda su desktop,
// D-DESIGN-1 n. 3), poi i blocchi con orario (`sortDay`, A5); i
// terminali restano al loro posto in secondo piano. Vista e giorno stanno nell'indirizzo (`?vista=mese&giorno=…`).
// Si passa di periodo scorrendo lateralmente, e su desktop con le frecce: il periodo nuovo entra dal lato verso cui si
// scorre; nel Mese si sceglie oggi o il primo del mese e la griglia resta anche senza attività (D-CAL-2). Il saluto
// «Ciao» lascia il posto alla data, in forma breve se la lunga non entra nella testata (360 px, D-CAL-2).
// Toccando una card della vista Giorno si apre il Dettaglio (T-009, `/attivita/:id`); il cerchio della card spunta
// (MECC §3 «spunta diretta», D-DETT-3). Pallini con l'alone del tipo e card in corso come S1 Mobile (D-CAL-2).
// La card Adesso (T-048, `HeroCard.tsx`) è la card dell'attività scelta (`heroBlock`), cresciuta a hero al suo posto
// nella giornata: su mobile allo scatto dell'ora, 900 ms dopo l'apertura; su desktop subito (MECC §14).
// In testa alla giornata il messaggio del ritorno dopo un'assenza (T-014, D-ASSENZA-1). Nella vista Giorno i todo senza
// orario si riordinano nel loro gruppo di priorità (MECC §15, T-044): maniglia a sei punti, frecce su desktop, barra
// «Riordina» su mobile; nessun orario, giorno o «Annulla». Arrivano con il loro task l'archivio impilato delle
// completate e la Giornata chiusa (T-040). Sotto la giornata su mobile, nella colonna di 360 su desktop, «Il tuo
// progresso oggi» e «Prossime attività» (T-040, `Progress.tsx`).
import {
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RefreshCcw,
  X,
} from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { Link, useLocation, useNavigate, useSearchParams, type Location } from 'react-router';
import { dismissAbsenceNotice, readAbsenceNotice } from '../app/absence';
import { calendarDays, type BloccoCalendario } from '../app/calendar';
import { checkFromCalendar, reopenBlock } from '../app/completion';
import { appDb, watch } from '../app/db';
import { nowInputs, type IngressiAdesso } from '../app/nowBlock';
import { progressInputs, type IngressiProgresso } from '../app/progress';
import { reorderTodo } from '../app/reorder';
import {
  dayLoad,
  isDayKey,
  monthGrid,
  monthLegend,
  shiftPeriod,
  swipeDay,
  weekOf,
  type Vista,
} from '../domain/calendar';
import { checkCircle, type PassoSpunta } from '../domain/completion';
import { heroBlock, isLiveBlock } from '../domain/nowBlock';
import { dayClosed, isDone } from '../domain/progress';
import { canReorder, reorderGroup, sortDayDesktop } from '../domain/ordering';
import type { AvvisoAssenza } from '../domain/scheduler/absence';
import { localDayKey, localInstant } from '../domain/time';
import { STATI_TERMINALI } from '../domain/types';
import { useMinuto, useOggi } from './clock';
import { fuso, maiuscola, sottotitolo, TIPO, titolo } from './format';
import { HeroCard } from './HeroCard';
import { lingua, t, type Chiave } from './i18n';
import { ProfileMenu } from './ProfileMenu';
import { ProgressoOggi, ProssimeAttivita } from './Progress';
import { Archivio, GiornataChiusa } from './Archive';
import { SessionBannerSlot } from './Session';
import s from './Today.module.css';

// Forme brevi nella colonna dell'orario («Norm.», S1)
const PRIORITA = { alta: 'prioritaBreveAlta', normale: 'prioritaBreveNormale', bassa: 'prioritaBreveBassa' } as const;
const FRECCE: Record<Vista, [Chiave, Chiave]> = {
  giorno: ['giornoPrecedente', 'giornoSuccessivo'],
  settimana: ['settimanaPrecedente', 'settimanaSuccessiva'],
  mese: ['mesePrecedente', 'meseSuccessivo'],
};
/** Le viste, nell'ordine del selettore; la chiave i18n coincide con il nome. */
const VISTE = ['giorno', 'settimana', 'mese'] as const satisfies readonly Vista[];
/** Durata del saluto prima della data (S1: 2,6 s, poi 0,4 s di uscita). */
const SALUTO_MS = 2600;
/** Scatto dell'ora (S1 `strikeDelay`): su mobile la card Adesso cresce a hero 900 ms dopo l'apertura dell'app. */
const SCATTO_MS = 900;
/** Toast della spunta dalla lista per tipo (TESTI: «Fatto · …», «Fatta · …», «Evento completato · …»). */
const FATTO: Record<BloccoCalendario['tipo'], Chiave> = {
  todo: 'toastFatto',
  routine: 'toastFatta',
  evento: 'toastEventoCompletato',
  studio: 'toastFatto',
};
/** Spostamento orizzontale che fa passare di periodo. */
const SOGLIA_SWIPE = 60;
let salutato = false;
let scattato = false;

/** Lato da cui entra il periodo nuovo dopo uno scorrimento o una freccia (D-CAL-2). */
type Verso = 'avanti' | 'indietro';
type Sfondo = { sfondo: Location };
/** Da 1024 px la giornata segue l'ordine desktop (D-UI-1). */
const DESKTOP = '(min-width: 1024px)';
const seguiDesktop = (cambia: () => void) => {
  const m = window.matchMedia(DESKTOP);
  m.addEventListener('change', cambia);
  return () => m.removeEventListener('change', cambia);
};
const eDesktop = () => window.matchMedia(DESKTOP).matches;

const fmt = (giorno: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(lingua, o).format(localInstant(giorno, '00:00'));
const fmtParti = (giorno: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(lingua, o).formatToParts(localInstant(giorno, '00:00'));
const intervallo = (da: string, a: string) =>
  new Intl.DateTimeFormat(lingua, { day: 'numeric', month: 'long' }).formatRange(
    localInstant(da, '00:00'),
    localInstant(a, '00:00'),
  );
const orario = (b: BloccoCalendario) => (b.conOrario ? b.orarioInizio : '—');
const terminale = (b: BloccoCalendario) => STATI_TERMINALI.has(b.stato);
/** Il periodo che una vista mostra per un giorno: il giorno, il lunedì della settimana o il mese. */
const periodoDi = (vista: Vista, giorno: string) =>
  vista === 'mese' ? giorno.slice(0, 7) : vista === 'settimana' ? (weekOf(giorno)[0] ?? giorno) : giorno;

/** «Annulla» del toast della spunta resta 5 s (A7), come il toast del Dettaglio. */
const ANNULLA_MS = 5000;
/** Movimento del puntatore oltre il quale la pressione diventa trascinamento. */
const SOGLIA_PRESA = 4;
/** L'istante delle scritture, fuori dal render (lo stesso accorgimento di Session.tsx per `react-hooks/purity`). */
const istante = () => Date.now();
/** Le frecce del riordino (MECC §15). */
type Freccia = 'su' | 'giu';
/** La priorità del gruppo nel testo della barra e della regione live («Priorità alta · 2 di 2»). */
const LIVELLO = { alta: 'livelloAlta', normale: 'livelloNormale', bassa: 'livelloBassa' } as const;

export function Today() {
  const [parametri, setParametri] = useSearchParams();
  const location = useLocation();
  // Il giorno di oggi cambia a mezzanotte e al ritorno in primo piano, senza riavvio (G4)
  const oggi = useOggi();
  const vista = VISTE.find((v) => v === parametri.get('vista')) ?? 'giorno';
  const scelto = parametri.get('giorno') ?? '';
  const giorno = isDayKey(scelto) ? scelto : oggi;
  const settimana = weekOf(giorno);
  const griglia = vista === 'mese' ? monthGrid(giorno) : null;
  const giorni = griglia ? griglia.map((c) => c.giorno) : settimana;
  const chiave = giorni.join();

  const [periodo, setPeriodo] = useState<{ chiave: string; giorni: Map<string, BloccoCalendario[]> }>();
  useEffect(
    () =>
      watch(
        () => calendarDays(appDb, chiave.split(',')),
        (g) => setPeriodo({ chiave, giorni: g }),
      ),
    [chiave],
  );
  const blocchi = (g: string) => (periodo?.chiave === chiave ? periodo.giorni.get(g) : undefined) ?? [];
  // «Il tuo progresso oggi» e «Prossime attività» (FUNZ §2): solo nella vista Giorno, sempre su oggi
  const [progresso, setProgresso] = useState<IngressiProgresso>();
  useEffect(
    () => (vista === 'giorno' ? watch(() => progressInputs(appDb, oggi), setProgresso) : undefined),
    [vista, oggi],
  );
  const pronto = periodo?.chiave === chiave;

  // Il saluto compare una volta per avvio dell'app, in testa alla vista Giorno (FUNZ §2)
  const [saluto, setSaluto] = useState<'in' | 'out' | null>(() => (salutato || vista !== 'giorno' ? null : 'in'));
  useEffect(() => {
    salutato = true;
    const a = setTimeout(() => setSaluto((x) => x && 'out'), SALUTO_MS);
    const b = setTimeout(() => setSaluto(null), SALUTO_MS + 400);
    return () => (clearTimeout(a), clearTimeout(b));
  }, []);

  // Il contenuto del periodo si rimonta quando il periodo cambia (chiave) ed entra dal lato dello scorrimento
  const [verso, setVerso] = useState<Verso>();
  const chiavePeriodo = `${vista}:${periodoDi(vista, giorno)}`;
  const vai = (p: { vista?: Vista; giorno?: string }, direzione?: Verso) => {
    const v = p.vista ?? vista;
    const g = p.giorno ?? giorno;
    setVerso(direzione);
    setParametri({ ...(v !== 'giorno' && { vista: v }), ...(g !== oggi && { giorno: g }) }, { replace: true });
  };
  const scorri = (n: number) => vai({ giorno: swipeDay(giorno, vista, n, oggi) }, n > 0 ? 'avanti' : 'indietro');

  const inizio = useRef<{ x: number; y: number } | null>(null);
  const giu = (e: PointerEvent) => {
    inizio.current = { x: e.clientX, y: e.clientY };
  };
  const su = (e: PointerEvent) => {
    const p = inizio.current;
    inizio.current = null;
    if (!p) return;
    const dx = e.clientX - p.x;
    if (Math.abs(dx) > SOGLIA_SWIPE && Math.abs(dx) > Math.abs(e.clientY - p.y)) scorri(dx < 0 ? 1 : -1);
  };

  // Toast con «Annulla» per 5 s dopo la spunta dalla lista (§3, A7)
  const [avviso, setAvviso] = useState<{ id: string; testo: string; annulla: () => void }>();
  const timerToast = useRef<ReturnType<typeof setTimeout>>(undefined);
  const annullaToast = useRef<HTMLButtonElement>(null);
  useEffect(() => () => clearTimeout(timerToast.current), []);
  // Se il fuoco è su «Annulla» quando il toast si chiude torna sulla card, se è ancora nella giornata, altrimenti sulla
  // prima card
  const chiudiToast = (id: string) => {
    clearTimeout(timerToast.current);
    if (document.activeElement === annullaToast.current)
      (
        document.querySelector<HTMLElement>(`li[data-id="${id}"] a`) ??
        document.querySelector<HTMLElement>('li[data-id] a')
      )?.focus();
    setAvviso(undefined);
  };
  const avvisa = (id: string, testo: string, annulla: () => Promise<unknown>) => {
    clearTimeout(timerToast.current);
    timerToast.current = setTimeout(() => chiudiToast(id), ANNULLA_MS);
    setAvviso({
      id,
      testo,
      annulla: () => {
        chiudiToast(id);
        void annulla().catch(() => undefined);
      },
    });
  };
  // Spunta dalla lista completata subito (§3, A7): «Fatto · …», «Fatta · …», «Evento completato · …»; «Annulla» riapre
  const completato = (b: BloccoCalendario) =>
    avvisa(b.id, t(FATTO[b.tipo], { titolo: titolo(b) }), () => reopenBlock(appDb, b.id, Date.now(), fuso()));
  const trascinabili = blocchi(giorno).some(canReorder);

  const sfondo = { sfondo: location };
  const creaAttivita = (
    <Link to="/crea" state={sfondo} className={s.primario}>
      {t('creaAttivita')}
    </Link>
  );
  const etichettaPeriodo =
    vista === 'settimana'
      ? intervallo(settimana[0] ?? giorno, settimana[6] ?? giorno)
      : maiuscola(fmt(giorno, { month: 'long', year: 'numeric' }));
  const giornoLungo = maiuscola(fmt(giorno, { weekday: 'long', day: 'numeric', month: 'long' }));
  const meseVuoto = pronto && !!griglia?.every((c) => !c.delMese || blocchi(c.giorno).length === 0);

  return (
    <div className={s.oggi}>
      <header className={s.testa}>
        <span className={s.soloMobile}>
          <ProfileMenu variante="logo" />
        </span>
        <h1 className={s.titolo}>
          {/* Su desktop il titolo è il periodo (S1 Desktop); saluto e data stanno nell'intestazione mobile */}
          <span className={s.soloMobile}>
            {saluto ? (
              <span className={`${s.saluto} ${saluto === 'out' ? s.esce : ''}`}>
                <span className={s.ciao}>{t('ciao')}</span>
                <span className={s.motto}>{t('motto')}</span>
              </span>
            ) : (
              <DataTesta giorno={giorno} />
            )}
          </span>
          <span className={`${s.periodo} ${s.soloDesktop}`}>{etichettaPeriodo}</span>
        </h1>
        {/* Su mobile si torna a oggi con «Oggi» della barra in basso, nessun tasto qui (`claude-design/CLAUDE.md`) */}
        <Segmentato viste={VISTE} vista={vista} vai={vai} className={s.soloDesktop} />
        {/* Su mobile le viste si scelgono solo con le tre icone in alto a destra (S1 Mobile) */}
        <div className={`${s.iconeVista} ${s.soloMobile}`} role="group" aria-label={t('vista')}>
          {VISTE.map((v) => (
            <button
              key={v}
              type="button"
              className={s.iconaVista}
              aria-label={t(v)}
              aria-pressed={vista === v}
              onClick={() => vai({ vista: v })}
            >
              <IconaVista vista={v} />
            </button>
          ))}
        </div>
        <div className={`${s.frecce} ${s.soloDesktop}`}>
          <button type="button" className={s.freccia} aria-label={t(FRECCE[vista][0])} onClick={() => scorri(-1)}>
            <ChevronLeft size={15} />
          </button>
          <button type="button" className={s.oggiPill} onClick={() => vai({ giorno: oggi })}>
            {t('oggi')}
          </button>
          <button type="button" className={s.freccia} aria-label={t(FRECCE[vista][1])} onClick={() => scorri(1)}>
            <ChevronRight size={15} />
          </button>
        </div>
      </header>
      <SessionBannerSlot />

      <div
        className={s.corpo}
        data-vista={vista}
        onPointerDown={giu}
        onPointerUp={su}
        onPointerCancel={() => (inizio.current = null)}
      >
        {vista === 'mese' && <h2 className={`${s.meseMobile} ${s.soloMobile}`}>{etichettaPeriodo}</h2>}
        {vista !== 'mese' && (
          <>
            {/* Su mobile la striscia sta anche nella Settimana (S1) */}
            <div className={`${s.striscia} ${vista === 'settimana' ? s.soloMobile : ''}`}>
              {settimana.map((g) => {
                const primo = dayLoad(blocchi(g)).tipi[0];
                return (
                  <button
                    key={g}
                    type="button"
                    className={s.giornoStriscia}
                    aria-pressed={g === giorno}
                    aria-current={g === oggi ? 'date' : undefined}
                    aria-label={fmt(g, { weekday: 'long', day: 'numeric', month: 'long' })}
                    data-carico={primo ? '' : undefined}
                    data-giorno-striscia={g}
                    onClick={() => vai({ giorno: g })}
                  >
                    <span className={s.sigla}>{fmt(g, { weekday: 'short' })}</span>
                    <span className={s.numero}>{fmt(g, { day: 'numeric' })}</span>
                    <span className={s.carico} data-tipo={primo} />
                  </button>
                );
              })}
            </div>
          </>
        )}
        {vista === 'giorno' && (
          <>
            <hr className={`${s.separatore} ${s.soloMobile}`} />
            {/* S1 Desktop: la data del giorno con la nota del trascinamento a destra */}
            <div className={`${s.rigaGiorno} ${s.soloDesktop}`}>
              <h2 className={s.giornoTitolo}>{giornoLungo}</h2>
              {trascinabili && <span className={s.notaGiorno}>{t('notaTrascina')}</span>}
            </div>
            <RitornoAssenza oggi={oggi} />
            {pronto && blocchi(giorno).length === 0 ? (
              <div key={chiavePeriodo} className={s.vuotoGiorno} data-verso={verso}>
                <CalendarCheck size={32} strokeWidth={1.5} className={s.iconaVuotoGiorno} />
                <p className={s.testoVuoto}>{t('giornoVuoto')}</p>
                <div className={s.azioniVuoto}>
                  {creaAttivita}
                  <Link to="/corsi" className={s.testuale}>
                    {t('vaiAiCorsi')}
                  </Link>
                </div>
              </div>
            ) : (
              <Giornata
                key={chiavePeriodo}
                blocchi={blocchi(giorno)}
                domani={primaDiDomani(progresso, oggi)}
                onDomani={() => vai({ giorno: shiftPeriod(oggi, 'giorno', 1) })}
                sfondo={sfondo}
                verso={verso}
                onCompletato={completato}
                onRiordino={() => avviso && chiudiToast(avviso.id)}
              />
            )}
            {progresso && (
              <div className={s.lato}>
                <ProgressoOggi ingressi={progresso} oggi={oggi} />
                <ProssimeAttivita
                  prossimi={progresso.prossimi}
                  oggi={oggi}
                  onVediTutte={() => vai({ vista: 'settimana' })}
                />
              </div>
            )}
          </>
        )}

        {vista === 'settimana' &&
          (pronto && settimana.every((g) => blocchi(g).length === 0) ? (
            <div key={chiavePeriodo} className={s.vuoto} data-verso={verso}>
              <span className={s.iconaVuoto}>
                <CalendarDays size={24} />
              </span>
              <span className={s.testiVuoto}>
                <span className={s.titoloVuoto}>{t('settimanaVuota')}</span>
                <span className={s.testoVuoto}>{t('settimanaVuotaTesto', { periodo: etichettaPeriodo })}</span>
              </span>
              {creaAttivita}
            </div>
          ) : (
            <div key={chiavePeriodo} className={s.settimana} data-verso={verso}>
              {settimana.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={s.giornoSettimanaRiga}
                  aria-pressed={g === giorno}
                  onClick={() => vai({ giorno: g })}
                >
                  <span className={s.intestazioneGiorno}>
                    <span className={s.sigla}>{fmt(g, { weekday: 'short' })}</span>
                    <span className={s.numero} data-libero={blocchi(g).length === 0 || undefined}>
                      {fmt(g, { day: 'numeric' })}
                    </span>
                  </span>
                  <span className={s.blocchiGiorno}>
                    {blocchi(g).map((b) => (
                      <Mini key={b.id} b={b} />
                    ))}
                    {blocchi(g).length === 0 && <span className={s.libero}>{t('libero')}</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}

        {/* Mese: la griglia resta anche senza attività, con la nota al posto della legenda (DESIGN.md §6, D-CAL-2) */}
        {griglia && (
          <div key={chiavePeriodo} className={s.mese} data-verso={verso}>
            <div className={s.calendario}>
              <div className={s.sigleMese} aria-hidden>
                {settimana.map((g) => (
                  <span key={g} className={s.sigla}>
                    {fmt(g, { weekday: 'short' })}
                  </span>
                ))}
              </div>
              <div className={s.griglia}>
                {griglia.map(({ giorno: g, delMese }) => {
                  if (!delMese) return <span key={g} />;
                  const { n, tipi, livello } = dayLoad(blocchi(g));
                  return (
                    <button
                      key={g}
                      type="button"
                      className={s.cella}
                      data-carico={livello ?? undefined}
                      aria-pressed={g === giorno}
                      aria-current={g === oggi ? 'date' : undefined}
                      aria-label={t('cellaMese', {
                        giorno: fmt(g, { weekday: 'long', day: 'numeric', month: 'long' }),
                        n,
                      })}
                      onClick={() => vai({ giorno: g })}
                    >
                      <span className={s.numero}>{fmt(g, { day: 'numeric' })}</span>
                      <span className={s.puntini}>
                        {tipi.map((tp) => (
                          <span key={tp} data-tipo={tp} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
              {!pronto ? null : meseVuoto ? (
                <p className={s.notaMese}>{t('meseVuotoTesto')}</p>
              ) : (
                <div className={s.legenda}>
                  {monthLegend(griglia.filter((c) => c.delMese).map((c) => blocchi(c.giorno))).map((v) => (
                    <span key={v.tipo} className={s.voceLegenda} data-tipo={v.tipo}>
                      <span className={s.puntoLegenda} />
                      {t('legendaGiorni', { tipo: t(TIPO[v.tipo]), n: v.giorni })}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <section className={s.elencoGiorno} aria-label={giornoLungo}>
              <h2 className={s.giornoTitolo}>{giornoLungo}</h2>
              {blocchi(giorno).map((b) => (
                <Mini key={b.id} b={b} />
              ))}
              {blocchi(giorno).length === 0 && <span className={s.libero}>{t('libero')}</span>}
            </section>
          </div>
        )}
      </div>

      {/* Senza bersaglio la card sollevata segue il puntatore nella colonna della giornata. Su un orario si aggancia
          nello spazio che la giornata apre; sulla striscia lascia il posto al giorno acceso, e il suggerimento sta in
          testa alla giornata (`Giornata`, S1 `drag=giorno`) */}
      <div className={s.regioneToast} role="status">
        {avviso && (
          <div className={s.toast}>
            <span className={s.testoToast}>{avviso.testo}</span>
            <button ref={annullaToast} type="button" className={s.annullaToast} onClick={avviso.annulla}>
              {t('annullaAzione')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Data della testata mobile (S1): giorno della settimana e «30 settembre». Se la forma lunga non entra nella riga
 * (360 px, nomi lunghi, pill «Oggi» accanto) passa alla breve «Mer» · «30 set» (D-CAL-2); la lunga si misura in una
 * copia nascosta, così la scelta non oscilla. Al lettore di schermo arriva sempre la data intera.
 */
function DataTesta({ giorno }: { giorno: string }) {
  const riga = useRef<HTMLSpanElement>(null);
  const misura = useRef<HTMLSpanElement>(null);
  const [breve, setBreve] = useState(false);
  // Si misura prima del disegno a ogni giorno (niente fotogramma con la forma lunga troncata), poi a ogni ridimensionamento
  useLayoutEffect(() => {
    const [r, m] = [riga.current, misura.current];
    if (!r || !m) return;
    const controlla = () => setBreve(m.offsetWidth > r.clientWidth);
    controlla();
    const osserva = new ResizeObserver(controlla);
    osserva.observe(r);
    osserva.observe(m);
    return () => osserva.disconnect();
  }, [giorno]);
  const righe = (corta: boolean) => (
    <>
      <span className={s.giornoSettimana}>{maiuscola(fmt(giorno, { weekday: corta ? 'short' : 'long' }))}</span>
      <span className={s.giornoMese}>
        {fmtParti(giorno, { day: 'numeric', month: corta ? 'short' : 'long' }).map((p, i) =>
          p.type === 'day' ? (
            <span key={i} className={s.cifra}>
              {p.value}
            </span>
          ) : (
            p.value
          ),
        )}
      </span>
    </>
  );
  return (
    <span ref={riga} className={s.data}>
      <span className={s.soloLettore}>{fmt(giorno, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
      <span className={s.righeData} aria-hidden>
        {righe(breve)}
      </span>
      <span ref={misura} className={s.misura} aria-hidden>
        {righe(false)}
      </span>
    </span>
  );
}

/**
 * Ritorno dopo un'assenza (FUNZ §2, MECC §9; S1 Mobile `absence`, DESIGN.md AbsenceBanner): dopo almeno due giorni senza
 * aprire l'app dice una volta che il piano si è già riallineato, con i giorni in font-num; × lo chiude. Lo scrive il
 * servizio all'apertura e vale solo nel giorno dell'apertura (D-ASSENZA-1). Su desktop, che il design non disegna, sta
 * nello stesso punto: in testa alla giornata.
 */
function RitornoAssenza({ oggi }: { oggi: string }) {
  const [avviso, setAvviso] = useState<AvvisoAssenza | null>(null);
  useEffect(() => watch(() => readAbsenceNotice(appDb, oggi), setAvviso), [oggi]);
  // I giorni in font-num dentro la frase tradotta: il segnaposto divide il testo
  const [prima, dopo = ''] = t('ritornoAssenza').split('{giorni}');
  // La regione di stato resta montata anche vuota: i lettori di schermo annunciano ciò che vi entra dopo
  return (
    <div role="status">
      {avviso && (
        <div className={s.assenza}>
          <RefreshCcw size={16} className={s.iconaAssenza} aria-hidden />
          <p className={s.testoAssenza}>
            {prima}
            <span className={s.giorniAssenza}>{avviso.giorni}</span>
            {dopo}
          </p>
          <button
            type="button"
            className={s.chiudiAssenza}
            aria-label={t('chiudi')}
            onClick={() => void dismissAbsenceNotice(appDb, Date.now())}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Giornata della vista Giorno: la card apre il Dettaglio, il cerchio fa la spunta diretta (MECC §3, D-DETT-3): completa
 * subito, con il toast, o apre il Dettaglio sul foglio giusto (revisione delle fasi, voci rimaste, esito); se nel
 * frattempo la spunta non è più possibile, o la scrittura fallisce, apre il Dettaglio, che spiega o ha lo stesso comando
 * con il messaggio d'errore. L'orologio batte al minuto per la card in corso e per la finestra della routine (D-CAL-2).
 * Riordino dei todo senza orario (MECC §15, `canReorder`), solo nel loro gruppo di priorità: trascinamento dalla
 * maniglia, e col mouse da tutta la card, con la card sollevata che segue il puntatore (su mobile sopra lo slot
 * tratteggiato della posizione d'arrivo, su desktop sopra la riga originale; fuori dal gruppo il todo resta dov'era);
 * su desktop le frecce «Sposta su» e «Sposta giù» con il puntatore sopra la riga o il fuoco; su mobile un tocco sulla
 * maniglia apre la barra «Riordina». Il fuoco segue il todo spostato e una regione live annuncia la posizione.
 */
function Giornata({
  blocchi,
  domani,
  onDomani,
  sfondo,
  verso,
  onCompletato,
  onRiordino,
}: {
  blocchi: BloccoCalendario[];
  /** La prima attività di domani, per la riga «Domani» della Giornata chiusa. */
  domani: BloccoCalendario | undefined;
  onDomani: () => void;
  sfondo: Sfondo;
  verso?: Verso;
  /** Spunta dalla lista scritta subito: il toast con «Annulla» (A7). */
  onCompletato: (b: BloccoCalendario) => void;
  /** Comincia un riordino: il toast lascia il posto alla barra (S1 `move=attivo`). */
  onRiordino: () => void;
}) {
  const now = useMinuto();
  const navigate = useNavigate();
  // Su desktop la fascia senza orario va in coda anche nell'ordine del fuoco (MECC §24, D-DESIGN-1 n. 3)
  const desktop = useSyncExternalStore(seguiDesktop, eDesktop);
  // Card Adesso (MECC §14): la scelta fra i blocchi di ieri, oggi e domani, ricalcolata a ogni minuto; cresce a hero
  // dopo lo scatto dell'ora, una volta per apertura, subito su desktop o con la riduzione delle animazioni
  const oggi = localDayKey(now);
  const [ingressi, setIngressi] = useState<IngressiAdesso>();
  useEffect(() => watch(() => nowInputs(appDb, oggi), setIngressi), [oggi]);
  const [scatto, setScatto] = useState(
    () => scattato || eDesktop() || window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  useEffect(() => {
    if (scatto) return;
    const timer = setTimeout(() => {
      scattato = true;
      setScatto(true);
    }, SCATTO_MS);
    return () => clearTimeout(timer);
  }, [scatto]);
  const hero = scatto && ingressi ? heroBlock(ingressi.blocchi, now) : null;
  const apri = (b: BloccoCalendario, passo?: PassoSpunta) =>
    navigate(`/attivita/${b.id}`, { state: { ...sfondo, ...(passo && { vista: passo }) } });
  // `null`: la finestra si è chiusa fra il ridisegno al minuto e il tocco; il Dettaglio dice perché
  const spunta = (b: BloccoCalendario, istante: number) =>
    void checkFromCalendar(appDb, b.id, istante, fuso()).then(
      (passo) => {
        if (passo === 'completa') onCompletato(b);
        else void apri(b, passo ?? undefined);
      },
      () => void apri(b),
    );

  // Su mobile le completate lasciano la lista per l'archivio in testa, in ordine di completamento (S1, DATI-UI); su desktop
  // restano al loro posto in secondo piano. Con tutte le attività di oggi chiuse arriva la Giornata chiusa
  const fatte = desktop ? [] : blocchi.filter(isDone).sort((a, b) => (a.chiusoIl ?? 0) - (b.chiusoIl ?? 0));
  const righe = desktop ? sortDayDesktop(blocchi) : blocchi.filter((b) => !isDone(b));
  const chiusa = !desktop && blocchi[0]?.giornoLocale === oggi && dayClosed(blocchi);
  const lista = useRef<HTMLOListElement>(null);
  const barra = useRef<HTMLDivElement>(null);
  // Riordino (MECC §15): il todo con la barra aperta (mobile), l'annuncio della regione live, il fuoco da ridare
  const [mosso, setMosso] = useState<string | null>(null);
  const [annuncio, setAnnuncio] = useState('');
  const fuoco = useRef<{ id: string; freccia: Freccia; dove: 'riga' | 'barra'; da: number } | null>(null);
  const posizione = (b: BloccoCalendario) => {
    const g = reorderGroup(blocchi, b.id);
    return { i: g.findIndex((x) => x.id === b.id), n: g.length };
  };
  const sposta = (b: BloccoCalendario, a: number, freccia?: Freccia, dove: 'riga' | 'barra' = 'riga') => {
    const { n } = posizione(b);
    if (freccia) fuoco.current = { id: b.id, freccia, dove, da: righe.findIndex((r) => r.id === b.id) };
    void reorderTodo(appDb, b.id, a, istante(), fuso()).then(
      (ok) => {
        if (!ok) return void (fuoco.current = null);
        const livello = t(LIVELLO[b.priorita ?? 'normale']);
        setAnnuncio(
          t('annuncioRiordino', { titolo: titolo(b), n: Math.min(Math.max(a, 0), n - 1) + 1, totale: n, livello }),
        );
      },
      () => void (fuoco.current = null),
    );
  };
  // Il fuoco segue il todo spostato (§15): sulla freccia usata, o sull'altra se quella si è spenta al bordo del gruppo.
  // Si ridà quando l'ordine nuovo è disegnato: spostare la riga nel DOM può togliere il fuoco
  useLayoutEffect(() => {
    const f = fuoco.current;
    if (!f || righe.findIndex((r) => r.id === f.id) === f.da) return;
    fuoco.current = null;
    const dove = f.dove === 'barra' ? barra.current : lista.current?.querySelector(`li[data-id="${f.id}"]`);
    const tasto = (x: Freccia) => dove?.querySelector<HTMLButtonElement>(`button[data-freccia="${x}"]`);
    const usata = tasto(f.freccia);
    (usata && !usata.disabled ? usata : tasto(f.freccia === 'su' ? 'giu' : 'su'))?.focus();
  });

  // Trascinamento: il todo preso, la y della card sollevata nella lista e la posizione d'arrivo nel gruppo (`null`:
  // fuori dal gruppo, il todo resta dov'era). Le posizioni del gruppo si leggono una volta, alla presa: la lista che si
  // riordina sotto il dito non le sposta
  const [presa, setPresa] = useState<{ id: string; y: number; a: number | null } | null>(null);
  const puntatore = useRef<{
    b: BloccoCalendario;
    x0: number;
    y0: number;
    dy: number;
    attiva: boolean;
    centri: number[];
    zona: readonly [number, number];
    a: number | null;
  } | null>(null);
  const trascinata = useRef(false);
  const relativa = (y: number) => y - (lista.current?.getBoundingClientRect().top ?? 0);
  // Si prende dalla maniglia, e col mouse da tutta la card (il cursore di presa di S1); il cerchio non prende mai
  const giu = (e: PointerEvent<HTMLDivElement>, b: BloccoCalendario) => {
    const bersaglio = e.target as Element;
    const dallaManiglia = !!bersaglio.closest('[data-maniglia]');
    trascinata.current = false;
    if (!canReorder(b) || e.button !== 0) return;
    if (!dallaManiglia && (e.pointerType !== 'mouse' || bersaglio.closest('button'))) return;
    e.stopPropagation(); // la pressione non scorre la pagina né cambia giorno (`.corpo`)
    if (!dallaManiglia) e.preventDefault(); // niente selezione del testo né fuoco sul collegamento
    const riga = e.currentTarget.getBoundingClientRect();
    puntatore.current = {
      b,
      x0: e.clientX,
      y0: e.clientY,
      dy: e.clientY - riga.top,
      attiva: false,
      centri: [],
      zona: [0, 0],
      a: null,
    };
  };
  const muovi = (e: PointerEvent<HTMLDivElement>) => {
    const p = puntatore.current;
    if (!p || (!p.attiva && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < SOGLIA_PRESA)) return;
    if (!p.attiva) {
      // Si cattura solo adesso: un clic senza movimento resta del collegamento (Dettaglio) o della maniglia (barra)
      e.currentTarget.setPointerCapture(e.pointerId);
      p.attiva = true;
      setMosso(null);
      onRiordino();
      const posti = reorderGroup(blocchi, p.b.id).map((x) => ({
        id: x.id,
        r: lista.current?.querySelector(`li[data-id="${x.id}"]`)?.getBoundingClientRect(),
      }));
      const y = (r: DOMRect | undefined, k: 'top' | 'bottom') => relativa(r?.[k] ?? 0);
      p.centri = posti.filter((x) => x.id !== p.b.id).map((x) => (y(x.r, 'top') + y(x.r, 'bottom')) / 2);
      p.zona = [y(posti[0]?.r, 'top'), y(posti.at(-1)?.r, 'bottom')];
    }
    const y = relativa(e.clientY);
    p.a = y < p.zona[0] || y > p.zona[1] ? null : p.centri.filter((c) => c < y).length;
    setPresa({ id: p.b.id, y: y - p.dy, a: p.a });
  };
  const su = () => {
    const p = puntatore.current;
    puntatore.current = null;
    if (!p?.attiva) return;
    trascinata.current = true;
    setPresa(null);
    if (p.a !== null && p.a !== posizione(p.b).i) sposta(p.b, p.a);
  };
  const lascia = () => {
    puntatore.current = null;
    setPresa(null);
  };
  // Il clic che chiude un trascinamento non apre il Dettaglio né la barra
  const clic = (e: MouseEvent) => {
    if (!trascinata.current) return;
    trascinata.current = false;
    e.preventDefault();
    e.stopPropagation();
  };
  // Esc durante il trascinamento: il todo resta dov'era
  const trascina = !!presa;
  useEffect(() => {
    if (!trascina) return;
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      puntatore.current = null;
      setPresa(null);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [trascina]);

  // Mobile: un tocco sulla maniglia senza trascinare apre la barra (WCAG 2.5.7); un secondo tocco o «Fine» la chiude
  const tocca = (b: BloccoCalendario) => {
    if (desktop) return;
    onRiordino();
    setAnnuncio('');
    setMosso((m) => (m === b.id ? null : b.id));
  };
  const preso = mosso && !desktop ? blocchi.find((x) => x.id === mosso && canReorder(x)) : undefined;
  const qui = preso && posizione(preso);

  // Su mobile durante il trascinamento il todo preso lascia la lista: lo slot tratteggiato sta nella posizione d'arrivo
  const mostrate = presa && !desktop ? anteprima(righe, reorderGroup(blocchi, presa.id), presa.id, presa.a) : righe;
  const sollevato = presa && blocchi.find((x) => x.id === presa.id);
  return (
    <>
      <ol ref={lista} className={s.giornata} data-verso={verso}>
        {fatte.length > 0 && <Archivio fatte={fatte} />}
        {chiusa && <GiornataChiusa blocchi={blocchi} domani={domani} onDomani={onDomani} />}
        {mostrate.map((b) => {
          // Il cerchio (MECC §3, §24, S1): attivo, spento (routine e studio fuori dal loro giorno, studio non ancora da
          // registrare) o assente per persi, saltati ed esiti di studio, con il posto che resta (titoli allineati)
          const cerchio = checkCircle(b, now);
          const fatta = cerchio === 'fatto';
          const sub = sottotitolo(b);
          const riordinabile = canReorder(b);
          const { i, n } = riordinabile ? posizione(b) : { i: 0, n: 0 };
          const slot = presa?.id === b.id && !desktop;
          return (
            <li
              key={b.id}
              className={s.riga}
              data-id={b.id}
              data-tipo={b.tipo}
              data-terminale={terminale(b) || undefined}
              data-completato={fatta || undefined}
              data-senza-orario={!b.conOrario || undefined}
              data-in-corso={isLiveBlock(b, now) || undefined}
              data-mosso={mosso === b.id || undefined}
              data-slot={slot || undefined}
            >
              <span className={b.conOrario ? s.ora : s.priorita} data-alta={b.priorita === 'alta' || undefined}>
                {b.conOrario ? b.orarioInizio : b.priorita && t(PRIORITA[b.priorita])}
              </span>
              <span className={s.punto} />
              {slot ? (
                <span className={s.slot} />
              ) : hero?.blocco.id === b.id ? (
                <HeroCard
                  b={hero.blocco}
                  stato={hero.stato}
                  now={now}
                  attiva={ingressi?.attiva ?? null}
                  sfondo={sfondo}
                  onSpunta={cerchio === 'attivo' ? () => spunta(b, Date.now()) : undefined}
                />
              ) : (
                <div
                  className={s.card}
                  onPointerDown={(e) => giu(e, b)}
                  onPointerMove={muovi}
                  onPointerUp={su}
                  onPointerCancel={lascia}
                  onClickCapture={clic}
                >
                  <span className={s.accento} />
                  {/* Lo stesso bottone prima e dopo la spunta: il fuoco resta e la spunta entra con la transizione; da
                      completato apre il Dettaglio, dove c'è «Riapri» (§3) */}
                  {cerchio === 'assente' ? (
                    <span className={s.spunta} data-assente aria-hidden />
                  ) : (
                    <button
                      type="button"
                      className={s.spunta}
                      data-fatta={fatta || undefined}
                      aria-disabled={cerchio === 'spento' || undefined}
                      title={
                        cerchio === 'spento' && b.giornoLocale !== oggi ? t('siSegnaNelGiornoPrevisto') : undefined
                      }
                      tabIndex={fatta ? -1 : undefined}
                      aria-label={t(fatta ? 'completatoTitolo' : 'segnaFattoTitolo', { titolo: titolo(b) })}
                      onClick={() => (fatta ? void apri(b) : cerchio === 'attivo' && spunta(b, Date.now()))}
                    >
                      {fatta && <Check size={12} strokeWidth={2.75} />}
                    </button>
                  )}
                  {/* Toccando la card si apre il dettaglio (FUNZ §4): il collegamento copre la card, il cerchio sta sopra */}
                  <Link to={`/attivita/${b.id}`} state={sfondo} className={s.testi}>
                    <span className={s.titoloCard}>{titolo(b)}</span>
                    {sub && <span className={s.sub}>{sub}</span>}
                  </Link>
                  {b.conOrario && b.orarioFine && (
                    <span className={`${s.fascia} ${s.soloDesktop}`}>
                      {b.orarioInizio} – {b.orarioFine}
                    </span>
                  )}
                  <span className={s.badge}>{t(TIPO[b.tipo])}</span>
                  {/* Maniglia a sei punti solo sui todo che si riordinano (MECC §15), sopra il collegamento della card; su
                      desktop è solo il segno della presa: da tastiera ci sono le frecce */}
                  {riordinabile && (
                    <button
                      type="button"
                      className={s.maniglia}
                      data-maniglia
                      aria-label={t('riordinaTitolo', { titolo: titolo(b) })}
                      aria-pressed={desktop ? undefined : mosso === b.id}
                      aria-hidden={desktop || undefined}
                      tabIndex={desktop ? -1 : undefined}
                      onClick={() => tocca(b)}
                    >
                      <IconaManiglia />
                    </button>
                  )}
                </div>
              )}
              {riordinabile && !slot && (
                <span className={`${s.frecceRiordino} ${s.soloDesktop}`}>
                  <button
                    type="button"
                    className={s.frecciaRiordino}
                    data-freccia="su"
                    aria-label={t('spostaSu')}
                    title={t('spostaSu')}
                    disabled={i === 0}
                    onClick={() => sposta(b, i - 1, 'su')}
                  >
                    <ChevronUp size={14} strokeWidth={2} />
                  </button>
                  <button
                    type="button"
                    className={s.frecciaRiordino}
                    data-freccia="giu"
                    aria-label={t('spostaGiu')}
                    title={t('spostaGiu')}
                    disabled={i === n - 1}
                    onClick={() => sposta(b, i + 1, 'giu')}
                  >
                    <ChevronDown size={14} strokeWidth={2} />
                  </button>
                </span>
              )}
            </li>
          );
        })}
        {sollevato && (
          <li className={s.sollevata} style={{ '--y': `${presa.y}px` } as CSSProperties} aria-hidden>
            <CardSollevata b={sollevato} />
          </li>
        )}
      </ol>
      {preso && qui && (
        <div ref={barra} className={s.barra} role="toolbar" aria-label={t('riordina')}>
          <span className={s.testiBarra}>
            <span className={s.titoloBarra}>{titolo(preso)}</span>
            <span className={s.posizioneBarra}>
              {maiuscola(
                t('posizioneGruppo', {
                  livello: t(LIVELLO[preso.priorita ?? 'normale']),
                  n: qui.i + 1,
                  totale: qui.n,
                }),
              )}
            </span>
          </span>
          <button
            type="button"
            className={s.tastoBarra}
            data-freccia="su"
            aria-label={t('spostaSu')}
            disabled={qui.i === 0}
            onClick={() => sposta(preso, qui.i - 1, 'su', 'barra')}
          >
            <ChevronUp size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={s.tastoBarra}
            data-freccia="giu"
            aria-label={t('spostaGiu')}
            disabled={qui.i === qui.n - 1}
            onClick={() => sposta(preso, qui.i + 1, 'giu', 'barra')}
          >
            <ChevronDown size={18} strokeWidth={2} />
          </button>
          <button
            type="button"
            className={s.fineBarra}
            onClick={() => {
              setMosso(null);
              setAnnuncio('');
            }}
          >
            {t('fineRiordino')}
          </button>
        </div>
      )}
      <p className={s.soloLettore} aria-live="polite">
        {annuncio}
      </p>
    </>
  );
}

/** La prima attività di domani (S1 Giornata chiusa, «Domani · ora · titolo»), se domani ne ha. */
function primaDiDomani(progresso: IngressiProgresso | undefined, oggi: string): BloccoCalendario | undefined {
  const [giorno, blocchi] = progresso?.prossimi[0] ?? [];
  if (giorno !== shiftPeriod(oggi, 'giorno', 1) || !blocchi) return undefined;
  return blocchi.find((b) => b.conOrario) ?? blocchi[0];
}

/**
 * L'ordine mostrato durante il trascinamento su mobile (§15): il todo preso va nella posizione d'arrivo `a` del suo
 * gruppo (`gruppo` nell'ordine della vista), dove la riga mostra lo slot; fuori dal gruppo resta dov'era.
 */
function anteprima(righe: BloccoCalendario[], gruppo: BloccoCalendario[], id: string, a: number | null) {
  const preso = righe.find((r) => r.id === id);
  const altri = gruppo.filter((x) => x.id !== id);
  const ultimo = altri.at(-1);
  if (!preso || a === null || !ultimo) return righe;
  const senza = righe.filter((r) => r.id !== id);
  const prima = altri[a];
  const i = prima ? senza.indexOf(prima) : senza.indexOf(ultimo) + 1;
  return [...senza.slice(0, i), preso, ...senza.slice(i)];
}

/** La card sollevata (S1 `drag=lift`): la copia del todo preso, con l'ombra del trascinamento e la maniglia. */
function CardSollevata({ b }: { b: BloccoCalendario }) {
  const sub = sottotitolo(b);
  return (
    <div className={s.card}>
      <span className={s.accento} />
      <span className={s.spunta} />
      <span className={s.testi}>
        <span className={s.titoloCard}>{titolo(b)}</span>
        {sub && <span className={s.sub}>{sub}</span>}
      </span>
      <span className={s.badge}>{t(TIPO[b.tipo])}</span>
      <span className={s.maniglia}>
        <IconaManiglia />
      </span>
    </div>
  );
}

/** Selettore di vista (FUNZ §2): Giorno · Settimana su mobile, Giorno · Settimana · Mese su desktop. */
function Segmentato(p: {
  viste: typeof VISTE;
  vista: Vista;
  vai: (x: { vista: Vista }) => void;
  className: string | undefined;
}) {
  return (
    <div className={`${s.segmentato} ${p.className ?? ''}`} role="group" aria-label={t('vista')}>
      {p.viste.map((v) => (
        <button
          key={v}
          type="button"
          className={s.segmento}
          aria-pressed={p.vista === v}
          onClick={() => p.vai({ vista: v })}
        >
          {t(v)}
        </button>
      ))}
    </div>
  );
}

// Icone delle viste disegnate nel mock (calendario con righe, colonne o griglia), tratto come LucideProvider
const TRACCIATI: Record<Vista, string> = {
  giorno: 'M16 2v4M8 2v4M3 10h18M7 14h10M7 18h6',
  settimana: 'M16 2v4M8 2v4M3 10h18M9 10v11M15 10v11',
  mese: 'M16 2v4M8 2v4M3 10h18M3 15.5h18M9 10v11M15 10v11',
};
function IconaVista({ vista }: { vista: Vista }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d={TRACCIATI[vista]} />
    </svg>
  );
}

/** La maniglia a sei punti del mock (S1: punti pieni di raggio 1,6), nel colore del testo che la contiene. */
function IconaManiglia() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      {[6, 12, 18].map((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r={1.6} />))}
    </svg>
  );
}

/** Riga compatta di un blocco (Settimana e elenco del giorno nel Mese). */
function Mini({ b }: { b: BloccoCalendario }) {
  return (
    <span className={s.mini} data-tipo={b.tipo} data-terminale={terminale(b) || undefined}>
      <span className={s.accento} />
      <span className={s.oraMini}>{orario(b)}</span>
      <span className={s.titoloMini}>{titolo(b)}</span>
      <span className={s.badge}>{t(TIPO[b.tipo])}</span>
    </span>
  );
}
