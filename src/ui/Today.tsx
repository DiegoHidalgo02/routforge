// Oggi (S1 Oggi Mobile/Desktop, 10 Mese; FUNZ §2, MECC §24): viste Giorno, Settimana e Mese sullo stesso periodo.
// Giorno: striscia della settimana, fascia senza orario per priorità (in cima su mobile, in coda su desktop,
// D-DESIGN-1 n. 3), poi i blocchi con orario (`sortDay`, A5); i
// terminali restano al loro posto in secondo piano. Vista e giorno stanno nell'indirizzo (`?vista=mese&giorno=…`).
// Si passa di periodo scorrendo lateralmente, e su desktop con le frecce. Il saluto «Ciao» lascia il posto alla data.
// Toccando una card della vista Giorno si apre il Dettaglio (T-009, `/attivita/:id`).
// Arrivano con il loro task: blocco Adesso (T-010), trascinamento (T-015), ritorno dopo
// un'assenza (T-013); l'archivio impilato delle completate, «Il tuo progresso oggi» e «Prossime attività» dei mock
// non sono nella spec di Oggi (docs/03_HANDOFF_DESIGN_CODE.md §10).
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { watchCalendar, type BloccoCalendario } from '../app/calendar';
import { appDb } from '../app/db';
import { dayLoad, isDayKey, monthGrid, monthLegend, shiftPeriod, weekOf, type Vista } from '../domain/calendar';
import { localDayKey } from '../domain/time';
import { STATI_TERMINALI, type TipoBlocco } from '../domain/types';
import { maiuscola } from './format';
import { lingua, t, type Chiave } from './i18n';
import { ProfileMenu } from './ProfileMenu';
import s from './Today.module.css';

const TIPO: Record<TipoBlocco, Chiave> = {
  todo: 'tipoTodo',
  studio: 'tipoStudio',
  routine: 'tipoRoutine',
  evento: 'tipoEvento',
};
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
const titolo = (b: BloccoCalendario) => b.titolo || t(TIPO[b.tipo]);

function sottotitolo(b: BloccoCalendario): string {
  if (b.stato === 'perso' && b.conOrario) return t('persaEraAlle', { ora: b.orarioInizio });
  const lista = b.checklist ?? [];
  if (lista.length) return t('checklistConto', { fatte: lista.filter((v) => v.fatta).length, totale: lista.length });
  return b.luogo ?? '';
}

export function Today() {
  const [parametri, setParametri] = useSearchParams();
  const location = useLocation();
  // ponytail: il giorno di oggi letto al montaggio come in Courses; il cambio di giorno a schermata aperta è T-013
  const [oggi] = useState(() => localDayKey(Date.now()));
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

  const vai = (p: { vista?: Vista; giorno?: string }) => {
    const v = p.vista ?? vista;
    const g = p.giorno ?? giorno;
    setParametri({ ...(v !== 'giorno' && { vista: v }), ...(g !== oggi && { giorno: g }) }, { replace: true });
  };
  const scorri = (n: number) => vai({ giorno: shiftPeriod(giorno, vista, n) });

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
              <span className={s.data}>
                <span className={s.giornoSettimana}>{maiuscola(fmt(giorno, { weekday: 'long' }))}</span>
                <span className={s.giornoMese}>
                  {fmtParti(giorno, { day: 'numeric', month: 'long' }).map((p, i) =>
                    p.type === 'day' ? (
                      <span key={i} className={s.cifra}>
                        {p.value}
                      </span>
                    ) : (
                      p.value
                    ),
                  )}
                </span>
              </span>
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

      <div className={s.corpo} onPointerDown={giu} onPointerUp={su} onPointerCancel={() => (inizio.current = null)}>
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
            <hr className={`${s.separatore} ${s.soloMobile}`} />
            <h2 className={`${s.giornoTitolo} ${s.soloDesktop}`}>{giornoLungo}</h2>
            {pronto && blocchi(giorno).length === 0 ? (
              <div className={s.vuotoGiorno}>
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
              <ol className={s.giornata}>
                {blocchi(giorno).map((b) => (
                  <li
                    key={b.id}
                    className={s.riga}
                    data-tipo={b.tipo}
                    data-terminale={terminale(b) || undefined}
                    data-completato={b.stato === 'completato' || undefined}
                    data-senza-orario={!b.conOrario || undefined}
                  >
                    <span className={b.conOrario ? s.ora : s.priorita} data-alta={b.priorita === 'alta' || undefined}>
                      {b.conOrario ? b.orarioInizio : b.priorita && t(PRIORITA[b.priorita])}
                    </span>
                    <span className={s.punto} />
                    {/* Toccando la card si apre il dettaglio (FUNZ §4), sopra Oggi come «+ Crea» */}
                    <Link to={`/attivita/${b.id}`} state={sfondo} className={s.card}>
                      <span className={s.accento} />
                      {/* Persi e saltati non si spuntano, salvo i todo (MECC §24): niente cerchio vuoto */}
                      {(b.tipo === 'todo' || (b.stato !== 'perso' && b.stato !== 'saltato')) && (
                        <span className={s.spunta} data-fatta={b.stato === 'completato' || undefined}>
                          {b.stato === 'completato' && <Check size={12} strokeWidth={2.75} />}
                        </span>
                      )}
                      <span className={s.testi}>
                        <span className={s.titoloCard}>{titolo(b)}</span>
                        {sottotitolo(b) && <span className={s.sub}>{sottotitolo(b)}</span>}
                      </span>
                      {b.conOrario && b.orarioFine && (
                        <span className={`${s.fascia} ${s.soloDesktop}`}>
                          {b.orarioInizio} – {b.orarioFine}
                        </span>
                      )}
                      <span className={s.badge}>{t(TIPO[b.tipo])}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </>
        )}

        {vista === 'settimana' &&
          (pronto && settimana.every((g) => blocchi(g).length === 0) ? (
            <div className={s.vuoto}>
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
            <div className={s.settimana}>
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

        {griglia &&
          (pronto && griglia.every((c) => !c.delMese || blocchi(c.giorno).length === 0) ? (
            <div className={s.vuoto}>
              <span className={s.iconaVuoto}>
                <CalendarDays size={24} />
              </span>
              <span className={s.testiVuoto}>
                <span className={s.titoloVuoto}>
                  {t('meseVuoto', { mese: maiuscola(fmt(giorno, { month: 'long' })) })}
                </span>
                <span className={s.testoVuoto}>{t('meseVuotoTesto')}</span>
              </span>
              {creaAttivita}
            </div>
          ) : (
            <div className={s.mese}>
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
                <div className={s.legenda}>
                  {monthLegend(griglia.filter((c) => c.delMese).map((c) => blocchi(c.giorno))).map((v) => (
                    <span key={v.tipo} className={s.voceLegenda} data-tipo={v.tipo}>
                      <span className={s.puntoLegenda} />
                      {t('legendaGiorni', { tipo: t(TIPO[v.tipo]), n: v.giorni })}
                    </span>
                  ))}
                </div>
              </div>
              <section className={s.elencoGiorno} aria-label={giornoLungo}>
                <h2 className={s.giornoTitolo}>{giornoLungo}</h2>
                {blocchi(giorno).map((b) => (
                  <Mini key={b.id} b={b} />
                ))}
                {blocchi(giorno).length === 0 && <span className={s.libero}>{t('libero')}</span>}
              </section>
            </div>
          ))}
      </div>
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
