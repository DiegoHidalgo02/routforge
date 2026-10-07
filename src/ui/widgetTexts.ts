// Testi del widget della schermata Home (MECC §21; T-023) nella lingua dell'app: il punto di composizione li inietta
// nell'adapter Android come quelli delle notifiche, così `platform` non importa `ui` (INV-1).
import { localInstant } from '../domain/time';
import { maiuscola } from './format';
import { lingua, t } from './i18n';

const fmtMese = new Intl.DateTimeFormat(lingua, { month: 'long', year: 'numeric' });
const fmtGiorno = new Intl.DateTimeFormat(lingua, { weekday: 'narrow' });

export const etichetteWidget = {
  mese: (aaaamm: string) => maiuscola(fmtMese.format(localInstant(`${aaaamm}-01`, '12:00'))),
  giorno: (giorno: string) => fmtGiorno.format(localInstant(giorno, '12:00')),
  prossima: t('prossima'),
  vuoto: t('widgetVuoto'),
  tipi: { todo: t('tipoTodo'), studio: t('tipoStudio'), routine: t('tipoRoutine'), evento: t('tipoEvento') },
};
