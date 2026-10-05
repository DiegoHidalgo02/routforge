// Dettaglio di un'attività (S5 Dettaglio Panel/Mobile/Desktop, 03 Dettaglio; FUNZ §4–§6, MECC §3–§5) su `/attivita/:id`,
// sopra la schermata di partenza come «+ Crea»: sheet sotto i 56 px di testa su mobile, pannello di 440 da 1024 px.
// Badge del tipo, titolo e meta; riga dell'esito; checklist (todo), fasi (routine ed evento: con il log se chiusa),
// note; footer per tipo. La revisione delle fasi (S9) e il follow-up sono sheet dentro il pannello; «Elimina» ha il
// toast con «Annulla». Dal cerchio di una card di Oggi il pannello si apre già sulla revisione o sulle voci rimaste
// (spunta diretta, D-DETT-3). Le regole vengono da dominio e servizio (`app/completion.ts`): qui solo la resa. Fuori da
// questo task: «Modifica» (T-042), l'unità proposta (T-013), le notifiche (T-019). Le azioni di sessione dello studio
// (Avvia · Anticipa · Recupera · Riprendi · Ripasso) vengono da `studyActions` (T-016); «Registra esito» senza sessione
// apre lo sheet dell'esito di S16 (T-018, D-ESITO-1).
import {
  Calendar,
  CalendarClock,
  Check,
  ChevronLeft,
  Clock,
  Flag,
  GraduationCap,
  Info,
  List,
  MapPin,
  Play,
  Repeat,
  SquareCheckBig,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate, useParams, type Location } from 'react-router';
import {
  completeBlock,
  completeWithLeftover,
  createFollowUps,
  deleteBlock,
  reopenBlock,
  restoreBlock,
  skipBlock,
  toggleChecklist,
  readDetail,
  type DettaglioAttivita,
} from '../app/completion';
import { appDb, watch } from '../app/db';
import { registerOutcome } from '../app/outcome';
import { readActiveSession } from '../app/session';
import { inheritedDay } from '../domain/checklist';
import { canRegisterOutcome, plannedMinutes, type DatiEsito } from '../domain/outcome';
import { studyActions, type AzioneStudio, type SessioneAttiva } from '../domain/session';
import { canCheckFromCalendar, canComplete, directCheckStep, shownState } from '../domain/completion';
import { effectiveEnd, horizonLastDay, lostAtInstant } from '../domain/lost';
import { shownPhases } from '../domain/phases';
import { MINUTE, local, localInstant, sameLocalDay } from '../domain/time';
import type { StatoBlocco } from '../domain/types';
import { useMinuto } from './clock';
import { durata, fmtData, fuso as fusoCorrente, maiuscola, SETTIMANA, TIPO, titolo as titoloDi } from './format';
import { lingua, t, type Chiave } from './i18n';
import s from './Detail.module.css';
import { SchedaEsito, useStudyAction } from './Session';

const PRIORITA = { alta: 'prioritaRigaAlta', normale: 'prioritaRigaNormale', bassa: 'prioritaRigaBassa' } as const;
/** Il toast con «Annulla» resta 5 s, come l'annulla del trascinamento (MECC §15). */
const TOAST_MS = 5000;

const fmtOra = new Intl.DateTimeFormat(lingua, { hour: '2-digit', minute: '2-digit' });
const fmtGiornoOra = new Intl.DateTimeFormat(lingua, {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const fmtGiorno = new Intl.DateTimeFormat(lingua, { weekday: 'long', day: 'numeric', month: 'long' });
const fmtSigla = new Intl.DateTimeFormat(lingua, { weekday: 'short' });
const quando = (ms: number, now: number) => (sameLocalDay(ms, now) ? fmtOra : fmtGiornoOra).format(ms);
const sigle = (giorni: readonly number[]) =>
  giorni.length === 7
    ? t('ogniGiorno')
    : SETTIMANA.filter((g) => giorni.includes(g))
        .map((g) => maiuscola(fmtSigla.format(local(2026, 9, 20 + (g || 7)))))
        .join(' · ');
const inverti = (insieme: ReadonlySet<string>, id: string): Set<string> => {
  const n = new Set(insieme);
  if (!n.delete(id)) n.add(id);
  return n;
};

/** Etichette delle azioni di sessione nel footer di S5 (studio). */
const AZIONE_STUDIO: Record<AzioneStudio, Chiave> = {
  inizia: 'avviaSessione',
  anticipa: 'anticipaSessione',
  libera: 'sessioneLibera',
  recupera: 'sessioneRecupera',
  riprendi: 'riprendiSessione',
  ripasso: 'ripassoLibera',
};
/** Esito dello studio nella OutcomeRow di S5 (§11), per stato del blocco. */
const ESITO_STUDIO: Partial<Record<StatoBlocco, Chiave>> = {
  completato: 'esitoCompletata',
  parziale: 'esitoContinua',
  indietro: 'esitoIndietro',
  saltato: 'esitoSalta',
};
/** Suggerimenti di S5 per lo studio: anticipo, ripasso e sessione libera di un altro giorno. */
const suggerimentoStudio = (azione: AzioneStudio | undefined): string | null =>
  azione === 'anticipa'
    ? t('suggerimentoAnticipo')
    : azione === 'ripasso'
      ? t('suggerimentoRipasso')
      : azione === 'libera'
        ? t('suggerimentoStudioAltroGiorno')
        : null;

type Vista = 'dettaglio' | 'revisione' | 'followup' | 'residuo' | 'esito';
interface Toast {
  testo: string;
  annulla: () => void;
  /** Il pallino nel colore del todo quando l'oggetto creato è un todo (follow-up, S5). */
  todo?: boolean;
}
/** Riga della MetaRow (S5): icona e testo; `ink` = nel colore del tipo, `num` = orari in font-num, `testo` = bianco. */
interface Meta {
  Icona: typeof Clock;
  testo: string;
  tono?: 'ink' | 'num' | 'testo';
}

export function Detail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const primaSchermata = location.key === 'default';
  const rotta = location.state as { sfondo?: Location; vista?: Vista } | null;
  const sfondo = rotta?.sfondo;
  const vistaDaOggi = rotta?.vista;
  // Dal cerchio della card di Oggi (spunta diretta, D-DETT-3) si arriva sulla revisione delle fasi, sulle voci rimaste o
  // sull'esito dello studio (C10):
  // la sheet si apre al primo caricamento solo se il blocco è ancora a quel passo, e lo stato della rotta si consuma
  // subito, così ricaricare o tornare avanti non la riapre su un blocco già chiuso
  const passoDaOggi = useRef(vistaDaOggi);
  const chiudi = () => (primaSchermata ? navigate('/') : navigate(-1));
  const dialogo = useRef<HTMLDialogElement>(null);
  const [d, setD] = useState<DettaglioAttivita>();
  const [sparito, setSparito] = useState(false);
  const [vista, setVista] = useState<Vista>('dettaglio');
  // La sheet aperta dal cerchio entra insieme al pannello, senza la propria animazione
  const [subito, setSubito] = useState(false);
  const [saltate, setSaltate] = useState<ReadonlySet<string>>(() => new Set());
  const [scelte, setScelte] = useState<ReadonlySet<string>>(() => new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [errore, setErrore] = useState(false);
  const [attiva, setAttiva] = useState<SessioneAttiva | null>(null);
  useEffect(() => watch(() => readActiveSession(appDb), setAttiva), []);
  const avviaSessione = useStudyAction();
  // L'orologio batte al minuto e si riallinea al ritorno in primo piano (G4); le scritture usano l'istante del clic
  const now = useMinuto();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sheet = useRef<HTMLDivElement>(null);
  const fuso = fusoCorrente();
  const sheetAperta = vista !== 'dettaglio';

  useEffect(() => {
    dialogo.current?.showModal();
    return () => clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    if (vistaDaOggi) void navigate(location.pathname, { replace: true, state: sfondo ? { sfondo } : null });
  }, [vistaDaOggi, navigate, location.pathname, sfondo]);
  // La sheet interna prende il fuoco; il resto del pannello è inerte finché resta aperta
  useEffect(() => {
    if (sheetAperta) sheet.current?.focus();
  }, [sheetAperta]);
  // Dopo un'eliminazione il blocco sparisce: il pannello mostra l'ultimo valore finché il toast permette l'annulla
  useEffect(
    () =>
      watch(
        () => readDetail(appDb, id),
        (x) => {
          setSparito(!x);
          if (!x) return;
          setD(x);
          const passo = passoDaOggi.current;
          passoDaOggi.current = undefined;
          if (
            passo &&
            canCheckFromCalendar(x.blocco, Date.now()) &&
            directCheckStep(x.blocco, x.fasi.length > 0) === passo
          ) {
            setVista(passo);
            setSubito(true);
          }
        },
      ),
    [id],
  );

  const act = async (fn: () => Promise<unknown>) => {
    setErrore(false);
    try {
      await fn();
    } catch {
      clearTimeout(timer.current);
      setToast(null);
      setErrore(true);
    }
  };
  const mostraToast = (
    testo: string,
    annulla: () => Promise<unknown>,
    { poi, todo }: { poi?: () => void; todo?: boolean } = {},
  ) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => (poi ? poi() : setToast(null)), TOAST_MS);
    setToast({
      testo,
      todo,
      // Il toast resta finché l'annulla non è scritto: altrimenti, con il blocco già sparito, il pannello si chiuderebbe
      annulla: () => {
        clearTimeout(timer.current);
        void act(async () => {
          await annulla();
          setSparito(false);
          setToast(null);
        });
      },
    });
  };

  if (sparito && !toast) return <Navigate to={sfondo ? sfondo.pathname + sfondo.search : '/'} replace />;
  const b = d?.blocco;
  if (!d || !b) return <dialog ref={dialogo} className={s.pannello} aria-label={t('dettaglio')} onClose={chiudi} />;

  const { fasi: template, log } = d;
  const tipo = b.tipo;
  const stato = shownState(b, now);
  const spuntabile = canComplete(b, now);
  const conFasi = template.length > 0;
  const fasiMostrate = shownPhases(template, log);
  const titolo = titoloDi(b);
  const orari =
    b.fine === null
      ? `${b.orarioInizio} · ${t('senzaDurata')}`
      : `${b.orarioInizio} – ${b.orarioFine} · ${durata(Math.round((b.fine - b.inizio) / MINUTE))}`;
  const ora = () => Date.now();

  const meta: Meta[] = [];
  if (tipo === 'todo') {
    const orizzonte = b.orizzonte ?? 'giorno';
    meta.push({
      Icona: CalendarClock,
      tono: 'ink',
      testo:
        orizzonte === 'giorno'
          ? maiuscola(fmtGiorno.format(b.inizio))
          : t('entroIl', { data: fmtGiorno.format(horizonLastDay(b.inizio, orizzonte)) }),
    });
    if (b.conOrario) meta.push({ Icona: Clock, tono: 'num', testo: orari });
    else if (b.priorita) meta.push({ Icona: Flag, testo: t(PRIORITA[b.priorita]) });
  } else if (tipo === 'evento') {
    meta.push({ Icona: Calendar, tono: 'testo', testo: maiuscola(fmtGiorno.format(b.inizio)) });
    meta.push(b.conOrario ? { Icona: Clock, tono: 'num', testo: orari } : { Icona: Clock, testo: t('tuttoIlGiorno') });
    if (b.luogo) meta.push({ Icona: MapPin, testo: b.luogo });
  } else {
    if (tipo === 'studio' && d.corso) meta.push({ Icona: GraduationCap, tono: 'ink', testo: d.corso.titolo });
    if (tipo === 'routine') meta.push({ Icona: Clock, tono: 'num', testo: orari });
    if (d.ricorrenza) meta.push({ Icona: Repeat, testo: sigle(d.ricorrenza.giorni) });
    if (tipo === 'studio') meta.push({ Icona: Clock, tono: 'num', testo: orari });
  }

  // OutcomeRow (S5): esito scritto, oppure «concluso» per l'evento con la fine passata (§3); per lo studio l'esito di §11
  // con confidenza e minuti
  const conto = (ms: number | null | undefined) => (ms == null ? '' : quando(ms, now));
  const voci = b.checklist ?? [];
  const fatte = voci.filter((v) => v.fatta).length;
  const saltateLog = log?.filter((f) => f.stato === 'saltata').length ?? 0;
  const registrabile = canRegisterOutcome(b, now);
  const dettagliStudio = [
    b.confidenza ? t('confidenzaDi', { c: b.confidenza }) : null,
    b.stato === 'completato' && b.minuti != null ? `${b.minuti} ${t('minutiUnita')}` : null,
  ].filter((x): x is string => x !== null);
  let esito: { testo: string; ora: string; ok: boolean; parziale?: boolean } | null = null;
  if (tipo === 'studio' && ESITO_STUDIO[b.stato]) {
    const testo = [t(ESITO_STUDIO[b.stato] ?? 'esitoCompletata')];
    if (b.stato === 'parziale') testo.push([t('esitoParziale'), ...dettagliStudio].join(', '));
    else if (b.stato === 'indietro') testo.push(t('esitoRigaIndietro'));
    else if (b.stato === 'saltato') testo.push(t('esitoRigaSalta'));
    else testo.push(...dettagliStudio);
    esito = {
      testo: testo.join(' · '),
      ora: conto(b.chiusoIl),
      ok: b.stato === 'completato',
      parziale: b.stato === 'parziale',
    };
  } else if (b.stato === 'completato' && tipo !== 'studio') {
    const testo =
      tipo === 'todo'
        ? voci.length
          ? t('esitoCompletatoChecklist', { fatte, totale: voci.length })
          : t('esitoCompletato')
        : tipo === 'routine'
          ? log
            ? t('esitoFattaFasi', { fatte: log.length - saltateLog, totale: log.length })
            : t('fatta')
          : saltateLog === 0
            ? t('esitoCompletato')
            : saltateLog === 1
              ? t('esitoCompletatoSaltata')
              : t('esitoCompletatoSaltate', { n: saltateLog });
    esito = { testo, ora: conto(b.chiusoIl), ok: true };
  } else if (b.stato === 'saltato') esito = { testo: t('saltata'), ora: conto(b.chiusoIl), ok: false };
  else if (b.stato === 'perso')
    // L'ora è la scadenza (fine + 30', §8), come nel mock, non l'istante del ciclo che ha marcato
    esito = {
      testo: t(tipo === 'todo' ? 'esitoNonFatto' : tipo === 'studio' ? 'esitoPersaStudio' : 'esitoPersa'),
      ora: conto(lostAtInstant(b)),
      ok: false,
    };
  else if (stato === 'concluso') esito = { testo: t('esitoConcluso'), ora: conto(effectiveEnd(b)), ok: false };

  const suggerimento =
    tipo === 'todo' && b.stato === 'perso'
      ? t('suggerimentoTodoPerso')
      : tipo === 'routine' && !spuntabile && b.stato === 'programmato'
        ? t('suggerimentoAltroGiorno')
        : tipo === 'routine' && !spuntabile && b.stato === 'perso'
          ? t('suggerimentoRoutinePersa')
          : tipo === 'evento' && stato === 'concluso'
            ? t('suggerimentoConcluso')
            : tipo === 'studio' && b.stato === 'perso'
              ? t('suggerimentoStudioPerso')
              : tipo === 'studio' && registrabile
                ? t('suggerimentoRecupero')
                : tipo === 'studio'
                  ? (suggerimentoStudio(studyActions(b, now, attiva)[0]) ??
                    (b.stato === 'parziale' ? t('suggerimentoParziale') : null))
                  : null;

  // Una spunta rifiutata dal servizio (finestra chiusa nel frattempo, §3) si segnala come le eccezioni
  const esegui = (fn: () => Promise<boolean>) =>
    void act(async () => {
      if (!(await fn())) setErrore(true);
    });
  // Spunta (§3): con fasi si passa dalla revisione a inversione (§5) e si scrive solo al Conferma; con voci rimaste si
  // sceglie se creare il todo (D-DETT-2). La regola è la stessa della spunta diretta dal cerchio (`directCheckStep`)
  const fatta = () => {
    const passo = directCheckStep(b, conFasi);
    setSubito(false);
    if (passo === 'revisione') {
      setSaltate(new Set());
      setVista('revisione');
    } else if (passo === 'residuo') setVista('residuo');
    else esegui(() => completeBlock(appDb, id, ora(), fuso));
  };
  // «Non ora» nella sheet delle voci rimaste: segna fatto e basta (tutte le voci spuntate, S5)
  const soloFatto = () => {
    setVista('dettaglio');
    esegui(() => completeBlock(appDb, id, ora(), fuso));
  };
  const creaResiduo = () => {
    const prima = d;
    void act(async () => {
      const nuovo = await completeWithLeftover(appDb, id, ora(), fuso);
      setVista('dettaglio');
      if (!nuovo) return setErrore(true);
      mostraToast(
        t('todoCreato', { titolo }),
        async () => {
          await deleteBlock(appDb, nuovo, ora(), fuso);
          await restoreBlock(appDb, prima, ora(), fuso);
          setVista('residuo');
        },
        { todo: true },
      );
    });
  };
  // Scadenza del todo derivato (D-DETT-2): giorno dell'attività da cui nasce, mai prima di oggi
  const giornoDerivato = localInstant(inheritedDay(b.inizio, now), '00:00');
  const orizzonteTodo = b.orizzonte ?? 'giorno';
  const scadenzaResiduo = t(orizzonteTodo === 'giorno' ? 'soloIl' : 'rotolaFino', {
    data: fmtData.format(horizonLastDay(giornoDerivato, orizzonteTodo)),
  });
  const conferma = () =>
    void act(async () => {
      const ok = await completeBlock(appDb, id, ora(), fuso, [...saltate]);
      if (!ok) setErrore(true);
      if (ok && tipo === 'evento' && saltate.size > 0) {
        setScelte(new Set(saltate));
        setVista('followup');
      } else setVista('dettaglio');
    });
  const creaFollowUp = () =>
    void act(async () => {
      const etichette = template.filter((f) => scelte.has(f.id)).map((f) => f.etichetta);
      const ids = await createFollowUps(appDb, id, etichette, ora(), fuso);
      setVista('dettaglio');
      mostraToast(
        ids.length === 1 ? t('todoCreato', { titolo: etichette[0] ?? '' }) : t('todoCreatiN', { n: ids.length }),
        async () => {
          for (const i of ids) await deleteBlock(appDb, i, ora(), fuso);
          setVista('followup');
        },
        { todo: true },
      );
    });
  const registraEsito = ({ esito, confidenza, nota }: DatiEsito) =>
    void act(async () => {
      const ok = await registerOutcome(appDb, id, { esito, confidenza, nota }, ora(), fuso);
      setVista('dettaglio');
      if (!ok) setErrore(true);
    });
  const elimina = () => {
    const prima = d;
    mostraToast(t('eliminata', { titolo }), () => restoreBlock(appDb, prima, ora(), fuso), { poi: chiudi });
    void act(() => deleteBlock(appDb, id, ora(), fuso));
  };

  // «Riapri» del todo e della routine completati (per la routine è la scelta dell'utente, divergenza 23: vince il design)
  const riapri = (
    <button
      type="button"
      className={`${s.azione} ${s.secondaria} ${s.larga}`}
      onClick={() => void act(() => reopenBlock(appDb, id, ora(), fuso))}
    >
      {t('riapri')}
    </button>
  );
  let piede: ReactNode = null;
  if (tipo === 'todo')
    piede =
      b.stato === 'completato' ? (
        riapri
      ) : (
        <button type="button" className={`${s.azione} ${s.primaria}`} onClick={fatta}>
          <Check size={16} />
          {t('segnaFatto')}
        </button>
      );
  else if (tipo === 'routine') {
    if (b.stato === 'completato') piede = riapri;
    else if (b.stato !== 'saltato')
      piede = (
        <>
          {/* Fatta o Saltata nella stessa finestra (FUNZ §4.3), anche se già persa nel suo giorno (B2) */}
          {spuntabile && (
            <button
              type="button"
              className={`${s.azione} ${s.secondaria}`}
              onClick={() => esegui(() => skipBlock(appDb, id, ora(), fuso))}
            >
              {t('saltata')}
            </button>
          )}
          <button type="button" className={`${s.azione} ${s.primaria}`} disabled={!spuntabile} onClick={fatta}>
            {t('fatta')}
          </button>
        </>
      );
  } else if (tipo === 'studio') {
    // Azioni della sessione (S5 studio, §10.1): la primaria a destra, la libera accanto in anticipo. «Registra esito»
    // (§11) è la primaria del perso, con «Recupera» accanto; col solo orario passato la primaria resta «Recupera»
    const [prima, seconda] = studyActions(b, now, attiva);
    const esitoBottone = (primaria: boolean) => (
      <button
        type="button"
        className={`${s.azione} ${primaria ? s.primaria : s.secondaria}`}
        onClick={() => setVista('esito')}
      >
        {t('registraEsito')}
      </button>
    );
    piede = (
      <>
        {registrabile && b.stato !== 'perso' && esitoBottone(false)}
        {seconda && (
          <button type="button" className={`${s.azione} ${s.secondaria}`} onClick={() => avviaSessione(seconda, b)}>
            {t(AZIONE_STUDIO[seconda])}
          </button>
        )}
        {prima && registrabile && b.stato === 'perso' ? (
          <>
            <button type="button" className={`${s.azione} ${s.secondaria}`} onClick={() => avviaSessione(prima, b)}>
              {t(AZIONE_STUDIO[prima])}
            </button>
            {esitoBottone(true)}
          </>
        ) : (
          prima && (
            <button
              type="button"
              className={`${s.azione} ${prima === 'ripasso' || prima === 'libera' ? `${s.secondaria} ${s.larga}` : s.primaria}`}
              onClick={() => avviaSessione(prima, b)}
            >
              {prima !== 'ripasso' && <Play size={14} fill="currentColor" />}
              {t(AZIONE_STUDIO[prima])}
            </button>
          )
        )}
      </>
    );
  } else if (tipo === 'evento' && b.stato !== 'completato')
    piede = (
      <button type="button" className={`${s.azione} ${s.primaria}`} onClick={fatta}>
        {t(conFasi ? 'completaEvento' : 'chiudiEvento')}
      </button>
    );

  const saltateTemplate = template.filter((f) => saltate.has(f.id));
  const casella = (on: boolean) => (
    <span className={s.casella} data-fatta={on || undefined}>
      {on && <Check size={12} strokeWidth={3} />}
    </span>
  );

  return (
    <dialog
      ref={dialogo}
      className={s.pannello}
      data-tipo={tipo}
      aria-label={t('dettaglio')}
      onClose={chiudi}
      onCancel={(e) => {
        // Esc con una sheet aperta chiude solo la sheet, come il velo
        if (sheetAperta) {
          e.preventDefault();
          setVista('dettaglio');
        }
      }}
    >
      <div className={s.maniglia} aria-hidden />
      <header className={s.testa} inert={sheetAperta}>
        <button type="button" className={s.icona} aria-label={t('chiudi')} onClick={chiudi}>
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className={`${s.icona} ${s.cestino}`}
          aria-label={t('elimina')}
          disabled={sparito}
          onClick={elimina}
        >
          <Trash2 size={17} />
        </button>
      </header>

      <div className={s.corpo} inert={sheetAperta}>
        <div className={s.intestazione}>
          <span className={s.badge}>{t(TIPO[tipo])}</span>
          {/* Solo il todo completato ha il titolo barrato (S5) */}
          <h1 className={s.titolo} data-fatto={(tipo === 'todo' && b.stato === 'completato') || undefined}>
            {titolo}
          </h1>
          <div className={s.meta}>
            {meta.map(({ Icona, testo, tono }) => (
              <span key={testo} className={s.rigaMeta} data-tono={tono}>
                <Icona size={14} />
                <span className={s.testoMeta}>{testo}</span>
              </span>
            ))}
          </div>
          {esito && (
            <div className={s.esito} data-ok={esito.ok || undefined} data-parziale={esito.parziale || undefined}>
              {esito.ok && <Check size={16} />}
              {esito.testo}
              <span className={s.esitoOra}>{esito.ora}</span>
            </div>
          )}
          {suggerimento && (
            <span className={s.suggerimento}>
              <Info size={13} />
              {suggerimento}
            </span>
          )}
        </div>

        {tipo === 'todo' && voci.length > 0 && (
          <section className={s.gruppo}>
            <div className={s.rigaEtichetta}>
              <span className={s.etichetta}>
                <SquareCheckBig size={14} />
                {t('checklist')}
              </span>
              <span className={`${s.conto} ${s.num}`} data-ink data-fatto={fatte === voci.length || undefined}>
                {fatte}/{voci.length}
              </span>
            </div>
            <div className={s.barra}>
              {/* larghezza = dato, non misura del design */}
              <div
                className={s.avanzamento}
                data-fatto={fatte === voci.length || undefined}
                style={{ width: `${Math.round((fatte / voci.length) * 100)}%` }}
              />
            </div>
            <div className={s.voci}>
              {voci.map((v, i) => (
                <button
                  key={i}
                  type="button"
                  className={s.voce}
                  aria-pressed={v.fatta}
                  disabled={sparito}
                  onClick={() => void act(() => toggleChecklist(appDb, id, i, ora(), fuso))}
                >
                  {casella(v.fatta)}
                  <span className={s.testoVoce}>{v.testo}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {fasiMostrate.length > 0 && (
          <section className={s.gruppo}>
            <div className={s.rigaEtichetta}>
              <span className={s.etichetta}>
                <List size={14} />
                {t('fasi')}
              </span>
              <span className={`${s.conto} ${s.num}`}>{fasiMostrate.length}</span>
            </div>
            <div className={s.fasi}>
              {fasiMostrate.map((f, i) => (
                <div key={f.id} className={s.fase} data-saltata={f.stato === 'saltata' || undefined}>
                  <span className={s.pallino} />
                  <span className={s.numero}>{String(i + 1).padStart(2, '0')}</span>
                  <span className={s.testoFase}>{f.etichetta}</span>
                  {f.stato === 'saltata' && <span className={s.tag}>{t('tagSaltata')}</span>}
                </div>
              ))}
            </div>
          </section>
        )}

        {b.note && (
          <section className={s.note}>
            <span className={s.etichetta}>
              <StickyNote size={14} />
              {t('note')}
            </span>
            <p className={s.testoNota}>{b.note}</p>
          </section>
        )}
      </div>

      {(piede || errore) && !sparito && (
        <footer className={s.piede} inert={sheetAperta}>
          {errore && (
            <p className={s.errore} role="alert">
              {t('azioneNonRiuscita')}
            </p>
          )}
          {piede}
        </footer>
      )}

      {vista !== 'dettaglio' && (
        <div className={s.velo}>
          <button
            type="button"
            className={s.sfondoVelo}
            aria-label={t(vista === 'followup' ? 'nonOra' : 'annulla')}
            onClick={() => setVista('dettaglio')}
          />
          <div
            ref={sheet}
            className={s.sheet}
            data-subito={subito || undefined}
            role="dialog"
            aria-labelledby="sheet-titolo"
            tabIndex={-1}
          >
            <div className={s.manigliaSheet} aria-hidden />
            {vista === 'esito' ? (
              // «Registra esito» senza sessione (§11, C6): minuti = durata pianificata, conta sempre
              <SchedaEsito
                titoloId="sheet-titolo"
                minuti={plannedMinutes(b, 'completata')}
                extra={0}
                unitaId={b.unitaId ?? null}
                conta={null}
                contaIniziale
                confidenza={Boolean(b.unitaId)}
                annulla="annulla"
                onAnnulla={() => setVista('dettaglio')}
                inCorso={false}
                onRegistra={registraEsito}
              />
            ) : vista === 'revisione' ? (
              <>
                <div className={s.testiSheet}>
                  <span id="sheet-titolo" className={s.titoloSheet}>
                    {t('revisioneFasi')}
                  </span>
                  <span className={s.sottotitoloSheet}>{t('revisioneFasiTesto')}</span>
                </div>
                <div className={s.fasi}>
                  {shownPhases(template, null).map((f, i) => {
                    const saltata = saltate.has(f.id);
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`${s.fase} ${s.faseRevisione}`}
                        aria-pressed={saltata}
                        data-saltata={saltata || undefined}
                        onClick={() => setSaltate(inverti(saltate, f.id))}
                      >
                        <span className={s.pallino} />
                        <span className={s.numero}>{String(i + 1).padStart(2, '0')}</span>
                        <span className={s.testoFase}>{f.etichetta}</span>
                        {saltata && <span className={s.tag}>{t('tagSaltata')}</span>}
                      </button>
                    );
                  })}
                </div>
                <span className={s.riepilogo}>
                  {t('riepilogoFasi', { fatte: template.length - saltate.size, saltate: saltate.size })}
                </span>
                <div className={s.azioniSheet}>
                  <button type="button" className={`${s.azione} ${s.fantasma}`} onClick={() => setVista('dettaglio')}>
                    {t('annulla')}
                  </button>
                  <button type="button" className={`${s.azione} ${s.primaria}`} onClick={conferma}>
                    {t('conferma')}
                  </button>
                </div>
              </>
            ) : vista === 'followup' ? (
              <>
                <div className={`${s.testiSheet} ${s.rivela}`}>
                  <span className={s.occhiello}>{t('eventoCompletato')}</span>
                  <span id="sheet-titolo" className={s.titoloSheet}>
                    {saltateTemplate.length === 1
                      ? t('haiSaltatoUna', { fase: saltateTemplate[0]?.etichetta ?? '' })
                      : t('haiSaltatoN', { n: saltateTemplate.length })}
                  </span>
                  <span className={s.sottotitoloSheet}>{t('followUpTesto')}</span>
                </div>
                <div className={`${s.fasi} ${s.rivela}`}>
                  {saltateTemplate.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      className={s.followUp}
                      aria-pressed={scelte.has(f.id)}
                      onClick={() => setScelte(inverti(scelte, f.id))}
                    >
                      {casella(scelte.has(f.id))}
                      <span className={s.testoFollowUp}>{f.etichetta}</span>
                      <span className={s.badgeTodo}>{t('tipoTodo')}</span>
                    </button>
                  ))}
                  <span className={s.metaFollowUp}>
                    {saltateTemplate.length > 1 &&
                      `${t('selezionate', { n: scelte.size, totale: saltateTemplate.length })} · `}
                    {t('soloIl', { data: fmtData.format(giornoDerivato) })}
                  </span>
                </div>
                <div className={s.azioniSheet}>
                  <button type="button" className={`${s.azione} ${s.fantasma}`} onClick={() => setVista('dettaglio')}>
                    {t('nonOra')}
                  </button>
                  <button
                    type="button"
                    className={`${s.azione} ${s.ctaTodo}`}
                    disabled={scelte.size === 0}
                    onClick={creaFollowUp}
                  >
                    {scelte.size <= 1 ? t('creaFollowUp') : t('creaFollowUpN', { n: scelte.size })}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className={s.testiSheet}>
                  <span id="sheet-titolo" className={s.titoloSheet}>
                    {t('residuoTitolo', { n: voci.length - fatte })}
                  </span>
                  <span className={s.sottotitoloSheet}>{t('residuoTesto')}</span>
                </div>
                <div className={s.fasi}>
                  {voci
                    .filter((v) => !v.fatta)
                    .map((v, i) => (
                      <div key={i} className={s.followUp} data-statico>
                        {casella(false)}
                        <span className={s.testoFollowUp}>{v.testo}</span>
                      </div>
                    ))}
                  <span className={s.metaFollowUp}>{scadenzaResiduo}</span>
                </div>
                <div className={s.azioniSheet}>
                  <button type="button" className={`${s.azione} ${s.fantasma}`} onClick={soloFatto}>
                    {t('nonOra')}
                  </button>
                  <button type="button" className={`${s.azione} ${s.ctaTodo}`} onClick={creaResiduo}>
                    {t('creaResiduo')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className={s.toast} role="status" data-todo={toast.todo || undefined}>
          <span className={s.puntoToast} />
          <span className={s.testoToast}>{toast.testo}</span>
          <button type="button" className={s.annullaToast} onClick={toast.annulla}>
            {t('annulla')}
          </button>
        </div>
      )}
    </dialog>
  );
}
