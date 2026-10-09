// S8 Sveglia a schermo intero (MECC §13.1 n. 4, §13.2; T-057; `claude-design/S8 Sveglia Mobile.dc.html`): la apre la
// sveglia nativa sopra il blocco schermo, con la sua voce nello stato della rotta. Ora corrente, data lunga, tipo,
// titolo, fascia e contesto (studio: corso e unità; todo: checklist); il tasto principale nel fill del tipo (studio
// «Inizia», todo «Segna fatto», routine ed evento «Apri il blocco»), «Posticipa» +10' e «Chiudi», che non fa nulla.
// La regola di ogni gesto è di `notificationGesture` (§13.2): qui solo dove va l'utente. Ciò che apre l'app chiede
// prima lo sblocco del telefono; Posticipa, Chiudi e «Segna fatto» senza voci aperte rimettono il telefono al blocco.
import { ArrowRight, Bell, Check, Clock, GraduationCap, Play } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { readDetail, type DettaglioAttivita } from '../app/completion';
import { appDb, watch } from '../app/db';
import { notificationGesture } from '../app/notificationActions';
import { closeAlarm, showAlarm, unlockForAlarm } from '../app/notifications';
import type { GestoNotifica, SvegliaAperta } from '../app/ports/notifications';
import type { TipoBlocco } from '../domain/types';
import { useMinuto } from './clock';
import { anticipo, fmtGiornoLungo, fmtOra, fuso, maiuscola, TIPO, titolo } from './format';
import { t, type Chiave } from './i18n';
import s from './Alarm.module.css';

/** Il tasto principale per tipo (MECC §13.2: le azioni del trigger, «Apri il blocco» = tocco dove non ce n'è una). */
const PRINCIPALE: Record<TipoBlocco, { gesto: GestoNotifica; testo: Chiave; Icona: typeof Play }> = {
  studio: { gesto: 'inizia', testo: 'azioneInizia', Icona: Play },
  todo: { gesto: 'segna_fatto', testo: 'azioneSegnaFatto', Icona: Check },
  routine: { gesto: 'tocco', testo: 'apriIlBlocco', Icona: ArrowRight },
  evento: { gesto: 'tocco', testo: 'apriIlBlocco', Icona: ArrowRight },
};

export function Alarm() {
  const sveglia = useLocation().state as SvegliaAperta | null;
  const navigate = useNavigate();
  const adesso = useMinuto();
  // `undefined` mentre si legge, `null` se il blocco non c'è più
  const [d, setD] = useState<DettaglioAttivita | null>();
  const id = sveglia?.bloccoId;
  useEffect(
    () =>
      id
        ? watch(
            () => readDetail(appDb, id),
            (x) => setD(x ?? null),
          )
        : undefined,
    [id],
  );
  // Lasciata S8 in qualunque modo (anche col tasto indietro) l'app non resta sopra il blocco schermo
  useEffect(() => () => void closeAlarm(null, false), []);
  // Sopra il blocco l'app è nascosta finché S8 non è disegnata; senza blocco da mostrare si rimette il blocco schermo
  // prima di andare a Oggi, che altrimenti si vedrebbe senza sblocco (revisione di T-057)
  const perso = !sveglia || !id || d === null;
  const caricato = Boolean(d);
  useEffect(() => {
    if (perso) void closeAlarm(null, true);
    else if (caricato) void showAlarm();
  }, [perso, caricato]);
  if (perso) return <Navigate to="/" replace />;
  if (!d) return null;
  const b = d.blocco;
  const principale = PRINCIPALE[b.tipo];
  const lista = b.checklist ?? [];
  const contesto =
    b.tipo === 'studio' && d.corso
      ? d.unita
        ? t('corsoUnita', { corso: d.corso.titolo, unita: d.unita.numero })
        : d.corso.titolo
      : b.tipo === 'todo' && lista.length
        ? t('checklistConto', { fatte: lista.filter((v) => v.fatta).length, totale: lista.length })
        : '';

  const chiudi = async () => {
    await closeAlarm(sveglia.idNativo, true);
    void navigate('/', { replace: true });
  };
  const gesto = async (g: GestoNotifica) => {
    const dest = await notificationGesture(appDb, sveglia, g, Date.now(), fuso());
    if (!dest) return chiudi();
    if (!(await unlockForAlarm())) return;
    await closeAlarm(sveglia.idNativo, false);
    void navigate(dest.percorso, { replace: true, state: dest.vista ? { vista: dest.vista } : null });
  };

  return (
    <main className={s.sveglia} data-tipo={b.tipo}>
      <span className={s.striscia} aria-hidden />
      <header className={s.testa}>
        <span className={s.eyebrow}>
          <Bell className={s.campana} size={14} aria-hidden />
          {t('svegliaEyebrow')}
        </span>
        <span className={s.anticipo}>
          {sveglia.anticipo ? t('svegliaPrima', { anticipo: anticipo(sveglia.anticipo) }) : t('avvisoInizio')}
        </span>
      </header>
      <section className={s.corpo}>
        <div className={s.quando}>
          <span className={s.ora}>{fmtOra.format(adesso)}</span>
          <span className={s.data}>{maiuscola(fmtGiornoLungo.format(adesso))}</span>
        </div>
        <div className={s.blocco}>
          <span className={s.badge}>{t(TIPO[b.tipo])}</span>
          <h1 className={s.titolo}>{titolo(b)}</h1>
          <div className={s.meta}>
            {b.conOrario && (
              <span className={s.riga}>
                <Clock size={14} aria-hidden />
                <span className={s.fascia}>{[b.orarioInizio, b.orarioFine].filter(Boolean).join(' – ')}</span>
              </span>
            )}
            {contesto && (
              <span className={`${s.riga} ${s.contesto}`}>
                <GraduationCap size={14} aria-hidden />
                {contesto}
              </span>
            )}
          </div>
        </div>
      </section>
      <footer className={s.piede}>
        <button type="button" className={s.principale} onClick={() => void gesto(principale.gesto)}>
          <principale.Icona size={18} strokeWidth={2} aria-hidden />
          {t(principale.testo)}
        </button>
        <button type="button" className={s.posticipa} onClick={() => void gesto('posticipa')}>
          {t('posticipa')} <span className={s.dieci}>{t('piuDieciMin')}</span>
        </button>
        <button type="button" className={s.chiudi} onClick={() => void chiudi()}>
          {t('chiudi')}
        </button>
      </footer>
    </main>
  );
}
