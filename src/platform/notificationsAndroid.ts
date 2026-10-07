// Notifiche locali su Android (porta `Notifications`; MECC §13.2–§13.3; D-NOTIF-1; T-021) con
// `@capacitor/local-notifications`: un canale per tipo, uno silenzioso e uno per le sveglie (importanza massima: compaiono
// sopra le app; lo schermo intero il plugin non lo offre, D-NATIVO-2), le azioni rapide come tipi d'azione, l'istante
// esatto anche col telefono a riposo (`allowWhileIdle` col permesso degli allarmi esatti). Il gesto (tocco o azione) va
// al punto di composizione con chiave, trigger e blocco della voce; il listener parte subito, così un avvio dall'azione
// di una notifica non si perde. Un armamento o una cancellazione rifiutati arrivano al servizio, che lascia il registro
// com'era e riprova alla riconciliazione successiva (D-NOTIF-1 n. 12).
import { LocalNotifications } from '@capacitor/local-notifications';
import type { GestoNotifica, Notifications, TestiNotifica, VoceToccata } from '../app/ports/notifications';
import type { AzioneNotifica, VoceRegistro } from '../domain/notifications/desiredSet';
import type { TipoBlocco } from '../domain/types';

type Canale = TipoBlocco | 'silenzioso' | 'sveglie';

export interface EtichetteNative {
  canali: Record<Canale, string>;
  azioni: Record<AzioneNotifica, string>;
}

/** Importanza Android: 5 sopra le app (sveglie), 4 col suono, 2 senza suono né comparsa (MECC §13.3 «silenzioso»). */
const importanza = (c: Canale) => (c === 'sveglie' ? 5 : c === 'silenzioso' ? 2 : 4);
const canale = (v: VoceRegistro): Canale => (v.sveglia ? 'sveglie' : v.silenzioso ? 'silenzioso' : v.tipo);
const tipoAzioni = (azioni: readonly AzioneNotifica[]) => azioni.join('+');

export function androidNotifications(
  testi: TestiNotifica,
  etichette: EtichetteNative,
  onGesto: (voce: VoceToccata, gesto: GestoNotifica) => void,
): Notifications {
  const registrati = new Set<string>();
  const canali = (async () => {
    await LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
      const e = notification.extra as Partial<VoceToccata> | undefined;
      if (!e?.chiave || !e.trigger) return;
      onGesto(
        { chiave: e.chiave, trigger: e.trigger, bloccoId: e.bloccoId ?? null },
        actionId === 'tap' ? 'tocco' : (actionId as AzioneNotifica),
      );
    });
    for (const [id, name] of Object.entries(etichette.canali) as [Canale, string][])
      await LocalNotifications.createChannel({ id, name, importance: importanza(id), vibration: id !== 'silenzioso' });
  })().catch(() => undefined);

  /** I tipi d'azione delle voci (studio: Inizia e Posticipa; todo: Segna fatto e Posticipa; esito; il resto: Posticipa). */
  const registraAzioni = async (voci: readonly VoceRegistro[]) => {
    const nuovi = [...new Set(voci.filter((v) => v.azioni.length).map((v) => tipoAzioni(v.azioni)))].filter(
      (id) => !registrati.has(id),
    );
    if (!nuovi.length) return;
    await LocalNotifications.registerActionTypes({
      types: nuovi.map((id) => ({
        id,
        actions: (id.split('+') as AzioneNotifica[]).map((a) => ({ id: a, title: etichette.azioni[a] })),
      })),
    });
    nuovi.forEach((id) => registrati.add(id));
  };

  return {
    // Solo il controllo: il prompt lo apre `schedule` del plugin; due richieste insieme si scambiano i risultati e
    // l'armamento finirebbe senza armare nulla (revisione di T-021)
    async requestPermission() {
      try {
        return (await LocalNotifications.checkPermissions()).display === 'granted';
      } catch {
        return false;
      }
    },
    async schedule(voci) {
      await canali;
      await registraAzioni(voci);
      await LocalNotifications.schedule({
        notifications: voci.map((v) => {
          const { titolo, corpo } = testi(v);
          return {
            id: v.idNativo,
            title: titolo,
            body: corpo,
            schedule: { at: new Date(v.istante), allowWhileIdle: true },
            channelId: canale(v),
            ...(v.azioni.length && { actionTypeId: tipoAzioni(v.azioni) }),
            extra: { chiave: v.chiave, trigger: v.trigger, bloccoId: v.bloccoId },
          };
        }),
      });
    },
    async cancel(ids) {
      if (ids.length) await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
    },
    async permissions() {
      const p = await LocalNotifications.checkPermissions();
      const esatti = await LocalNotifications.checkExactNotificationSetting().catch(() => null);
      return {
        notifiche: p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default',
        allarmiEsatti: esatti ? esatti.exact_alarm === 'granted' : null,
      };
    },
  };
}
