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
// desktop. In testa alla giornata il messaggio del ritorno dopo un'assenza (T-014, D-ASSENZA-1). Nella vista Giorno si
// trascinano i todo senza orario e i persi dalla maniglia a sei punti (MECC §15, D-DRAG-1): la card sollevata segue il
// puntatore, la riga di aggancio mostra orario e durata nel punto d'inserimento, il giorno della striscia sotto il dito
// si accende; al rilascio il toast offre «Annulla» per 5 s. Da tastiera: Invio, frecce, Invio o Esc. Arrivano con il
// loro task l'archivio impilato delle completate, «Il tuo progresso oggi» e «Prossime attività» dei mock (T-040).
import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Check, RefreshCcw, X } from 'lucide-react';
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { Link, useLocation, useNavigate, useSearchParams, type Location } from 'react-router';
import { dismissAbsenceNotice, readAbsenceNotice } from '../app/absence';
import { calendarDays, type BloccoCalendario } from '../app/calendar';
import { checkFromCalendar } from '../app/completion';
import { appDb, watch } from '../app/db';
import { moveBlock } from '../app/drag';
import { dayLoad, isDayKey, monthGrid, monthLegend, swipeDay, weekOf, type Vista } from '../domain/calendar';
import { canCheckFromCalendar, type PassoSpunta } from '../domain/completion';
import {
  canDrag,
  dropDays,
  dropDuration,
  dropReferences,
  dropStart,
  movedBlock,
  timeOnDay,
  type Rilascio,
} from '../domain/drag';
import { isLiveBlock } from '../domain/nowBlock';
import { sortDayDesktop } from '../domain/ordering';
import type { AvvisoAssenza } from '../domain/scheduler/absence';
import { localDaysBetween, localInstant, localTimeKey, MINUTE } from '../domain/time';
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
/** Le viste, nell'ordine del selettore; la chiave i18n coincide con il nome. */
const VISTE = ['giorno', 'settimana', 'mese'] as const satisfies readonly Vista[];
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

/** «Annulla» dopo un rilascio resta 5 s (MECC §15), come il toast del Dettaglio. */
const ANNULLA_MS = 5000;
/** Movimento del puntatore sulla maniglia oltre il quale la pressione diventa trascinamento. */
const SOGLIA_PRESA = 4;
/** La zona degli orari va oltre la giornata di tanto: lì si rilascia prima del primo blocco o dopo l'ultimo. */
const MARGINE_ZONA = 48;
/**
 * Dove si rilascerebbe (MECC §15, D-DRAG-1): il punto d'inserimento fra i blocchi con orario della giornata con
 * l'inizio agganciato, oppure un giorno della striscia.
 */
type Bersaglio = { indice: number; inizio: number } | { giorno: string };
/** Il blocco preso, da tastiera o dal puntatore; `punto` è dove disegnare la card sollevata che segue il puntatore. */
interface Presa {
  b: BloccoCalendario;
  bersaglio: Bersaglio | null;
  punto?: { x: number; y: number; w: number };
}
const etichetta = (b: BloccoCalendario) => `${titolo(b)} ${b.orarioInizio}${b.orarioFine ? `–${b.orarioFine}` : ''}`;
/** «oggi», «domani» o «giovedì 1», con l'orario se c'è: dove finisce il blocco rilasciato. */
function quando(g: string, ora: string | null, oggi: string): string {
  const d = localDaysBetween(localInstant(oggi, '12:00'), localInstant(g, '12:00'));
  const giorno =
    d === 0 || d === 1
      ? new Intl.RelativeTimeFormat(lingua, { numeric: 'auto' }).format(d, 'day')
      : fmt(g, { weekday: 'long', day: 'numeric' });
  return ora ? `${giorno} ${ora}` : giorno;
}
/** Nota della riga di aggancio (S1 `drag`): la durata e il passo di 5', o il perso che torna programmato. */
function notaAggancio(b: BloccoCalendario): string {
  const d = dropDuration(b);
  const nota = t(b.stato === 'perso' ? 'persoProgrammato' : 'aggancioCinque');
  return d === null ? nota : `${t('minutiDurata', { m: Math.round(d / MINUTE) })} · ${nota}`;
}
/**
 * Il suggerimento del trascinamento (S1 `drag`): fra quali blocchi si aggancia, o il giorno della striscia con l'orario
 * invariato; per un perso sulla striscia lo dice la riga di aggancio.
 */
function suggerimento({ b, bersaglio: x }: Presa, blocchi: BloccoCalendario[], oggi: string): string {
  if (!x) return '';
  if ('giorno' in x)
    return b.stato === 'perso' ? '' : t('giornoOrarioInvariato', { quando: quando(x.giorno, timeOnDay(b), oggi) });
  const orari = dropReferences(blocchi, b.id);
  const [a, c] = [orari[x.indice - 1], orari[x.indice]];
  if (a && c) return t('fraBlocchi', { a: etichetta(a), b: etichetta(c) });
  return a ? t('dopoBlocco', { a: etichetta(a) }) : c ? t('primaDiBlocco', { b: etichetta(c) }) : '';
}
/**
 * La riga di aggancio (S1 `drag`): su un orario l'orario e la nota; un perso sulla striscia giorno e orario con «perso →
 * programmato» (`drag=perso`); un todo senza orario sulla striscia non ce l'ha.
 */
function rigaAggancio({ b, bersaglio: x }: Presa, oggi: string): { pill: string; nota: string } | null {
  if (!x) return null;
  if ('indice' in x) return { pill: localTimeKey(x.inizio), nota: notaAggancio(b) };
  return b.stato === 'perso' ? { pill: quando(x.giorno, timeOnDay(b), oggi), nota: t('persoProgrammato') } : null;
}

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

  // Trascinamento (MECC §15): il blocco preso e il toast con «Annulla» dopo il rilascio (5 s). Durante la presa la
  // striscia offre i giorni dove il rilascio può valere: la settimana mostrata o, se ha giorni passati, i sette da oggi
  const [presa, setPresa] = useState<Presa | null>(null);
  const istruzioni = useId();
  const giorniStriscia = presa ? dropDays(settimana, oggi) : settimana;
  const [spostato, setSpostato] = useState<{ id: string; testo: string; tastiera: boolean; annulla: () => void }>();
  const timerToast = useRef<ReturnType<typeof setTimeout>>(undefined);
  const annullaToast = useRef<HTMLButtonElement>(null);
  useEffect(() => () => clearTimeout(timerToast.current), []);
  // Dopo un rilascio da tastiera il fuoco va ad «Annulla», perché la maniglia sparisce con il blocco spostato; quando il
  // toast si chiude torna sulla card spostata, se è ancora nella giornata, altrimenti sulla prima card
  useEffect(() => {
    if (spostato?.tastiera) annullaToast.current?.focus();
  }, [spostato]);
  const chiudiToast = (id: string) => {
    clearTimeout(timerToast.current);
    if (document.activeElement === annullaToast.current)
      (
        document.querySelector<HTMLElement>(`li[data-id="${id}"] a`) ??
        document.querySelector<HTMLElement>('li[data-id] a')
      )?.focus();
    setSpostato(undefined);
  };
  const rilascia = (b: BloccoCalendario, x: Bersaglio, tastiera: boolean) => {
    const r: Rilascio = 'giorno' in x ? { giorno: x.giorno } : { inizio: x.inizio };
    const dove = 'giorno' in x ? quando(x.giorno, timeOnDay(b), oggi) : quando(giorno, localTimeKey(x.inizio), oggi);
    // `null`: il rilascio non vale più (il blocco è cambiato nel frattempo): non c'è nulla da annullare
    void moveBlock(appDb, b.id, r, Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone).then(
      (annulla) => {
        if (!annulla) return;
        clearTimeout(timerToast.current);
        timerToast.current = setTimeout(() => chiudiToast(b.id), ANNULLA_MS);
        setSpostato({
          id: b.id,
          testo: t('spostatoA', { titolo: titolo(b), quando: dove }),
          tastiera,
          annulla: () => {
            chiudiToast(b.id);
            void annulla(Date.now()).catch(() => undefined);
          },
        });
      },
      () => undefined,
    );
  };
  const giornoBersaglio = presa?.bersaglio && 'giorno' in presa.bersaglio ? presa.bersaglio.giorno : null;
  const suggerito = presa ? suggerimento(presa, blocchi(giorno), oggi) : '';
  const riga = presa ? rigaAggancio(presa, oggi) : null;
  const trascinabili = blocchi(giorno).some(canDrag);

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
              {giorniStriscia.map((g) => {
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
                    data-bersaglio={g === giornoBersaglio || undefined}
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
            {/* S1 Desktop: la data del giorno con la nota del trascinamento a destra, in text-2 a riposo e nel primary con
                il suggerimento durante la presa */}
            <div className={`${s.rigaGiorno} ${s.soloDesktop}`}>
              <h2 className={s.giornoTitolo}>{giornoLungo}</h2>
              {(suggerito || trascinabili) && (
                <span className={s.notaGiorno} data-attiva={suggerito ? '' : undefined}>
                  {suggerito || t('notaTrascina')}
                </span>
              )}
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
                giorno={giorno}
                settimana={giorniStriscia}
                sfondo={sfondo}
                verso={verso}
                presa={presa}
                suggerito={suggerito}
                riga={riga}
                istruzioni={istruzioni}
                onPresa={setPresa}
                onRilascio={rilascia}
              />
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
      {presa?.punto && !presa.bersaglio && (
        <div
          className={s.fantasma}
          data-tipo={presa.b.tipo}
          style={{ width: presa.punto.w, transform: `translate(${presa.punto.x}px, ${presa.punto.y}px)` }}
          aria-hidden
        >
          <CardSollevata b={presa.b} />
        </div>
      )}
      <p className={s.soloLettore} role="status">
        {presa && [riga && `${riga.pill} · ${riga.nota}`, suggerito].filter(Boolean).join('. ')}
      </p>
      <span id={istruzioni} hidden>
        {t('istruzioniSposta')}
      </span>
      <div className={s.regioneToast} role="status">
        {spostato && (
          <div className={s.toast}>
            <span className={s.testoToast}>{spostato.testo}</span>
            <button ref={annullaToast} type="button" className={s.annullaToast} onClick={spostato.annulla}>
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
 * subito o apre il Dettaglio sulla sheet giusta (revisione delle fasi, voci rimaste); se nel frattempo la spunta non è
 * più possibile, o la scrittura fallisce, apre il Dettaglio, che spiega o ha lo stesso comando con il messaggio
 * d'errore. L'orologio batte al minuto per la card in corso e per la finestra della routine (D-CAL-2).
 * Le card trascinabili (MECC §15, `canDrag`) hanno la maniglia: dal puntatore la pressione diventa trascinamento oltre
 * pochi pixel e il bersaglio si legge sotto il puntatore; da tastiera Invio prende, le frecce scelgono fra gli orari
 * validi (su e giù) e i giorni validi della striscia (sinistra e destra), Invio rilascia, Esc lascia (D-DRAG-1).
 */
function Giornata({
  blocchi,
  giorno,
  settimana,
  sfondo,
  verso,
  presa,
  suggerito,
  riga,
  istruzioni,
  onPresa,
  onRilascio,
}: {
  blocchi: BloccoCalendario[];
  giorno: string;
  settimana: string[];
  sfondo: Sfondo;
  verso?: Verso;
  presa: Presa | null;
  suggerito: string;
  riga: { pill: string; nota: string } | null;
  /** Id del testo nascosto con i comandi da tastiera, che descrive la maniglia. */
  istruzioni: string;
  onPresa: (p: Presa | null) => void;
  onRilascio: (b: BloccoCalendario, x: Bersaglio, tastiera: boolean) => void;
}) {
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

  const lista = useRef<HTMLOListElement>(null);
  /** La pressione sulla maniglia: diventa trascinamento oltre `SOGLIA_PRESA`; `bersaglio` è l'ultimo mostrato. */
  const puntatore = useRef<{
    b: BloccoCalendario;
    x0: number;
    y0: number;
    /** Il bordo sinistro della card, dove resta la card sollevata. */
    x: number;
    dy: number;
    w: number;
    attiva: boolean;
    bersaglio: Bersaglio | null;
  } | null>(null);
  const aggancio = (b: BloccoCalendario, indice: number, istante: number): Bersaglio | null => {
    const inizio = dropStart(dropReferences(blocchi, b.id), indice, dropDuration(b), giorno, istante);
    return inizio === null ? null : { indice, inizio };
  };
  const suGiorno = (b: BloccoCalendario, g: string, istante: number): Bersaglio | null =>
    movedBlock(b, { giorno: g }, istante) ? { giorno: g } : null;
  // Al rilascio il bersaglio si ricalcola con l'istante del rilascio: fra l'ultimo movimento e il rilascio può
  // passare un multiplo di 5' (mai prima di adesso, D-DRAG-1)
  const adesso = (b: BloccoCalendario, x: Bersaglio) =>
    'giorno' in x ? suGiorno(b, x.giorno, Date.now()) : aggancio(b, x.indice, Date.now());

  /**
   * Il bersaglio sotto il puntatore (D-DRAG-1): un giorno della striscia, se lì il rilascio vale; altrimenti, nella zona
   * degli orari (sotto la fascia senza orario su mobile, sopra su desktop, e un margine oltre la giornata), il punto
   * d'inserimento dato dalle card con orario il cui centro sta sopra il puntatore. Fuori, nessuno: il blocco resta.
   * Le posizioni sono quelle naturali, senza lo spazio aperto per il blocco del trascinamento: altrimenti spingerebbe le
   * card sotto il dito e tratterrebbe il punto d'inserimento.
   */
  const bersaglioIn = (b: BloccoCalendario, x: number, y: number): Bersaglio | null => {
    const istante = Date.now();
    const sotto = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-giorno-striscia]');
    if (sotto?.dataset.giornoStriscia) return suGiorno(b, sotto.dataset.giornoStriscia, istante);
    const ol = lista.current;
    if (!ol) return null;
    const blocco = ol.querySelector<HTMLElement>(':scope > [data-blocco]');
    const spazio = blocco ? blocco.offsetHeight + parseFloat(getComputedStyle(ol).rowGap) : 0;
    const naturale = (el: HTMLElement) => {
      const q = el.getBoundingClientRect();
      const d = blocco && blocco.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING ? spazio : 0;
      return { top: q.top - d, bottom: q.bottom - d };
    };
    const r = ol.getBoundingClientRect();
    const fondo = r.bottom - spazio;
    const righe = [...ol.querySelectorAll<HTMLElement>(':scope > li[data-id]')];
    const fascia = righe.filter((el) => el.dataset.senzaOrario).map(naturale);
    const [su, giu] = desktop
      ? [r.top - MARGINE_ZONA, fascia[0]?.top ?? fondo + MARGINE_ZONA]
      : [fascia.at(-1)?.bottom ?? r.top - MARGINE_ZONA, fondo + MARGINE_ZONA];
    if (x < r.left || x > r.right || y < su || y > giu) return null;
    const sopra = righe.filter((el) => {
      if (el.dataset.senzaOrario || el.dataset.id === b.id) return false;
      const q = naturale(el);
      return (q.top + q.bottom) / 2 < y;
    });
    return aggancio(b, sopra.length, istante);
  };

  // Puntatore: si prende dalla maniglia, e col mouse da tutta la card (il cursore di presa di S1); al tocco il resto
  // della card scorre, apre il Dettaglio e spunta come prima; il cerchio non prende mai. Quando il gesto diventa
  // trascinamento la card cattura il puntatore; la pressione non scorre la pagina né cambia periodo (`.corpo`)
  const trascinata = useRef(false);
  const giu = (e: PointerEvent<HTMLDivElement>) => {
    const b = blocchi.find((x) => x.id === e.currentTarget.closest<HTMLElement>('[data-id]')?.dataset.id);
    const bottone = (e.target as Element).closest('button');
    const dallaManiglia = !!bottone?.hasAttribute('data-maniglia');
    trascinata.current = false;
    if (
      !b ||
      !canDrag(b) ||
      e.button !== 0 ||
      (bottone && !dallaManiglia) ||
      (!dallaManiglia && e.pointerType !== 'mouse')
    )
      return;
    e.stopPropagation();
    if (!dallaManiglia) e.preventDefault(); // niente selezione del testo né fuoco sul collegamento
    const card = e.currentTarget.getBoundingClientRect();
    const [x0, y0] = [e.clientX, e.clientY];
    puntatore.current = { b, x0, y0, x: card.left, dy: y0 - card.top, w: card.width, attiva: false, bersaglio: null };
  };
  // La card sollevata resta nella colonna della giornata e segue il puntatore in verticale (S1 `drag`): il dito sceglie
  // anche di lato, sui giorni della striscia, senza portarla fuori dallo schermo
  const muovi = (e: PointerEvent<HTMLDivElement>) => {
    const p = puntatore.current;
    if (!p || (!p.attiva && Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < SOGLIA_PRESA)) return;
    // Si cattura solo adesso: un clic senza movimento resta del collegamento e apre il Dettaglio
    if (!p.attiva) e.currentTarget.setPointerCapture(e.pointerId);
    p.attiva = true;
    p.bersaglio = bersaglioIn(p.b, e.clientX, e.clientY);
    onPresa({ b: p.b, bersaglio: p.bersaglio, punto: { x: p.x, y: e.clientY - p.dy, w: p.w } });
  };
  const su = () => {
    const p = puntatore.current;
    puntatore.current = null;
    if (!p?.attiva) return;
    trascinata.current = true;
    onPresa(null);
    const x = p.bersaglio && adesso(p.b, p.bersaglio);
    if (x) onRilascio(p.b, x, false);
  };
  // Il clic che chiude un trascinamento col mouse non apre il Dettaglio
  const clic = (e: MouseEvent) => {
    if (!trascinata.current) return;
    trascinata.current = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const lascia = () => {
    if (puntatore.current?.attiva) onPresa(null);
    puntatore.current = null;
  };
  // Esc durante il trascinamento col puntatore: il blocco resta dov'era
  const trascina = !!presa?.punto;
  useEffect(() => {
    if (!trascina) return;
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      puntatore.current = null;
      onPresa(null);
    };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [trascina, onPresa]);

  // Tastiera, l'alternativa al trascinamento: Invio prende, le frecce scelgono, Invio rilascia, Esc lascia
  const daTastiera = (b: BloccoCalendario) => presa?.b.id === b.id && !presa.punto;
  const tasto = (e: KeyboardEvent<HTMLButtonElement>, b: BloccoCalendario) => {
    const x = daTastiera(b) ? (presa?.bersaglio ?? null) : undefined;
    if (x === undefined) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      onPresa({ b, bersaglio: null });
      return;
    }
    const istante = Date.now();
    const passo = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    // Il prossimo bersaglio valido nella direzione; senza bersaglio, il primo (o l'ultimo andando indietro)
    const scegli = (validi: Bersaglio[], i: number) => {
      const nuovo =
        validi[i < 0 ? (passo > 0 ? 0 : validi.length - 1) : Math.min(Math.max(i + passo, 0), validi.length - 1)];
      if (nuovo) onPresa({ b, bersaglio: nuovo });
    };
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowDown': {
        const agganci = Array.from({ length: dropReferences(blocchi, b.id).length + 1 }, (_, i) =>
          aggancio(b, i, istante),
        );
        const validi = agganci.filter((v): v is Bersaglio => v !== null);
        scegli(validi, x && 'indice' in x ? validi.findIndex((v) => 'indice' in v && v.indice === x.indice) : -1);
        break;
      }
      case 'ArrowLeft':
      case 'ArrowRight': {
        const validi = settimana.map((g) => suGiorno(b, g, istante)).filter((v): v is Bersaglio => v !== null);
        scegli(validi, x && 'giorno' in x ? validi.findIndex((v) => 'giorno' in v && v.giorno === x.giorno) : -1);
        break;
      }
      case 'Enter':
      case ' ':
        onPresa(null);
        {
          const ora = x && adesso(b, x);
          if (ora) onRilascio(b, ora, true);
        }
        break;
      case 'Escape':
        onPresa(null);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const righe = desktop ? sortDayDesktop(blocchi) : blocchi;
  // Il blocco del trascinamento (S1 `drag`): su un orario la giornata gli fa spazio nel punto d'inserimento, prima della
  // card con orario al suo indice o dopo l'ultima (in cima o in coda se non ce ne sono), e dal puntatore ci mette la card
  // sollevata; sulla striscia sta in testa alla giornata (`drag=giorno`), da tastiera sopra la card presa. Su desktop il
  // suggerimento sta nella riga del giorno: un blocco che avrebbe solo quello non c'è
  const x = presa?.bersaglio;
  const orari = presa ? dropReferences(blocchi, presa.b.id) : [];
  const sottoAggancio = x && 'indice' in x ? orari[x.indice] : undefined;
  const ultimo = orari.at(-1);
  const testo = desktop ? '' : suggerito;
  const pos =
    !x || (!testo && !riga)
      ? -1
      : 'giorno' in x
        ? presa.punto
          ? 0
          : righe.findIndex((r) => r.id === presa.b.id)
        : sottoAggancio
          ? righe.indexOf(sottoAggancio)
          : ultimo
            ? righe.indexOf(ultimo) + 1
            : desktop
              ? 0
              : righe.length;
  const bloccoAggancio = presa && (
    <li key="blocco" className={s.bloccoAggancio} data-blocco data-tipo={presa.b.tipo} aria-hidden>
      <Suggerimento testo={testo} riga={riga} />
      {presa.punto && x && 'indice' in x && <CardSollevata b={presa.b} />}
    </li>
  );
  return (
    <ol ref={lista} className={s.giornata} data-verso={verso}>
      {righe.map((b, i) => {
        const fatta = b.stato === 'completato';
        // Persi e saltati non si spuntano, salvo i todo (MECC §24): niente cerchio, ma il suo posto resta (titoli allineati)
        const assente = b.tipo !== 'todo' && (b.stato === 'perso' || b.stato === 'saltato');
        const sub = sottotitolo(b);
        const presaQui = presa?.b.id === b.id;
        return [
          i === pos && bloccoAggancio,
          <li
            key={b.id}
            className={s.riga}
            data-id={b.id}
            data-tipo={b.tipo}
            data-terminale={terminale(b) || undefined}
            data-completato={fatta || undefined}
            data-senza-orario={!b.conOrario || undefined}
            data-in-corso={isLiveBlock(b, now) || undefined}
            data-sollevata={presaQui ? (presa.punto ? 'puntatore' : 'tastiera') : undefined}
          >
            <span className={b.conOrario ? s.ora : s.priorita} data-alta={b.priorita === 'alta' || undefined}>
              {b.conOrario ? b.orarioInizio : b.priorita && t(PRIORITA[b.priorita])}
            </span>
            <span className={s.punto} />
            <div
              className={s.card}
              onPointerDown={giu}
              onPointerMove={muovi}
              onPointerUp={su}
              onPointerCancel={lascia}
              onClickCapture={clic}
            >
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
              {/* Maniglia a sei punti solo sulle card che si trascinano (MECC §15); sopra il collegamento della card */}
              {canDrag(b) && (
                <button
                  type="button"
                  className={s.maniglia}
                  data-maniglia
                  aria-label={t('spostaTitolo', { titolo: titolo(b) })}
                  aria-describedby={istruzioni}
                  aria-pressed={daTastiera(b)}
                  onKeyDown={(e) => tasto(e, b)}
                  onBlur={() => daTastiera(b) && onPresa(null)}
                >
                  <IconaManiglia />
                </button>
              )}
            </div>
          </li>,
        ];
      })}
      {pos === righe.length && bloccoAggancio}
    </ol>
  );
}

/** La card sollevata (S1 `drag`): la copia della card presa, con l'ombra del trascinamento e la maniglia. */
function CardSollevata({ b }: { b: BloccoCalendario }) {
  const sub = sottotitolo(b);
  return (
    <div className={`${s.card} ${s.sollevata}`}>
      <span className={s.accento} />
      <span className={s.spunta} />
      <span className={s.testi}>
        <span className={s.titoloCard}>{titolo(b)}</span>
        {sub && <span className={s.sub}>{sub}</span>}
      </span>
      <span className={s.badge}>{t(TIPO[b.tipo])}</span>
      <IconaManiglia />
    </div>
  );
}

/**
 * Il blocco del trascinamento di S1 `drag`: il suggerimento nel primary, che va a capo, e la riga di aggancio con la
 * pill (l'orario, o giorno e orario per un perso sulla striscia), la linea tratteggiata e la nota.
 */
function Suggerimento({ testo, riga }: { testo: string; riga: { pill: string; nota: string } | null }) {
  return (
    <>
      {testo && <span className={s.suggerimento}>{testo}</span>}
      {riga && (
        <span className={s.aggancio} data-aggancio>
          <span className={s.oraAggancio}>{riga.pill}</span>
          <span className={s.lineaAggancio} />
          <span className={s.notaAggancio}>{riga.nota}</span>
        </span>
      )}
    </>
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
