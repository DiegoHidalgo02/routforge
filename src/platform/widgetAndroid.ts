// Widget Android (porta `Widget`; MECC §21; T-023): il contenuto del dominio, coi testi della UI, diventa il JSON che il
// plugin locale `WidgetNativo` salva e `RoutForgeWidget` disegna. I collegamenti diretti `routforge://` (oggi, creazione,
// attività) arrivano qui da `@capacitor/app`; le aperture doppie entro 1,5 s si ignorano (§21). Un aggiornamento
// rifiutato dal plugin arriva al servizio, che lo registra e lo riprova (INV-16).
import { App } from '@capacitor/app';
import { registerPlugin } from '@capacitor/core';
import type { Widget } from '../app/ports/widget';
import type { TipoBlocco } from '../domain/types';
import type { ContenutoWidget, RigaWidget } from '../domain/widget';

const WidgetNativo = registerPlugin<{ aggiorna(o: { contenuto: string }): Promise<void> }>('WidgetNativo');

export interface EtichetteWidget {
  /** «Settembre 2026» da «2026-09». */
  mese(aaaamm: string): string;
  /** L'iniziale del giorno della settimana di un giorno «AAAA-MM-GG». */
  giorno(giorno: string): string;
  prossima: string;
  vuoto: string;
  tipi: Record<TipoBlocco, string>;
}

export const androidWidget = (e: EtichetteWidget): Widget => ({
  aggiorna(c: ContenutoWidget) {
    const testo = (r: RigaWidget) => [r.ora, r.titolo || e.tipi[r.tipo]].filter(Boolean).join(' ');
    // `giorno` e `fine` lasciano al widget nascondere ciò che scade mentre l'app è chiusa (revisione di T-023)
    const contenuto = JSON.stringify({
      giorno: c.giorni.find((g) => g.oggi)?.giorno ?? '',
      mese: e.mese(c.mese),
      settimana: c.giorni.slice(0, 7).map((g) => e.giorno(g.giorno)),
      giorni: c.giorni.map((g) => ({
        n: String(Number(g.giorno.slice(8))),
        mese: g.delMese,
        oggi: g.oggi,
        weekend: g.weekend,
        tipo: g.tipo ?? '',
      })),
      agenda: c.agenda.map((r) => ({ testo: testo(r), fatto: r.fatto, tipo: r.tipo, id: r.id })),
      vuoto: e.vuoto,
      prossima: c.prossima && {
        testo: `${e.prossima} · ${testo(c.prossima)}`,
        id: c.prossima.id,
        fine: c.prossima.fine,
      },
    });
    return WidgetNativo.aggiorna({ contenuto });
  },
});

export type Collegamento = { tipo: 'oggi' } | { tipo: 'crea' } | { tipo: 'attivita'; id: string };

/**
 * Segue i collegamenti `routforge://` del widget: anche quello dell'avvio a freddo arriva come `appUrlOpen` trattenuto
 * (`BridgeActivity.load` → `onNewIntent`). `getLaunchUrl` no: dopo un ricaricamento della pagina restituirebbe di nuovo
 * il collegamento dell'avvio (revisione di T-023).
 */
export function followLinks(apri: (c: Collegamento) => void): void {
  let ultimo = { url: '', quando: 0 };
  const segui = (url: string) => {
    const ora = Date.now();
    if (url === ultimo.url && ora - ultimo.quando < 1500) return;
    ultimo = { url, quando: ora };
    const m = /^routforge:\/\/(oggi|crea|attivita\/(.+))$/.exec(url);
    if (!m) return;
    apri(
      m[1] === 'oggi'
        ? { tipo: 'oggi' }
        : m[1] === 'crea'
          ? { tipo: 'crea' }
          : { tipo: 'attivita', id: decodeURIComponent(m[2] ?? '') },
    );
  };
  void App.addListener('appUrlOpen', ({ url }) => segui(url)).catch(() => undefined);
}
