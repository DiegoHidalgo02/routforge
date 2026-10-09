/**
 * Adapter web della porta `Notifications` (MECC §13.3 «sul web: solo con la scheda aperta»; docs/02_ARCHITETTURA.md §6;
 * D-NOTIF-1). Un timer per id nativo; allo scatto, col permesso concesso, una `Notification` con `tag` = id (due schede
 * sostituiscono invece di duplicare). La sveglia degrada a notifica che resta finché non la si tocca; il clic porta al
 * blocco (al timer per il tempo scaduto, a Oggi per il digest e la prova). Senza `Notification` (contesto non sicuro,
 * iOS non installato) tutto è un no-op; nessun ramo lancia (INV-16). L'adapter nativo, con le azioni rapide, è di T-021.
 * Il clic passa il tocco all'app come su Android (`notificationGesture`): la rotta e la risposta alla verifica (§13.2,
 * §20) le decide lei, non l'adapter (audit P3-23).
 */
import type { GestoNotifica, Notifications, TestiNotifica, VoceToccata } from '../app/ports/notifications';

const disponibile = () => typeof Notification !== 'undefined';

export function webNotifications(
  testi: TestiNotifica,
  gesto: (voce: VoceToccata, g: GestoNotifica) => void,
): Notifications {
  const timer = new Map<number, ReturnType<typeof setTimeout>>();
  const togli = (id: number) => {
    clearTimeout(timer.get(id));
    timer.delete(id);
  };
  return {
    async requestPermission() {
      try {
        return disponibile() && (await Notification.requestPermission()) === 'granted';
      } catch {
        return false;
      }
    },
    schedule(voci) {
      for (const v of voci) {
        togli(v.idNativo);
        // Entro 14 giorni (§13.3): sotto il limite di setTimeout (~24,8 giorni)
        const t = setTimeout(
          () => {
            timer.delete(v.idNativo);
            try {
              if (!disponibile() || Notification.permission !== 'granted') return;
              const { titolo, corpo } = testi(v);
              const n = new Notification(titolo, {
                body: corpo,
                tag: String(v.idNativo),
                silent: v.silenzioso,
                requireInteraction: v.sveglia,
              });
              n.onclick = () => {
                window.focus();
                gesto({ chiave: v.chiave, trigger: v.trigger, bloccoId: v.bloccoId }, 'tocco');
                n.close();
              };
            } catch {
              // Nessuna eccezione verso i servizi (INV-16)
            }
          },
          Math.max(0, v.istante - Date.now()),
        );
        timer.set(v.idNativo, t);
      }
      return Promise.resolve();
    },
    cancel(ids) {
      ids.forEach(togli);
      return Promise.resolve();
    },
    permissions: () =>
      Promise.resolve({ notifiche: disponibile() ? Notification.permission : null, allarmiEsatti: null }),
  };
}
