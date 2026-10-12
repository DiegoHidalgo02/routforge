// Il service worker della PWA (CONTESTO §3: web installabile e offline; T-035, D-RILASCIO-1): solo nel browser.
// Nell'app Capacitor i file arrivano dall'APK e un service worker terrebbe in cache la versione di prima dopo un
// aggiornamento. Senza supporto (o se la registrazione fallisce) l'app funziona lo stesso, solo online.
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';

export function registerPwa(): void {
  if (Capacitor.isNativePlatform() || !('serviceWorker' in navigator)) return;
  void registerSW({ immediate: true });
}
