// Archivio delle completate e «Giornata chiusa» (S1 Mobile `archive`, `variant=done`; FUNZ §2, MECC §24, DATI-UI): su
// mobile le completate del giorno lasciano la lista e si impilano in testa, l'ultima spuntata davanti con la penultima
// che sporge dietro; un trascinamento in giù (oltre 28 px) apre il mazzo in ordine di completamento, uno in su lo
// richiude, e così la rotella; da tastiera Invio o Spazio sul mazzo (alternativa al gesto, provvisoria fino alla
// risposta del n. 13 dell'handoff). Con tutte le attività di oggi chiuse, sotto l'archivio la card «Giornata chiusa»:
// fascia oraria, barra a segmenti (un'attività per segmento, larga quanto i minuti, nel colore del tipo), legenda per
// tipo e la prima attività di domani. Decisione: D-PROG-1.
import { Check, ChevronRight } from 'lucide-react';
import { useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import type { BloccoCalendario } from '../app/calendar';
import { ORDINE_TIPI } from '../domain/calendar';
import { blockMinutes } from '../domain/stats';
import { MINUTE } from '../domain/time';
import s from './Archive.module.css';
import { durata, sottotitolo, TIPO, titolo } from './format';
import { t } from './i18n';

/** Spostamento oltre il quale il gesto apre o chiude il mazzo; la rotella chiude oltre 12 (S1). */
const SOGLIA_ARCHIVIO = 28;
const SOGLIA_ROTELLA = 12;

function CardCompletata({ b }: { b: BloccoCalendario }) {
  const sub = sottotitolo(b);
  return (
    <div className={s.card} data-tipo={b.tipo}>
      <span className={s.accento} />
      <span className={s.disco} aria-hidden>
        <Check size={13} strokeWidth={2.75} />
      </span>
      <span className={s.testi}>
        <span className={s.titolo}>{titolo(b)}</span>
        {(b.conOrario || sub) && (
          <span className={s.sub}>
            {b.conOrario && <span className={s.ora}>{b.orarioInizio}</span>}
            {sub}
          </span>
        )}
      </span>
      <span className={s.badge}>{t(TIPO[b.tipo])}</span>
    </div>
  );
}

/** Il mazzo delle completate (mobile): `fatte` in ordine di completamento, l'ultima spuntata in fondo all'elenco. */
export function Archivio({ fatte }: { fatte: BloccoCalendario[] }) {
  const [aperto, setAperto] = useState(false);
  const [dy, setDy] = useState(0);
  const presa = useRef<number | null>(null);
  const giu = (e: PointerEvent<HTMLDivElement>) => {
    presa.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const muovi = (e: PointerEvent<HTMLDivElement>) => {
    if (presa.current === null) return;
    // Il mazzo segue il dito a metà velocità, fra −20 e +35 px (S1)
    setDy(Math.round(Math.max(-40, Math.min(70, e.clientY - presa.current)) / 2));
  };
  const su = (e: PointerEvent<HTMLDivElement>) => {
    if (presa.current === null) return;
    const d = e.clientY - presa.current;
    presa.current = null;
    setDy(0);
    if (d > SOGLIA_ARCHIVIO) setAperto(true);
    else if (d < -SOGLIA_ARCHIVIO) setAperto(false);
  };
  const rotella = (e: WheelEvent) => {
    if (aperto && e.deltaY > SOGLIA_ROTELLA) setAperto(false);
  };
  const ultima = fatte.at(-1);
  if (!ultima) return null;
  const penultima = fatte.at(-2);
  return (
    <li>
      <div
        className={s.archivio}
        data-aperto={aperto || undefined}
        style={dy ? { transform: `translateY(${dy}px)` } : undefined}
        tabIndex={0}
        role="button"
        aria-expanded={aperto}
        aria-label={t('archivioCompletate', { n: fatte.length })}
        onPointerDown={giu}
        onPointerMove={muovi}
        onPointerUp={su}
        onPointerCancel={() => {
          presa.current = null;
          setDy(0);
        }}
        onWheel={rotella}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          setAperto((x) => !x);
        }}
      >
        {aperto ? (
          <ol className={s.aperto}>
            {fatte.map((b) => (
              <li key={b.id} className={s.riga} data-tipo={b.tipo}>
                <span className={s.oraRiga}>{b.conOrario ? b.orarioInizio : ''}</span>
                <span className={s.punto} />
                <CardCompletata b={b} />
              </li>
            ))}
          </ol>
        ) : (
          <div className={s.mazzo} data-livelli={penultima ? 1 : 0}>
            <span className={s.puntoMazzo} />
            {penultima && <span className={s.sporge} data-tipo={penultima.tipo} />}
            <CardCompletata b={ultima} />
          </div>
        )}
      </div>
    </li>
  );
}

/** «Giornata chiusa» (S1 `variant=done`): `blocchi` sono le attività di oggi, `domani` la prima di domani. */
export function GiornataChiusa({
  blocchi,
  domani,
  onDomani,
}: {
  blocchi: BloccoCalendario[];
  domani: BloccoCalendario | undefined;
  onDomani: () => void;
}) {
  const conOrario = blocchi.filter((b) => b.conOrario).sort((a, b) => a.inizio - b.inizio);
  const segmenti = [...conOrario, ...blocchi.filter((b) => !b.conOrario)];
  const fine = Math.max(...conOrario.map((b) => b.inizio + blockMinutes(b) * MINUTE));
  const ultimaFine = conOrario.find((b) => b.inizio + blockMinutes(b) * MINUTE === fine);
  const legenda = ORDINE_TIPI.map((tipo) => ({
    tipo,
    n: blocchi.filter((b) => b.tipo === tipo).length,
    m: blocchi.filter((b) => b.tipo === tipo).reduce((x, b) => x + blockMinutes(b), 0),
  }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.m - a.m);
  return (
    <li className={s.chiusa}>
      <div className={s.testa}>
        <span className={s.discoChiusa} aria-hidden>
          <Check size={20} strokeWidth={2.5} />
        </span>
        <span className={s.titoli}>
          <span className={s.eyebrow}>{t('giornataChiusa')}</span>
          <span className={s.titoloChiusa}>{t('tuttoFatto')}</span>
        </span>
      </div>
      <div className={s.corpo}>
        {conOrario[0] && ultimaFine && (
          <span className={s.fascia}>
            {t('laTuaGiornata')}
            <span className={s.fasciaOre}>
              {conOrario[0].orarioInizio} – {ultimaFine.orarioFine ?? ultimaFine.orarioInizio}
            </span>
          </span>
        )}
        <span className={s.barra} role="img" aria-label={t('composizioneGiornata')}>
          {segmenti.map((b) => (
            // La larghezza è il dato: i minuti dell'attività, 10 per quelle senza durata (S1)
            <span key={b.id} className={s.segmento} data-tipo={b.tipo} style={{ flexGrow: blockMinutes(b) || 10 }} />
          ))}
        </span>
        <span className={s.legenda}>
          {legenda.map((x) => (
            <span key={x.tipo} className={s.voce} data-tipo={x.tipo}>
              <span className={s.pallino} />
              <span className={s.tipo}>{t(TIPO[x.tipo])}</span>
              <span className={s.durata}>{durata(x.m)}</span>
            </span>
          ))}
        </span>
      </div>
      {domani && (
        <button type="button" className={s.domani} data-tipo={domani.tipo} onClick={onDomani}>
          <span className={s.testiDomani}>
            <span className={s.quando}>
              {t('domani')}
              {domani.conOrario && (
                <>
                  {' · '}
                  <span className={s.cifre}>{domani.orarioInizio}</span>
                </>
              )}
            </span>
            <span className={s.titoloDomani}>{titolo(domani)}</span>
          </span>
          <span className={s.badge}>{t(TIPO[domani.tipo])}</span>
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      )}
    </li>
  );
}
