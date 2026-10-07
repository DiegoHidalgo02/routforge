// DevSwipe, Bug Hunter e Audio Flash-Trivia (MECC §18; T-028; `claude-design/S19 AI Panel.dc.html` pezzi «DevSwipe»,
// «Bug Hunter», «Audio Flash-Trivia» e «Pratica · riepilogo»): la carta da giudicare con lo swipe o i due tasti, le righe
// del codice da toccare, la playlist letta dalla voce di sistema; alla fine il riepilogo con punteggio, sbagliate,
// «Rifai la pratica» e «Torna all'unità». Punteggi, riproposte e playlist stanno nel dominio (`practiceResult`,
// `scoreDevSwipe`, `scoreBugHunterExercise`, `triviaReturning`) e in `app/practice`: qui si mostra e si passa il gesto.
import { ArrowLeft, ArrowRight, Check, CircleAlert, Pause, Play, SkipForward, Square, X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { appDb } from '../app/db';
import {
  generatePractice,
  hasVoice,
  readAloud,
  readPractice,
  savePracticeResult,
  stopReading,
  type EsitoGenerazione,
  type PraticaAperta,
} from '../app/practice';
import type { FaseVoce } from '../app/ports/voice';
import { PAUSA_TRIVIA_MS, practiceResult, type RispostePratica, type RisultatoPratica } from '../domain/generation';
import { scoreBugHunterExercise, scoreDevSwipe, verdictFromSwipe, type Verdetto } from '../domain/practice';
import { lingua, t, type Chiave } from './i18n';
import {
  DIFFICOLTA,
  ERRORE,
  Fonte,
  Indietro,
  NOME_TIPO,
  QuizScreen,
  rottaPratica,
  rottaUnita,
  Testa,
} from './Practice';
import s from './Practice.module.css';
import { vibra } from './preferenze';

type Di<T extends PraticaAperta['tipo']> = Extract<PraticaAperta, { tipo: T }>;
type Gioco = Di<'devswipe' | 'bughunter' | 'trivia'>;

/** S19 `/pratica/:id`: la pratica nel suo tipo; una già fatta si riapre sul riepilogo (S12 «Recenti», D-QUIZ-4). */
export function PracticeScreen() {
  const { id = '' } = useParams();
  const [p, setP] = useState<PraticaAperta | null>();
  useEffect(() => {
    void readPractice(appDb, id).then((x) => setP(x ?? null));
  }, [id]);
  if (p === undefined) return null;
  if (p === null) return <Indietro />;
  // La chiave: «Rifai la pratica» apre una pratica nuova sulla stessa rotta e lo stato riparte da capo
  switch (p.tipo) {
    case 'quiz':
      return <QuizScreen key={p.id} q={p} />;
    case 'devswipe':
      return <DevSwipe key={p.id} p={p} />;
    case 'bughunter':
      return <BugHunter key={p.id} p={p} />;
    case 'trivia':
      return <Trivia key={p.id} p={p} />;
  }
}

// Istanti letti al gesto, fuori dai componenti
const salva = (p: Gioco, r: RispostePratica) =>
  savePracticeResult(appDb, p.id, r, Date.now()).then(
    // Una scrittura fallita (in Diagnostica) non toglie il riepilogo: si calcola come l'avrebbe salvato
    (x): RisultatoPratica => x ?? { ...practiceResult(p.elementi, r), istante: Date.now() },
  );
const rifai = (p: Gioco) =>
  generatePractice(appDb, p.unitaId, p.tipo, p.parametri.quantita, p.parametri.difficolta, Date.now());

/** «difficoltà media» del sottotitolo: l'etichetta della difficoltà in minuscolo. */
const difficolta = (p: Gioco) => {
  const d = DIFFICOLTA.find(([x]) => x === p.parametri.difficolta);
  return d ? t(d[1]).toLocaleLowerCase(lingua) : '';
};

const GENERE: Record<'codice' | 'architettura' | 'affermazione', Chiave> = {
  codice: 'genereCodice',
  architettura: 'genereArchitettura',
  affermazione: 'genereAffermazione',
};

/**
 * S19 DevSwipe (`devswipe`, `devswipe-wrong`): la carta si giudica con lo swipe (destra = corretto, sinistra = errato) o
 * coi due tasti; dopo il verdetto (bordo, spiegazione, vibrazione se sbagliato) un secondo gesto passa alla prossima. Le
 * sbagliate al primo passaggio tornano una volta a fine mazzo; conta solo il primo passaggio (§18, I2).
 */
function DevSwipe({ p }: { p: Di<'devswipe'> }) {
  const navigate = useNavigate();
  const n = p.elementi.length;
  const [coda, setCoda] = useState(() => p.elementi.map((_, i) => i));
  const [k, setK] = useState(0);
  const [verdetti, setVerdetti] = useState<Verdetto[]>([]);
  const [risposta, setRisposta] = useState<Verdetto | null>(null);
  const [risultato, setRisultato] = useState(p.risultato);
  // Il trascinamento: dove è partito il dito e quanto si è spostato
  const partenza = useRef<number | null>(null);
  const [dx, setDx] = useState(0);
  if (risultato) return <Riepilogo p={p} risultato={risultato} />;
  const c = p.elementi[coda[k] ?? 0];
  if (!c) return null;
  const giusta = risposta === c.verdetto;
  const gesto = (v: Verdetto) => {
    if (!risposta) {
      setRisposta(v);
      if (k < n) setVerdetti([...verdetti, v]);
      if (v !== c.verdetto) vibra();
      return;
    }
    const prossima = () => {
      setRisposta(null);
      setK(k + 1);
    };
    if (k + 1 < coda.length) return prossima();
    const { daRiproporre } = scoreDevSwipe(
      p.elementi.map((x) => x.verdetto),
      verdetti,
    );
    if (coda.length === n && daRiproporre.length) {
      setCoda([...coda, ...daRiproporre]);
      return prossima();
    }
    // A fine mazzo la carta resta giudicata finché il salvataggio torna: un tocco in più risalva (idempotente) e non
    // aggiunge un verdetto
    void salva(p, { tipo: 'devswipe', verdetti }).then(setRisultato);
  };
  const giu = (e: PointerEvent<HTMLDivElement>) => {
    partenza.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const muovi = (e: PointerEvent<HTMLDivElement>) => {
    if (partenza.current !== null) setDx(e.clientX - partenza.current);
  };
  const su = (e: PointerEvent<HTMLDivElement>) => {
    if (partenza.current === null) return;
    partenza.current = null;
    setDx(0);
    // Un quarto della carta basta per decidere (il mock non dà la soglia)
    if (Math.abs(dx) >= e.currentTarget.offsetWidth / 4) gesto(verdictFromSwipe(dx > 0 ? 'destra' : 'sinistra'));
  };
  // Dopo il verdetto la carta resta spostata di 10 px verso il lato scelto, inclinata di 1,5° (mock)
  const x = (risposta ? (risposta === 'corretto' ? 10 : -10) : 0) + dx;
  const sottotitolo = p.parametri.difficolta
    ? t('devswipeSottotitolo', { u: p.numero, n, d: difficolta(p) })
    : t('mazzoSottotitolo', { u: p.numero, n });
  return (
    <div className={s.pagina}>
      <Testa
        titolo={t('praticaDevSwipe')}
        sottotitolo={sottotitolo}
        progresso={[k + 1, coda.length]}
        indietro={() => void navigate(rottaUnita(p))}
      />
      <div className={s.corpoSwipe}>
        <div
          className={s.cartaSwipe}
          data-esito={risposta ? (giusta ? 'giusta' : 'sbagliata') : undefined}
          data-trascina={dx !== 0 || undefined}
          style={{ transform: `translateX(${x}px) rotate(${Math.max(-15, Math.min(15, x * 0.15))}deg)` }}
          onPointerDown={giu}
          onPointerMove={muovi}
          onPointerUp={su}
          onPointerCancel={() => {
            partenza.current = null;
            setDx(0);
          }}
        >
          <span className={s.testaSwipe}>
            <span className={s.genere}>{c.genere ? t(GENERE[c.genere]) : ''}</span>
            <span className={s.linguaggio}>{c.linguaggio}</span>
          </span>
          <pre className={s.contenuto} data-genere={c.genere ?? undefined}>
            {c.contenuto}
          </pre>
          {risposta && (
            <div className={s.verdettoSwipe} role="status">
              <span className={s.verdetto} data-giusta={giusta || undefined}>
                {giusta ? <Check size={16} strokeWidth={2.5} /> : <X size={16} strokeWidth={2.5} />}
                {t(
                  c.verdetto === 'errato'
                    ? giusta
                      ? 'swipeGiustoScarta'
                      : 'swipeSbagliatoScarta'
                    : giusta
                      ? 'swipeGiustoTieni'
                      : 'swipeSbagliatoTieni',
                )}
              </span>
              <p className={s.spiegazioneSwipe}>{c.spiegazione}</p>
              <Fonte citazione={c.citazione} />
              <span className={s.soloLettore}>{t('swipeProssima')}</span>
            </div>
          )}
        </div>
        <div className={s.tastiSwipe}>
          <button type="button" className={s.tastoSwipe} onClick={() => gesto('errato')}>
            <span className={s.rigaTasto}>
              <ArrowLeft size={14} strokeWidth={2} />
              {t('swipeSinistra')}
            </span>
            <span className={s.notaTasto}>{t('swipeSinistraNota')}</span>
          </button>
          <button type="button" className={s.tastoSwipe} onClick={() => gesto('corretto')}>
            <span className={s.rigaTasto}>
              {t('swipeDestra')}
              <ArrowRight size={14} strokeWidth={2} />
            </span>
            <span className={s.notaTasto}>{t('swipeDestraNota')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * S19 Bug Hunter (`bughunter`, `bughunter-solved`): si tocca la riga sbagliata; al primo tentativo giusto 2 punti, al
 * secondo 1, poi la soluzione (§18, I3): il codice corretto, con le righe cambiate in evidenza, e la spiegazione.
 */
function BugHunter({ p }: { p: Di<'bughunter'> }) {
  const navigate = useNavigate();
  const n = p.elementi.length;
  const [k, setK] = useState(0);
  const [tocchi, setTocchi] = useState<number[][]>([]);
  const [risultato, setRisultato] = useState(p.risultato);
  const prossimoRef = useRef<HTMLButtonElement>(null);
  const finito = scoreBugHunterExercise(p.elementi[k]?.riga ?? 0, tocchi[k] ?? []).finito;
  useEffect(() => {
    if (finito) prossimoRef.current?.focus();
  }, [finito, k]);
  if (risultato) return <Riepilogo p={p} risultato={risultato} />;
  const e = p.elementi[k];
  if (!e) return null;
  const miei = tocchi[k] ?? [];
  const esito = scoreBugHunterExercise(e.riga, miei);
  const totale = tocchi.reduce((somma, tt, i) => {
    const r = scoreBugHunterExercise(p.elementi[i]?.riga ?? 0, tt);
    return somma + (r.finito ? r.punti : 0);
  }, 0);
  const ultimo = miei.at(-1);
  const originali = new Set(e.codice.split('\n'));
  const tocca = (riga: number) => {
    if (esito.finito) return;
    const nuovi = [...tocchi];
    nuovi[k] = [...miei, riga];
    setTocchi(nuovi);
  };
  const prossimo = () => {
    if (k + 1 < n) return setK(k + 1);
    void salva(p, { tipo: 'bughunter', tocchi }).then(setRisultato);
  };
  return (
    <div className={s.pagina}>
      <Testa
        titolo={t('praticaBugHunter')}
        sottotitolo={t('bugSottotitolo', { u: p.numero, n, d: difficolta(p) })}
        progresso={[k + 1, n]}
        indietro={() => void navigate(rottaUnita(p))}
      />
      <div className={s.corpoBug}>
        <div className={s.intestaBug}>
          <h2 className={s.titoloBug}>{t('toccaRigaSbagliata')}</h2>
          <p className={s.suggerimento}>
            {esito.finito
              ? t('bugEsercizio', { k: k + 1, n })
              : miei.length
                ? t('bugSecondoTentativo')
                : t('bugSuggerimento')}
          </p>
        </div>
        <div className={s.codiceBug}>
          {e.codice.split('\n').map((testo, i) => {
            const numero = i + 1;
            const stato =
              esito.finito && numero === e.riga
                ? 'giusta'
                : numero === ultimo && numero !== e.riga
                  ? 'sbagliata'
                  : undefined;
            return (
              <button
                key={i}
                type="button"
                className={s.rigaBug}
                data-stato={stato}
                disabled={esito.finito}
                onClick={() => tocca(numero)}
              >
                <span className={s.numeroRiga}>{numero}</span>
                <span className={s.testoRiga}>{testo}</span>
                {stato && (
                  <span className={s.segnoRiga}>
                    {stato === 'giusta' ? <Check size={16} strokeWidth={2.5} /> : <X size={16} strokeWidth={2.5} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {esito.finito && (
          <div className={s.soluzione} role="status">
            <span className={s.verdettoBug} data-punti={esito.punti || undefined}>
              {esito.punti ? <Check size={16} strokeWidth={2.5} /> : <CircleAlert size={16} strokeWidth={2.5} />}
              {esito.punti === 2
                ? t('bugDuePunti', { r: e.riga })
                : esito.punti === 1
                  ? t('bugUnPunto', { r: e.riga })
                  : t('bugZeroPunti')}
            </span>
            {e.spiegazione && <p className={s.testoSpiegazione}>{e.spiegazione}</p>}
            <pre className={s.codiceCorretto}>
              {e.corretto.split('\n').map((riga, i) => (
                <span key={i} data-nuova={!originali.has(riga) || undefined}>
                  {riga}
                  {'\n'}
                </span>
              ))}
            </pre>
            <Fonte citazione={e.citazione} />
          </div>
        )}
      </div>
      <footer className={s.piedeBug}>
        <PuntiBug p={esito.finito ? String(esito.punti) : '—'} tot={`${totale} / ${2 * n}`} />
        {esito.finito && (
          <button ref={prossimoRef} type="button" className={s.prossimo} onClick={prossimo}>
            {t(k + 1 < n ? 'prossimo' : 'vediPunteggio')}
          </button>
        )}
      </footer>
    </div>
  );
}

/** Il piede di Bug Hunter coi valori in evidenza (mock: «Punti 2 / 2 per esercizio · totale 7 / 12»). */
function PuntiBug({ p, tot }: { p: string; tot: string }) {
  const [prima = '', mezzo = '', dopo = ''] = t('bugPunti', { p: '\uE000', tot: '\uE000' }).split('\uE000');
  return (
    <span className={s.puntiBug}>
      {prima}
      <span className={s.valoreBug}>{p}</span>
      {mezzo}
      <span className={s.valoreBug}>{tot}</span>
      {dopo}
    </span>
  );
}

/** Le barre dell'onda del mock mentre la voce legge; ferme a 4 in pausa e nel silenzio. */
const ONDA = [8, 16, 22, 12, 18, 24, 10, 16, 8];
const FASE: Record<FaseVoce, Chiave> = {
  domanda: 'faseDomanda',
  pausa: 'faseSilenzio',
  spiegazione: 'faseSpiegazione',
};
const nomeLingua = (codice: string | null) => {
  try {
    return codice ? (new Intl.DisplayNames([lingua], { type: 'language' }).of(codice) ?? '') : '';
  } catch {
    return '';
  }
};

/**
 * S19 Audio Flash-Trivia (`trivia`, `trivia-explain`): la voce di sistema legge domanda, 5 s di silenzio e spiegazione,
 * poi passa da sola all'elemento successivo; continua a schermo spento (su Android la coda è del motore di sintesi).
 * Play/Pausa, Stop (ferma e torna alla domanda), Salta (l'elemento conta come sbagliato e torna una volta nella playlist
 * successiva). Parte col primo Play: il browser non lascia parlare una pagina senza un gesto.
 */
function Trivia({ p }: { p: Di<'trivia'> }) {
  const navigate = useNavigate();
  const n = p.elementi.length;
  const [i, setI] = useState(0);
  const [fase, setFase] = useState<FaseVoce>('domanda');
  const [suona, setSuona] = useState(false);
  const [senzaVoce, setSenzaVoce] = useState(() => !hasVoice());
  const [secondi, setSecondi] = useState(PAUSA_TRIVIA_MS / 1000);
  const [risultato, setRisultato] = useState(p.risultato);
  // I saltati servono anche all'evento «fine» della voce, che arriva fuori dal giro di React
  const saltate = useRef<number[]>([]);
  // All'uscita la voce si ferma
  useEffect(() => stopReading, []);
  // Il conto alla rovescia del silenzio
  useEffect(() => {
    if (!suona || fase !== 'pausa') return;
    const id = setInterval(() => setSecondi((x) => Math.max(1, x - 1)), 1000);
    return () => clearInterval(id);
  }, [suona, fase, i]);
  if (risultato) return <Riepilogo p={p} risultato={risultato} />;
  const e = p.elementi[i];
  if (!e) return null;
  const finisci = () => void salva(p, { tipo: 'trivia', saltate: saltate.current }).then(setRisultato);
  const avvia = (da: number) => {
    setSuona(true);
    setSenzaVoce(false);
    readAloud(p.elementi, da, p.lingua, {
      fase: (indice, f) => {
        setI(indice);
        setFase(f);
        if (f === 'pausa') setSecondi(PAUSA_TRIVIA_MS / 1000);
      },
      fine: () => {
        setSuona(false);
        finisci();
      },
      errore: () => {
        setSuona(false);
        setSenzaVoce(true);
      },
    });
  };
  const ferma = (allaDomanda: boolean) => {
    stopReading();
    setSuona(false);
    if (allaDomanda) setFase('domanda');
  };
  const salta = () => {
    saltate.current = [...saltate.current, i];
    if (i + 1 >= n) {
      ferma(false);
      return finisci();
    }
    setI(i + 1);
    setFase('domanda');
    if (suona) avvia(i + 1);
  };
  const legge = suona && fase !== 'pausa';
  const meta = fase === 'pausa' && suona ? t('secondiRestanti', { n: secondi }) : t('lettura');
  const voce = nomeLingua(p.lingua);
  return (
    <div className={s.pagina}>
      <Testa
        titolo={t('praticaTrivia')}
        sottotitolo={t('triviaSottotitolo', { u: p.numero, n })}
        progresso={[i + 1, n]}
        indietro={() => void navigate(rottaUnita(p))}
      />
      <div className={s.corpoTrivia}>
        <span className={s.occhielloTrivia}>{t('triviaOcchiello')}</span>
        <div className={s.cartaTrivia}>
          <span className={s.fase} data-fase={fase}>
            {t(FASE[fase])}
          </span>
          <p className={s.testoTrivia}>{fase === 'domanda' ? e.domanda : fase === 'pausa' ? '…' : e.spiegazione}</p>
          <span className={s.onda} aria-hidden>
            {ONDA.map((h, k) => (
              <span key={k} style={{ height: `${legge ? h : 4}px` }} />
            ))}
          </span>
          <span className={s.metaTrivia}>
            {t('triviaMeta', { fase: meta, i: i + 1, n })}
            {voce && ` · ${voce}`}
          </span>
        </div>
        <div className={s.comandi}>
          <button type="button" className={s.comando} aria-label={t('stop')} onClick={() => ferma(true)}>
            <Square size={14} fill="currentColor" />
          </button>
          <button
            type="button"
            className={s.comandoPrincipale}
            aria-label={t(suona ? 'pausa' : 'play')}
            // Spento solo senza voce; dopo un errore della lettura (anche passeggero) si riprova
            disabled={!hasVoice()}
            onClick={() => (suona ? ferma(false) : avvia(i))}
          >
            {suona ? <Pause size={22} strokeWidth={2.5} /> : <Play size={22} fill="currentColor" />}
          </button>
          <button type="button" className={s.comando} aria-label={t('saltaElemento')} onClick={salta}>
            <SkipForward size={16} fill="currentColor" />
          </button>
        </div>
        {senzaVoce && (
          <p className={s.avviso} role="alert">
            {t('voceNonDisponibile')}
          </p>
        )}
      </div>
    </div>
  );
}

const RIEPILOGO: Record<Gioco['tipo'], { occhiello: Chiave; sottotitolo: Chiave; nota: Chiave }> = {
  devswipe: { occhiello: 'devswipeCompletato', sottotitolo: 'riepilogoCarte', nota: 'notaDevSwipe' },
  bughunter: { occhiello: 'bughunterCompletato', sottotitolo: 'riepilogoEsercizi', nota: 'notaBugHunter' },
  trivia: { occhiello: 'playlistCompletata', sottotitolo: 'riepilogoPlaylist', nota: 'notaTrivia' },
};

/** Una riga delle sbagliate: titolo, meta e l'etichetta (DevSwipe «rifatta»; Trivia «ripetuta» se tornerà). */
function sbagliata(p: Gioco, i: number): { titolo: string; meta: string; tag: Chiave | null } | null {
  const u = p.numero;
  if (p.tipo === 'devswipe') {
    const c = p.elementi[i];
    if (!c) return null;
    const titolo = c.titolo || (c.contenuto.split('\n')[0] ?? '');
    return {
      titolo,
      meta: c.categoria ? t('categoriaUnita', { c: c.categoria, u }) : t('unitaNumero', { u }),
      tag: 'tagRifatta',
    };
  }
  if (p.tipo === 'bughunter') {
    const e = p.elementi[i];
    return e ? { titolo: e.categoria || e.linguaggio, meta: t('rigaUnita', { r: e.riga, u }), tag: null } : null;
  }
  const e = p.elementi[i];
  return e ? { titolo: e.domanda, meta: t('unitaNumero', { u }), tag: e.riproposto ? null : 'tagRipetuta' } : null;
}

/**
 * S19 «Pratica · riepilogo» (`*-done`; §18 «Fine della pratica»): punteggio salvato, sbagliate (DevSwipe dopo la
 * riproposta, Bug Hunter quelli a 0 punti, Trivia i saltati), «Rifai la pratica» (una pratica nuova con gli stessi
 * parametri) e «Torna all'unità».
 */
function Riepilogo({ p, risultato }: { p: Gioco; risultato: RisultatoPratica }) {
  const navigate = useNavigate();
  const [stato, setStato] = useState<'pronto' | 'genera' | Extract<EsitoGenerazione, { errore: unknown }>['errore']>(
    'pronto',
  );
  const montato = useRef(false);
  useEffect(() => {
    montato.current = true;
    return () => {
      montato.current = false;
    };
  }, []);
  const r = RIEPILOGO[p.tipo];
  const righe = risultato.sbagliate.flatMap((i) => sbagliata(p, i) ?? []);
  const titoloSbagliate: Chiave =
    p.tipo === 'bughunter'
      ? righe.length === 1
        ? 'sbagliatoEsercizio'
        : 'sbagliatiEsercizi'
      : righe.length === 1
        ? 'sbagliataRiproposta'
        : 'sbagliateRiproposte';
  const nuova = async () => {
    setStato('genera');
    const x = await rifai(p);
    if (!montato.current) return;
    if ('errore' in x) return setStato(x.errore);
    void navigate(rottaPratica(p.tipo, x.id), { replace: true });
  };
  return (
    <div className={s.pagina}>
      <Testa
        titolo={t(NOME_TIPO[p.tipo])}
        sottotitolo={t(r.sottotitolo, { u: p.numero, n: p.elementi.length })}
        indietro={() => void navigate(rottaUnita(p))}
      />
      <div className={s.riepilogo}>
        <span className={s.occhiello}>{t(r.occhiello)}</span>
        <span>
          <span className={s.cifraGrande}>{risultato.giuste}</span>
          <span className={s.suTotali}> / {risultato.totali}</span>
        </span>
        <span className={s.percentuale}>{risultato.percentuale} %</span>
        <p className={s.notaPunteggio}>{t(r.nota)}</p>
        {righe.length > 0 && (
          <div className={s.sbagliate}>
            <span className={s.titoloSbagliate}>{t(titoloSbagliate, { n: righe.length })}</span>
            {righe.map((w, k) => (
              <div key={k} className={s.rigaSbagliata}>
                <span className={s.testiSbagliata}>
                  <span className={s.titoloSbagliata}>{w.titolo}</span>
                  <span className={s.metaSbagliata}>{w.meta}</span>
                </span>
                {w.tag && <span className={s.tagSbagliata}>{t(w.tag)}</span>}
              </div>
            ))}
          </div>
        )}
        {stato !== 'pronto' && stato !== 'genera' && (
          <p className={s.avviso} role="alert">
            {t(ERRORE[stato])}
          </p>
        )}
        <span className={s.azioni}>
          <button
            type="button"
            className={s.secondarioGrande}
            disabled={stato === 'genera'}
            aria-busy={stato === 'genera'}
            onClick={() => void nuova()}
          >
            {stato === 'genera' && <span className={s.spinnerChiaro} aria-hidden />}
            {t('rifaiPratica')}
          </button>
          <button type="button" className={s.primario} onClick={() => void navigate(rottaUnita(p))}>
            {t('tornaAllUnita')}
          </button>
        </span>
      </div>
    </div>
  );
}
