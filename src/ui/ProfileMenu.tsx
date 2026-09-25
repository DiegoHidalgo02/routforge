// Menu del logo utente (S1 Oggi Mobile «menu», FUNZ §1): Corsi, Esiti da registrare, Account e sincronizzazione,
// Impostazioni (D-DESIGN-1 n. 16: la Diagnostica si apre da Impostazioni). Popover nativo: si chiude toccando fuori o
// con Esc. L'intestazione con nome, email e stato della sync e il badge degli esiti entrano con T-033 e T-022.
import { Bell, BookOpen, RefreshCw, Settings } from 'lucide-react';
import { useId, useRef } from 'react';
import { NavLink } from 'react-router';
import { t, type Chiave } from './i18n';
import { Logomark } from './Logomark';
import s from './ProfileMenu.module.css';

const VOCI: { to: string; chiave: Chiave; Icona: typeof Bell }[] = [
  { to: '/corsi', chiave: 'corsi', Icona: BookOpen },
  { to: '/notifiche', chiave: 'esiti', Icona: Bell },
  { to: '/account', chiave: 'account', Icona: RefreshCw },
  { to: '/impostazioni', chiave: 'impostazioni', Icona: Settings },
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
