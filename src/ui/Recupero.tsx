// La rete di sicurezza (T-059; CONTESTO §3: l'app non resta a schermo vuoto). Un errore nel disegno di una schermata,
// per esempio una riga malformata arrivata con la sync o con un backup costruito ad arte (security review del 07/10),
// mostra questa pagina invece del vuoto: «Riprova» ridisegna; «Esporta backup» salva prima i dati che sono solo qui
// (corsi, PDF, sessioni); se l'errore torna, «Elimina tutti i dati», con la conferma in linea di S22, azzera il
// dispositivo (MECC §22) e ricarica. L'errore va in Diagnostica (INV-16). Un confine sta alla radice, uno dentro la
// shell per ogni rotta: un errore in una schermata lascia la navigazione e cambiare rotta lo azzera (audit P1-4).
// Il design non ha questa pagina: è composta coi pezzi di Impostazioni → Backup (handoff §3).
import { Component, useState, type ReactNode } from 'react';
import { eraseAllData, exportBackup } from '../app/backup';
import { appDb } from '../app/db';
import { logError } from '../app/diagnostics';
import { t, type Chiave } from './i18n';
import r from './Recupero.module.css';
import { Conferma, Gruppo } from './Settings';
import s from './Settings.module.css';

function Pagina({ onRiprova, dentro }: { onRiprova: () => void; dentro: boolean }) {
  const [conferma, setConferma] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const [esito, setEsito] = useState<Chiave | null>(null);
  // Dentro la shell c'è già il suo `main`
  const Cornice = dentro ? 'div' : 'main';
  const esporta = () => {
    setLavoro(true);
    // `exportBackup` non rigetta: un file non salvato è `null`, con la riga in Diagnostica
    void exportBackup(appDb, Date.now()).then((dove) => {
      setEsito(dove === 'documenti' ? 'backupSalvatoDocumenti' : dove ? 'backupScaricato' : 'backupNonSalvato');
      setLavoro(false);
    });
  };
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
    <Cornice className={r.cornice}>
      <div className={s.viste}>
        <Gruppo titolo={t('recuperoTitolo')}>
          <button type="button" className={s.riga} onClick={onRiprova}>
            <span className={s.etichettaRiga}>{t('riprova')}</span>
          </button>
          <button type="button" className={s.riga} disabled={lavoro} onClick={esporta}>
            <span className={s.etichettaRiga}>{t('esportaBackup')}</span>
          </button>
          <button type="button" className={s.riga} disabled={conferma} onClick={() => setConferma(true)}>
            <span className={s.etichettaRiga} data-pericolo>
              {t('eliminaTuttiIDati')}
            </span>
          </button>
        </Gruppo>
        {esito && (
          <span
            className={esito === 'backupNonSalvato' ? s.avvisoBackup : s.esitoBackup}
            role={esito === 'backupNonSalvato' ? 'alert' : 'status'}
          >
            {t(esito)}
          </span>
        )}
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
    </Cornice>
  );
}

/**
 * Il confine degli errori di disegno: al posto dei figli che falliscono, la pagina di recupero. `dentro`: il confine
 * della shell, attorno alla rotta (con la rotta come `key`, così cambiare schermata lo azzera).
 */
export class Recupero extends Component<{ children: ReactNode; dentro?: boolean }, { errore: boolean }> {
  override state = { errore: false };

  static getDerivedStateFromError() {
    return { errore: true };
  }

  override componentDidCatch(e: unknown) {
    logError('interfaccia', e);
  }

  override render() {
    return this.state.errore ? (
      <Pagina onRiprova={() => this.setState({ errore: false })} dentro={this.props.dentro === true} />
    ) : (
      this.props.children
    );
  }
}
