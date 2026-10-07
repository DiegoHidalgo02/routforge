/**
 * Porta del widget della schermata Home (MECC §21; T-023): riceve il contenuto già calcolato e lo disegna. Adapter
 * Android in `src/platform/widgetAndroid.ts` (plugin locale `WidgetNativo`); sul web non c'è. Un aggiornamento rifiutato
 * arriva al servizio, che lo registra in Diagnostica e riprova al ricalcolo successivo.
 */
import type { ContenutoWidget } from '../../domain/widget';

export interface Widget {
  aggiorna(contenuto: ContenutoWidget): Promise<void>;
}
