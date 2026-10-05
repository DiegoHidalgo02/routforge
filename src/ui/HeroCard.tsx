// Card Adesso (S1 «Card Adesso (hero)», COMPONENTI HeroCard; FUNZ §2, MECC §14): l'attività scelta dal dominio
// (`heroBlock`) cresce a hero nella lista, al suo orario; non si chiude (G2). Eyebrow nell'ink del tipo, badge, titolo
// su due righe al massimo, un solo sub (lo studio «corso · Unità n.n»), il dato: in corso durata e fascia, tra poco i
// minuti all'inizio, da recuperare l'ultimo avvio (la routine «poi risulta persa»). Studio: play 48 con l'azione della
// sessione (`studyActions`, T-016); gli altri tipi: cerchio 28 su un bersaglio 48 che spunta come il cerchio della card
// (MECC §3, D-DETT-3). Il tocco sulla card apre il Dettaglio. Decisioni: D-NOW-2, D-DESIGN-3.
import { GraduationCap, MapPin, Play, SquareCheckBig } from 'lucide-react';
import { Link, type Location } from 'react-router';
import type { BloccoAdesso } from '../app/nowBlock';
import type { StatoHero } from '../domain/nowBlock';
import { studyActions, type AzioneStudio, type SessioneAttiva } from '../domain/session';
import { localTimeKey, MINUTE } from '../domain/time';
import { sottotitolo, TIPO, titolo } from './format';
import s from './HeroCard.module.css';
import { t, type Chiave } from './i18n';
import { useStudyAction } from './Session';

const EYEBROW: Record<StatoHero['tipo'], Chiave> = { tra: 'traPoco', adesso: 'adesso', recupera: 'daRecuperare' };
/** Etichette del play (S1): «Inizia», «Anticipa», «Recupera»; la ripresa della sessione attiva «Riprendi». */
const AZIONE: Record<AzioneStudio, Chiave> = {
  inizia: 'sessioneInizia',
  anticipa: 'sessioneAnticipa',
  recupera: 'sessioneRecupera',
  riprendi: 'sessioneRiprendi',
  libera: 'sessioneLibera',
  ripasso: 'ripassoLibera',
};
/** Etichetta del cerchio per tipo (S1 `heroCheckLabel`); lo studio ha il play. */
const SPUNTA: Record<BloccoAdesso['tipo'], Chiave> = {
  todo: 'segnaFatto',
  routine: 'segnaFatta',
  evento: 'completaEvento',
  studio: 'segnaFatto',
};

/** Il dato della card (S1 `heroNum` · `heroUnit` · `heroSub`): numero, unità e testo accanto. */
function dato(b: BloccoAdesso, stato: StatoHero): [string, string, string] {
  if (stato.tipo === 'tra') return [String(stato.minutiAllInizio), t('minutiUnita'), ''];
  if (stato.tipo === 'recupera')
    return [localTimeKey(stato.ultimoAvvio), '', t(b.tipo === 'routine' ? 'poiRisultaPersa' : 'ultimoAvvio')];
  if (b.fine === null) return [b.orarioInizio, '', t('senzaDurata')];
  return [String(Math.round((b.fine - b.inizio) / MINUTE)), t('minutiUnita'), `${b.orarioInizio} – ${b.orarioFine}`];
}

export function HeroCard({
  b,
  stato,
  now,
  attiva,
  sfondo,
  onSpunta,
}: {
  b: BloccoAdesso;
  stato: StatoHero;
  now: number;
  attiva: SessioneAttiva | null;
  sfondo: { sfondo: Location };
  /** Spunta dal cerchio, se il blocco si spunta da qui (`canCheckFromCalendar`). */
  onSpunta?: () => void;
}) {
  const avvia = useStudyAction();
  const [numero, unita, testo] = dato(b, stato);
  const [sessione] = b.tipo === 'studio' ? studyActions(b, now, attiva) : [];
  const studio = b.tipo === 'studio';
  const sub = studio
    ? [b.corsoTitolo, b.unitaNumero && `${t('unita')} ${b.unitaNumero}`].filter(Boolean).join(' · ')
    : sottotitolo(b);
  const Icona = studio ? GraduationCap : b.checklist?.length ? SquareCheckBig : b.luogo ? MapPin : null;
  return (
    <div className={s.hero}>
      <span className={s.accento} />
      <span className={s.eyebrow}>{t(EYEBROW[stato.tipo])}</span>
      <span className={s.badge}>{t(TIPO[b.tipo])}</span>
      {/* Il collegamento copre la card (FUNZ §4); play e cerchio stanno sopra */}
      <Link to={`/attivita/${b.id}`} state={sfondo} className={s.titolo}>
        {titolo(b)}
      </Link>
      {sub && (
        <span className={s.sub}>
          {Icona && <Icona size={12} aria-hidden />}
          <span className={s.testoSub}>{sub}</span>
        </span>
      )}
      <span className={s.dato}>
        <span className={s.numero}>{numero}</span>
        {unita && <span className={s.unita}>{unita}</span>}
        {testo && <span className={s.testoDato}>{testo}</span>}
      </span>
      {sessione ? (
        <button
          type="button"
          className={s.play}
          aria-label={t(AZIONE[sessione])}
          title={t(AZIONE[sessione])}
          onClick={() => avvia(sessione, b)}
        >
          <Play size={20} fill="currentColor" stroke="none" />
        </button>
      ) : (
        onSpunta && (
          <button
            type="button"
            className={s.cerchio}
            aria-label={t(SPUNTA[b.tipo])}
            title={t(SPUNTA[b.tipo])}
            onClick={onSpunta}
          >
            <span className={s.anello} />
          </button>
        )
      )}
    </div>
  );
}
