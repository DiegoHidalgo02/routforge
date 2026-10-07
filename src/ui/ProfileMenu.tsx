// Menu del logo utente (S1 Oggi Mobile «menu», FUNZ §1): Corsi, Esiti da registrare, Account e sincronizzazione,
// Impostazioni (D-DESIGN-1 n. 16: la Diagnostica si apre da Impostazioni). Popover nativo: si chiude toccando fuori o
// con Esc. «Esiti da registrare» ha il contatore degli esiti nuovi (T-022, CONTROLLI); l'intestazione con nome, email e
// stato della sync (T-033); sull'avatar un pallino quando la sync è in pari (handoff n. 17).
import { Bell, BookOpen, RefreshCw, Settings } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { NavLink } from 'react-router';
import { appDb, watch } from '../app/db';
import { readInbox } from '../app/inbox';
import { useMinuto } from './clock';
import { t, type Chiave } from './i18n';
import { Logomark } from './Logomark';
import s from './ProfileMenu.module.css';
import { syncLabel } from './Settings';
import { useSync } from './useSync';

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
  const [nuove, setNuove] = useState(0);
  useEffect(() => watch(() => readInbox(appDb, Date.now()).then((x) => x.nuove), setNuove), []);
  const sync = useSync();
  const now = useMinuto();
  const inPari = sync.account !== null && sync.fase === 'in_pari';
  return (
    <>
      {variante === 'logo' ? (
        <button type="button" popoverTarget={id} className={s.logo} aria-label={t('profilo')}>
          <Logomark />
          {inPari && <span className={s.pallino} />}
        </button>
      ) : (
        <button type="button" popoverTarget={id} className={s.riga}>
          <span className={s.avatar}>
            <Logomark />
            {inPari && <span className={s.pallino} />}
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
        {sync.account && (
          <div className={s.testa}>
            {sync.account.nome && <span className={s.nome}>{sync.account.nome}</span>}
            <span className={s.email}>{sync.account.email}</span>
            <span className={s.stato}>
              {t('sincronizzazione')} · {sync.fase === 'in_pari' ? t('inPari') : syncLabel(sync, now).testo}
            </span>
          </div>
        )}
        {VOCI.map(({ to, chiave, Icona }) => (
          <NavLink key={to} to={to} className={s.voce} onClick={() => menu.current?.hidePopover()}>
            <Icona size={18} />
            {t(chiave)}
            {to === '/notifiche' && nuove > 0 && <span className={s.contatore}>{nuove}</span>}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
