// Menu del logo utente (FUNZ §1; S1 Oggi Mobile «menu», S20 Shell Desktop): Corsi, esiti da registrare, Impostazioni
// e Diagnostica (divergenza 16, docs/03_HANDOFF_DESIGN_CODE.md §10). Popover nativo: si chiude toccando fuori o con Esc.
// La voce «Account e sincronizzazione» e l'intestazione con email e stato della sync entrano con T-033.
import { Activity, Bell, BookOpen, Settings } from 'lucide-react';
import { useId, useRef } from 'react';
import { NavLink } from 'react-router';
import { t, type Chiave } from './i18n';
import { Logomark } from './Logomark';
import s from './ProfileMenu.module.css';

const VOCI: { to: string; chiave: Chiave; Icona: typeof Bell }[] = [
  { to: '/corsi', chiave: 'corsi', Icona: BookOpen },
  { to: '/notifiche', chiave: 'esiti', Icona: Bell },
  { to: '/impostazioni', chiave: 'impostazioni', Icona: Settings },
  { to: '/diagnostica', chiave: 'diagnostica', Icona: Activity },
];

/** `logo`: bottone tondo in testa a Oggi (mobile); `riga`: riga del profilo in fondo alla sidebar (desktop). */
export function ProfileMenu({ variante }: { variante: 'logo' | 'riga' }) {
  const id = useId();
  const menu = useRef<HTMLElement>(null);
  return (
    <>
      {variante === 'logo' ? (
        <button type="button" popoverTarget={id} className={s.logo} aria-label={t('profilo')}>
          <Logomark />
        </button>
      ) : (
        <button type="button" popoverTarget={id} className={s.riga}>
          <span className={s.avatar}>
            <Logomark />
          </span>
          {t('profilo')}
        </button>
      )}
      <nav
        id={id}
        ref={menu}
        popover="auto"
        className={`${s.menu} ${variante === 'logo' ? s.sotto : s.sopra}`}
        aria-label={t('profilo')}
      >
        {VOCI.map(({ to, chiave, Icona }) => (
          <NavLink key={to} to={to} className={s.voce} onClick={() => menu.current?.hidePopover()}>
            <Icona size={18} />
            {t(chiave)}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
