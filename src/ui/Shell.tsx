// Shell (S20 Shell Mobile/Desktop, S1 Oggi; DESIGN.md §6 Navigazione): BottomNav su mobile, sidebar da 1024 px
// (D-UI-1). Il logo utente apre il menu del Profilo (FUNZ §1): in testa a Oggi su mobile, in fondo alla sidebar.
import { ChartColumn, House, Plus, SlidersVertical } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { t } from './i18n';
import { Logomark } from './Logomark';
import { ProfileMenu } from './ProfileMenu';
import s from './Shell.module.css';

export function Shell() {
  // S20 Shell Mobile: niente BottomNav su Notifiche e sulle viste interne di Impostazioni (Diagnostica), che hanno
  // l'indietro; Impostazioni stessa la tiene
  const location = useLocation();
  const barra = location.pathname !== '/notifiche' && location.pathname !== '/diagnostica';
  // «+ Crea» si apre sopra la schermata corrente (App.tsx)
  const sfondo = { sfondo: location };
  return (
    <div className={s.shell}>
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
        <div className={s.fondo}>
          <ProfileMenu variante="riga" />
          <NavLink to="/impostazioni" className={s.voce}>
            <SlidersVertical size={18} />
            {t('impostazioni')}
          </NavLink>
        </div>
      </aside>
      <main className={s.main}>
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
