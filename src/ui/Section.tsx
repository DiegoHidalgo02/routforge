// Sezione ancora vuota (T-006): solo l'intestazione con il titolo; il contenuto arriva con il task della sezione.
// Su mobile `indietro` (Notifiche, Impostazioni, Diagnostica: S20 Shell Mobile); su desktop lo sostituisce la sidebar.
// Sotto l'intestazione il banner «Sessione in corso» (NAVIGAZIONE §2). Le viste di Impostazioni hanno il sottotitolo
// «Impostazioni» (S20 Shell Mobile).
import { ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { t, type Chiave } from './i18n';
import { SessionBannerSlot } from './Session';
import s from './Section.module.css';

export function Section({
  titolo,
  indietro,
  sottotitolo,
}: {
  titolo: Chiave;
  indietro?: boolean;
  sottotitolo?: string;
}) {
  const navigate = useNavigate();
  // Aperta da un collegamento diretto non c'è una schermata precedente nell'app: si torna a Oggi
  const primaSchermata = useLocation().key === 'default';
  return (
    <>
      <header className={s.intestazione}>
        {indietro && (
          <button
            type="button"
            className={`${s.indietro} ${s.soloMobile}`}
            aria-label={t('indietro')}
            onClick={() => (primaSchermata ? navigate('/') : navigate(-1))}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div className={s.testi}>
          <h1 className={s.titolo}>{t(titolo)}</h1>
          {sottotitolo && <span className={s.sottotitolo}>{sottotitolo}</span>}
        </div>
      </header>
      <SessionBannerSlot />
    </>
  );
}
