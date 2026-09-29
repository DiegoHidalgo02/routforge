// Testi delle notifiche nelle sei lingue (FUNZ §22, MECC §13.2, §13.5, §13.6; D-NOTIF-1 n. 8): la porta riceve voci
// semantiche, il punto di composizione inietta questa funzione nell'adapter, così `app` e `platform` non importano `ui`
// (INV-1). Criteri: SCENARI A4 (digest), B7 (blocco perso).
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
  perso: 'persaEraAlle',
  ritardo: 'notifRitardo',
  digest: 'notifDigest',
  prova: 'notifProvaCorpo',
};

export const testiNotifica: TestiNotifica = (v) => {
  const nome = titoloBlocco(v);
  if (v.trigger === 'tempo_scaduto') return { titolo: t('notifTempoScaduto'), corpo: nome };
  if (v.trigger === 'prova') return { titolo: t('notifProva'), corpo: t('notifProvaCorpo') };
  if (v.trigger === 'digest') {
    // «3 da fare (1 arretrato)» e fino a 3 titoli (§13.5, A4)
    const { totale: n, arretrati: a, titoli } = v.digest ?? { totale: 0, arretrati: 0, titoli: [] };
    const titolo =
      a === 0 ? t('notifDigest', { n }) : t(a === 1 ? 'notifDigestArretrato' : 'notifDigestArretrati', { n, a });
    return { titolo, corpo: titoli.join(' · ') };
  }
  const ora = v.inizioBlocco === null ? '' : localTimeKey(v.inizioBlocco);
  return {
    titolo: v.sveglia ? t('notifSveglia', { titolo: nome }) : nome,
    corpo: t(CORPO[v.trigger], { tempo: durata(v.anticipo), ora }),
  };
};
