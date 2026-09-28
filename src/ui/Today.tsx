// Oggi (S1 Oggi Mobile/Desktop, 10 Mese; FUNZ §2, MECC §24): viste Giorno, Settimana e Mese sullo stesso periodo.
// Giorno: striscia della settimana, fascia senza orario per priorità (in cima su mobile, in coda su desktop,
// D-DESIGN-1 n. 3), poi i blocchi con orario (`sortDay`, A5); i
// terminali restano al loro posto in secondo piano. Vista e giorno stanno nell'indirizzo (`?vista=mese&giorno=…`).
// Si passa di periodo scorrendo lateralmente, e su desktop con le frecce: il periodo nuovo entra dal lato verso cui si
// scorre; nel Mese si sceglie oggi o il primo del mese e la griglia resta anche senza attività (D-CAL-2). Il saluto
// «Ciao» lascia il posto alla data, in forma breve se la lunga non entra nella testata (360 px, D-CAL-2).
// Toccando una card della vista Giorno si apre il Dettaglio (T-009, `/attivita/:id`); il cerchio della card spunta
// (MECC §3 «spunta diretta», D-DETT-3). Pallini con l'alone del tipo e card in corso come S1 Mobile (D-CAL-2).
// Il blocco Adesso (T-010, `NowBlock.tsx`) sta fra la striscia e la giornata su mobile e nella colonna laterale su
// desktop. Arrivano con il loro task: trascinamento (T-015), ritorno dopo un'assenza (T-013); l'archivio impilato delle completate, «Il tuo progresso oggi» e «Prossime attività» dei mock
// non sono nella spec di Oggi (docs/03_HANDOFF_DESIGN_CODE.md §10).
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams, type Location } from 'react-router';
import { watchCalendar, type BloccoCalendario } from '../app/calendar';
import { checkFromCalendar } from '../app/completion';
import { appDb } from '../app/db';
import { dayLoad, isDayKey, monthGrid, monthLegend, swipeDay, weekOf, type Vista } from '../domain/calendar';
import { canCheckFromCalendar, type PassoSpunta } from '../domain/completion';
import { isLiveBlock } from '../domain/nowBlock';
import { sortDayDesktop } from '../domain/ordering';
import { STATI_TERMINALI } from '../domain/types';
import { useMinuto, useOggi } from './clock';
import { maiuscola, sottotitolo, TIPO, titolo } from './format';
import { lingua, t, type Chiave } from './i18n';
import { NowBlock } from './NowBlock';
import { ProfileMenu } from './ProfileMenu';
import s from './Today.module.css';

// Forme brevi nella colonna dell'orario («Norm.», S1)
const PRIORITA = { alta: 'prioritaBreveAlta', normale: 'prioritaBreveNormale', bassa: 'prioritaBreveBassa' } as const;
const FRECCE: Record<Vista, [Chiave, Chiave]> = {
  giorno: ['giornoPrecedente', 'giornoSuccessivo'],
  settimana: ['settimanaPrecedente', 'settimanaSuccessiva'],
  mese: ['mesePrecedente', 'meseSuccessivo'],
};
const VISTE: { vista: Vista; chiave: Chiave }[] = [
  { vista: 'giorno', chiave: 'giorno' },
  { vista: 'settimana', chiave: 'settimana' },
  { vista: 'mese', chiave: 'mese' },
];
/** Durata del saluto prima della data (S1: 2,6 s, poi 0,4 s di uscita). */
const SALUTO_MS = 2600;
/** Spostamento orizzontale che fa passare di periodo. */
const SOGLIA_SWIPE = 60;
let salutato = false;

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

const data = (giorno: string) => {
  const [y = 0, m = 1, d = 1] = giorno.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmt = (giorno: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lingua, o).format(data(giorno));
const fmtParti = (giorno: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(lingua, o).formatToParts(data(giorno));
const intervallo = (da: string, a: string) =>
  new Intl.DateTimeFormat(lingua, { day: 'numeric', month: 'long' }).formatRange(data(da), data(a));
const orario = (b: BloccoCalendario) => (b.conOrario ? b.orarioInizio : '—');
const terminale = (b: BloccoCalendario) => STATI_TERMINALI.has(b.stato);
/** Il periodo che una vista mostra per un giorno: il giorno, il lunedì della settimana o il mese. */
const periodoDi = (vista: Vista, giorno: string) =>
  vista === 'mese' ? giorno.slice(0, 7) : vista === 'settimana' ? (weekOf(giorno)[0] ?? giorno) : giorno;

export function Today() {
  const [parametri, setParametri] = useSearchParams();
  const location = useLocation();
  // Il giorno di oggi cambia a mezzanotte e al ritorno in primo piano, senza riavvio (G4)
  const oggi = useOggi();
  const vista = (VISTE.find((v) => v.vista === parametri.get('vista'))?.vista ?? 'giorno') satisfies Vista;
  const scelto = parametri.get('giorno') ?? '';
  const giorno = isDayKey(scelto) ? scelto : oggi;
  const settimana = weekOf(giorno);
  const griglia = vista === 'mese' ? monthGrid(giorno) : null;
  const giorni = griglia ? griglia.map((c) => c.giorno) : settimana;
  const chiave = giorni.join();

  const [periodo, setPeriodo] = useState<{ chiave: string; giorni: Map<string, BloccoCalendario[]> }>();
  useEffect(() => watchCalendar(appDb, chiave.split(','), (g) => setPeriodo({ chiave, giorni: g })), [chiave]);
  const blocchi = (g: string) => (periodo?.chiave === chiave ? periodo.giorni.get(g) : undefined) ?? [];
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
        {giorno !== oggi && (
          <button type="button" className={`${s.tornaOggi} ${s.soloMobile}`} onClick={() => vai({ giorno: oggi })}>
            {t('oggi')}
          </button>
        )}
        <Segmentato viste={VISTE} vista={vista} vai={vai} className={s.soloDesktop} />
        {/* Su mobile le viste si scelgono solo con le tre icone in alto a destra (S1 Mobile) */}
        <div className={`${s.iconeVista} ${s.soloMobile}`} role="group" aria-label={t('vista')}>
          {VISTE.map((v) => (
            <button
              key={v.vista}
              type="button"
              className={s.iconaVista}
              aria-label={t(v.chiave)}
              aria-pressed={vista === v.vista}
              onClick={() => vai({ vista: v.vista })}
            >
              <IconaVista vista={v.vista} />
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
            {/* Colonna laterale di S1 Desktop (360); su mobile il blocco Adesso sta qui, fra striscia e giornata */}
            <div className={s.lato}>
              <NowBlock sfondo={sfondo} />
            </div>
            <hr className={`${s.separatore} ${s.soloMobile}`} />
            <h2 className={`${s.giornoTitolo} ${s.soloDesktop}`}>{giornoLungo}</h2>
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
              <Giornata key={chiavePeriodo} blocchi={blocchi(giorno)} sfondo={sfondo} verso={verso} />
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
 * Giornata della vista Giorno: la card apre il Dettaglio, il cerchio fa la spunta diretta (MECC §3, D-DETT-3): completa
 * subito o apre il Dettaglio sulla sheet giusta (revisione delle fasi, voci rimaste); se nel frattempo la spunta non è
 * più possibile, o la scrittura fallisce, apre il Dettaglio, che spiega o ha lo stesso comando con il messaggio
 * d'errore. L'orologio batte al minuto per la card in corso e per la finestra della routine (D-CAL-2).
 */
function Giornata({ blocchi, sfondo, verso }: { blocchi: BloccoCalendario[]; sfondo: Sfondo; verso?: Verso }) {
  const now = useMinuto();
  const navigate = useNavigate();
  // Su desktop la fascia senza orario va in coda anche nell'ordine del fuoco (MECC §24, D-DESIGN-1 n. 3)
  const desktop = useSyncExternalStore(seguiDesktop, eDesktop);
  const apri = (b: BloccoCalendario, passo?: PassoSpunta) =>
    navigate(`/attivita/${b.id}`, { state: { ...sfondo, ...(passo && { vista: passo }) } });
  // `null`: la finestra si è chiusa fra il ridisegno al minuto e il tocco; il Dettaglio dice perché
  const spunta = (b: BloccoCalendario, istante: number) =>
    void checkFromCalendar(appDb, b.id, istante, Intl.DateTimeFormat().resolvedOptions().timeZone).then(
      (passo) => {
        if (passo !== 'completa') void apri(b, passo ?? undefined);
      },
      () => void apri(b),
    );
  return (
    <ol className={s.giornata} data-verso={verso}>
      {(desktop ? sortDayDesktop(blocchi) : blocchi).map((b) => {
        const fatta = b.stato === 'completato';
        // Persi e saltati non si spuntano, salvo i todo (MECC §24): niente cerchio, ma il suo posto resta (titoli allineati)
        const assente = b.tipo !== 'todo' && (b.stato === 'perso' || b.stato === 'saltato');
        const sub = sottotitolo(b);
        return (
          <li
            key={b.id}
            className={s.riga}
            data-tipo={b.tipo}
            data-terminale={terminale(b) || undefined}
            data-completato={fatta || undefined}
            data-senza-orario={!b.conOrario || undefined}
            data-in-corso={isLiveBlock(b, now) || undefined}
          >
            <span className={b.conOrario ? s.ora : s.priorita} data-alta={b.priorita === 'alta' || undefined}>
              {b.conOrario ? b.orarioInizio : b.priorita && t(PRIORITA[b.priorita])}
            </span>
            <span className={s.punto} />
            <div className={s.card}>
              <span className={s.accento} />
              {/* Lo stesso bottone prima e dopo la spunta: il fuoco resta e la spunta entra con la transizione; da
                  completato apre il Dettaglio, dove c'è «Riapri» (§3) */}
              {fatta || canCheckFromCalendar(b, now) ? (
                <button
                  type="button"
                  className={s.spunta}
                  data-fatta={fatta || undefined}
                  tabIndex={fatta ? -1 : undefined}
                  aria-label={t(fatta ? 'completatoTitolo' : 'segnaFattoTitolo', { titolo: titolo(b) })}
                  onClick={() => (fatta ? void apri(b) : spunta(b, Date.now()))}
                >
                  {fatta && <Check size={12} strokeWidth={2.75} />}
                </button>
              ) : (
                <span className={s.spunta} data-assente={assente || undefined} aria-hidden />
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
            </div>
          </li>
        );
      })}
    </ol>
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
          key={v.vista}
          type="button"
          className={s.segmento}
          aria-pressed={p.vista === v.vista}
          onClick={() => p.vai({ vista: v.vista })}
        >
          {t(v.chiave)}
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
