// Corsi dentro (FUNZ §9.3, MECC §11, §16). Il corso (S11 «Corso → moduli», `/corsi/:corso`): avanzamento, routine di
// studio del corso, puntatore e moduli a fisarmonica (il primo aperto) con le unità e la verifica; i bloccati hanno il
// lucchetto. Il modulo (S11 Modulo, `/corsi/:corso/moduli/:n`): meta, obiettivi, unità che si aprono sul materiale,
// criteri Go/No-Go da spuntare, progetto, «Riprendi da». L'unità (S12, `/corsi/:corso/unita/:unita`): stato, ultima
// sessione, concetto core, sezioni con le risorse, la sessione sull'unità. Restano ad altri task il cestino del corso
// (T-037), «Chiedi all'AI» (T-026), i materiali tuoi e la pratica generata (T-024, T-027).
import {
  ArrowUpRight,
  Book,
  Building,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Code,
  Globe,
  Layers,
  List,
  Lock,
  Play,
  Repeat,
  SquarePlay,
  Target,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import {
  readCourse,
  readModule,
  readUnit,
  readUnitMaterial,
  setCriterion,
  type MaterialeUnita,
  type VistaCorso,
  type VistaModulo,
  type VistaUnita,
} from '../app/courses';
import { appDb, watch } from '../app/db';
import { local } from '../domain/time';
import type { Esito, StatoUnita } from '../domain/types';
import { durata as durataBreve, fuso, SETTIMANA } from './format';
import { lingua, t, type Chiave } from './i18n';
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

/** Indietro: alla pagina precedente dell'app, o a `altrimenti` se la pagina è stata aperta da un collegamento. */
function Indietro({ altrimenti }: { altrimenti: string }) {
  const navigate = useNavigate();
  const primaSchermata = useLocation().key === 'default';
  return (
    <header className={s.testa}>
      <button
        type="button"
        className={s.icona}
        aria-label={t('indietro')}
        onClick={() => (primaSchermata ? navigate(altrimenti) : navigate(-1))}
      >
        <ChevronLeft size={18} />
      </button>
    </header>
  );
}

const DOCUMENTAZIONE = /javascript\.info|git-scm|missing\.csail|developer\.mozilla/;
/** L'icona del link per dominio, come nel mock (S11 Modulo `linkIcon`): video, codice, documentazione, web. */
const IconaLink = ({ host, youtube }: { host: string; youtube: boolean }) => {
  const Icona = youtube ? SquarePlay : /github/.test(host) ? Code : DOCUMENTAZIONE.test(host) ? Book : Globe;
  return <Icona size={16} className={s.iconaLink} />;
};

const STATO_SEZIONE: Record<MaterialeUnita['sezioni'][number]['stato'], Chiave> = {
  da_fare: 'sezioneDaFare',
  in_corso: 'sezioneInCorso',
  fatta: 'sezioneFatta',
};
const BADGE_SEZIONE: Record<MaterialeUnita['sezioni'][number]['tipo'], Chiave> = {
  teoria: 'sezioneTeoria',
  studio: 'sezioneStudio',
  pratica: 'sezionePratica',
  progetto: 'sezioneProgetto',
};

/**
 * Concetto core e sezioni dell'unità con le risorse (S11 Modulo, unità aperta; S12): intestazione intera della sezione
 * (D-SEZ-1), stato della sezione solo in S12, testo semplice senza HTML del corso.
 */
function Sezioni({ m, conStato }: { m: MaterialeUnita; conStato?: boolean }) {
  return (
    <>
      {m.concettoCore && (
        <div className={s.blocco}>
          <span className={s.etichetta}>{t('concettoCoreDi', { titolo: m.concettoCore.titolo })}</span>
          <p className={s.concetto}>{m.concettoCore.testo}</p>
        </div>
      )}
      {m.sezioni.map((x) => (
        <div key={x.id} className={s.blocco}>
          <span className={s.testaSezione}>
            <span className={s.badgeSezione}>{t(BADGE_SEZIONE[x.tipo])}</span>
            <span className={s.intestazioneSezione}>{x.intestazione}</span>
            {conStato && (
              <span className={s.statoSezione} data-stato={x.stato}>
                {t(STATO_SEZIONE[x.stato])}
              </span>
            )}
          </span>
          {x.risorse.map((r, i) => (
            <a key={i} className={s.link} href={r.url} target="_blank" rel="noopener noreferrer">
              <IconaLink host={r.host} youtube={r.youtube} />
              <span className={s.testiLink}>
                <span className={s.titoloLink}>{r.titolo}</span>
                <span className={s.hostLink}>{r.host}</span>
              </span>
              <ArrowUpRight size={14} className={s.freccia} />
            </a>
          ))}
          {x.descrizione && <p className={s.descrizione}>{x.descrizione}</p>}
        </div>
      ))}
    </>
  );
}

/** Il materiale di un'unità che si legge quando la si apre (S11 Modulo). */
function MaterialeAperto({ unitaId, children }: { unitaId: string; children: ReactNode }) {
  const [m, setM] = useState<MaterialeUnita | null>();
  useEffect(() => watch(() => readUnitMaterial(appDb, unitaId), setM), [unitaId]);
  return (
    <div className={s.unitaAperta}>
      {m && <Sezioni m={m} />}
      {children}
    </div>
  );
}

/** «Applicare il ciclo…»: la prima parola in grassetto, come il mock (obiettivi come testo semplice). */
const obiettivo = (o: string) => {
  const i = o.indexOf(' ');
  return i < 0 ? (
    <strong>{o}</strong>
  ) : (
    <>
      <strong>{o.slice(0, i)}</strong>
      {o.slice(i)}
    </>
  );
};

export function Module() {
  const { corso = '', n = '' } = useParams();
  const [v, setV] = useState<VistaModulo | null>();
  // Una sola unità aperta alla volta (CONTROLLI); all'inizio quella del puntatore, se è in questo modulo
  const [aperta, setAperta] = useState<string | null>();
  useEffect(() => watch(() => readModule(appDb, corso, Number(n)), setV), [corso, n]);
  if (v === undefined) return null;
  if (v === null) return <Navigate to={`/corsi/${encodeURIComponent(corso)}`} replace />;
  const { modulo: m, unita } = v;
  const delModulo = unita.some((u) => u.id === v.puntatore?.id) ? v.puntatore : null;
  const apertaOra = aperta === undefined ? (delModulo?.id ?? null) : aperta;
  const fatte = unita.filter((u) => u.stato === 'completata').length;
  const pct = unita.length ? Math.round((fatte / unita.length) * 100) : 0;
  const link = unita.reduce((x, u) => x + u.link, 0);
  const ok = m.criteri.filter((c) => c.fatto).length;
  const go = m.criteri.length > 0 && ok === m.criteri.length;
  // La CTA: l'unità del puntatore se è qui, altrimenti la prima non completata del modulo
  const prossima = delModulo ?? unita.find((u) => u.stato !== 'completata' && u.stato !== 'saltata') ?? null;
  const trasversali = m.trasversali.split('(')[0]?.trim();
  return (
    <div className={s.pagina}>
      <Indietro altrimenti={`/corsi/${encodeURIComponent(corso)}`} />
      <SessionBannerSlot />
      <div className={s.corpo}>
        <div className={s.intestazione}>
          <span className={s.eyebrowPrimary}>
            {t('modulo')} <span className={s.num}>{m.nn}</span> · {v.corso.titolo}
          </span>
          <h1 className={s.titolo}>{m.titolo}</h1>
          <span className={s.progresso}>
            <span className={s.binario} aria-hidden>
              {/* larghezza = dato, non misura del design */}
              <span style={{ width: `${pct}%` }} />
            </span>
            <span className={s.numeri}>{t('corsoProgresso', { fatte, unita: unita.length, pct })}</span>
          </span>
          <span className={s.righe}>
            {m.tipo && (
              <span className={s.riga}>
                <Layers size={14} className={s.iconaRiga} />
                <span>
                  {frase(m.tipo)}
                  {trasversali && ` · ${t('trasversali')}: ${trasversali}`}
                </span>
              </span>
            )}
            {m.finestraIndicativa && (
              <span className={s.riga}>
                <Calendar size={14} className={s.iconaRiga} />
                <span>
                  {t('finestraIndicativa')} · <span className={s.num}>{m.finestraIndicativa}</span>
                </span>
              </span>
            )}
            {m.prerequisiti && (
              <span className={s.riga}>
                <List size={14} className={s.iconaRiga} />
                <span>
                  {t('prerequisiti')} · {m.prerequisiti}
                </span>
              </span>
            )}
            {delModulo && (
              <span className={s.riga} data-tono="primary">
                <Target size={14} className={s.iconaRiga} />
                <span>
                  {t('puntatore')} · {t('unita')} <span className={s.num}>{delModulo.numero}</span> · {delModulo.titolo}
                </span>
              </span>
            )}
          </span>
        </div>

        {m.obiettivi.length > 0 && (
          <div className={s.obiettivi}>
            <span className={s.etichetta}>{t('alTermineSaprai')}</span>
            <ul className={s.elencoObiettivi}>
              {m.obiettivi.map((o, i) => (
                <li key={i}>{obiettivo(o)}</li>
              ))}
            </ul>
          </div>
        )}

        <section className={s.sezione}>
          <span className={s.etichettaSezione}>
            <span className={s.etichetta}>
              <List size={14} />
              {t('unitaPlurale')}
            </span>
            <span className={s.conteggio}>{t('unitaLink', { n: unita.length, link })}</span>
          </span>
          {unita.map((u) => {
            const aperto = apertaOra === u.id;
            return (
              <div key={u.id} className={s.modulo}>
                <button
                  type="button"
                  className={s.testaModulo}
                  aria-expanded={aperto}
                  onClick={() => setAperta(aperto ? null : u.id)}
                >
                  <span className={s.numeroUnita}>{u.numero}</span>
                  <span className={s.titoliModulo}>
                    <span className={s.titoloModulo} data-fatta={u.stato === 'completata' || undefined}>
                      {u.titolo}
                    </span>
                    <span className={s.subModulo}>{t('sezioniLink', { sezioni: u.sezioni, link: u.link })}</span>
                  </span>
                  {u.stato === 'completata' ? (
                    <Check size={16} strokeWidth={2.25} className={s.spunta} />
                  ) : (
                    u.id === delModulo?.id && <span className={s.badgeProssima}>{t('prossima')}</span>
                  )}
                  <ChevronDown size={16} className={s.chevron} />
                </button>
                {aperto && (
                  <MaterialeAperto unitaId={u.id}>
                    <Link
                      to={`/corsi/${encodeURIComponent(corso)}/unita/${encodeURIComponent(u.id)}`}
                      className={s.apri}
                    >
                      {t('apriUnita')} <span className={s.num}>{u.numero}</span>
                      <ChevronRight size={14} />
                    </Link>
                  </MaterialeAperto>
                )}
              </div>
            );
          })}
        </section>

        {m.criteri.length > 0 && (
          <section className={s.sezione}>
            <span className={s.etichettaSezione}>
              <span className={s.etichetta}>{t('criteriGoNoGo')}</span>
              <span className={s.contoCriteri} data-tono={go ? 'successo' : 'avviso'}>
                {ok} / {m.criteri.length}
                {go && ` · ${t('go')}`}
              </span>
            </span>
            <div className={s.criteri}>
              {m.criteri.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  role="checkbox"
                  aria-checked={c.fatto}
                  aria-disabled={c.auto || undefined}
                  className={s.criterio}
                  onClick={() =>
                    !c.auto && void setCriterion(appDb, m.id, i, !c.fatto, Date.now(), fuso()).catch(() => null)
                  }
                >
                  <span className={s.casella}>{c.fatto && <Check size={13} strokeWidth={2.25} />}</span>
                  <span className={s.testiCriterio}>
                    <span className={s.testoCriterio}>{c.testo}</span>
                    {c.auto && (
                      <span className={s.metaCriterio}>
                        <span className={s.badgeAuto}>{t('auto')}</span>
                        {t(c.fatto ? 'autoFatto' : 'autoQuiz')}
                      </span>
                    )}
                  </span>
                </button>
              ))}
            </div>
            <span className={s.nota}>
              {t('tuttiBinari')}
              {m.noGo && (
                <>
                  {' '}
                  <span className={s.noGo}>{t('noGo')}</span> {m.noGo}
                </>
              )}
            </span>
          </section>
        )}

        {m.progetto && (
          <section className={s.sezione}>
            <span className={s.etichetta}>
              <Building size={14} />
              {t('progettoModulo')}
            </span>
            {m.progetto.risorsa ? (
              <a className={s.progetto} href={m.progetto.risorsa.url} target="_blank" rel="noopener noreferrer">
                <span className={s.testiLink}>
                  <span className={s.titoloLink}>{m.progetto.titolo}</span>
                  <span className={s.hostLink}>{m.progetto.risorsa.host}</span>
                </span>
                <ArrowUpRight size={14} className={s.freccia} />
              </a>
            ) : (
              <span className={s.progetto}>
                <span className={s.titoloLink}>{m.progetto.titolo}</span>
              </span>
            )}
          </section>
        )}

        {prossima && (
          <Link to={`/sessione/setup?unita=${encodeURIComponent(prossima.id)}`} className={s.cta}>
            <Play size={14} fill="currentColor" />
            {t(fatte > 0 ? 'riprendiDa' : 'iniziaDa')} <span className={s.num}>{prossima.numero}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

const STATO_UNITA: Record<StatoUnita, Chiave> = {
  non_iniziata: 'statoNonIniziata',
  parziale: 'statoParziale',
  da_rivedere: 'statoDaRivedere',
  completata: 'statoCompletata',
  saltata: 'statoSaltata',
};
const ESITO: Record<Esito, Chiave> = {
  completata: 'esitoCompletata',
  continua: 'esitoContinua',
  indietro: 'esitoIndietro',
  salta: 'esitoSalta',
};
const fmtUltima = new Intl.DateTimeFormat(lingua, { weekday: 'short', day: 'numeric', month: 'short' });

export function Unit() {
  const { corso = '', unita = '' } = useParams();
  const [v, setV] = useState<VistaUnita | null>();
  useEffect(() => watch(() => readUnit(appDb, unita), setV), [unita]);
  if (v === undefined) return null;
  if (v === null) return <Navigate to={`/corsi/${encodeURIComponent(corso)}`} replace />;
  const { unita: u, ultimaSessione: ultima } = v;
  const badge = (
    <span className={s.badgeStato} data-stato={u.stato}>
      {t(STATO_UNITA[u.stato])}
    </span>
  );
  return (
    <div className={s.pagina}>
      <Indietro altrimenti={`/corsi/${encodeURIComponent(corso)}/moduli/${v.modulo.numero}`} />
      <SessionBannerSlot />
      <div className={s.corpo}>
        <div className={s.intestazione}>
          <span className={s.eyebrowPrimary}>
            {t('modulo')} <span className={s.num}>{v.modulo.nn}</span> · {t('unita')}{' '}
            <span className={s.num}>{u.numero}</span>
          </span>
          <h1 className={s.titolo}>{u.titolo}</h1>
          <span className={s.righe}>
            <span className={s.riga}>
              <Layers size={14} className={s.iconaRiga} />
              <span className={s.testoRiga}>{v.modulo.titolo}</span>
              {!v.puntatore && badge}
            </span>
            {v.puntatore && (
              <span className={s.riga} data-tono="primary">
                <Target size={14} className={s.iconaRiga} />
                <span className={s.testoRiga}>{t('prossimaDalPuntatore')}</span>
                {badge}
              </span>
            )}
            <span className={s.riga}>
              <Clock size={14} className={s.iconaRiga} />
              <span className={s.testoRiga}>
                {ultima ? (
                  <>
                    {t('ultimaSessione')} ·{' '}
                    <span className={s.num}>
                      {fmtUltima.format(ultima.avvio)} · {durataBreve(ultima.minuti)}
                    </span>
                    {ultima.esito && ` · ${t('esitoBreve', { esito: t(ESITO[ultima.esito]) })}`}
                  </>
                ) : (
                  t('nessunaSessione')
                )}
              </span>
            </span>
          </span>
        </div>
        <div className={s.sezione}>
          <Sezioni m={v.materiale} conStato />
        </div>
        <Link to={`/sessione/setup?unita=${encodeURIComponent(u.id)}`} className={s.cta}>
          <Play size={14} fill="currentColor" />
          {t(
            u.stato === 'completata' ? 'ripassoLibera' : u.stato === 'parziale' ? 'riprendiSessione' : 'iniziaSessione',
          )}
        </Link>
      </div>
    </div>
  );
}
