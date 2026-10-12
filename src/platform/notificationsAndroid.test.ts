// @vitest-environment jsdom
// L'adapter delle notifiche Android coi plugin finti (T-021, T-057): qui solo chi può far eseguire un gesto.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoceRegistro } from '../domain/notifications/desiredSet';

type Azione = { actionId: string; notification: { extra?: unknown } };
const plugin = vi.hoisted(() => ({
  azione: null as ((a: Azione) => void) | null,
  extra: [] as unknown[],
  /** Le chiamate ai due plugin che armano e tolgono, in ordine (audit P2-13). */
  chiamate: [] as string[],
  gesti: [] as unknown[],
  rifiuta: false,
}));

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    addListener: () => Promise.resolve({ remove: () => Promise.resolve() }),
    // Le due fasi (audit P2-28): si legge senza togliere, si tolgono i primi n applicati
    leggiGesti: () =>
      plugin.rifiuta ? Promise.reject(new Error('ponte')) : Promise.resolve({ gesti: [...plugin.gesti] }),
    togliGesti: ({ n }: { n: number }) => Promise.resolve(void plugin.gesti.splice(0, n)),
    programma: (o: { voci: { id: number; canale: string; extra: unknown }[] }) => {
      plugin.chiamate.push(`nativo.programma ${o.voci.map((v) => `${v.id}:${v.canale}`).join(' ')}`);
      return Promise.resolve(void plugin.extra.push(...o.voci.map((v) => v.extra)));
    },
    annulla: (o: { ids: number[] }) => Promise.resolve(void plugin.chiamate.push(`nativo.annulla ${o.ids.join(' ')}`)),
  }),
}));
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    addListener: (_evento: string, f: (a: Azione) => void) => {
      plugin.azione = f;
      return Promise.resolve({ remove: () => Promise.resolve() });
    },
    createChannel: () => Promise.resolve(),
    registerActionTypes: () => Promise.resolve(),
    schedule: (o: { notifications: { id: number; channelId: string; extra: unknown }[] }) => {
      if (plugin.rifiuta) return Promise.reject(new Error('schedule'));
      plugin.chiamate.push(`plugin.schedule ${o.notifications.map((n) => `${n.id}:${n.channelId}`).join(' ')}`);
      return Promise.resolve(void plugin.extra.push(...o.notifications.map((n) => n.extra)));
    },
    cancel: (o: { notifications: { id: number }[] }) =>
      Promise.resolve(void plugin.chiamate.push(`plugin.cancel ${o.notifications.map((n) => n.id).join(' ')}`)),
    checkPermissions: () => Promise.resolve({ display: 'granted' }),
  },
}));

const { androidNotifications } = await import('./notificationsAndroid');

const voce = (over: Partial<VoceRegistro> = {}): VoceRegistro => ({
  chiave: 'inizio:0:b1',
  istante: 0,
  trigger: 'inizio',
  anticipo: 0,
  bloccoId: 'b1',
  tipo: 'studio',
  titolo: 'Studio',
  inizioBlocco: 0,
  sveglia: false,
  silenzioso: false,
  azioni: ['inizia', 'posticipa'],
  vociAperte: false,
  oneShot: false,
  idNativo: 1,
  ...over,
});
const etichette = {
  canali: { todo: 't', evento: 'e', routine: 'r', studio: 's', silenzioso: 'q', sveglie: 'w' },
  azioni: { inizia: 'I', posticipa: 'P', segna_fatto: 'F', registra_esito: 'E' },
};

describe('Gesti delle notifiche su Android — MECCANISMI §13.2, D-NATIVO-2 (audit P1-6)', () => {
  beforeEach(() => {
    plugin.azione = null;
    plugin.extra = [];
  });

  it('un intent costruito da un’altra app con gli extra di una notifica non esegue il gesto; le voci dell’app sì', async () => {
    const onGesto = vi.fn();
    const porta = androidNotifications(
      () => ({ titolo: '', corpo: '' }),
      etichette,
      onGesto,
      () => undefined,
    );
    await porta.schedule([voce(), voce({ chiave: 'pre:5:b2', bloccoId: 'b2', azioni: ['segna_fatto'], idNativo: 2 })]);
    expect(plugin.azione).not.toBeNull();
    // `MainActivity` è esportata: un'altra app può mandarle gli extra del plugin con l'id di un blocco
    plugin.azione!({
      actionId: 'segna_fatto',
      notification: { extra: { chiave: 'pre:5:b2', trigger: 'pre', bloccoId: 'b2' } },
    });
    expect(onGesto).not.toHaveBeenCalled();
    // Le voci armate dall'app, dal plugin e dal ricevitore nativo, portano gli extra giusti
    expect(plugin.extra).toHaveLength(2);
    for (const extra of plugin.extra) plugin.azione!({ actionId: 'tap', notification: { extra } });
    expect(onGesto).toHaveBeenCalledTimes(2);
    expect(onGesto).toHaveBeenCalledWith({ chiave: 'inizio:0:b1', trigger: 'inizio', bloccoId: 'b1' }, 'tocco');
  });

  it('un processo nuovo (tocco ad app chiusa) rilegge lo stesso segreto; un’altra installazione no', async () => {
    const adapter = (onGesto: () => void) =>
      androidNotifications(
        () => ({ titolo: '', corpo: '' }),
        etichette,
        onGesto,
        () => undefined,
      );
    await adapter(() => undefined).schedule([voce()]);
    const [extra] = plugin.extra;
    const dopo = vi.fn();
    adapter(dopo);
    plugin.azione!({ actionId: 'tap', notification: { extra } });
    expect(dopo).toHaveBeenCalledTimes(1);
    // Il segreto è dell'installazione, non una costante: con lo spazio dell'app vuoto lo stesso gesto non passa
    localStorage.clear();
    const altra = vi.fn();
    adapter(altra);
    plugin.azione!({ actionId: 'tap', notification: { extra } });
    expect(altra).not.toHaveBeenCalled();
  });
});

describe('Smistamento, gesti in sfondo ed errori su Android — MECCANISMI §13.3, D-NATIVO-3, D-NOTIF-1 n. 12 (audit P2-13)', () => {
  const adapter = (onGesto: Parameters<typeof androidNotifications>[2] = () => undefined) =>
    androidNotifications(
      () => ({ titolo: '', corpo: '' }),
      etichette,
      onGesto,
      () => undefined,
    );
  beforeEach(() => {
    plugin.chiamate = [];
    plugin.gesti = [];
    plugin.rifiuta = false;
  });

  it('una voce che diventa sveglia si toglie dal plugin e si arma in proprio, e viceversa: non suona due volte', async () => {
    const porta = adapter();
    await porta.schedule([voce({ sveglia: true, idNativo: 7 })]);
    expect(plugin.chiamate).toEqual(['plugin.cancel 7', 'nativo.programma 7:sveglie']);
    plugin.chiamate = [];
    await porta.schedule([voce({ idNativo: 7 }), voce({ chiave: 'pre:5:b2', azioni: ['segna_fatto'], idNativo: 8 })]);
    expect(plugin.chiamate).toEqual([
      'nativo.annulla 7',
      'plugin.schedule 7:studio',
      'plugin.cancel 8',
      'nativo.programma 8:studio',
    ]);
  });

  it('i gesti fatti ad app chiusa arrivano uno dopo l’altro, in ordine e col loro istante', async () => {
    plugin.gesti = [
      { chiave: 'pre:5:a', trigger: 'pre', bloccoId: 'a', gesto: 'segna_fatto', istante: 100 },
      { chiave: 'inizio:0:b', trigger: 'inizio', bloccoId: null, gesto: 'posticipa', istante: 200 },
    ];
    const visti: string[] = [];
    const porta = adapter(async (v, g, istante) => {
      visti.push(`inizio ${v.chiave} ${g} ${istante}`);
      await new Promise((r) => setTimeout(r, 5));
      visti.push(`fine ${v.chiave}`);
    });
    await porta.pronte;
    expect(visti).toEqual([
      'inizio pre:5:a segna_fatto 100',
      'fine pre:5:a',
      'inizio inizio:0:b posticipa 200',
      'fine inizio:0:b',
    ]);
  });

  it('un gesto che non si applica resta nella coda nativa con quelli dopo, nell’ordine: si riprova al giro dopo (audit P2-28)', async () => {
    plugin.gesti = [
      { chiave: 'pre:5:a', trigger: 'pre', bloccoId: 'a', gesto: 'segna_fatto', istante: 100 },
      { chiave: 'pre:5:b', trigger: 'pre', bloccoId: 'b', gesto: 'segna_fatto', istante: 200 },
      { chiave: 'pre:5:c', trigger: 'pre', bloccoId: 'c', gesto: 'segna_fatto', istante: 300 },
    ];
    const porta = adapter((v) => Promise.resolve(v.chiave !== 'pre:5:b'));
    await porta.pronte;
    expect(plugin.gesti.map((g) => (g as { chiave: string }).chiave)).toEqual(['pre:5:b', 'pre:5:c']);
  });

  it('un armamento rifiutato arriva al servizio, che riprova; il ponte che non risponde non blocca l’avvio', async () => {
    plugin.rifiuta = true;
    const porta = adapter();
    await expect(porta.pronte).resolves.toBeUndefined();
    await expect(porta.schedule([voce()])).rejects.toThrow('schedule');
  });
});
