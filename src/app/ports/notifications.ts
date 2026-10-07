/**
 * Porta delle notifiche locali (docs/02_ARCHITETTURA.md §1, MECC §13.3; D-NOTIF-1). Riceve voci semantiche con il loro
 * id nativo a 32 bit: stesso id = sostituzione. La sveglia è un attributo della voce (`sveglia`), non una porta a parte:
 * l'adapter nativo (T-021) la porta a schermo intero, il web la degrada a notifica ordinaria. Un adapter non lancia
 * verso i servizi (INV-16); il servizio comunque tratta un rifiuto come «riprova alla prossima riconciliazione».
 */
import type { AzioneNotifica, TriggerNotifica, VoceRegistro } from '../../domain/notifications/desiredSet';

export interface Notifications {
  /** Chiede il permesso di sistema (§13.3 «al primo ciclo utile»); `true` se concesso. */
  requestPermission(): Promise<boolean>;
  /** Arma le voci; una voce con un id nativo già armato lo sostituisce. */
  schedule(voci: readonly VoceRegistro[]): Promise<void>;
  cancel(idNativi: readonly number[]): Promise<void>;
  /** Lo stato dei permessi per Impostazioni e Diagnostica (§13.3, MECC §23); `null` dove la piattaforma non lo ha. */
  permissions?(): Promise<PermessiNotifiche>;
}

export interface PermessiNotifiche {
  notifiche: 'granted' | 'denied' | 'default' | null;
  /** Gli allarmi esatti di Android 12+ (i promemoria all'istante giusto anche col telefono a riposo). */
  allarmiEsatti: boolean | null;
}

/** Ciò che l'utente fa su una notifica nativa (§13.2; T-021): un'azione rapida o il tocco. */
export type GestoNotifica = AzioneNotifica | 'tocco';

/** Ciò che l'adapter sa della notifica toccata (gli extra della notifica nativa). */
export interface VoceToccata {
  chiave: string;
  trigger: TriggerNotifica;
  bloccoId: string | null;
}

/** Testo di una notifica: lo produce la UI con `t()` e lo inietta l'adapter dal punto di composizione (D-NOTIF-1 n. 8). */
export type TestiNotifica = (voce: VoceRegistro) => { titolo: string; corpo: string };
