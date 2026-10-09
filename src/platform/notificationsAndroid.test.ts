// @vitest-environment jsdom
// L'adapter delle notifiche Android coi plugin finti (T-021, T-057): qui solo chi può far eseguire un gesto.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoceRegistro } from '../domain/notifications/desiredSet';

type Azione = { actionId: string; notification: { extra?: unknown } };
const plugin = vi.hoisted(() => ({
  azione: null as ((a: Azione) => void) | null,
  extra: [] as unknown[],
}));

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    addListener: () => Promise.resolve({ remove: () => Promise.resolve() }),
    prendiGesti: () => Promise.resolve({ gesti: [] }),
    programma: (o: { voci: { extra: unknown }[] }) =>
      Promise.resolve(void plugin.extra.push(...o.voci.map((v) => v.extra))),
    annulla: () => Promise.resolve(),
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
    schedule: (o: { notifications: { extra: unknown }[] }) =>
      Promise.resolve(void plugin.extra.push(...o.notifications.map((n) => n.extra))),
    cancel: () => Promise.resolve(),
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
