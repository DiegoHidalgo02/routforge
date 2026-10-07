// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VoceRegistro } from '../domain/notifications/desiredSet';
import { webNotifications } from './notifications';

const T0 = new Date(2026, 8, 28, 8, 0).getTime();
const voce = (over: Partial<VoceRegistro> = {}): VoceRegistro => ({
  chiave: 'pre:5:s1',
  istante: T0 + 60_000,
  trigger: 'pre',
  anticipo: 5,
  bloccoId: 's1',
  tipo: 'studio',
  titolo: 'Studio',
  inizioBlocco: T0 + 360_000,
  sveglia: false,
  silenzioso: true,
  azioni: [],
  vociAperte: false,
  oneShot: false,
  idNativo: 7,
  ...over,
});
const testi = (v: VoceRegistro) => ({ titolo: v.titolo, corpo: v.chiave });

let create: ReturnType<typeof vi.fn>;
let permesso: NotificationPermission;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
  create = vi.fn();
  permesso = 'granted';
  class NotificaFinta {
    onclick: (() => void) | null = null;
    close = vi.fn();
    constructor(titolo: string, opzioni: NotificationOptions) {
      create(titolo, opzioni, this);
    }
    static get permission() {
      return permesso;
    }
    static requestPermission = vi.fn(() => Promise.resolve(permesso));
  }
  vi.stubGlobal('Notification', NotificaFinta);
  vi.spyOn(window, 'focus').mockImplementation(() => {}); // jsdom non lo implementa
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Adapter web — MECCANISMI §13.3 (solo con la scheda aperta), INV-16', () => {
  it('schedule arma un timer che mostra la notifica con tag e silent; il clic apre il blocco', async () => {
    const apri = vi.fn();
    await webNotifications(testi, apri).schedule([voce()]);
    vi.advanceTimersByTime(59_999);
    expect(create).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(create).toHaveBeenCalledWith(
      'Studio',
      expect.objectContaining({ tag: '7', silent: true, body: 'pre:5:s1' }),
      expect.anything(),
    );
    (create.mock.calls[0]![2] as { onclick: () => void }).onclick();
    expect(apri).toHaveBeenCalledWith('/attivita/s1');
  });

  it('il clic sul digest e sulla prova apre Oggi, sul tempo scaduto il timer (T-020)', async () => {
    const apri = vi.fn();
    await webNotifications(testi, apri).schedule([
      voce({ chiave: 'digest:0:2026-09-28', trigger: 'digest', bloccoId: null, idNativo: 8 }),
      voce({ chiave: 'prova:0:prova', trigger: 'prova', bloccoId: null, idNativo: 9 }),
      voce({ chiave: 'tempo_scaduto:0:sessione', trigger: 'tempo_scaduto', bloccoId: null, idNativo: 10 }),
    ]);
    vi.advanceTimersByTime(60_000);
    for (const c of create.mock.calls) (c[2] as { onclick: () => void }).onclick();
    expect(apri.mock.calls.map(([percorso]) => percorso)).toEqual(['/', '/', '/sessione']);
  });

  it('cancel toglie il timer; lo stesso id riarmato sostituisce; la sveglia resta finché la si tocca', async () => {
    const porta = webNotifications(testi, vi.fn());
    await porta.schedule([voce()]);
    await porta.cancel([7]);
    vi.advanceTimersByTime(120_000);
    expect(create).not.toHaveBeenCalled();
    await porta.schedule([voce()]);
    await porta.schedule([voce({ istante: T0 + 180_000, sveglia: true })]);
    vi.advanceTimersByTime(200_000);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![1]).toMatchObject({ requireInteraction: true });
  });

  it('senza permesso non mostra nulla; requestPermission → booleano', async () => {
    permesso = 'denied';
    const porta = webNotifications(testi, vi.fn());
    await porta.schedule([voce()]);
    vi.advanceTimersByTime(120_000);
    expect(create).not.toHaveBeenCalled();
    await expect(porta.requestPermission()).resolves.toBe(false);
  });

  it('senza Notification e con un costruttore che lancia: nessuna eccezione', async () => {
    create.mockImplementation(() => {
      throw new Error('no');
    });
    const porta = webNotifications(testi, vi.fn());
    await porta.schedule([voce()]);
    expect(() => vi.advanceTimersByTime(120_000)).not.toThrow();
    vi.stubGlobal('Notification', undefined);
    await expect(porta.requestPermission()).resolves.toBe(false);
    await porta.schedule([voce()]);
    expect(() => vi.advanceTimersByTime(120_000)).not.toThrow();
  });
});
