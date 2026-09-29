// Shell (S20 Shell Mobile/Desktop, S1 Oggi; DESIGN.md §6 Navigazione): BottomNav su mobile, sidebar da 1024 px
// (D-UI-1). Il logo utente apre il menu del Profilo (FUNZ §1): in testa a Oggi su mobile, in fondo alla sidebar.
import { ChartColumn, House, Plus, SlidersVertical } from 'lucide-react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { exitLocked } from '../domain/timer';
import { useMinuto } from './clock';
import { t } from './i18n';
import { Logomark } from './Logomark';
import { ProfileMenu } from './ProfileMenu';
import { SessionBanner, useSessionView } from './Session';
import s from './Shell.module.css';

export function Shell() {
  // S20 Shell Mobile: niente BottomNav su Notifiche e sulle viste interne di Impostazioni (Account, Diagnostica), che hanno
  // l'indietro; Impostazioni stessa la tiene. La sessione (S15 Mobile) è a schermo pieno
  const location = useLocation();
  const sessione = location.pathname.startsWith('/sessione');
  const barra = !['/notifiche', '/account', '/diagnostica'].includes(location.pathname) && !sessione;
  // Con una sessione attiva, fuori dalla sessione: banner in testa su mobile e card nella sidebar su desktop (T-017)
  const vista = useSessionView();
  const now = useMinuto();
  const banner = vista && !sessione ? vista : null;
  // Iperfocus: l'uscita resta bloccata fino alla fine anche riaprendo l'app altrove (D5)
  if (banner && exitLocked(banner.sessione, now)) return <Navigate to="/sessione" replace />;
  // «+ Crea» si apre sopra la schermata corrente (App.tsx)
  const sfondo = { sfondo: location };
  return (
    <div className={s.shell} data-sessione={banner ? '' : undefined}>
      <aside className={s.sidebar}>
        <div className={s.marchio}>
          <span className={s.logo}>
            <Logomark />
          </span>
          RoutForge
        </div>
        <nav className={s.voci} aria-label={t('navigazione')}>
          <NavLink to="/" end className={s.voce}>
            <House size={18} />
            {t('oggi')}
          </NavLink>
          <NavLink to="/statistiche" className={s.voce}>
            <ChartColumn size={18} />
            {t('statistiche')}
          </NavLink>
          <Link to="/crea" state={sfondo} className={s.crea}>
            <Plus size={16} strokeWidth={2.25} />
            {t('crea')}
          </Link>
        </nav>
        {vista && <SessionBanner vista={vista} variante="sidebar" />}
        <div className={s.fondo}>
          <ProfileMenu variante="riga" />
          <NavLink to="/impostazioni" className={s.voce}>
            <SlidersVertical size={18} />
            {t('impostazioni')}
          </NavLink>
        </div>
      </aside>
      <main className={s.main} data-piena={sessione || undefined}>
        {banner && <SessionBanner vista={banner} variante="banner" />}
        <Outlet />
      </main>
      {barra && (
        <nav className={s.bottomNav} aria-label={t('navigazione')}>
          <NavLink to="/" end className={s.tab}>
            <House size={18} />
            {t('oggi')}
          </NavLink>
          <Link to="/crea" state={sfondo} className={s.fab} aria-label={t('crea')}>
            <Plus size={22} strokeWidth={2.25} />
          </Link>
          <NavLink to="/statistiche" className={s.tab}>
            <ChartColumn size={18} />
            {t('statistiche')}
          </NavLink>
        </nav>
      )}
    </div>
  );
}
