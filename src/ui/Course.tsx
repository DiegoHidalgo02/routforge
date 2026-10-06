// Il corso (S11 «Corso → moduli», `/corsi/:corso`; FUNZ §9.3, MECC §11): avanzamento, routine di studio del corso,
// puntatore e moduli a fisarmonica (il primo aperto) con le unità e la verifica del modulo. I moduli bloccati hanno il
// lucchetto e non si aprono. L'eliminazione del corso (cestino del mock) arriva con T-037; la pagina del modulo e
// quella dell'unità con i loro passi di T-053.
import { Check, ChevronDown, ChevronLeft, ChevronRight, List, Lock, Repeat, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { readCourse, type VistaCorso } from '../app/courses';
import { appDb, watch } from '../app/db';
import { local } from '../domain/time';
import { durata as durataBreve, SETTIMANA } from './format';
import { lingua, t } from './i18n';
import { SessionBannerSlot } from './Session';
import s from './Course.module.css';

const fmtGiornoBreve = new Intl.DateTimeFormat(lingua, { weekday: 'short' });
const fmtImport = new Intl.DateTimeFormat(lingua, { day: 'numeric', month: 'short' });
/** «CONSOLIDAMENTO» del file → «Consolidamento» (S11). */
const frase = (x: string) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();
/** Le cifre di un testo nel font dei numeri. */
const cifre = (testo: string) =>
  testo.split(/(\d[\d:.,–/]*)/).map((x, i) =>
    i % 2 ? (
      <span key={i} className={s.num}>
        {x}
      </span>
    ) : (
      x
    ),
  );

export function Course() {
  const { corso = '' } = useParams();
  const navigate = useNavigate();
  const primaSchermata = useLocation().key === 'default';
  const [v, setV] = useState<VistaCorso | null>();
  // Moduli aperti: all'inizio il primo (S11)
  const [aperti, setAperti] = useState<ReadonlySet<number>>(() => new Set([0]));
  useEffect(() => watch(() => readCourse(appDb, corso), setV), [corso]);
  if (v === undefined) return null;
  if (v === null) return <Navigate to="/corsi" replace />;
  const { scheda: c } = v;
  const apri = (n: number) =>
    setAperti((x) => {
      const y = new Set(x);
      if (!y.delete(n)) y.add(n);
      return y;
    });

  return (
    <div className={s.pagina}>
      <header className={s.testa}>
        <button
          type="button"
          className={s.icona}
          aria-label={t('indietro')}
          onClick={() => (primaSchermata ? navigate('/corsi') : navigate(-1))}
        >
          <ChevronLeft size={18} />
        </button>
      </header>
      <SessionBannerSlot />

      <div className={s.corpo}>
        <div className={s.intestazione}>
          <span className={s.eyebrow}>{cifre(t('corsoImportatoIl', { data: fmtImport.format(v.importatoIl) }))}</span>
          <h1 className={s.titolo}>{c.titolo}</h1>
          <span className={s.progresso}>
            <span className={s.binario} aria-hidden>
              {/* larghezza = dato, non misura del design */}
              <span style={{ width: `${c.pct}%` }} />
            </span>
            <span className={s.numeri}>
              {t('corsoAvanzamento', {
                fatte: c.completate,
                unita: c.unita,
                pct: c.pct,
                tempo: durataBreve(c.minuti),
              })}
            </span>
          </span>
          {(v.routine || v.puntatore) && (
            <span className={s.righe}>
              {v.routine && (
                <span className={s.riga} data-tono="primary">
                  <Repeat size={14} className={s.iconaRiga} />
                  <span>
                    {t('routineDiStudio')} ·{' '}
                    <span className={s.num}>
                      {SETTIMANA.filter((g) => v.routine?.giorni.includes(g))
                        .map((g) => frase(fmtGiornoBreve.format(local(2026, 9, 20 + (g || 7)))))
                        .join(' · ')}{' '}
                      · {v.routine.orarioInizio}
                    </span>
                  </span>
                </span>
              )}
              {v.puntatore && (
                <span className={s.riga}>
                  <Target size={14} className={s.iconaRiga} />
                  <span>
                    {t('puntatore')} · {t('unita')} <span className={s.num}>{v.puntatore.numero}</span> ·{' '}
                    {v.puntatore.titolo}
                  </span>
                </span>
              )}
            </span>
          )}
        </div>

        <section className={s.sezione}>
          <span className={s.etichettaSezione}>
            <span className={s.etichetta}>
              <List size={14} />
              {t('moduli')}
            </span>
            <span className={s.conteggio}>{t('moduliImportati', { moduli: c.moduli, unita: c.unita })}</span>
          </span>
          {v.moduli.map((m) => {
            const bloccato = m.stato === 'bloccato';
            const aperto = !bloccato && aperti.has(m.numero);
            const fatte = m.unita.filter((u) => u.stato === 'completata').length;
            const modulo = `/corsi/${encodeURIComponent(corso)}/moduli/${m.numero}`;
            return (
              <div key={m.id} className={s.modulo} data-bloccato={bloccato || undefined}>
                <button
                  type="button"
                  className={s.testaModulo}
                  aria-expanded={bloccato ? undefined : aperto}
                  disabled={bloccato}
                  onClick={() => apri(m.numero)}
                >
                  <span className={s.nn}>{m.nn}</span>
                  <span className={s.titoliModulo}>
                    <span className={s.titoloModulo}>{m.titolo}</span>
                    <span className={s.subModulo}>
                      {bloccato
                        ? t('bloccatoGoNoGo', { n: m.numero - 1 })
                        : [frase(m.tipo), m.finestraIndicativa].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  {bloccato ? (
                    <Lock size={16} className={s.lucchetto} />
                  ) : (
                    <>
                      <span className={s.contoModulo} data-fatto={fatte === m.unita.length || undefined}>
                        {fatte}/{m.unita.length}
                      </span>
                      <ChevronDown size={16} className={s.chevron} />
                    </>
                  )}
                </button>
                {aperto && (
                  <div className={s.corpoModulo}>
                    <div className={s.unita}>
                      {m.unita.map((u) => (
                        <Link
                          key={u.id}
                          to={`/corsi/${encodeURIComponent(corso)}/unita/${encodeURIComponent(u.id)}`}
                          className={s.rigaUnita}
                          data-fatta={u.stato === 'completata' || undefined}
                        >
                          <span className={s.numeroUnita}>{u.numero}</span>
                          <span className={s.titoloUnita}>{u.titolo}</span>
                          {u.stato === 'completata' ? (
                            <Check size={16} strokeWidth={2.25} className={s.spunta} />
                          ) : u.id === v.puntatore?.id ? (
                            <span className={s.badgeProssima}>{t('prossima')}</span>
                          ) : (
                            <span className={s.cerchio} />
                          )}
                        </Link>
                      ))}
                    </div>
                    <span className={s.etichetta}>{t('verificaModulo')}</span>
                    <div className={s.verifica}>
                      <Link to={`${modulo}#domande`} className={s.rigaVerifica}>
                        <span className={s.testiVerifica}>
                          <span className={s.titoloVerifica}>{t('domandeSocratiche')}</span>
                          <span className={s.metaVerifica}>{t('domandeSocraticheMeta')}</span>
                        </span>
                        <span className={s.valore}>{m.domande}</span>
                        <ChevronRight size={14} className={s.freccia} />
                      </Link>
                      {m.esercizi.length > 0 && (
                        <Link to={`${modulo}#esercizi`} className={s.rigaVerifica}>
                          <span className={s.testiVerifica}>
                            <span className={s.titoloVerifica}>{t('eserciziProgressivi')}</span>
                            <span className={s.metaVerifica}>{m.esercizi[0]}</span>
                          </span>
                          <span className={s.valore}>{m.esercizi.length}</span>
                          <ChevronRight size={14} className={s.freccia} />
                        </Link>
                      )}
                      <Link to={`${modulo}#criteri`} className={s.rigaVerifica}>
                        <span className={s.testiVerifica}>
                          <span className={s.titoloVerifica}>{t('criteriGoNoGo')}</span>
                          <span className={s.metaVerifica}>{t('criteriGoNoGoMeta')}</span>
                        </span>
                        <span
                          className={s.valore}
                          data-tono={m.criteri.fatti === m.criteri.totali ? 'successo' : 'avviso'}
                        >
                          {m.criteri.fatti}/{m.criteri.totali}
                        </span>
                        <ChevronRight size={14} className={s.freccia} />
                      </Link>
                      {m.progetto && (
                        <Link to={`${modulo}#progetto`} className={s.rigaVerifica}>
                          <span className={s.testiVerifica}>
                            <span className={s.titoloVerifica}>{t('progettoModulo')}</span>
                            <span className={s.metaVerifica}>{m.progetto}</span>
                          </span>
                          <ChevronRight size={14} className={s.freccia} />
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <span className={s.nota}>{t('sbloccoModulo')}</span>
        </section>
      </div>
    </div>
  );
}
