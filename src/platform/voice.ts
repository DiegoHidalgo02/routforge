// La voce dell'Audio Flash-Trivia (porta `Voce`, T-028). Su Android il plugin locale `VoceTrivia`
// (android/app/src/main/java/com/routforge/app): la playlist intera nella coda del motore di sintesi del sistema, che
// continua a schermo spento; la WebView di Android non ha una `speechSynthesis` che parli. Sul web `speechSynthesis`, col
// silenzio fra domanda e spiegazione contato da un timer: una scheda nascosta lo rallenta e lo schermo spento lo ferma.
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import type { FaseVoce, Voce } from '../app/ports/voice';

type Elemento = { domanda: string; spiegazione: string };
const VoceTrivia = registerPlugin<{
  leggi(o: { elementi: Elemento[]; da: number; lingua: string | null; pausaMs: number }): Promise<void>;
  ferma(): Promise<void>;
  addListener(evento: 'fase', f: (e: { indice: number; fase: FaseVoce }) => void): Promise<PluginListenerHandle>;
  addListener(evento: 'fine' | 'errore', f: () => void): Promise<PluginListenerHandle>;
}>('VoceTrivia');

function androidVoice(): Voce {
  let ascolti: Promise<PluginListenerHandle>[] = [];
  const stacca = () => {
    for (const a of ascolti) void a.then((h) => h.remove());
    ascolti = [];
  };
  return {
    async leggi(elementi, da, lingua, pausaMs, eventi) {
      stacca();
      ascolti = [
        VoceTrivia.addListener('fase', (e) => eventi.fase(e.indice, e.fase)),
        VoceTrivia.addListener('fine', () => eventi.fine()),
        VoceTrivia.addListener('errore', () => eventi.errore()),
      ];
      const testi = elementi.map(({ domanda, spiegazione }) => ({ domanda, spiegazione }));
      // Nessun motore di sintesi o playlist rifiutata: l'esito arriva come evento, mai come eccezione (INV-16)
      await VoceTrivia.leggi({ elementi: testi, da, lingua, pausaMs }).catch(() => eventi.errore());
    },
    async ferma() {
      stacca();
      await VoceTrivia.ferma().catch(() => undefined);
    },
  };
}

function webVoice(sintesi: SpeechSynthesis): Voce {
  let generazione = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Chrome può raccogliere un enunciato che nessuno referenzia e non mandarne mai la fine: l'ultimo resta qui
  const corrente: { u?: SpeechSynthesisUtterance } = {};
  const ferma = () => {
    generazione++;
    clearTimeout(timer);
    sintesi.cancel();
  };
  return {
    leggi(elementi, da, lingua, pausaMs, eventi) {
      ferma();
      const g = generazione;
      // Dopo `cancel` il browser chiude l'enunciato fermato con `end` o `error`: della lettura vecchia non passa nulla
      const di = (testo: string, poi: () => void) => {
        const u = new SpeechSynthesisUtterance(testo);
        corrente.u = u;
        if (lingua) u.lang = lingua;
        u.onend = () => g === generazione && poi();
        u.onerror = () => g === generazione && eventi.errore();
        sintesi.speak(u);
      };
      const passo = (i: number) => {
        const e = elementi[i];
        if (!e) return eventi.fine();
        eventi.fase(i, 'domanda');
        di(e.domanda, () => {
          eventi.fase(i, 'pausa');
          timer = setTimeout(() => {
            eventi.fase(i, 'spiegazione');
            di(e.spiegazione, () => passo(i + 1));
          }, pausaMs);
        });
      };
      passo(da);
      return Promise.resolve();
    },
    ferma() {
      ferma();
      return Promise.resolve();
    },
  };
}

/** La voce del dispositivo, o null dove non c'è (un browser senza sintesi vocale). */
export function deviceVoice(): Voce | null {
  if (Capacitor.getPlatform() === 'android') return androidVoice();
  return typeof speechSynthesis === 'undefined' ? null : webVoice(speechSynthesis);
}
