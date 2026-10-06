// «+ Crea» (S4 Crea Panel/Mobile/Desktop; FUNZ §3, MECC §2): quattro tipi nello stesso form, campi per tipo. Su
// mobile una sheet sotto i 56 px di testa, da 1024 px un pannello a destra di 440 (DESIGN.md, S4 Desktop). La
// validazione è del dominio (`validateActivity`): la CTA è attiva solo se la bozza è valida. Si parte dal giorno
// selezionato in Oggi se cade fra oggi e oggi + 6, altrimenti da oggi, e le date si scelgono solo lì (MECC §2, G5): il
// todo non ha data né corso e l'orizzonte dice fin dove rotola. Nessuna ×: «Annulla», Esc o il trascinamento in basso
// del bordo alto; dopo la creazione Oggi mostra «… creato» con «Annulla» (`avvisi.ts`). In Modifica (T-042, S4
// `mode=edit`) lo stesso foglio parte dall'attività, il tipo resta, «Salva» torna a Oggi con «Modifiche salvate». L'anticipo
// libero del promemoria (MECC §13.1, fino a 31 giorni) non è nel mock: riga «Altro anticipo» con le chip di S4
// (T-019, divergenza 35).
import {
  AlarmClock,
  ArrowRight,
  Bell,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Flag,
  GraduationCap,
  MapPin,
  NotebookPen,
  Plus,
  Repeat,
  SquareCheckBig,
  Sun,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate, useParams, type Location } from 'react-router';
import { createActivity, editActivity } from '../app/activities';
import { deleteBlock, readDetail, type DettaglioAttivita } from '../app/completion';
import { deleteRecurrence } from '../app/recurrences';
import { courseCards, type SchedaCorso } from '../app/courses';
import { appDb, watch } from '../app/db';
import {
  ANTICIPI,
  DURATA_TODO,
  GRADINI_DURATA,
  MAX_ANTICIPO_MINUTI,
  MAX_ANTICIPO_SVEGLIA,
  MAX_CARATTERI_VOCE,
  MAX_VOCI_CHECKLIST,
  creationDays,
  endsNextDay,
  recurrenceLastDay,
  recurrenceTerm,
  startDay,
  validateActivity,
  wallDuration,
  type BozzaAttivita,
  type Termine,
  type VoceBozza,
} from '../domain/activity';
import { horizonLastDay } from '../domain/lost';
import { local, localDayKey, localInstant } from '../domain/time';
import type { Orizzonte, Priorita } from '../domain/types';
import { lascia } from './avvisi';
import { durata, fmtData, fuso, SETTIMANA } from './format';
import { lingua, t, type Chiave } from './i18n';
import s from './Create.module.css';

type Tipo = BozzaAttivita['tipo'];
/** Una riga della checklist o delle fasi: in Modifica porta la spunta della voce o l'id della fase (D-MOD-1). */
type Riga = Exclude<VoceBozza, string>;
const TIPI: { tipo: Tipo; chiave: Chiave; Icona: typeof Plus }[] = [
  { tipo: 'todo', chiave: 'tipoTodo', Icona: SquareCheckBig },
  { tipo: 'studio', chiave: 'tipoStudio', Icona: GraduationCap },
  { tipo: 'routine', chiave: 'tipoRoutine', Icona: Repeat },
  { tipo: 'evento', chiave: 'tipoEvento', Icona: CalendarCheck },
];
const TITOLO: Record<Tipo, Chiave> = {
  todo: 'titoloTodo',
  studio: 'titoloStudio',
  routine: 'titoloRoutine',
  evento: 'titoloEvento',
};
const CTA: Record<Tipo, Chiave> = {
  todo: 'creaTodo',
  studio: 'creaStudio',
  routine: 'creaRoutine',
  evento: 'creaEvento',
};
const ORIZZONTI: [Orizzonte, Chiave, typeof Plus][] = [
  ['giorno', 'orizzonteGiorno', Sun],
  ['settimana', 'orizzonteSettimana', CalendarRange],
  ['mese', 'orizzonteMese', CalendarDays],
];
const PRIORITA: [Priorita, Chiave][] = [
  ['alta', 'prioritaAlta'],
  ['normale', 'prioritaNormale'],
  ['bassa', 'prioritaBassa'],
];
const UNITA: [NonNullable<Termine>['unita'], Chiave][] = [
  ['giorni', 'unitaGiorni'],
  ['settimane', 'unitaSettimane'],
  ['mesi', 'unitaMesi'],
];
const fmtGiorno = new Intl.DateTimeFormat(lingua, { weekday: 'narrow' });
const fmtNumero = new Intl.DateTimeFormat(lingua, { day: 'numeric' });
const fmtMese = new Intl.DateTimeFormat(lingua, { month: 'long', year: 'numeric' });
const fmtSettimana = new Intl.DateTimeFormat(lingua, { weekday: 'long' });
const anticipo = (min: number) =>
  min === 0
    ? t('anticipoInizio')
    : min === 1440
      ? t('anticipoGiorno')
      : min === 60
        ? t('anticipoOra')
        : min % 1440 === 0
          ? t('anticipoGiorni', { n: min / 1440 })
          : min % 60 === 0
            ? t('anticipoOre', { n: min / 60 })
            : t('anticipoMin', { n: min });
/** Unità dell'anticipo libero (MECC §13.1 «libero fino a 31 giorni», FUNZ §7.2), in minuti. */
const UNITA_ANTICIPO: { min: number; chiave: Chiave }[] = [
  { min: 1, chiave: 'unitaMinuti' },
  { min: 60, chiave: 'unitaOre' },
  { min: 1440, chiave: 'unitaGiorni' },
];
const alle = (hhmm: string, min: number) => {
  const [h, m] = hhmm.split(':').map(Number) as [number, number];
  const tot = (h * 60 + m + min) % 1440;
  return `${String(Math.floor(tot / 60)).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
};

interface Form {
  tipo: Tipo;
  titolo: string;
  note: string;
  conOrario: boolean;
  tuttoIlGiorno: boolean;
  conFine: boolean;
  inizio: string;
  fine: string;
  durata: number;
  orizzonte: Orizzonte;
  priorita: Priorita;
  checklist: Riga[];
  fasi: Riga[];
  giorni: number[];
  giorno: string;
  dataInizio: string;
  termine: Termine;
  corsoId: string | null;
  luogo: string;
  modo: 'auto' | 'off' | 'personalizzato';
  anticipi: number[];
  sveglie: number[];
}

/** Trascinamento in giù oltre il quale il foglio si chiude senza salvare (S4 Crea). */
const SOGLIA_CHIUSURA = 110;

/** Il messaggio dopo la creazione (TESTI): «Todo creato · …», «Evento creato», «Routine creata · …». */
const creato = (b: BozzaAttivita): string =>
  b.tipo === 'todo'
    ? t('todoCreato', { titolo: b.titolo || t('tipoTodo') })
    : t(b.tipo === 'evento' ? 'eventoCreato' : b.tipo === 'routine' ? 'routineCreata' : 'studioCreata');

function initial(partenza: string): Form {
  const now = new Date();
  // L'ora piena successiva, al più le 23:00: dopo le 23 un «00:00» di oggi sarebbe già passato
  const ora = `${String(Math.min(now.getHours() + 1, 23)).padStart(2, '0')}:00`;
  return {
    tipo: 'todo',
    titolo: '',
    note: '',
    conOrario: false,
    tuttoIlGiorno: false,
    conFine: false,
    inizio: ora,
    fine: alle(ora, 60),
    durata: DURATA_TODO,
    orizzonte: 'giorno',
    priorita: 'normale',
    checklist: [],
    fasi: [],
    giorni: [],
    giorno: partenza,
    dataInizio: partenza,
    termine: null,
    corsoId: null,
    luogo: '',
    modo: 'auto',
    anticipi: [],
    sveglie: [],
  };
}

/** Il form della Modifica (T-042): la definizione per routine e studio, il blocco per todo ed evento. */
function fromDetail({ blocco: b, ricorrenza: r, fasi }: DettaglioAttivita): Form {
  const base = initial(b.giornoLocale);
  const p = r?.promemoria ?? b.promemoria ?? { modo: 'auto' };
  const anticipi = p.modo === 'personalizzato' ? p.anticipi : [];
  const comune: Form = {
    ...base,
    tipo: b.tipo,
    titolo: r?.titolo ?? b.titolo ?? '',
    note: r?.note ?? b.note ?? '',
    fasi: fasi.map(({ id, etichetta }) => ({ testo: etichetta, id })),
    modo: p.modo,
    anticipi: anticipi.map((a) => a.minuti),
    sveglie: anticipi.filter((a) => a.sveglia).map((a) => a.minuti),
  };
  if (r)
    return {
      ...comune,
      inizio: r.orarioInizio,
      fine: r.orarioFine ?? alle(r.orarioInizio, 60),
      conFine: r.orarioFine !== null,
      giorni: r.giorni,
      dataInizio: r.dataInizio,
      termine: recurrenceTerm(r.dataInizio, r.dataFine),
      corsoId: r.corsoId,
    };
  return {
    ...comune,
    conOrario: b.conOrario,
    tuttoIlGiorno: !b.conOrario,
    ...(b.conOrario &&
      b.orarioFine !== null && {
        inizio: b.orarioInizio,
        fine: b.orarioFine,
        durata: wallDuration(b.orarioInizio, b.orarioFine) ?? DURATA_TODO,
      }),
    orizzonte: b.orizzonte ?? 'giorno',
    priorita: b.priorita ?? 'normale',
    checklist: b.checklist?.map(({ testo, fatta }) => ({ testo, fatta })) ?? [],
    luogo: b.luogo ?? '',
  };
}

function toDraft(f: Form): BozzaAttivita {
  const comune = {
    titolo: f.titolo,
    note: f.note,
    promemoria:
      f.modo === 'personalizzato'
        ? { modo: f.modo, anticipi: f.anticipi.map((minuti) => ({ minuti, sveglia: f.sveglie.includes(minuti) })) }
        : { modo: f.modo },
  };
  const ricorrenza = { giorni: f.giorni, inizio: f.inizio, dataInizio: f.dataInizio, termine: f.termine };
  switch (f.tipo) {
    case 'todo':
      return {
        ...comune,
        tipo: 'todo',
        // Il todo parte dal giorno di partenza (MECC §2, G5)
        giorno: f.giorno,
        orario: f.conOrario ? { inizio: f.inizio, durata: f.durata } : null,
        orizzonte: f.orizzonte,
        priorita: f.priorita,
        checklist: f.checklist,
        corsoId: null,
      };
    case 'evento':
      return {
        ...comune,
        tipo: 'evento',
        giorno: f.giorno,
        orario: f.tuttoIlGiorno ? null : { inizio: f.inizio, fine: f.fine },
        luogo: f.luogo,
        fasi: f.fasi,
      };
    case 'routine':
      return { ...comune, ...ricorrenza, tipo: 'routine', fine: f.conFine ? f.fine : null, fasi: f.fasi };
    case 'studio':
      return { ...comune, ...ricorrenza, tipo: 'studio', fine: f.fine, corsoId: f.corsoId };
  }
}

const toggle = (lista: number[], v: number) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);

function Chip(p: { on: boolean; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={s.chip} aria-pressed={p.on} disabled={p.disabled} onClick={p.onClick}>
      {p.children}
    </button>
  );
}

function Interruttore({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={s.interruttore} onClick={onClick}>
      {children}
      <span className={s.knob} />
    </button>
  );
}

/**
 * Data con il selettore nativo sotto un campo disegnato (S4): l'input trasparente copre il campo, il tocco apre il
 * selettore. `grande` = data dell'evento e del todo (giorno a 26); altrimenti il campo «Inizio» della ricorrenza.
 */
function CampoData(p: {
  giorno: string;
  grande?: boolean;
  /** I giorni fra cui si sceglie (MECC §2, G5: da oggi a oggi + 6). */
  giorni: readonly [string, string];
  onChange: (g: string) => void;
}) {
  const d = localInstant(p.giorno, '00:00');
  return (
    <label className={p.grande ? s.data : s.campo}>
      {p.grande ? (
        <>
          <span className={s.numeroData}>{fmtNumero.format(d)}</span>
          <span className={s.colonna}>
            <span className={s.meseAnno}>{fmtMese.format(d)}</span>
            <span className={s.campoEtichetta}>{fmtSettimana.format(d)}</span>
          </span>
        </>
      ) : (
        <span className={s.colonna}>
          <span className={s.campoEtichetta}>{t('inizio')}</span>
          <span className={s.campoValore}>{fmtData.format(d)}</span>
        </span>
      )}
      <ChevronDown size={p.grande ? 16 : 14} className={s.freccia} />
      <input
        type="date"
        className={s.dataNativa}
        value={p.giorno}
        min={p.giorni[0]}
        max={p.giorni[1]}
        required
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            // selettore non disponibile: resta l'input nativo
          }
        }}
        onChange={(e) => {
          const g = e.currentTarget.value;
          if (g && g >= p.giorni[0] && g <= p.giorni[1]) p.onChange(g);
        }}
      />
    </label>
  );
}

function Etichetta({ Icona, children }: { Icona: typeof Plus; children: ReactNode }) {
  return (
    <span className={s.etichetta}>
      <Icona size={14} />
      {children}
    </span>
  );
}

/** Checklist (todo, MECC §4) o fasi (routine ed evento, MECC §5): voci vuote scartate dal dominio. */
function Voci(p: { voci: Riga[]; fasi?: boolean; onChange: (v: Riga[]) => void }) {
  const { voci, fasi, onChange } = p;
  const cambia = (i: number, testo: string) => onChange(voci.map((x, j) => (j === i ? { ...x, testo } : x)));
  const scambia = (i: number, j: number) => {
    const a = [...voci];
    [a[i], a[j]] = [a[j]!, a[i]!];
    onChange(a);
  };
  const pieno = !fasi && voci.length >= MAX_VOCI_CHECKLIST;
  return (
    <div className={fasi ? s.fasi : s.checklist}>
      {voci.map((v, i) => (
        <div key={i} className={fasi ? s.fase : s.voce}>
          {fasi ? (
            <>
              <span className={s.pallino} />
              <span className={s.numeroFase}>{String(i + 1).padStart(2, '0')}</span>
            </>
          ) : (
            <span className={s.casella} />
          )}
          <input
            className={s.inputVoce}
            value={v.testo}
            maxLength={fasi ? undefined : MAX_CARATTERI_VOCE}
            placeholder={t(fasi ? 'fase' : 'voce')}
            aria-label={t(fasi ? 'fase' : 'voce')}
            onChange={(e) => cambia(i, e.currentTarget.value)}
          />
          {fasi && (
            <>
              <button
                type="button"
                className={s.iconaVoce}
                aria-label={t('spostaSu')}
                disabled={i === 0}
                onClick={() => scambia(i, i - 1)}
              >
                <ChevronUp size={16} />
              </button>
              <button
                type="button"
                className={s.iconaVoce}
                aria-label={t('spostaGiu')}
                disabled={i === voci.length - 1}
                onClick={() => scambia(i, i + 1)}
              >
                <ChevronDown size={16} />
              </button>
            </>
          )}
          <button
            type="button"
            className={`${s.iconaVoce} ${s.elimina}`}
            aria-label={t(fasi ? 'eliminaFase' : 'eliminaVoce')}
            onClick={() => onChange(voci.filter((_, j) => j !== i))}
          >
            <X size={16} />
          </button>
        </div>
      ))}
      {!pieno && (
        <button
          type="button"
          className={fasi ? s.aggiungiFase : s.aggiungiVoce}
          onClick={() => onChange([...voci, { testo: '' }])}
        >
          <span className={fasi ? undefined : s.casellaNuova}>
            <Plus size={fasi ? 14 : 12} strokeWidth={2.25} />
          </span>
          {fasi ? t(voci.length ? 'aggiungiFase' : 'fasi') : t(voci.length ? 'aggiungiVoce' : 'checklist')}
        </button>
      )}
    </div>
  );
}

// `/crea`, o `/attivita/:id/modifica`: la Modifica apre lo stesso foglio quando l'attività è letta (T-042)
export function Create() {
  const { id } = useParams();
  const [d, setD] = useState<DettaglioAttivita | null>();
  useEffect(() => {
    if (id) void readDetail(appDb, id).then((x) => setD(x ?? null));
  }, [id]);
  if (!id) return <Foglio />;
  if (d === null) return <Navigate to="/" replace />;
  return d ? <Foglio modifica={d} /> : null;
}

function Foglio({ modifica }: { modifica?: DettaglioAttivita }) {
  const navigate = useNavigate();
  const location = useLocation();
  const primaSchermata = location.key === 'default';
  const chiudi = () => (primaSchermata ? navigate('/') : navigate(-1));
  const dialogo = useRef<HTMLDialogElement>(null);
  // Il giorno di partenza (MECC §2, G5): il giorno selezionato in Oggi sotto il foglio, se cade fra oggi e oggi + 6
  const [oggi] = useState(() => localDayKey(Date.now()));
  const giorni = creationDays(oggi);
  const sfondo = (location.state as { sfondo?: Location } | null)?.sfondo;
  const [f, setF] = useState(() => {
    if (modifica) return fromDetail(modifica);
    const selezionato = sfondo?.pathname === '/' ? new URLSearchParams(sfondo.search).get('giorno') : null;
    return initial(startDay(selezionato, oggi));
  });
  // Su mobile il foglio si chiude senza salvare trascinandolo in basso dal bordo alto, oltre 110 px (S4); col mouse no
  const [giu, setGiu] = useState(0);
  const presa = useRef<number | null>(null);
  const tira = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse') return;
      presa.current = e.clientY;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (presa.current !== null) setGiu(Math.max(0, e.clientY - presa.current));
    },
    onPointerUp: () => {
      if (presa.current === null) return;
      presa.current = null;
      if (giu > SOGLIA_CHIUSURA) chiudi();
      else setGiu(0);
    },
    onPointerCancel: () => {
      presa.current = null;
      setGiu(0);
    },
  };
  const [corsi, setCorsi] = useState<SchedaCorso[]>([]);
  const [errore, setErrore] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [libero, setLibero] = useState({ n: '', unita: 1440 });
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);
  useEffect(() => watch(() => courseCards(appDb), setCorsi), []);

  const bozza = toDraft(f);
  const pronta = validateActivity(bozza).ok;
  const { tipo } = f;
  const ricorrente = tipo === 'routine' || tipo === 'studio';
  const conFasi = tipo === 'routine' || tipo === 'evento';
  // Blocchi senza orario: il todo va solo nel digest (MECC §2), l'evento tutto il giorno avvisa alle 08:00 (§13.2)
  const soloDigest = tipo === 'todo' && !f.conOrario;
  const senzaOrario = soloDigest || (tipo === 'evento' && f.tuttoIlGiorno);
  const mostraOrari = ricorrente || (tipo === 'todo' && f.conOrario) || (tipo === 'evento' && !f.tuttoIlGiorno);
  const mostraFine = tipo === 'studio' || tipo === 'evento' || (tipo === 'routine' && f.conFine);
  const minuti = mostraFine ? wallDuration(f.inizio, f.fine) : null;
  const fineErrata = tipo === 'evento' && minuti !== null && endsNextDay(f.inizio, f.fine);
  const giornoDopo = !fineErrata && minuti !== null && endsNextDay(f.inizio, f.fine);
  const svegliabili = f.anticipi.filter((m) => m <= MAX_ANTICIPO_SVEGLIA).sort((a, b) => b - a);
  const liberi = f.anticipi.filter((m) => !(ANTICIPI as readonly number[]).includes(m)).sort((a, b) => b - a);
  const minutiLiberi = Number(libero.n) * libero.unita;
  const liberoValido =
    Number.isInteger(minutiLiberi) &&
    minutiLiberi > 0 &&
    minutiLiberi <= MAX_ANTICIPO_MINUTI &&
    !f.anticipi.includes(minutiLiberi);

  // Un solo salvataggio alla volta: un doppio tocco non crea due attività
  const crea = async () => {
    setInCorso(true);
    try {
      // ponytail: Date.now() e il fuso letti qui come in Courses; passano dalla porta Clock quando nasce
      if (modifica) {
        const r = await editActivity(appDb, modifica.blocco.id, bozza, Date.now(), fuso());
        if (r.ok) {
          // «Salva» torna a Oggi con «Modifiche salvate», senza «Annulla» (S1, handoff §3 n. 28): da Oggi c'erano il
          // Dettaglio e la Modifica sopra
          lascia({ id: modifica.blocco.id, testo: t('modificheSalvate'), tono: 'info' });
          return sfondo ? navigate(-2) : navigate('/', { replace: true });
        }
        throw new Error('modifica');
      }
      const r = await createActivity(appDb, bozza, Date.now(), fuso());
      if (r.ok) {
        // Oggi mostra «… creato» con «Annulla», che toglie l'attività appena creata (G5)
        const { id } = r;
        lascia({
          id,
          testo: creato(bozza),
          tono: bozza.tipo === 'todo' ? 'todo' : 'info',
          annulla: () =>
            ricorrente ? deleteRecurrence(appDb, id, Date.now()) : deleteBlock(appDb, id, Date.now(), fuso()),
        });
        return chiudi();
      }
    } catch {
      setErrore(true);
    }
    setInCorso(false);
  };

  return (
    <dialog
      ref={dialogo}
      className={s.pannello}
      data-tipo={tipo}
      aria-labelledby="crea-titolo"
      onClose={chiudi}
      style={giu ? { transform: `translateY(${giu}px)` } : undefined}
    >
      <div className={s.alone} aria-hidden />
      {/* Nessuna ×: si chiude con «Annulla», con Esc o trascinando in basso il bordo alto (S4) */}
      <div className={s.presa} {...tira}>
        <div className={s.maniglia} aria-hidden />
        <header className={s.testa}>
          <h1 id="crea-titolo" className={s.titoloPannello}>
            <span className={s.puntoTipo} />
            {t(modifica ? 'modificaAttivita' : 'nuovaAttivita')}
          </h1>
        </header>
      </div>

      <div className={s.corpo}>
        {modifica ? (
          <div className={s.tipoFisso}>
            <span className={s.badge}>{t(TIPI.find((x) => x.tipo === tipo)!.chiave)}</span>
            <span className={s.notaTipo}>{t('tipoNonCambia')}</span>
          </div>
        ) : (
          <div className={s.tipi} role="group" aria-label={t('tipo')}>
            {TIPI.map(({ tipo: k, chiave, Icona }) => (
              <button
                key={k}
                type="button"
                className={s.tipo}
                data-tipo={k}
                aria-pressed={k === tipo}
                onClick={() => set({ tipo: k })}
              >
                <Icona size={14} className={s.iconaTipo} />
                {t(chiave)}
              </button>
            ))}
          </div>
        )}
        {modifica && ricorrente && (
          <span className={s.notaModifica}>
            <Repeat size={13} className={s.iconaNota} />
            {t('modificheFuture')}
          </span>
        )}

        <input
          className={s.titolo}
          value={f.titolo}
          placeholder={t(TITOLO[tipo])}
          aria-label={t(TITOLO[tipo])}
          onChange={(e) => set({ titolo: e.currentTarget.value })}
        />

        {tipo === 'studio' && (
          <label className={s.select} data-vuoto={f.corsoId === null}>
            <GraduationCap size={16} className={s.iconaInk} />
            <select
              value={f.corsoId ?? ''}
              aria-label={t('corso')}
              onChange={(e) => set({ corsoId: e.currentTarget.value || null })}
            >
              <option value="">{t('nessunCorso')}</option>
              {corsi.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titolo}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className={s.freccia} />
          </label>
        )}

        {soloDigest && (
          <div className={s.gruppo}>
            <Etichetta Icona={Flag}>{t('priorita')}</Etichetta>
            <div className={s.chips}>
              {PRIORITA.map(([p, k]) => (
                <Chip key={p} on={f.priorita === p} onClick={() => set({ priorita: p })}>
                  <span className={s.pallinoPriorita} data-priorita={p} />
                  {t(k)}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {ricorrente && (
          <>
            <div className={s.gruppo}>
              <Etichetta Icona={Repeat}>{t('ripeti')}</Etichetta>
              <div className={s.giorni}>
                {SETTIMANA.map((g) => (
                  <Chip key={g} on={f.giorni.includes(g)} onClick={() => set({ giorni: toggle(f.giorni, g) })}>
                    {fmtGiorno.format(local(2026, 9, 20 + (g || 7)))}
                  </Chip>
                ))}
              </div>
              <span className={s.meta}>
                {f.giorni.length === 7
                  ? t('ogniGiorno')
                  : f.giorni.length === 0
                    ? t('scegliGiorni')
                    : t('giorniSettimana', { n: f.giorni.length })}
              </span>
            </div>
            <div className={s.gruppo}>
              <Etichetta Icona={CalendarDays}>{t('dalFinoA')}</Etichetta>
              <div className={s.dueColonne}>
                <CampoData giorno={f.dataInizio} giorni={giorni} onChange={(dataInizio) => set({ dataInizio })} />
                <button
                  type="button"
                  className={s.campo}
                  onClick={() => set({ termine: f.termine ? null : { n: 4, unita: 'settimane' } })}
                >
                  <span className={s.colonna}>
                    <span className={s.campoEtichetta}>{t('fine')}</span>
                    <span className={s.campoTesto}>{t(f.termine ? 'aTermine' : 'perSempre')}</span>
                  </span>
                  <ChevronDown size={14} className={s.freccia} />
                </button>
              </div>
              {f.termine && (
                <>
                  <div className={s.chips}>
                    <span className={s.dopo}>{t('dopo')}</span>
                    {[1, 2, 4, 8, 12].map((n) => (
                      <Chip key={n} on={f.termine?.n === n} onClick={() => set({ termine: { ...f.termine!, n } })}>
                        <span className={s.num}>{n}</span>
                      </Chip>
                    ))}
                    <span className={s.spazio} />
                    {UNITA.map(([u, k]) => (
                      <Chip
                        key={u}
                        on={f.termine?.unita === u}
                        onClick={() => set({ termine: { ...f.termine!, unita: u } })}
                      >
                        {t(k)}
                      </Chip>
                    ))}
                  </div>
                  {pronta && (
                    <span className={`${s.meta} ${s.num}`}>
                      {t('ultimoGiorno', {
                        data: fmtData.format(localInstant(recurrenceLastDay(f.dataInizio, f.termine), '00:00')),
                      })}
                    </span>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {tipo === 'todo' && (
          <div className={s.gruppo}>
            <div className={s.rigaEtichetta}>
              <Etichetta Icona={CalendarDays}>{t('orizzonte')}</Etichetta>
              <span className={`${s.meta} ${s.num}`}>
                {t(f.orizzonte === 'giorno' ? 'soloIl' : 'rotolaFino', {
                  data: fmtData.format(horizonLastDay(localInstant(f.giorno, '00:00'), f.orizzonte)),
                })}
              </span>
            </div>
            <div className={s.chips}>
              {ORIZZONTI.map(([o, k, Icona]) => (
                <Chip key={o} on={f.orizzonte === o} onClick={() => set({ orizzonte: o })}>
                  <Icona size={14} className={s.iconaChip} />
                  {t(k)}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {tipo === 'evento' && (
          <div className={s.gruppo}>
            <Etichetta Icona={CalendarDays}>{t('data')}</Etichetta>
            <CampoData giorno={f.giorno} grande giorni={giorni} onChange={(giorno) => set({ giorno })} />
          </div>
        )}

        {tipo === 'evento' && (
          <Interruttore on={f.tuttoIlGiorno} onClick={() => set({ tuttoIlGiorno: !f.tuttoIlGiorno })}>
            {t('tuttoIlGiorno')}
          </Interruttore>
        )}

        {tipo === 'todo' && (
          <Interruttore on={f.conOrario} onClick={() => set({ conOrario: !f.conOrario })}>
            {t('conOrario')}
          </Interruttore>
        )}

        {mostraOrari && (
          <div className={s.gruppo}>
            <div className={s.orari}>
              <label className={s.orario}>
                <Etichetta Icona={Clock}>{t('inizio')}</Etichetta>
                <input
                  type="time"
                  className={s.ora}
                  value={f.inizio}
                  onChange={(e) => set({ inizio: e.currentTarget.value })}
                />
              </label>
              {mostraFine && (
                <>
                  <ArrowRight size={18} className={s.frecciaOrari} />
                  <label className={s.orario}>
                    <span className={s.rigaEtichetta}>
                      <span className={s.etichetta}>{t('fine')}</span>
                      {tipo === 'routine' && (
                        <button
                          type="button"
                          className={s.rimuoviFine}
                          aria-label={t('rimuoviFine')}
                          onClick={() => set({ conFine: false })}
                        >
                          <X size={12} strokeWidth={2} />
                        </button>
                      )}
                    </span>
                    <input
                      type="time"
                      className={s.ora}
                      aria-invalid={fineErrata || undefined}
                      value={f.fine}
                      onChange={(e) => set({ fine: e.currentTarget.value })}
                    />
                  </label>
                </>
              )}
              {tipo === 'routine' && !f.conFine && (
                <button type="button" className={s.aggiungiFine} onClick={() => set({ conFine: true })}>
                  <Plus size={14} strokeWidth={2.25} />
                  {t('orarioFine')}
                </button>
              )}
            </div>
            {tipo === 'todo' && (
              <div className={s.gruppoStretto}>
                <span className={s.etichetta}>{t('durataCampo')}</span>
                <div className={s.chips}>
                  {GRADINI_DURATA.map((m) => (
                    <Chip key={m} on={f.durata === m} onClick={() => set({ durata: m })}>
                      <span className={s.num}>{durata(m)}</span>
                    </Chip>
                  ))}
                </div>
                <span className={s.nota}>
                  {t('gradiniNota')} <span className={s.fineTodo}>{alle(f.inizio, f.durata)}</span>
                </span>
              </div>
            )}
            {fineErrata && (
              <span className={s.errore} role="alert">
                {t('fineDopoInizio')}
              </span>
            )}
            {minuti !== null && !fineErrata && (
              <span className={s.nota}>
                <span className={s.badgeDurata}>
                  <span className={s.puntoTipo} />
                  {durata(minuti)}
                </span>
                {giornoDopo && t('giornoDopo')}
              </span>
            )}
          </div>
        )}

        {tipo === 'evento' && (
          <label className={s.luogo}>
            <MapPin size={16} className={s.iconaLuogo} />
            <input
              className={s.input}
              value={f.luogo}
              placeholder={t('luogo')}
              aria-label={t('luogo')}
              onChange={(e) => set({ luogo: e.currentTarget.value })}
            />
          </label>
        )}

        {tipo === 'todo' && <Voci voci={f.checklist} onChange={(checklist) => set({ checklist })} />}
        {conFasi && <Voci voci={f.fasi} fasi onChange={(fasi) => set({ fasi })} />}

        <div className={s.gruppo}>
          <Etichetta Icona={Bell}>{t('promemoria')}</Etichetta>
          {soloDigest ? (
            <span className={s.info}>{t('soloDigest')}</span>
          ) : (
            <>
              <div className={s.chips}>
                {(['auto', 'off', 'personalizzato'] as const).map((m) => (
                  <Chip key={m} on={f.modo === m} onClick={() => set({ modo: m })}>
                    {t(m)}
                  </Chip>
                ))}
              </div>
              {f.modo === 'personalizzato' && (
                <>
                  <div className={s.chips}>
                    {ANTICIPI.map((m) => (
                      <Chip
                        key={m}
                        on={f.anticipi.includes(m)}
                        disabled={senzaOrario}
                        onClick={() => set({ anticipi: toggle(f.anticipi, m) })}
                      >
                        {f.anticipi.includes(m) && <Check size={12} strokeWidth={2.5} className={s.iconaInk} />}
                        {anticipo(m)}
                      </Chip>
                    ))}
                    {liberi.map((m) => (
                      <Chip key={m} on disabled={senzaOrario} onClick={() => set({ anticipi: toggle(f.anticipi, m) })}>
                        <Check size={12} strokeWidth={2.5} className={s.iconaInk} />
                        {anticipo(m)}
                      </Chip>
                    ))}
                  </div>
                  {!senzaOrario && (
                    <div className={s.gruppoStretto}>
                      <span className={s.info}>
                        {t('anticipoAltro')} <span className={s.notaDebole}>· {t('anticipoMassimo')}</span>
                      </span>
                      <div className={s.chips}>
                        <input
                          className={`${s.chip} ${s.numeroAnticipo}`}
                          type="number"
                          inputMode="numeric"
                          min={1}
                          value={libero.n}
                          aria-label={t('anticipoAltro')}
                          onChange={(e) => setLibero({ ...libero, n: e.currentTarget.value })}
                        />
                        {UNITA_ANTICIPO.map((u) => (
                          <Chip
                            key={u.min}
                            on={libero.unita === u.min}
                            onClick={() => setLibero({ ...libero, unita: u.min })}
                          >
                            {t(u.chiave)}
                          </Chip>
                        ))}
                        <button
                          type="button"
                          className={s.chip}
                          aria-label={t('aggiungiAnticipo')}
                          disabled={!liberoValido}
                          onClick={() => {
                            set({ anticipi: [...f.anticipi, minutiLiberi] });
                            setLibero({ ...libero, n: '' });
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                  {senzaOrario ? (
                    <span className={s.info}>{t('promemoriaTuttoGiorno')}</span>
                  ) : (
                    svegliabili.length > 0 && (
                      <div className={s.gruppoStretto}>
                        <span className={s.info}>
                          {t('sveglia')} <span className={s.notaDebole}>· {t('svegliaNota')}</span>
                        </span>
                        <div className={s.chips}>
                          {svegliabili.map((m) => (
                            <Chip
                              key={m}
                              on={f.sveglie.includes(m)}
                              onClick={() => set({ sveglie: toggle(f.sveglie, m) })}
                            >
                              <AlarmClock size={12} />
                              {anticipo(m)}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )
                  )}
                </>
              )}
            </>
          )}
        </div>

        <label className={s.note}>
          <Etichetta Icona={NotebookPen}>{t('note')}</Etichetta>
          <textarea
            className={s.testoNote}
            rows={2}
            value={f.note}
            placeholder={t('aggiungiNota')}
            onChange={(e) => set({ note: e.currentTarget.value })}
          />
        </label>
      </div>

      <footer className={s.piede}>
        {errore && (
          <p className={s.errore} role="alert">
            {t('creaNonRiuscito')}
          </p>
        )}
        <button type="button" className={s.annulla} onClick={chiudi}>
          {t('annulla')}
        </button>
        <button type="button" className={s.cta} disabled={!pronta || inCorso} onClick={() => void crea()}>
          {t(modifica ? 'salva' : CTA[tipo])}
        </button>
      </footer>
    </dialog>
  );
}
