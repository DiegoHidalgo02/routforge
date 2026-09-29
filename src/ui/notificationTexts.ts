// Testi delle notifiche nelle sei lingue (FUNZ §22, MECC §13.2; D-NOTIF-1 n. 8): la porta riceve voci semantiche, il
// punto di composizione inietta questa funzione nell'adapter, così `app` e `platform` non importano `ui` (INV-1).
import type { TestiNotifica } from '../app/ports/notifications';
import type { TriggerNotifica } from '../domain/notifications/desiredSet';
import { localTimeKey } from '../domain/time';
import { durata, titolo as titoloBlocco } from './format';
import { t, type Chiave } from './i18n';

const CORPO: Record<TriggerNotifica, Chiave> = {
  pre: 'notifPre',
  inizio: 'notifInizio',
  verifica: 'notifVerifica',
  esito: 'notifEsito',
  scadenza: 'notifScadenza',
  giorno: 'notifGiorno',
  tempo_scaduto: 'notifTempoScaduto',
};

export const testiNotifica: TestiNotifica = (v) => {
  const nome = titoloBlocco(v);
  if (v.trigger === 'tempo_scaduto') return { titolo: t('notifTempoScaduto'), corpo: nome };
  const ora = v.inizioBlocco === null ? '' : localTimeKey(v.inizioBlocco);
  return {
    titolo: v.sveglia ? t('notifSveglia', { titolo: nome }) : nome,
    corpo: t(CORPO[v.trigger], { tempo: durata(v.anticipo), ora }),
  };
};
