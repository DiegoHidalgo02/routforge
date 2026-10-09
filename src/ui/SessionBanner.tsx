// Il banner «Sessione in corso» (S1 SessionShell, S15 Desktop) e la lettura della sessione attiva che lo alimenta: un
// pezzo trasversale, usato da quasi ogni schermata, in un file proprio invece che dentro la Sessione, così le schermate
// che lo mostrano non importano tutta la Sessione e il grafo degli import resta senza cicli (audit P2-17).
import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router';
import { appDb, watch } from '../app/db';
import { readSessionView, type VistaSessione } from '../app/session';
import { timerState, type StatoTimer } from '../domain/timer';
import { useSecondo } from './clock';
import { orologio } from './format';
import { t } from './i18n';
import s from './Session.module.css';

/** La sessione attiva con unità e orario; `undefined` fino alla prima lettura. */
export function useSessionView(): VistaSessione | null | undefined {
  const [vista, setVista] = useState<VistaSessione | null>();
  useEffect(() => watch(() => readSessionView(appDb), setVista), []);
  return vista;
}

/** Il numero del timer: conto alla rovescia, «+04:12» nel tempo extra, focus trascorso nel cronometro (FUNZ §11.2). */
export function testoTimer(st: StatoTimer): string {
  if (st.restante === null) return orologio(st.focus);
  return st.finita ? `+${orologio(st.extra)}` : orologio(st.restante, true);
}

/**
 * «Sessione in corso» (S1 SessionShell, S15 Desktop): banner in testa al contenuto su mobile, card nella sidebar su
 * desktop; «Riprendi» riporta al timer (FUNZ §11.2, D4).
 */
export function SessionBanner({ vista, variante }: { vista: VistaSessione; variante: 'banner' | 'sidebar' }) {
  const now = useSecondo();
  const tempo = testoTimer(timerState(vista.sessione, now));
  const titolo = vista.unita?.titolo ?? t('sessioneDiStudio');
  if (variante === 'sidebar')
    return (
      <NavLink to="/sessione" end className={s.bannerSidebar}>
        <span className={s.bannerEtichetta}>
          <span className={s.pallino} />
          {t('sessioneInCorso')}
        </span>
        <span className={s.bannerRiga}>
          <span className={s.bannerTempo}>{tempo}</span>
          <span className={s.bannerAzione}>{t('riprendi')}</span>
        </span>
        <span className={s.bannerTitolo}>{titolo}</span>
      </NavLink>
    );
  return (
    <div className={s.banner}>
      <span className={s.pallinoLive} />
      <span className={s.bannerTesto}>
        {t('sessioneInCorso')} · <span className={s.bannerCifre}>{tempo}</span> · {titolo}
      </span>
      <Link to="/sessione" className={s.bannerRiprendi}>
        {t('riprendi')}
      </Link>
    </div>
  );
}

/**
 * Banner «Sessione in corso» sotto l'intestazione di ogni schermata mobile e sopra la striscia dei giorni
 * (`claude-design/CLAUDE.md` «Oggi», NAVIGAZIONE §2); su desktop c'è la carta della sidebar e il banner è nascosto.
 */
export function SessionBannerSlot() {
  const vista = useSessionView();
  return vista ? <SessionBanner vista={vista} variante="banner" /> : null;
}
