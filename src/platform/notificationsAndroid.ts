// Notifiche locali su Android (porta `Notifications`; MECC §13.2–§13.3; D-NOTIF-1; T-021, T-057). Due strade:
// - `@capacitor/local-notifications` per le notifiche ordinarie: un canale per tipo, uno silenzioso e uno per le
//   sveglie, le azioni rapide come tipi d'azione (aprono sempre l'app), l'istante esatto anche col telefono a riposo
//   (`allowWhileIdle` col permesso degli allarmi esatti);
// - il plugin locale `PromemoriaNativi` per le sveglie a schermo intero (S8) e le voci con «Segna fatto», le sole con
//   azioni che non aprono l'app (A6; D-NATIVO-3): i gesti fatti lì si accodano e arrivano qui con il loro istante.
// Una voce che cambia strada (notifica ↔ sveglia) si toglie dall'altra, così non suona due volte. Il gesto (tocco o
// azione) va al punto di composizione con chiave, trigger e blocco della voce; i listener partono subito, così un avvio
// dall'azione di una notifica non si perde. Un armamento o una cancellazione rifiutati arrivano al servizio, che lascia
// il registro com'era e riprova alla riconciliazione successiva (D-NOTIF-1 n. 12).
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type {
  GestoNotifica,
  Notifications,
  SvegliaAperta,
  TestiNotifica,
  VoceToccata,
} from '../app/ports/notifications';
import { runsInBackground, type AzioneNotifica, type VoceRegistro } from '../domain/notifications/desiredSet';
import type { TipoBlocco } from '../domain/types';

type Canale = TipoBlocco | 'silenzioso' | 'sveglie';

export interface EtichetteNative {
  canali: Record<Canale, string>;
  azioni: Record<AzioneNotifica, string>;
}

interface Extra extends VoceToccata {
  anticipo: number;
}

const PromemoriaNativi = registerPlugin<{
  programma(o: {
    voci: {
      id: number;
      istante: number;
      canale: Canale;
      titolo: string;
      corpo: string;
      sveglia: boolean;
      azioni: { id: AzioneNotifica; titolo: string; sfondo: boolean }[];
      extra: Extra;
    }[];
  }): Promise<void>;
  annulla(o: { ids: number[] }): Promise<void>;
  prendiGesti(): Promise<{ gesti: (VoceToccata & { gesto: AzioneNotifica; istante: number })[] }>;
  schermoIntero(): Promise<{ concesso: boolean | null }>;
  mostra(): Promise<void>;
  sblocca(): Promise<{ sbloccato: boolean }>;
  chiudi(o: { id?: number; sfondo: boolean }): Promise<void>;
  addListener(evento: 'gesti', f: () => void): Promise<PluginListenerHandle>;
  addListener(evento: 'sveglia', f: (s: Extra & { id: number }) => void): Promise<PluginListenerHandle>;
}>('PromemoriaNativi');

/** Importanza Android: 5 sopra le app (sveglie), 4 col suono, 2 senza suono né comparsa (MECC §13.3 «silenzioso»). */
const importanza = (c: Canale) => (c === 'sveglie' ? 5 : c === 'silenzioso' ? 2 : 4);
const canale = (v: VoceRegistro): Canale => (v.sveglia ? 'sveglie' : v.silenzioso ? 'silenzioso' : v.tipo);
const tipoAzioni = (azioni: readonly AzioneNotifica[]) => azioni.join('+');
/** Armate in proprio (T-057): le sveglie (schermo intero) e le voci con «Segna fatto» (azioni senza aprire l'app). */
const propria = (v: VoceRegistro) => v.sveglia || v.azioni.includes('segna_fatto');

export function androidNotifications(
  testi: TestiNotifica,
  etichette: EtichetteNative,
  onGesto: (voce: VoceToccata, gesto: GestoNotifica, istante?: number) => Promise<void> | void,
  onSveglia: (s: SvegliaAperta) => void,
): Notifications & { pronte: Promise<void> } {
  const registrati = new Set<string>();
  /** I gesti fatti senza aprire l'app, uno dopo l'altro e con il loro istante (A6, F5); le chiamate si accodano. */
  let coda: Promise<void> = Promise.resolve();
  const scarica = (): Promise<void> =>
    (coda = coda
      .then(async () => {
        const { gesti } = await PromemoriaNativi.prendiGesti();
        for (const g of gesti)
          await onGesto({ chiave: g.chiave, trigger: g.trigger, bloccoId: g.bloccoId ?? null }, g.gesto, g.istante);
      })
      .catch(() => undefined));
  // Sveglia e gesti in sfondo prima di tutto, fuori dalla catena dei canali: i gesti fatti ad app chiusa si applicano
  // prima del primo ciclo, che altrimenti troverebbe il todo ancora da fare (revisione di T-057)
  const pronte = (async () => {
    await PromemoriaNativi.addListener('gesti', () => void scarica());
    await PromemoriaNativi.addListener('sveglia', (s) =>
      onSveglia({
        chiave: s.chiave,
        trigger: s.trigger,
        bloccoId: s.bloccoId ?? null,
        anticipo: s.anticipo,
        idNativo: s.id,
      }),
    );
    await scarica();
  })().catch(() => undefined);
  const canali = (async () => {
    await LocalNotifications.addListener('localNotificationActionPerformed', ({ actionId, notification }) => {
      const e = notification.extra as Partial<VoceToccata> | undefined;
      if (!e?.chiave || !e.trigger) return;
      void onGesto(
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

  const ids = (voci: readonly VoceRegistro[]) => voci.map((v) => v.idNativo);

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
      const proprie = voci.filter(propria);
      const delPlugin = voci.filter((v) => !propria(v));
      if (delPlugin.length) {
        await PromemoriaNativi.annulla({ ids: ids(delPlugin) });
        await registraAzioni(delPlugin);
        await LocalNotifications.schedule({
          notifications: delPlugin.map((v) => {
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
      }
      if (proprie.length) {
        await LocalNotifications.cancel({ notifications: ids(proprie).map((id) => ({ id })) });
        // Il prompt del permesso lo apre `schedule` del plugin: se stavolta non tocca a lui, lo si chiede qui
        const p = await LocalNotifications.checkPermissions();
        if (!delPlugin.length && p.display.startsWith('prompt')) await LocalNotifications.requestPermissions();
        await PromemoriaNativi.programma({
          voci: proprie.map((v) => ({
            id: v.idNativo,
            istante: v.istante,
            canale: canale(v),
            ...testi(v),
            sveglia: v.sveglia,
            azioni: v.azioni.map((a) => ({ id: a, titolo: etichette.azioni[a], sfondo: runsInBackground(v, a) })),
            extra: { chiave: v.chiave, trigger: v.trigger, bloccoId: v.bloccoId, anticipo: v.anticipo },
          })),
        });
      }
    },
    async cancel(idNativi) {
      if (!idNativi.length) return;
      await LocalNotifications.cancel({ notifications: idNativi.map((id) => ({ id })) });
      await PromemoriaNativi.annulla({ ids: [...idNativi] });
    },
    async permissions() {
      const p = await LocalNotifications.checkPermissions();
      const esatti = await LocalNotifications.checkExactNotificationSetting().catch(() => null);
      const schermo = await PromemoriaNativi.schermoIntero().catch(() => null);
      return {
        notifiche: p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default',
        allarmiEsatti: esatti ? esatti.exact_alarm === 'granted' : null,
        schermoIntero: schermo?.concesso ?? null,
      };
    },
    pronte,
    sveglia: {
      mostra: () => PromemoriaNativi.mostra(),
      sblocca: () => PromemoriaNativi.sblocca().then((r) => r.sbloccato),
      chiudi: (id, inSfondo) => PromemoriaNativi.chiudi({ ...(id !== null && { id }), sfondo: inSfondo }),
    },
  };
}
