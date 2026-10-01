// Sezione ancora vuota (T-006): solo l'intestazione con il titolo; il contenuto arriva con il task della sezione.
// Su mobile `indietro` (Notifiche, Impostazioni, Diagnostica: S20 Shell Mobile); su desktop lo sostituisce la sidebar.
import { ChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { t, type Chiave } from './i18n';
import s from './Section.module.css';

export function Section({ titolo, indietro }: { titolo: Chiave; indietro?: boolean }) {
  const navigate = useNavigate();
  // Aperta da un collegamento diretto non c'è una schermata precedente nell'app: si torna a Oggi
  const primaSchermata = useLocation().key === 'default';
  return (
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
      <h1 className={s.titolo}>{t(titolo)}</h1>
    </header>
  );
}
