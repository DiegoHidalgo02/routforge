// Corsi dentro (FUNZ §9.3, MECC §11, §16). Il corso (S11 «Corso → moduli», `/corsi/:corso`): avanzamento, routine di
// studio del corso, puntatore e moduli a fisarmonica (il primo aperto) con le unità e la verifica; i bloccati hanno il
// lucchetto. Il modulo (S11 Modulo, `/corsi/:corso/moduli/:n`): meta, obiettivi, unità che si aprono sul materiale,
// criteri Go/No-Go da spuntare, progetto, «Riprendi da». L'unità (S12, `/corsi/:corso/unita/:unita`): stato, ultima
// sessione, concetto core, sezioni con le risorse, la sessione sull'unità. Il cestino del corso apre la conferma con
// ciò che sparisce ed elimina a cascata (T-037, H3). Restano ad altri task «Chiedi all'AI» (T-026), i materiali tuoi e
// la pratica generata (T-024, T-027).
import {
  ArrowUpRight,
  Building,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  GraduationCap,
  Layers,
  List,
  Lock,
  Play,
  SquareCheckBig,
  Sun,
  Target,
  Trash2,
  Video,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router';
import {
  courseCascade,
  deleteCourse,
  readCourse,
  readModule,
  readUnit,
  readUnitMaterial,
  setCriterion,
  type CascataCorso,
  type MaterialeUnita,
  type VistaCorso,
  type VistaModulo,
  type VistaUnita,
} from '../app/courses';
import { appDb, watch } from '../app/db';
import { youtubeId } from '../domain/course/parser';
import { quizCriterion } from '../domain/generation';
import { completedUnits } from '../domain/pointer';
import type { StatoUnita } from '../domain/types';
import {
  durata as durataBreve,
  durataCorso,
  fmtData,
  fmtGiornoMese,
  fuso,
  NOME_ESITO,
  NOME_SEZIONE,
  nomeGiorno,
  SETTIMANA,
} from './format';
import { IconaLink } from './IconaLink';
import { t, type Chiave } from './i18n';
import { SessionBannerSlot } from './SessionBanner';
import { CodiceUnita, TuoiMateriali } from './Materials';
import { PraticaUnita } from './Practice';
import s from './Course.module.css';

/** «CONSOLIDAMENTO» del file → «Consolidamento» (S11). */
const frase = (x: string) => x.charAt(0).toUpperCase() + x.slice(1).toLowerCase();

export function Course() {
  const { corso = '' } = useParams();
  const navigate = useNavigate();
  const primaSchermata = useLocation().key === 'default';
  const [v, setV] = useState<VistaCorso | null>();
  // Moduli aperti: all'inizio il primo (S11), qualunque sia il suo numero
  const [scelti, setAperti] = useState<ReadonlySet<number> | null>(null);
  // La conferma dell'eliminazione con i numeri letti all'apertura (S11 `confirmDelete`)
  const [cascata, setCascata] = useState<CascataCorso | null>(null);
  const [eliminato, setEliminato] = useState(false);
  useEffect(() => watch(() => readCourse(appDb, corso), setV), [corso]);
  if (v === undefined) return null;
  if (v === null || eliminato) return <Navigate to="/corsi" replace />;
  const chiediElimina = () => void courseCascade(appDb, corso).then(setCascata);
  const elimina = () =>
    void deleteCourse(appDb, corso, Date.now())
      .then(() => setEliminato(true))
      .catch(() => setCascata(null));
  const { scheda: c } = v;
  // «Corso · importato il 16 set»: la data intera nel font dei numeri
  const [primaData, dopoData = ''] = t('corsoImportatoIl').split('{data}');
  const aperti = scelti ?? new Set(v.moduli.slice(0, 1).map((m) => m.numero));
  const apri = (n: number) => {
    const y = new Set(aperti);
    if (!y.delete(n)) y.add(n);
    setAperti(y);
  };

  return (
    <div className={s.pagina}>
      <header className={s.testa}>
        <button
          type="button"
          // Su desktop l'elenco dei corsi è accanto: S10 Desktop non ha l'indietro del corso
          className={`${s.icona} ${s.indietroCorso}`}
          aria-label={t('indietro')}
          onClick={() => (primaSchermata ? navigate('/corsi') : navigate(-1))}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          className={`${s.icona} ${s.cestino}`}
          aria-label={t('eliminaCorso')}
          onClick={chiediElimina}
        >
          <Trash2 size={17} />
        </button>
      </header>
      <SessionBannerSlot />
      {cascata && (
        <ConfermaElimina titolo={c.titolo} cascata={cascata} onAnnulla={() => setCascata(null)} onElimina={elimina} />
      )}

      <div className={s.corpo}>
        <div className={s.intestazione}>
          <span className={s.eyebrow}>
            {primaData}
            <span className={s.num}>{fmtGiornoMese.format(v.importatoIl)}</span>
            {dopoData}
          </span>
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
                tempo: durataCorso(c.minuti),
              })}
            </span>
          </span>
          {(v.routine || v.puntatore) && (
            <span className={s.righe}>
              {v.routine && (
                <span className={s.riga} data-tono="primary">
                  <GraduationCap size={14} className={s.iconaRiga} />
                  <span>
                    {t('routineDiStudio')} ·{' '}
                    <span className={s.num}>
                      {SETTIMANA.filter((g) => v.routine?.giorni.includes(g))
                        .map((g) => frase(nomeGiorno(g, 'short')))
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
            const fatte = completedUnits(m.unita);
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
                        ? t('bloccatoGoNoGo', { n: m.precedente ?? 0 })
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
                    <Link to={modulo} className={s.apri}>
                      {t('apriModulo')} <span className={s.num}>{m.nn}</span>
                      <ChevronRight size={14} />
                    </Link>
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

/**
 * Indietro: alla pagina precedente dell'app, o a `altrimenti` se la pagina è stata aperta da un collegamento; a destra
 * «Chiedi all'AI» (S11, S12), che apre la chat con l'ambito del modulo o dell'unità (T-026).
 */
function Indietro({ altrimenti, chat }: { altrimenti: string; chat?: string }) {
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
      {chat && (
        <Link to={chat} className={s.chiediAi}>
          <Sun size={15} />
          {t('chiediAllAi')}
        </Link>
      )}
    </header>
  );
}

const STATO_SEZIONE: Record<MaterialeUnita['sezioni'][number]['stato'], Chiave> = {
  da_fare: 'sezioneDaFare',
  in_corso: 'sezioneInCorso',
  fatta: 'sezioneFatta',
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
        <div key={x.id} className={s.blocco} data-sezione>
          <span className={s.testaSezione}>
            <span className={s.badgeSezione}>{t(NOME_SEZIONE[x.tipo])}</span>
            <span className={s.intestazioneSezione}>{x.intestazione}</span>
            {conStato && (
              <span className={s.statoSezione} data-stato={x.stato}>
                {t(STATO_SEZIONE[x.stato])}
              </span>
            )}
          </span>
          {x.risorse.length > 0 && (
            <div className={s.risorse}>
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
            </div>
          )}
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
  const { fatte, pct, go, cta } = v;
  const link = unita.reduce((x, u) => x + u.link, 0);
  const ok = m.criteri.filter((c) => c.fatto).length;
  const trasversali = m.trasversali.split('(')[0]?.trim();
  return (
    <div className={s.pagina}>
      <Indietro altrimenti={`/corsi/${encodeURIComponent(corso)}`} chat={`/chat?modulo=${encodeURIComponent(m.id)}`} />
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
          <span className={s.righe} data-a-capo>
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
              <span className={s.etichetta}>
                <SquareCheckBig size={14} />
                {t('criteriGoNoGo')}
              </span>
              <span className={s.contoCriteri} data-tono={go ? 'successo' : 'avviso'}>
                {ok} / {m.criteri.length}
                {go && ` · ${t('go')}`}
              </span>
            </span>
            <div className={s.criteri}>
              {m.criteri.map((c, i) => {
                const auto = quizCriterion(c);
                return (
                  <button
                    key={i}
                    type="button"
                    role="checkbox"
                    aria-checked={c.fatto}
                    aria-disabled={auto || undefined}
                    className={s.criterio}
                    onClick={() =>
                      !auto && void setCriterion(appDb, m.id, i, !c.fatto, Date.now(), fuso()).catch(() => null)
                    }
                  >
                    <span className={s.casella}>{c.fatto && <Check size={13} strokeWidth={2.25} />}</span>
                    <span className={s.testiCriterio}>
                      <span className={s.testoCriterio}>{c.testo}</span>
                      {auto && (
                        <span className={s.metaCriterio}>
                          <span className={s.badgeAuto}>{t('auto')}</span>
                          {t(c.fatto ? 'autoFatto' : 'autoQuiz')}
                          {!c.fatto &&
                            v.ultimoQuiz &&
                            ` · ${t('ultimoQuiz', { g: v.ultimoQuiz.giuste, t: v.ultimoQuiz.totali })}`}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <span className={s.nota}>
              {t('tuttiBinari')}
              {m.noGo && (
                <>
                  {' '}
                  <span className={s.noGo}>
                    {t('noGo')} {m.noGo}
                  </span>
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

        {cta && (
          <div className={s.piede}>
            <Link to={`/sessione/setup?unita=${encodeURIComponent(cta.id)}`} className={s.cta}>
              <Play size={14} fill="currentColor" />
              {t(cta.riprendi ? 'riprendiDa' : 'iniziaDa')} <span className={s.num}>{cta.numero}</span>
            </Link>
          </div>
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

/**
 * VideoCard (S12; FORMATO §3, CONTROLLI): il primo video YouTube della sezione Studio, che si riproduce qui e non nel
 * browser. Il player si carica solo dopo «Riproduci»; offline mostra l'errore del browser dentro il riquadro.
 */
function VideoStudio({ m }: { m: MaterialeUnita }) {
  const [avviato, setAvviato] = useState(false);
  // L'indirizzo del player lo costruisce l'app dall'id, mai il file del corso
  const r = m.sezioni.find((x) => x.tipo === 'studio')?.risorse.find((x) => youtubeId(x.url) !== null);
  const id = r && youtubeId(r.url);
  if (!r || !id) return null;
  return (
    <section className={s.sezione}>
      <span className={s.etichettaSezione}>
        <span className={s.etichetta}>
          <Video size={14} />
          {t('videoSezioneStudio')}
        </span>
        <span className={s.conteggio}>{t('incorporato')}</span>
      </span>
      <div className={s.video}>
        {avviato ? (
          <iframe
            className={s.player}
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`}
            title={r.titolo}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <span className={s.anteprima}>
            <button type="button" className={s.riproduci} aria-label={t('riproduci')} onClick={() => setAvviato(true)}>
              <Play size={18} fill="currentColor" className={s.iconaPlay} />
            </button>
          </span>
        )}
        <span className={s.piedeVideo}>
          <span className={s.titoloVideo}>{r.titolo}</span>
          <span className={s.hostLink}>{t('videoQui')}</span>
        </span>
      </div>
    </section>
  );
}

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
    <div className={s.pagina} data-larga>
      <Indietro
        altrimenti={`/corsi/${encodeURIComponent(corso)}/moduli/${v.modulo.numero}`}
        chat={`/chat?unita=${encodeURIComponent(u.id)}`}
      />
      <SessionBannerSlot />
      <div className={s.corpo}>
        {/* S12 `wide`: da 1024 il materiale del corso a sinistra e una colonna di 320 con video, «Tuoi» e codice */}
        <div className={s.colonneUnita}>
          <div className={s.principaleUnita}>
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
                          {fmtData.format(ultima.avvio)} · {durataBreve(ultima.minuti)}
                        </span>
                        {ultima.esito && ` · ${t('esitoBreve', { esito: t(NOME_ESITO[ultima.esito]) })}`}
                      </>
                    ) : (
                      t('nessunaSessione')
                    )}
                  </span>
                </span>
              </span>
            </div>
            <div className={s.materiale}>
              <Sezioni m={v.materiale} conStato />
            </div>
          </div>
          <div className={s.latoUnita}>
            <VideoStudio key={u.id} m={v.materiale} />
            <TuoiMateriali corsoId={corso} unitaId={u.id} />
            <CodiceUnita corsoId={corso} unitaId={u.id} />
            <PraticaUnita key={`pratica:${u.id}`} unitaId={u.id} />
          </div>
        </div>
        <div className={s.piede}>
          <Link to={`/sessione/setup?unita=${encodeURIComponent(u.id)}`} className={s.cta}>
            <Play size={14} fill="currentColor" />
            {t(
              u.stato === 'completata'
                ? 'ripassoLibera'
                : u.stato === 'parziale'
                  ? 'riprendiSessione'
                  : 'iniziaSessione',
            )}
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * «Eliminare «…»?» (S11 Corso, conferma; MECC §16, H3): ciò che sparisce con i suoi numeri, la nota sulle sessioni, «Annulla»
 * ed «Elimina corso». Dialog modale nativo: Esc chiude come «Annulla».
 */
function ConfermaElimina(p: { titolo: string; cascata: CascataCorso; onAnnulla: () => void; onElimina: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);
  const c = p.cascata;
  const righe: [Chiave, Record<string, number>][] = [
    ['cascataRoutine', { n: c.routine, occ: c.occorrenze }],
    ['cascataMateriali', { n: c.materiali }],
    ['cascataMazzi', { mazzi: c.mazzi, carte: c.carte }],
    ['cascataPratiche', { n: c.pratiche }],
    ['cascataConversazioni', { n: c.conversazioni }],
    ['cascataCodice', { n: c.fileCodice }],
  ];
  return (
    <dialog ref={ref} className={s.foglio} aria-labelledby="elimina-titolo" onClose={p.onAnnulla}>
      <div className={s.contenutoFoglio}>
        <span className={s.maniglia} aria-hidden />
        <span className={s.testiFoglio}>
          <span id="elimina-titolo" className={s.titoloFoglio}>
            {t('eliminareTitolo', { titolo: p.titolo })}
          </span>
          <span className={s.testoFoglio}>{t('sparisconoCorso')}</span>
        </span>
        <span className={s.griglia}>
          {righe.map(([k, v]) => {
            // «Routine di studio · 1 · 34 occorrenze»: dopo l'etichetta, i valori nel font dei numeri
            const [etichetta, ...valori] = t(k, v).split(' · ');
            return (
              <span key={k}>
                {etichetta} · <span className={s.num}>{valori.join(' · ')}</span>
              </span>
            );
          })}
        </span>
        <span className={s.notaFoglio}>{t('cascataNota')}</span>
        <span className={s.azioniFoglio}>
          <button type="button" className={s.annulla} onClick={p.onAnnulla}>
            {t('annulla')}
          </button>
          <button type="button" className={s.pericolo} onClick={p.onElimina}>
            {t('eliminaCorso')}
          </button>
        </span>
      </div>
    </dialog>
  );
}
