// «+ Crea» (S4 Crea Panel/Mobile/Desktop; FUNZ §3, MECC §2): quattro tipi nello stesso form, campi per tipo. Su
// mobile una sheet sotto i 56 px di testa, da 1024 px un pannello a destra di 440 (DESIGN.md, S4 Desktop). La
// validazione è del dominio (`validateActivity`): la CTA è attiva solo se la bozza è valida. Il todo non ha data né
// corso (S4 Crea, D-DESIGN-1 n. 20): parte da oggi e l'orizzonte dice fin dove rotola. L'anticipo
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
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { createActivity } from '../app/activities';
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
  endsNextDay,
  recurrenceLastDay,
  validateActivity,
  wallDuration,
  type BozzaAttivita,
  type Termine,
} from '../domain/activity';
import { horizonLastDay } from '../domain/lost';
import { local, localDayKey, localInstant } from '../domain/time';
import type { Orizzonte, Priorita } from '../domain/types';
import { durata, fmtData, SETTIMANA } from './format';
import { lingua, t, type Chiave } from './i18n';
import s from './Create.module.css';

type Tipo = BozzaAttivita['tipo'];
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
  checklist: string[];
  fasi: string[];
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

function initial(): Form {
  const now = new Date();
  // L'ora piena successiva, al più le 23:00: dopo le 23 un «00:00» di oggi sarebbe già passato
  const ora = `${String(Math.min(now.getHours() + 1, 23)).padStart(2, '0')}:00`;
  const oggi = localDayKey(now.getTime());
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
    giorno: oggi,
    dataInizio: oggi,
    termine: null,
    corsoId: null,
    luogo: '',
    modo: 'auto',
    anticipi: [],
    sveglie: [],
  };
}

function toDraft(f: Form, oggi: string): BozzaAttivita {
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
        // Il todo parte da oggi (S4 Crea, D-DESIGN-1 n. 20)
        giorno: oggi,
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
function CampoData(p: { giorno: string; grande?: boolean; onChange: (g: string) => void }) {
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
        required
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            // selettore non disponibile: resta l'input nativo
          }
        }}
        onChange={(e) => e.currentTarget.value && p.onChange(e.currentTarget.value)}
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
function Voci(p: { voci: string[]; fasi?: boolean; onChange: (v: string[]) => void }) {
  const { voci, fasi, onChange } = p;
  const cambia = (i: number, v: string) => onChange(voci.map((x, j) => (j === i ? v : x)));
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
            value={v}
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
          onClick={() => onChange([...voci, ''])}
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

export function Create() {
  const navigate = useNavigate();
  const primaSchermata = useLocation().key === 'default';
  const chiudi = () => (primaSchermata ? navigate('/') : navigate(-1));
  const dialogo = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState(initial);
  // Il todo parte dal giorno in cui si apre il form (S4 Crea, D-DESIGN-1 n. 20)
  const [oggi] = useState(() => localDayKey(Date.now()));
  const [corsi, setCorsi] = useState<SchedaCorso[]>([]);
  const [errore, setErrore] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [libero, setLibero] = useState({ n: '', unita: 1440 });
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));

  useEffect(() => {
    dialogo.current?.showModal();
  }, []);
  useEffect(() => watch(() => courseCards(appDb), setCorsi), []);

  const bozza = toDraft(f, oggi);
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
      const r = await createActivity(appDb, bozza, Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
      if (r.ok) return chiudi();
    } catch {
      setErrore(true);
    }
    setInCorso(false);
  };

  return (
    <dialog ref={dialogo} className={s.pannello} data-tipo={tipo} aria-labelledby="crea-titolo" onClose={chiudi}>
      <div className={s.alone} aria-hidden />
      <div className={s.maniglia} aria-hidden />
      <header className={s.testa}>
        <h1 id="crea-titolo" className={s.titoloPannello}>
          <span className={s.puntoTipo} />
          {t('nuovaAttivita')}
        </h1>
        <button type="button" className={s.chiudi} aria-label={t('chiudi')} onClick={chiudi}>
          <X size={18} />
        </button>
      </header>

      <div className={s.corpo}>
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
                <CampoData giorno={f.dataInizio} onChange={(dataInizio) => set({ dataInizio })} />
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
                  data: fmtData.format(horizonLastDay(localInstant(oggi, '00:00'), f.orizzonte)),
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
            <CampoData giorno={f.giorno} grande onChange={(giorno) => set({ giorno })} />
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
          {t(CTA[tipo])}
        </button>
      </footer>
    </dialog>
  );
}
