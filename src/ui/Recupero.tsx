// La rete di sicurezza della radice (T-059; CONTESTO §3: l'app non resta a schermo vuoto). Un errore nel disegno di una
// schermata, per esempio una riga malformata arrivata con la sync o con un backup costruito ad arte (security review
// del 07/10), mostra questa pagina invece del vuoto: «Riprova» ridisegna; se l'errore torna, «Elimina tutti i dati»,
// con la conferma in linea di S22, azzera il dispositivo (MECC §22) e ricarica. L'errore va in Diagnostica (INV-16).
// Il design non ha questa pagina: è composta coi pezzi di Impostazioni → Backup (handoff §3).
import { Component, useState, type ReactNode } from 'react';
import { eraseAllData } from '../app/backup';
import { appDb } from '../app/db';
import { logError } from '../app/diagnostics';
import { t } from './i18n';
import r from './Recupero.module.css';
import { Conferma, Gruppo } from './Settings';
import s from './Settings.module.css';

function Pagina({ onRiprova }: { onRiprova: () => void }) {
  const [conferma, setConferma] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const elimina = () => {
    setLavoro(true);
    void eraseAllData(appDb)
      .then(() => location.reload())
      .catch((e: unknown) => {
        logError('backup', e);
        setLavoro(false);
      });
  };
  return (
    <main className={r.cornice}>
      <div className={s.viste}>
        <Gruppo titolo={t('recuperoTitolo')}>
          <button type="button" className={s.riga} onClick={onRiprova}>
            <span className={s.etichettaRiga}>{t('riprova')}</span>
          </button>
          <button type="button" className={s.riga} disabled={conferma} onClick={() => setConferma(true)}>
            <span className={s.etichettaRiga} data-pericolo>
              {t('eliminaTuttiIDati')}
            </span>
          </button>
        </Gruppo>
        <p className={s.notaChiave}>{t('recuperoTesto')}</p>
        {conferma && (
          <Conferma
            titolo={t('eliminareTuttiTitolo')}
            corpo={t('eliminareTuttiCorpo')}
            azione={t('eliminaTuttiIDati')}
            lavoro={lavoro}
            onAnnulla={() => setConferma(false)}
            onConferma={elimina}
          />
        )}
      </div>
    </main>
  );
}

/** Il confine degli errori di disegno: al posto dei figli che falliscono, la pagina di recupero. */
export class Recupero extends Component<{ children: ReactNode }, { errore: boolean }> {
  override state = { errore: false };

  static getDerivedStateFromError() {
    return { errore: true };
  }

  override componentDidCatch(e: unknown) {
    logError('interfaccia', e);
  }

  override render() {
    return this.state.errore ? <Pagina onRiprova={() => this.setState({ errore: false })} /> : this.props.children;
  }
}
