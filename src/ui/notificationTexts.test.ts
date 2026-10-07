// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { VoceRegistro } from '../domain/notifications/desiredSet';
import { local } from '../domain/time';
import { testiNotifica } from './notificationTexts';

// jsdom dichiara `en-US`: la lingua di ripiego (MECC §23)
const voce = (over: Partial<VoceRegistro>): VoceRegistro => ({
  chiave: 'x',
  istante: 0,
  trigger: 'pre',
  anticipo: 0,
  bloccoId: null,
  tipo: 'todo',
  titolo: '',
  inizioBlocco: null,
  sveglia: false,
  silenzioso: true,
  azioni: [],
  vociAperte: false,
  oneShot: true,
  idNativo: 1,
  ...over,
});

describe('Testi delle notifiche — SCENARI A4, B7 (digest, perso, in ritardo, prova)', () => {
  it('digest: «3 to do (1 overdue)» con i titoli; senza arretrati solo il conteggio; plurale degli arretrati', () => {
    const digest = (totale: number, arretrati: number, titoli: string[]) =>
      testiNotifica(voce({ trigger: 'digest', digest: { totale, arretrati, titoli } }));
    expect(digest(3, 1, ['Chiama Marco', 'Spesa', 'Bolletta'])).toEqual({
      titolo: '3 to do (1 overdue)',
      corpo: 'Chiama Marco · Spesa · Bolletta',
    });
    expect(digest(2, 0, ['a', 'b']).titolo).toBe('2 to do');
    expect(digest(4, 2, ['a']).titolo).toBe('4 to do (2 overdue)');
  });

  it('perso e in ritardo: titolo del blocco e corpo con l’orario; la prova ha i suoi testi', () => {
    const persa = voce({
      trigger: 'perso',
      tipo: 'routine',
      titolo: 'Corsa',
      bloccoId: 'r',
      inizioBlocco: local(2026, 9, 28, 18, 0),
    });
    expect(testiNotifica(persa)).toEqual({ titolo: 'Corsa', corpo: 'Missed · was at 18:00' });
    expect(testiNotifica(voce({ trigger: 'ritardo', titolo: 'Spesa', bloccoId: 't' }))).toEqual({
      titolo: 'Spesa',
      corpo: 'Overdue',
    });
    expect(testiNotifica(voce({ trigger: 'prova' }))).toEqual({
      titolo: 'Test notification',
      corpo: 'Notifications are working.',
    });
  });
});
