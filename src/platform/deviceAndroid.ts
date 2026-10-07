// Il dispositivo su Android (porte `ScreenAwake`, `DoNotDisturb`, `SessioneInPrimoPiano`; MECC §10.4; D-TIMER-2; T-021):
// schermo acceso con `@capacitor-community/keep-awake`; Non Disturbare e il servizio in primo piano della sessione coi
// plugin locali `NonDisturbare` e `SessioneNativa` (android/app/src/main/java/com/routforge/app). Senza l'accesso a Non
// disturbare concesso nelle impostazioni del sistema l'iperfocus vale comunque (§10.4). Nessuno lancia (INV-16).
import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { DoNotDisturb, ScreenAwake, SessioneInPrimoPiano } from '../app/ports/device';
import { segnaPrimoPiano } from './clock';

export const eAndroid = Capacitor.getPlatform() === 'android';

const NonDisturbare = registerPlugin<{
  attiva(): Promise<{ attivo: boolean }>;
  disattiva(): Promise<void>;
  stato(): Promise<{ accesso: boolean }>;
}>('NonDisturbare');
const SessioneNativa = registerPlugin<{
  avvia(o: { titolo: string; testo: string; avvio: number }): Promise<void>;
  ferma(): Promise<void>;
}>('SessioneNativa');

export const androidScreenAwake: ScreenAwake = {
  keep() {
    void KeepAwake.keepAwake().catch(() => undefined);
    return () => void KeepAwake.allowSleep().catch(() => undefined);
  },
};

export const androidDoNotDisturb: DoNotDisturb = {
  enable: () =>
    NonDisturbare.attiva().then(
      (r) => r.attivo,
      () => false,
    ),
  disable: () => void NonDisturbare.disattiva().catch(() => undefined),
  access: () =>
    NonDisturbare.stato().then(
      (s) => s.accesso,
      () => false,
    ),
};

/** La notifica fissa: il titolo dell'unità (o «Sessione di studio») e «Sessione in corso» col cronometro dall'avvio. */
export const androidSession = (etichette: { canale: string; titolo: string }): SessioneInPrimoPiano => ({
  avvia({ titolo, avvio }) {
    // Coi battiti vivi anche a WebView nascosta (porta Clock, D-TIMER-2); se il servizio non parte, si torna al web
    segnaPrimoPiano(true);
    void SessioneNativa.avvia({ titolo: titolo || etichette.titolo, testo: etichette.canale, avvio }).catch(() =>
      segnaPrimoPiano(false),
    );
  },
  ferma() {
    segnaPrimoPiano(false);
    void SessioneNativa.ferma().catch(() => undefined);
  },
});
