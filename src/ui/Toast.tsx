// Il toast con «Annulla» (S1 Toast, `claude-design/docs/COMPONENTI.md`): il pallino col tono, il testo e «Annulla» se
// l'avviso lo ha, in una regione che i lettori di schermo annunciano. Era scritto uguale in Oggi, Notifiche e Materiali
// (audit P3-15); il Dettaglio ha il suo, dentro il dialogo. Oggi passa il riferimento del bottone per dargli il fuoco.
import type { Ref } from 'react';
import type { Tono } from './avvisi';
import { t } from './i18n';
import s from './Today.module.css';

export function Toast({
  avviso,
  annullaRef,
}: {
  avviso: { testo: string; tono: Tono; annulla?: () => void } | undefined;
  annullaRef?: Ref<HTMLButtonElement>;
}) {
  return (
    <div className={s.regioneToast} role="status">
      {avviso && (
        <div className={s.toast}>
          <span className={s.puntoToast} data-tono={avviso.tono} />
          <span className={s.testoToast}>{avviso.testo}</span>
          {avviso.annulla && (
            <button ref={annullaRef} type="button" className={s.annullaToast} onClick={avviso.annulla}>
              {t('annullaAzione')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
