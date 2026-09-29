/**
 * Porta delle notifiche locali (docs/02_ARCHITETTURA.md §1, MECC §13.3; D-NOTIF-1). Riceve voci semantiche con il loro
 * id nativo a 32 bit: stesso id = sostituzione. La sveglia è un attributo della voce (`sveglia`), non una porta a parte:
 * l'adapter nativo (T-021) la porta a schermo intero, il web la degrada a notifica ordinaria. Un adapter non lancia
 * verso i servizi (INV-16); il servizio comunque tratta un rifiuto come «riprova alla prossima riconciliazione».
 */
import type { VoceRegistro } from '../../domain/notifications/desiredSet';

export interface Notifications {
  /** Chiede il permesso di sistema (§13.3 «al primo ciclo utile»); `true` se concesso. */
  requestPermission(): Promise<boolean>;
  /** Arma le voci; una voce con un id nativo già armato lo sostituisce. */
  schedule(voci: readonly VoceRegistro[]): Promise<void>;
  cancel(idNativi: readonly number[]): Promise<void>;
}

/** Testo di una notifica: lo produce la UI con `t()` e lo inietta l'adapter dal punto di composizione (D-NOTIF-1 n. 8). */
export type TestiNotifica = (voce: VoceRegistro) => { titolo: string; corpo: string };
