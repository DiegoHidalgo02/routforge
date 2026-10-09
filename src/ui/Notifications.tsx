// Notifiche (S21, `/notifiche`; MECC §8 «Esiti pendenti», §13; FUNZ §7; SCENARI C6): esiti da registrare degli ultimi 3
// giorni (al più 5) con «Registra esito» e l'azione secondaria (Recupera, Apri unità, Apri), «Segna tutte lette» che
// svuota il contatore, «Ieri · gestite» dal registro, «Tutto in ordine» con il prossimo avviso. L'esito si registra nel
// foglio del Dettaglio sopra questa schermata; il messaggio con «Annulla» torna qui.
import { Check, ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { appDb, watch } from '../app/db';
import { markAllRead, readInbox, type EsitoPendente, type Inbox, type VoceIeri } from '../app/inbox';
import { addLocalDays, localDayKey, localTimeKey, startOfLocalDay } from '../domain/time';
import { ANNULLA_MS, ascolta, type Tono } from './avvisi';
import { useMinuto } from './clock';
import { durata, fmtData } from './format';
import { t, type Chiave } from './i18n';
import { SessionBannerSlot } from './SessionBanner';
import { Toast } from './Toast';
import { useIndietro } from './useIndietro';
import s from './Notifications.module.css';

const giorno = (istante: number, now: number): string => {
  const g = localDayKey(istante);
  if (g === localDayKey(now)) return t('oggiMinuscolo');
  if (g === localDayKey(addLocalDays(startOfLocalDay(now), -1))) return t('ieriMinuscolo');
  return fmtData.format(istante);
};

const SOTTO: Partial<Record<VoceIeri['trigger'], Chiave>> = {
  inizio: 'avvisoInizio',
  verifica: 'avvisoVerifica',
  esito: 'avvisoEsito',
  scadenza: 'avvisoScadenza',
  giorno: 'avvisoGiorno',
  tempo_scaduto: 'avvisoTempo',
  perso: 'avvisoPerso',
  ritardo: 'avvisoRitardo',
};
const sottotitolo = (v: VoceIeri): string =>
  v.trigger === 'pre'
    ? t('avvisoPrima', { durata: v.anticipo < 60 ? `${v.anticipo} ${t('minutiUnita')}` : durata(v.anticipo) })
    : v.trigger === 'digest'
      ? t('avvisoDigest', { n: v.todo ?? 0 })
      : t(SOTTO[v.trigger] ?? 'avvisoInizio');

export function Notifications() {
  const location = useLocation();
  const indietro = useIndietro();
  const now = useMinuto();
  const [v, setV] = useState<Inbox>();
  useEffect(() => watch(() => readInbox(appDb, Date.now()), setV), []);
  // Il messaggio lasciato dal foglio dell'esito (avvisi.ts), con «Annulla» per 5 s
  const [avviso, setAvviso] = useState<{ testo: string; tono: Tono; annulla?: () => void }>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(
    () =>
      ascolta(({ testo, tono, annulla }) => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setAvviso(undefined), ANNULLA_MS);
        setAvviso({
          testo,
          tono,
          ...(annulla && {
            annulla: () => {
              clearTimeout(timer.current);
              setAvviso(undefined);
              void annulla().catch(() => undefined);
            },
          }),
        });
      }),
    [],
  );
  if (!v) return null;
  const sfondo = { sfondo: location };

  const riga = (e: EsitoPendente) => {
    const quando =
      e.stato === 'programmato'
        ? `${giorno(e.inizio, now)} ${localTimeKey(e.inizio)} – ${localTimeKey(e.fine)}`
        : `${giorno(e.inizio, now)} ${localTimeKey(e.inizio)}`;
    const motivo: Chiave =
      e.stato === 'programmato' ? 'motivoRecuperabile' : e.unita ? 'motivoPersaUnita' : 'motivoPersaSenza';
    const secondaria =
      e.stato === 'programmato'
        ? { a: `/sessione/setup?blocco=${encodeURIComponent(e.id)}`, chiave: 'recupera' as const }
        : e.unita
          ? {
              a: `/corsi/${encodeURIComponent(e.unita.corsoId)}/unita/${encodeURIComponent(e.unita.id)}`,
              chiave: 'apriUnitaBreve' as const,
            }
          : { a: `/attivita/${encodeURIComponent(e.id)}`, chiave: 'apri' as const };
    return (
      <li key={e.id} className={s.esito} data-tipo="studio">
        <span className={s.testaEsito}>
          <span className={s.testiEsito}>
            <span className={s.titoloEsito}>
              {e.titolo || t('tipoStudio')}
              {e.unita && (
                <>
                  {' '}
                  · {t('unita')} <span className={s.num}>{e.unita.numero}</span>
                </>
              )}
            </span>
            <span className={s.meta}>
              <span className={s.num}>{quando}</span> · {t(motivo)}
            </span>
          </span>
          <span className={s.badge}>{t('tipoStudio')}</span>
        </span>
        <span className={s.azioni}>
          <Link to={secondaria.a} className={s.secondaria}>
            {t(secondaria.chiave)}
          </Link>
          <Link
            to={`/attivita/${encodeURIComponent(e.id)}`}
            state={{ ...sfondo, vista: 'esito' }}
            className={s.primaria}
          >
            {t('registraEsito')}
          </Link>
        </span>
      </li>
    );
  };

  return (
    <div className={s.pagina}>
      <header className={s.testa}>
        <button type="button" className={s.indietro} aria-label={t('indietro')} onClick={indietro}>
          <ChevronLeft size={18} />
        </button>
        <span className={s.titoli}>
          <h1 className={s.titolo}>{t('notifiche')}</h1>
          {v.nuove > 0 && <span className={s.contatore}>{v.nuove}</span>}
        </span>
        <button type="button" className={s.lette} onClick={() => void markAllRead(appDb, Date.now())}>
          {t('segnaTutteLette')}
        </button>
      </header>
      <SessionBannerSlot />

      {v.esiti.length > 0 ? (
        <section className={s.sezione}>
          <span className={s.etichettaSezione}>
            <span>{t('esitiDaRegistrare')}</span>
            <span className={s.conteggio}>{t('esitiMax', { n: v.esiti.length })}</span>
          </span>
          <ul className={s.esiti}>{v.esiti.map(riga)}</ul>
        </section>
      ) : (
        <div className={s.vuoto}>
          <span className={s.iconaVuoto}>
            <Check size={24} strokeWidth={2} />
          </span>
          <span className={s.testiVuoto}>
            <span className={s.titoloVuoto}>{t('tuttoInOrdine')}</span>
            <span className={s.testoVuoto}>
              {t('nessunEsitoPendente')}
              {v.prossimo && (
                <>
                  {' '}
                  {t('prossimoAvviso')} <span className={s.num}>{localTimeKey(v.prossimo.istante)}</span>,{' '}
                  {v.prossimo.titolo}.
                </>
              )}
            </span>
          </span>
        </div>
      )}

      {v.ieri.length > 0 && (
        <section className={s.sezioneIeri}>
          <span className={s.etichettaSezione}>
            <span>{t('ieri')}</span>
            <span className={s.conteggio}>{t('gestite')}</span>
          </span>
          <ul className={s.ieri}>
            {v.ieri.map((x) => (
              <li key={x.chiave} className={s.rigaIeri}>
                <span className={s.pallino} data-tipo={x.tipo} />
                <span className={s.testiIeri}>
                  <span className={s.titoloIeri}>{x.titolo}</span>
                  <span className={s.sottoIeri}>{sottotitolo(x)}</span>
                </span>
                <span className={s.ora}>{localTimeKey(x.istante)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <span className={s.nota}>{t('notaImpostazioniNotifiche')}</span>

      <Toast avviso={avviso} />
    </div>
  );
}
