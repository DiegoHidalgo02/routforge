// Formattazioni condivise dalle schermate (lingua di `pickLanguage`, MECC §23).
import type { BloccoCalendario } from '../app/calendar';
import type { TipoFonte } from '../domain/ai';
import type { TipoSezione } from '../domain/course/parser';
import type { Blocco, Esito, TipoBlocco } from '../domain/types';
import { lingua, t, type Chiave } from './i18n';

/** Fuso corrente del dispositivo per le scritture delle schermate (la porta `Clock` è dei servizi, D-SCHED-1 n. 9). */
export const fuso = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** «mar 22 set»: sigla del giorno, numero e mese breve (S4, S5, S15, S22). */
export const fmtData = new Intl.DateTimeFormat(lingua, { weekday: 'short', day: 'numeric', month: 'short' });
/** «22 set» (S11, S13, S22, chat). */
export const fmtGiornoMese = new Intl.DateTimeFormat(lingua, { day: 'numeric', month: 'short' });
/** «martedì 22 settembre» (S5, S8). */
export const fmtGiornoLungo = new Intl.DateTimeFormat(lingua, { weekday: 'long', day: 'numeric', month: 'long' });
/** «16:08». */
export const fmtOra = new Intl.DateTimeFormat(lingua, { hour: '2-digit', minute: '2-digit' });
const FMT_SETTIMANA = {
  long: new Intl.DateTimeFormat(lingua, { weekday: 'long' }),
  short: new Intl.DateTimeFormat(lingua, { weekday: 'short' }),
  narrow: new Intl.DateTimeFormat(lingua, { weekday: 'narrow' }),
};
/** Il nome del giorno della settimana per indice (0 = domenica: il 20/9/2026 è una domenica). */
export const nomeGiorno = (g: number, forma: keyof typeof FMT_SETTIMANA): string =>
  FMT_SETTIMANA[forma].format(new Date(2026, 8, 20 + g));

export const unDecimale = new Intl.NumberFormat(lingua, { maximumFractionDigits: 1 });
const MIB = 1024 * 1024;
/**
 * Una dimensione come nei mock: «84 KB», «0,4 MB», «1,2 GB», sempre in base 1024 come il limite di 20 MB dei PDF (prima
 * la Diagnostica contava in base 1000: audit P3-14); `perEccesso` per il rifiuto, così un file appena oltre il limite
 * non si legge «20 MB».
 */
export const dimensione = (byte: number, perEccesso = false): string =>
  byte >= 1024 * MIB
    ? `${unDecimale.format(byte / (1024 * MIB))} GB`
    : byte >= MIB
      ? `${unDecimale.format((perEccesso ? Math.ceil : Math.round)((byte / MIB) * 10) / 10)} MB`
      : `${byte > 0 ? Math.max(1, Math.round(byte / 1024)) : 0} KB`;

/** Lunedì → domenica come nei mock; 0 = domenica (`localWeekday`). */
export const SETTIMANA = [1, 2, 3, 4, 5, 6, 0];

/** Durata in minuti nella forma breve dei mock: «30m», «1h», «1h 30m». */
export const durata = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return t('minutiBrevi', { m });
  return m ? t('durata', { h, m: String(m).padStart(2, '0') }) : t('oreBrevi', { h });
};

/** Tempo dedicato a un corso «11h 40m», sempre ore e minuti, uguale in S10 e S11 (`durata` è la forma breve). */
export const durataCorso = (min: number): string =>
  t('durata', { h: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') });

/** Un anticipo del promemoria (MECC §13.1): «All’inizio», «5 min», «1 ora», «2 ore», «1 giorno», «3 giorni» (S4, S8). */
export const anticipo = (min: number): string =>
  min === 0
    ? t('anticipoInizio')
    : min === 1440
      ? t('anticipoGiorno')
      : min === 60
        ? t('anticipoOra')
        : min % 1440 === 0
          ? t('anticipoGiorni', { n: min / 1440 })
          : min % 60 === 0
            ? t('anticipoOre', { n: min / 60 })
            : t('anticipoMin', { n: min });

/** Tempo del timer «24:19», «1:05:00»; `perEccesso` per il conto alla rovescia, che mostra 50:00 all'avvio. */
export const orologio = (ms: number, perEccesso = false): string => {
  const sec = Math.max(0, perEccesso ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  const due = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(sec / 3600);
  const mm = `${due(Math.floor((sec % 3600) / 60))}:${due(sec % 60)}`;
  return h ? `${h}:${mm}` : mm;
};

/** Iniziale maiuscola nella lingua dell'app (i nomi di giorni e mesi di `Intl` nascono minuscoli). */
export const maiuscola = (x: string): string => x.charAt(0).toLocaleUpperCase(lingua) + x.slice(1);

/** Chiave del nome di ogni tipo di attività (badge delle card, S1). */
export const TIPO: Record<TipoBlocco, Chiave> = {
  todo: 'tipoTodo',
  studio: 'tipoStudio',
  routine: 'tipoRoutine',
  evento: 'tipoEvento',
};

/** Il nome dell'esito (MECC §11), lo stesso in Corso, Dettaglio e Sessione (audit P3-12). */
export const NOME_ESITO: Record<Esito, Chiave> = {
  completata: 'esitoCompletata',
  continua: 'esitoContinua',
  indietro: 'esitoIndietro',
  salta: 'esitoSalta',
};

/** Il nome del tipo di sezione dell'unità (FORMATO §3): l'`etichetta` del parser è il testo del file, non si mostra. */
export const NOME_SEZIONE: Record<TipoSezione, Chiave> = {
  teoria: 'sezioneTeoria',
  studio: 'sezioneStudio',
  pratica: 'sezionePratica',
  progetto: 'sezioneProgetto',
};

/** Il nome della fonte di una citazione dell'AI (MECC §18), lo stesso nella chat e nella pratica. */
export const FONTE: Record<TipoFonte, Chiave> = {
  TEORIA: 'fonteCorso',
  CODICE: 'fonteCodice',
  NOTA: 'fonteTuoi',
  LINK: 'fonteTuoi',
  PDF: 'fonteTuoi',
};

/** Titolo di un blocco sul calendario: il suo, o il nome del tipo. */
export const titolo = (b: Pick<Blocco, 'titolo' | 'tipo'>): string => b.titolo || t(TIPO[b.tipo]);

/** Sottotitolo della card di S1: «Persa · era alle …», conto della checklist o luogo dell'evento; altrimenti vuoto. */
export function sottotitolo(b: BloccoCalendario): string {
  if (b.stato === 'perso' && b.conOrario) return t('persaEraAlle', { ora: b.orarioInizio });
  const lista = b.checklist ?? [];
  if (lista.length) return t('checklistConto', { fatte: lista.filter((v) => v.fatta).length, totale: lista.length });
  return b.luogo ?? '';
}
