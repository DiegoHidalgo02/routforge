// «Il tuo progresso oggi» e «Prossime attività» di Oggi (S1 Mobile sotto la giornata, S1 Desktop nella colonna di 360;
// FUNZ §2, `claude-design/docs/DATI-UI.md`): Completate su totali di oggi con la percentuale, il focus di oggi con il
// confronto «vs ieri», le attività completate della settimana con l'andamento per giorno; i prossimi due giorni con
// attività, «Vedi tutte» apre la Settimana. I numeri vengono dal dominio (`domain/progress.ts`), il colore dei grafici è
// il tipo che pesa di più. Le barre del Focus aspettano la risposta sulla loro scala (handoff §3 n. 11): la card ha solo
// i numeri. Decisione: D-PROG-1.
import { ChevronRight, CircleCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import type { IngressiProgresso } from '../app/progress';
import type { BloccoCalendario } from '../app/calendar';
import { shiftPeriod } from '../domain/calendar';
import { dayProgress, focusDelta, heaviestType, isDone } from '../domain/progress';
import { localInstant, MINUTE } from '../domain/time';
import { maiuscola, TIPO, titolo } from './format';
import { lingua, t } from './i18n';
import { animazioniRidotte, useSettings } from './preferenze';
import s from './Progress.module.css';

const fmt = (giorno: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(lingua, o).format(localInstant(giorno, '00:00'));
/** «Gio 24 Settembre» come nei mock: ogni parola con l'iniziale maiuscola. */
const dataGruppo = (giorno: string) =>
  fmt(giorno, { weekday: 'short', day: 'numeric', month: 'long' }).split(' ').map(maiuscola).join(' ');

/** Andamento della settimana (S1 «Settimana»): area e linea su sette punti, alti quanto le completate di ogni giorno. */
function Andamento({ valori, larga }: { valori: number[]; larga: number }) {
  const alta = 20;
  const max = Math.max(1, ...valori);
  const punti = valori.map((v, i) => [(i / Math.max(1, valori.length - 1)) * larga, alta - (v / max) * (alta - 2) - 1]);
  const linea = punti.map(([x, y], i) => `${i ? 'L' : 'M'}${x?.toFixed(1)} ${y?.toFixed(1)}`).join(' ');
  return (
    <svg className={s.andamento} viewBox={`0 0 ${larga} ${alta}`} preserveAspectRatio="none" aria-hidden>
      <path className={s.area} d={`${linea} L${larga} ${alta} L0 ${alta} Z`} />
      <path className={s.linea} d={linea} />
    </svg>
  );
}

/**
 * Il numero delle completate pulsa quando cresce (S1 `rf-bump`: 1,18 e success al 35 %, 450 ms), non all'apertura;
 * con Celebrazioni off o animazioni ridotte cambia e basta (council del 07/10, handoff n. 80: al posto di `rf-land`).
 */
function Pulsa({ n }: { n: number }) {
  const { celebrazioni } = useSettings();
  const [prima, setPrima] = useState(n);
  const [colpi, setColpi] = useState(0);
  if (n !== prima) {
    setPrima(n);
    if (n > prima && celebrazioni !== 'off' && !animazioniRidotte()) setColpi((c) => c + 1);
  }
  return (
    <motion.span
      key={colpi}
      className={s.pulsa}
      initial={colpi ? { scale: 1 } : false}
      animate={
        colpi
          ? { scale: [1, 1.18, 1], color: ['var(--color-text)', 'var(--color-success)', 'var(--color-text)'] }
          : undefined
      }
      transition={{ duration: 0.45, times: [0, 0.35, 1], ease: 'easeOut' }}
    >
      {n}
    </motion.span>
  );
}

export function ProgressoOggi({ ingressi, oggi }: { ingressi: IngressiProgresso; oggi: string }) {
  const diOggi = ingressi.settimana.get(oggi) ?? [];
  const p = dayProgress(diOggi);
  const fatteOggi = diOggi.filter(isDone);
  const giorni = [...ingressi.settimana.values()];
  const perGiorno = giorni.map((g) => g.filter(isDone).length);
  const fatteSettimana = giorni.flat().filter(isDone);
  const delta = focusDelta(ingressi.focusOggi, ingressi.focusIeri);
  const minuti = Math.round(ingressi.focusOggi / MINUTE);
  const tipoOggi = heaviestType(fatteOggi);
  const tipoSettimana = heaviestType(fatteSettimana);
  return (
    <section className={s.progresso} aria-labelledby="progresso-titolo">
      <h2 id="progresso-titolo" className={s.titoloSezione}>
        {t('progressoOggi')}
      </h2>
      <div className={s.terna}>
        <div className={s.card} data-tipo={tipoOggi ?? undefined}>
          <span className={s.testa}>
            <span className={s.etichetta}>{t('completate')}</span>
            <span className={`${s.disco} ${s.soloDesktop}`} aria-hidden>
              <CircleCheck size={13} />
            </span>
          </span>
          <span className={s.valore}>
            <Pulsa n={p.fatte} />
            <span className={s.unita}> / {p.totale}</span>
          </span>
          <span className={s.sub}>
            <span className={s.soloMobile}>{t('percentoDiOggi', { p: p.percento })}</span>
            <span className={s.soloDesktop}>{p.percento} %</span>
          </span>
          <span className={s.binario}>
            {/* Larghezza del riempimento: la sola misura che dipende dal dato */}
            <span className={s.riempimento} style={{ width: `${p.percento}%` }} />
          </span>
        </div>
        <div className={s.card} data-tipo={tipoOggi ?? undefined}>
          <span className={s.etichetta}>{t('focus')}</span>
          <span className={s.valore}>
            {Math.floor(minuti / 60)}
            <span className={s.unita}>{t('oreSigla')}</span> {String(minuti % 60).padStart(2, '0')}
            <span className={s.unita}>{t('minutiSigla')}</span>
          </span>
          <span className={s.sub} data-delta={delta === null ? undefined : delta >= 0 ? 'su' : 'giu'}>
            {t('vsIeri', { delta: delta === null ? '—' : `${delta >= 0 ? '+' : '−'}${Math.abs(delta)} %` })}
          </span>
        </div>
        <div className={`${s.card} ${s.settimana}`} data-tipo={tipoSettimana ?? undefined}>
          <span className={s.etichetta}>
            <span className={s.soloMobile}>{t('settimana')}</span>
            <span className={s.soloDesktop}>{t('attivitaCompletate')}</span>
          </span>
          <span className={s.valoreSettimana}>
            <span className={s.valore}>{fatteSettimana.length}</span>
            <span className={s.sub}>
              <span className={s.soloMobile}>{t('completateMinuscolo')}</span>
              <span className={s.soloDesktop}>{t('questaSettimana')}</span>
            </span>
          </span>
          <Andamento valori={perGiorno} larga={100} />
        </div>
      </div>
    </section>
  );
}

export function ProssimeAttivita({
  prossimi,
  oggi,
  onVediTutte,
}: {
  prossimi: IngressiProgresso['prossimi'];
  oggi: string;
  onVediTutte: () => void;
}) {
  const domani = shiftPeriod(oggi, 'giorno', 1);
  return (
    <section className={s.prossime} aria-labelledby="prossime-titolo">
      <div className={s.testaProssime}>
        <h2 id="prossime-titolo" className={s.titoloSezione}>
          {t('prossimeAttivita')}
        </h2>
        <button type="button" className={s.vediTutte} onClick={onVediTutte}>
          {t('vediTutte')}
          <ChevronRight size={14} />
        </button>
      </div>
      <div className={s.cartaProssime}>
        {prossimi.length === 0 && <p className={s.vuoto}>{t('nienteInProgramma')}</p>}
        {prossimi.map(([g, blocchi]) => (
          <div key={g} className={s.gruppo}>
            <span className={s.giorno}>
              {g === domani ? t('domani') : maiuscola(fmt(g, { weekday: 'long' }))}
              <span className={s.data}> • {dataGruppo(g)}</span>
            </span>
            {blocchi.map((b) => (
              <Riga key={b.id} b={b} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function Riga({ b }: { b: BloccoCalendario }) {
  return (
    <span className={s.riga} data-tipo={b.tipo}>
      <span className={s.ora}>{b.conOrario ? b.orarioInizio : '—'}</span>
      <span className={s.titoloRiga}>{titolo(b)}</span>
      <span className={s.badge}>{t(TIPO[b.tipo])}</span>
    </span>
  );
}
