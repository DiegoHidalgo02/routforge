// Blocco «Adesso / prossimo» (S1 NowBlock; FUNZ §2, MECC §14): cosa è in corso o cosa viene dopo, con lo stato che
// cambia da solo (l'orologio batte al minuto): «Tra poco» con i minuti all'inizio, «Adesso» con i minuti alla fine,
// «Da recuperare» con l'ultimo avvio (fine + 30') per routine e studio, «Concluso» per todo ed eventi (copy del mock,
// D-DESIGN-1); numeri dal dominio (`statusOf`). Gli ingressi arrivano dal servizio (`watchNowInputs`: blocchi di ieri,
// oggi e domani, chiusure, sessione attiva), la scelta dal dominio (`selectNowBlock`). «Apri» porta al Dettaglio; per
// lo studio l'azione è della sessione (Inizia · Anticipa · Recupera · Riprendi, `studyActions`, T-016) e il sottotitolo
// «corso · Unità n.n». × chiude per oggi (G2). Su mobile il blocco è appiccicato in testa
// e si comprime allo scroll (oltre 72 px giù, sotto 8 px su, come il mock); su desktop sta nella colonna laterale.
// Colori: solo quello del tipo (accento, pallino, badge), lo stato con parole e peso (D-NOW-3, `NowBlock.module.css`).
// Decisioni: D-NOW-2, D-NOW-3, D-SESS-1.
import { Play, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, type Location } from 'react-router';
import { appDb } from '../app/db';
import { dismissNowBlock, watchNowInputs, type IngressiAdesso } from '../app/nowBlock';
import { selectNowBlock, type StatoAdesso } from '../domain/nowBlock';
import { studyActions, type AzioneStudio } from '../domain/session';
import { localDayKey, localTimeKey } from '../domain/time';
import { useMinuto } from './clock';
import { sottotitolo, TIPO, titolo } from './format';
import { t, type Chiave } from './i18n';
import s from './NowBlock.module.css';
import { useStudyAction } from './Session';

const EYEBROW: Record<StatoAdesso['tipo'], Chiave> = {
  tra: 'traPoco',
  adesso: 'adesso',
  recupera: 'daRecuperare',
  orario_passato: 'concluso',
};
/** Etichette brevi del mock (S1): «Inizia», «Anticipa», «Recupera»; la ripresa della sessione attiva «Riprendi». */
const AZIONE: Record<AzioneStudio, Chiave> = {
  inizia: 'sessioneInizia',
  anticipa: 'sessioneAnticipa',
  recupera: 'sessioneRecupera',
  riprendi: 'sessioneRiprendi',
  libera: 'sessioneLibera',
  ripasso: 'ripassoLibera',
};
/** Soglie di scorrimento del mock: oltre 72 px il blocco si comprime, sotto 8 px si riestende. */
const SCROLL_COMPATTO = 72;
const SCROLL_ESTESO = 8;
/** Da 1024 px il blocco sta nella colonna laterale (D-UI-1). */
const DESKTOP = '(min-width: 1024px)';

/** Compresso dopo 72 px di scorrimento della pagina, esteso di nuovo sotto 8 px (S1 Mobile); mai su desktop (D-UI-1). */
function useCompatto(): boolean {
  const [compatto, setCompatto] = useState(
    () => !window.matchMedia(DESKTOP).matches && window.scrollY > SCROLL_COMPATTO,
  );
  useEffect(() => {
    const desktop = window.matchMedia(DESKTOP);
    const suScroll = () => {
      if (desktop.matches) return;
      if (window.scrollY > SCROLL_COMPATTO) setCompatto(true);
      else if (window.scrollY < SCROLL_ESTESO) setCompatto(false);
    };
    window.addEventListener('scroll', suScroll, { passive: true });
    return () => window.removeEventListener('scroll', suScroll);
  }, []);
  return compatto;
}

export function NowBlock({ sfondo }: { sfondo: { sfondo: Location } }) {
  const now = useMinuto();
  const oggi = localDayKey(now);
  const [ingressi, setIngressi] = useState<IngressiAdesso>();
  useEffect(() => watchNowInputs(appDb, oggi, setIngressi), [oggi]);
  const compatto = useCompatto();
  const avvia = useStudyAction();

  const sel = ingressi && selectNowBlock(ingressi.blocchi, now, ingressi.chiusi);
  if (!sel) return null;
  const { blocco: b, stato } = sel;

  // Numero grande, unità e testo accanto, come nel mock: minuti (tra poco, adesso), orario (ultimo avvio, concluso)
  const fascia = b.orarioFine ? `${b.orarioInizio} – ${b.orarioFine}` : `${b.orarioInizio} · ${t('senzaDurata')}`;
  let numero = b.orarioInizio;
  let unita = '';
  let numeroSub = b.orarioFine ? `– ${b.orarioFine}` : t('senzaDurata');
  if (stato.tipo === 'tra') {
    numero = String(stato.minutiAllInizio);
    unita = t('minutiUnita');
    numeroSub = `${t('allInizio')} · ${fascia}`;
  } else if (stato.tipo === 'adesso' && stato.minutiAllaFine !== null) {
    numero = String(stato.minutiAllaFine);
    unita = t('minutiUnita');
    numeroSub = `${t('allaFine')} · ${fascia}`;
  } else if (stato.tipo === 'recupera') {
    numero = localTimeKey(stato.ultimoAvvio);
    numeroSub = t('ultimoAvvio');
  }
  const numeri = (
    <span className={s.numeri}>
      <span className={s.numero}>{numero}</span>
      {unita && <span className={s.unita}>{unita}</span>}
      <span className={s.numeroSub}>{numeroSub}</span>
    </span>
  );
  // Lo studio avvia la sessione (§10.1: l'azione la sceglie il dominio); gli altri tipi aprono il Dettaglio
  const [sessione] = b.tipo === 'studio' ? studyActions(b, now, ingressi.attiva) : [];
  const azione = sessione ? (
    <button type="button" className={`${s.azione} ${s.primaria}`} onClick={() => avvia(sessione, b)}>
      {/* Il play del mock solo a blocco esteso */}
      {!compatto && <Play size={13} strokeWidth={2} />}
      {t(AZIONE[sessione])}
    </button>
  ) : (
    <Link to={`/attivita/${b.id}`} state={sfondo} className={s.azione}>
      {t('apri')}
    </Link>
  );
  // Sottotitolo dello studio «corso · Unità n.n» (S1)
  const sub =
    b.tipo === 'studio'
      ? [b.corsoTitolo, b.unitaNumero && `${t('unita')} ${b.unitaNumero}`].filter(Boolean).join(' · ')
      : sottotitolo(b);

  return (
    <div className={s.fisso}>
      {compatto ? (
        <section
          className={`${s.card} ${s.compatta}`}
          data-tipo={b.tipo}
          data-stato={stato.tipo}
          aria-label={t('adesso')}
        >
          <span className={s.accento} />
          <span className={s.pallino} aria-hidden />
          <span className={s.colonna}>
            <span className={s.titolo}>{titolo(b)}</span>
            {/* Il pallino ha il colore del tipo (D-NOW-3): lo stato lo dice la parola, anche da compresso */}
            <span className={s.rigaCompatta}>
              <span className={s.statoCompatto}>{t(EYEBROW[stato.tipo])}</span>
              {numeri}
            </span>
          </span>
          {azione}
        </section>
      ) : (
        <section className={s.card} data-tipo={b.tipo} data-stato={stato.tipo} aria-label={t('adesso')}>
          <span className={s.accento} />
          <span className={s.eyebrow}>
            <span className={s.pallino} />
            {t(EYEBROW[stato.tipo])}
          </span>
          <button
            type="button"
            className={s.chiudi}
            aria-label={t('chiudiPerOggi')}
            onClick={() => void dismissNowBlock(appDb, b, Date.now())}
          >
            <X size={14} />
          </button>
          <span className={s.titolo}>{titolo(b)}</span>
          <span className={s.sub}>{sub}</span>
          <span className={s.meta}>
            <span className={s.badge}>{t(TIPO[b.tipo])}</span>
            {numeri}
          </span>
          {azione}
        </section>
      )}
    </div>
  );
}
