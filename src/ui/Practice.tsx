// La pratica generata dall'AI (MECC §18, §19; T-027, T-028; `claude-design/S19 AI Panel.dc.html` stati `quiz*` e
// `flashcard*`, `S12 Unità Panel.dc.html` sezione «Pratica»): in S12 i cinque tipi, quantità e difficoltà, «Genera» con
// l'attesa e l'errore «nessun elemento valido», i Recenti; il quiz con le quattro opzioni, la verifica e il punteggio; le
// flashcard da girare con i quattro gradi SM-2 (solo l'etichetta, D-DESIGN-1 n. 9) per un mazzo o per il ripasso
// trasversale (`/ripasso`). DevSwipe, Bug Hunter e Trivia stanno in `PracticeGames.tsx`. Le regole stanno in
// `app/practice` e nel dominio: qui si mostra e si passa il gesto.
import { Check, ChevronLeft, Layers, TriangleAlert, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { appDb, watch } from '../app/db';
import {
  generatePractice,
  gradeCard,
  readDeckView,
  readDueCards,
  readUnitPractice,
  saveQuizResult,
  type CartaDaRipassare,
  type EsitoGenerazione,
  type PraticaAperta,
  type PraticaRecente,
} from '../app/practice';
import { citations, type ErroreAi } from '../domain/ai';
import { QUANTITA, quizScore, type DifficoltaPratica, type Quantita, type TipoPratica } from '../domain/generation';
import type { Valutazione } from '../domain/sm2';
import { fmtData, fuso } from './format';
import { t, type Chiave } from './i18n';
import s from './Practice.module.css';

/** I cinque tipi di S12, nell'ordine del mock, col loro nome; il sostantivo dell'errore «nessun … valido» (TESTI). */
export const NOME_TIPO: Record<TipoPratica, Chiave> = {
  quiz: 'praticaQuiz',
  flashcard: 'praticaFlashcard',
  devswipe: 'praticaDevSwipe',
  bughunter: 'praticaBugHunter',
  trivia: 'praticaTrivia',
};
const TIPI = Object.keys(NOME_TIPO) as TipoPratica[];
const NESSUNO_VALIDO: Record<TipoPratica, Chiave> = {
  quiz: 'nessunaDomandaValida',
  flashcard: 'nessunaCartaValida',
  devswipe: 'nessunaCartaValida',
  bughunter: 'nessunEsercizioValido',
  trivia: 'nessunaDomandaValida',
};
/** La difficoltà dove S12 la mostra: nascosta per Flashcard e Trivia (CONTROLLI di S12). */
const conDifficolta = (tipo: TipoPratica) => tipo !== 'flashcard' && tipo !== 'trivia';
/** Dove si apre una pratica: il mazzo per le flashcard, S19 per le altre. */
export const rottaPratica = (tipo: TipoPratica, id: string) =>
  tipo === 'flashcard' ? `/mazzo/${encodeURIComponent(id)}` : `/pratica/${encodeURIComponent(id)}`;
export const DIFFICOLTA: [DifficoltaPratica, Chiave][] = [
  ['facile', 'difficoltaFacile'],
  ['media', 'difficoltaMedia'],
  ['difficile', 'difficoltaDifficile'],
];
type Errore = Extract<EsitoGenerazione, { errore: unknown }>['errore'];
export const ERRORE: Record<ErroreAi | 'vuota', Chiave> = {
  vuota: 'generazioneVuotaTesto',
  chiave: 'erroreChiaveTesto',
  modello: 'erroreModelloTesto',
  limite: 'erroreLimiteTesto',
  sicurezza: 'generazioneBloccata',
  rete: 'generazioneSenzaRete',
  generico: 'generazioneNonRiuscita',
};

/**
 * S12 «Pratica · genera da questa unità»: tipo, quantità 5–25, difficoltà del quiz, «Genera», Recenti (§18). Chi esce
 * mentre il modello lavora resta dov'è: la pratica generata compare nei Recenti.
 */
export function PraticaUnita({ unitaId }: { unitaId: string }) {
  const navigate = useNavigate();
  const montato = useRef(false);
  useEffect(() => {
    montato.current = true;
    return () => {
      montato.current = false;
    };
  }, []);
  const [tipo, setTipo] = useState<TipoPratica>('quiz');
  const [quantita, setQuantita] = useState<Quantita>(10);
  const [difficolta, setDifficolta] = useState<DifficoltaPratica>('media');
  const [stato, setStato] = useState<'pronto' | 'genera' | Errore>('pronto');
  const [recenti, setRecenti] = useState<PraticaRecente[]>();
  useEffect(() => watch(() => readUnitPractice(appDb, unitaId, Date.now()), setRecenti), [unitaId]);
  const nome = t(NOME_TIPO[tipo]);
  const genera = async () => {
    setStato('genera');
    const r = await generatePractice(appDb, unitaId, tipo, quantita, difficolta, Date.now());
    if (!montato.current) return;
    if ('errore' in r) return setStato(r.errore);
    setStato('pronto');
    void navigate(rottaPratica(tipo, r.id));
  };
  return (
    <section className={s.sezione}>
      <h2 className={s.testaSezione}>
        <Layers size={14} />
        {t('praticaGenera')}
      </h2>
      <div className={s.tipi}>
        {TIPI.map((id) => (
          <button
            key={id}
            type="button"
            className={s.tipo}
            aria-pressed={tipo === id}
            disabled={stato === 'genera'}
            onClick={() => setTipo(id)}
          >
            {t(NOME_TIPO[id])}
          </button>
        ))}
      </div>
      <div className={s.parametri}>
        <div className={s.riga}>
          <span className={s.etichetta}>{t('quantita')}</span>
          <span className={s.chips}>
            {QUANTITA.map((q) => (
              <button
                key={q}
                type="button"
                className={`${s.chip} ${s.cifra}`}
                aria-pressed={quantita === q}
                disabled={stato === 'genera'}
                onClick={() => setQuantita(q)}
              >
                {q}
              </button>
            ))}
          </span>
        </div>
        {conDifficolta(tipo) && (
          <div className={s.riga}>
            <span className={s.etichetta}>{t('difficolta')}</span>
            <span className={s.chips}>
              {DIFFICOLTA.map(([d, chiave]) => (
                <button
                  key={d}
                  type="button"
                  className={s.chip}
                  aria-pressed={difficolta === d}
                  disabled={stato === 'genera'}
                  onClick={() => setDifficolta(d)}
                >
                  {t(chiave)}
                </button>
              ))}
            </span>
          </div>
        )}
        {stato !== 'pronto' && stato !== 'genera' ? (
          <div className={s.errore} role="alert">
            <TriangleAlert size={18} className={s.iconaErrore} />
            <span className={s.testiErrore}>
              <span className={s.titoloErrore}>
                {t(stato === 'vuota' ? NESSUNO_VALIDO[tipo] : 'generazioneNonFatta')}
              </span>
              <span className={s.dettaglioErrore}>{t(ERRORE[stato])}</span>
              <span className={s.azioniErrore}>
                <button type="button" className={s.ghost} onClick={() => setStato('pronto')}>
                  {t('chiudi')}
                </button>
                {stato === 'chiave' || stato === 'modello' ? (
                  <Link to="/impostazioni/ai" className={s.secondario}>
                    {t('apriImpostazioni')}
                  </Link>
                ) : (
                  <button type="button" className={s.secondario} onClick={() => void genera()}>
                    {t('riprova')}
                  </button>
                )}
              </span>
            </span>
          </div>
        ) : (
          <button
            type="button"
            className={s.genera}
            disabled={stato === 'genera'}
            aria-busy={stato === 'genera'}
            onClick={() => void genera()}
          >
            {stato === 'genera' && <span className={s.spinner} aria-hidden />}
            <span className={stato === 'genera' ? s.inCorso : undefined}>
              {t(stato === 'genera' ? 'generoPratica' : 'generaPratica', { n: quantita, tipo: nome })}
            </span>
          </button>
        )}
      </div>
      <p className={s.nota}>{t('praticaNotaLingua')}</p>
      {recenti && recenti.length > 0 && (
        <div className={s.recenti}>
          <span className={s.etichetta}>{t('recenti')}</span>
          {recenti.map((r) => (
            <Link key={r.id} className={s.recente} to={rottaPratica(r.tipo, r.id)}>
              <span className={s.tipoRecente}>{t(NOME_TIPO[r.tipo])}</span>
              <span className={s.titoloRecente}>
                {fmtData.format(r.creataIl)} · <Quanti r={r} />
              </span>
              <span
                className={s.punteggioRecente}
                data-tono={
                  r.tipo === 'flashcard' ? 'primary' : r.tipo === 'quiz' && r.giuste !== null ? 'successo' : undefined
                }
              >
                {r.tipo === 'flashcard'
                  ? r.dovute > 0
                    ? t('ripassa')
                    : ''
                  : r.giuste === null || r.totali === null
                    ? ''
                    : r.tipo === 'quiz'
                      ? t('punteggioRecente', { g: r.giuste, t: r.totali, p: r.percentuale ?? 0 })
                      : `${r.giuste} / ${r.totali}`}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/** Quanti elementi ha una pratica dei Recenti (mock di S12: «10 domande», «15 carte», «12 carte · 4 scadute»). */
function Quanti({ r }: { r: PraticaRecente }) {
  if (r.tipo === 'flashcard')
    return t(r.dovute === 1 ? 'recenteCarteUnaScaduta' : 'recenteCarte', { n: r.carte, d: r.dovute });
  const chiave: Record<typeof r.tipo, Chiave> = {
    quiz: 'recenteDomande',
    devswipe: 'recenteSoloCarte',
    bughunter: 'recenteEsercizi',
    trivia: 'recentePlaylist',
  };
  return t(chiave[r.tipo], { n: r.elementi });
}

/** La rotta dell'unità della pratica: dove tornano «Indietro» e «Torna all'unità». */
export const rottaUnita = (u: { unitaId: string; corsoId: string | null }) =>
  u.corsoId ? `/corsi/${encodeURIComponent(u.corsoId)}/unita/${encodeURIComponent(u.unitaId)}` : '/';

export function Testa(p: { titolo: string; sottotitolo: string; progresso?: [number, number]; indietro: () => void }) {
  return (
    <header className={s.testa}>
      <div className={s.rigaTesta}>
        <button type="button" className={s.icona} aria-label={t('indietro')} onClick={p.indietro}>
          <ChevronLeft size={18} />
        </button>
        <span className={s.titoli}>
          <span className={s.titolo}>{p.titolo}</span>
          <span className={s.sottotitolo}>{p.sottotitolo}</span>
        </span>
        {p.progresso && (
          <span className={s.contatore}>
            {p.progresso[0]} / {p.progresso[1]}
          </span>
        )}
      </div>
      {p.progresso && (
        <span className={s.barra}>
          <span style={{ width: `${(p.progresso[0] / Math.max(1, p.progresso[1])) * 100}%` }} />
        </span>
      )}
    </header>
  );
}

/** La fonte di un elemento generato come chip numerata con l'etichetta (le stesse etichette della chat). */
export function Fonte({ citazione }: { citazione: string }) {
  if (!citazione) return null;
  const f = citations(citazione.startsWith('[') ? citazione : `[${citazione}]`).fonti[0];
  const tipo: Record<string, Chiave> = {
    CODICE: 'fonteCodice',
    NOTA: 'fonteTuoi',
    LINK: 'fonteTuoi',
    PDF: 'fonteTuoi',
  };
  return (
    <span className={s.fonte}>
      <span className={s.quadrato}>1</span>
      <span className={s.etichettaFonte}>
        {f ? t(tipo[f.tipo] ?? 'fonteCorso', { etichetta: f.etichetta }) : citazione}
      </span>
    </span>
  );
}

const LETTERE = ['A', 'B', 'C', 'D'];
// Istante e fuso si leggono al gesto, fuori dal componente
const salvaQuiz = (id: string, esiti: boolean[]) => saveQuizResult(appDb, id, esiti, Date.now(), fuso());

/**
 * S19 Quiz (`quiz`, `quiz-answered`, `quiz-done`): una domanda alla volta, «Conferma» e la spiegazione, il punteggio. Un
 * quiz già fatto si riapre sul punteggio salvato, con le sue sbagliate da rivedere (D-QUIZ-4).
 */
export function QuizScreen({ q }: { q: Extract<PraticaAperta, { tipo: 'quiz' }> }) {
  const navigate = useNavigate();
  // «Rivedi le sbagliate»: un giro sulle sole domande sbagliate, che non cambia il punteggio salvato
  const [giro, setGiro] = useState<number[] | null>(null);
  const [i, setI] = useState(0);
  const [scelta, setScelta] = useState<number | null>(null);
  const [verificata, setVerificata] = useState(false);
  const [esiti, setEsiti] = useState<boolean[]>([]);
  const [fine, setFine] = useState(false);
  const ordine = giro ?? q.elementi.map((_, k) => k);
  const d = q.elementi[ordine[i] ?? 0];
  const indietro = () => void navigate(rottaUnita(q));
  const sottotitolo = t('quizSottotitolo', { u: q.numero, n: ordine.length });
  const salvato = giro ? null : q.risultato;
  if (fine || salvato || !d) {
    const p = salvato ?? quizScore(esiti);
    const sbagliate = salvato ? salvato.sbagliate : ordine.filter((_, k) => !esiti[k]);
    return (
      <div className={s.pagina}>
        <Testa titolo={t('praticaQuiz')} sottotitolo={sottotitolo} indietro={indietro} />
        <div className={s.punteggio}>
          <span className={s.occhiello}>{t('quizCompletato')}</span>
          <span>
            <span className={s.cifraGrande}>{p.giuste}</span>
            <span className={s.suTotali}> / {p.totali}</span>
          </span>
          <span className={s.percentuale}>{p.percentuale} %</span>
          {!giro && <p className={s.notaPunteggio}>{t('notaPunteggio')}</p>}
          <span className={s.azioni}>
            {sbagliate.length > 0 && (
              <button
                type="button"
                className={s.secondarioGrande}
                onClick={() => {
                  setGiro(sbagliate);
                  setI(0);
                  setEsiti([]);
                  setScelta(null);
                  setVerificata(false);
                  setFine(false);
                }}
              >
                {t('rivediSbagliate')}
              </button>
            )}
            <button type="button" className={s.primario} onClick={indietro}>
              {t('tornaAllUnita')}
            </button>
          </span>
        </div>
      </div>
    );
  }
  const ultima = i + 1 >= ordine.length;
  const avanti = () => {
    if (!verificata) {
      setVerificata(true);
      setEsiti([...esiti, scelta === d.corretta]);
      return;
    }
    if (!ultima) {
      setI(i + 1);
      setScelta(null);
      setVerificata(false);
      return;
    }
    // Il punteggio si salva solo per il quiz intero e la prima volta (§18 tabella: punteggio, percentuale, istante)
    if (!giro && !q.risultato) void salvaQuiz(q.id, esiti);
    setFine(true);
  };
  const giusta = scelta === d.corretta;
  return (
    <div className={s.pagina}>
      <Testa
        titolo={t('praticaQuiz')}
        sottotitolo={sottotitolo}
        progresso={[i + 1, ordine.length]}
        indietro={indietro}
      />
      <div className={s.corpoQuiz}>
        <h2 className={s.domanda}>{d.domanda}</h2>
        <div className={s.opzioni}>
          {d.opzioni.map((o, k) =>
            o ? (
              <button
                key={k}
                type="button"
                className={s.opzione}
                data-stato={
                  verificata
                    ? k === d.corretta
                      ? 'giusta'
                      : k === scelta
                        ? 'sbagliata'
                        : 'altra'
                    : k === scelta
                      ? 'scelta'
                      : undefined
                }
                aria-pressed={k === scelta}
                disabled={verificata}
                onClick={() => setScelta(k)}
              >
                <span className={s.lettera}>{LETTERE[k]}</span>
                <span className={s.testoOpzione}>{o}</span>
                {verificata && k === d.corretta && <Check size={18} strokeWidth={2.5} className={s.iconaGiusta} />}
                {verificata && k === scelta && k !== d.corretta && (
                  <X size={18} strokeWidth={2.5} className={s.iconaSbagliata} />
                )}
              </button>
            ) : null,
          )}
        </div>
        {verificata && (
          <div className={s.spiegazione} role="status">
            <span className={s.verdetto} data-giusta={giusta || undefined}>
              {giusta ? <Check size={16} /> : <X size={16} />}
              {giusta ? t('corretto') : t('nonCorretto', { l: LETTERE[d.corretta] ?? '' })}
            </span>
            {d.spiegazione && <p className={s.testoSpiegazione}>{d.spiegazione}</p>}
            <Fonte citazione={d.citazione} />
          </div>
        )}
      </div>
      <footer className={s.piede}>
        <button type="button" className={s.primario} disabled={scelta === null} onClick={avanti}>
          {t(!verificata ? 'conferma' : ultima ? 'vediPunteggio' : 'prossimaDomanda')}
        </button>
      </footer>
    </div>
  );
}

export function Indietro() {
  const navigate = useNavigate();
  useEffect(() => void navigate('/', { replace: true }), [navigate]);
  return null;
}

// L'istante si legge al gesto, fuori dal componente (il compilatore di React lo scambia per una lettura nel render)
const valutaCarta = (id: string, v: Valutazione) => gradeCard(appDb, id, v, Date.now());

const GRADI: [Valutazione, Chiave][] = [
  ['niente', 'gradoNiente'],
  ['difficile', 'gradoDifficile'],
  ['bene', 'gradoBene'],
  ['facile', 'gradoFacile'],
];

/**
 * Le carte da girare (S19 `flashcard-front`, `flashcard-back`): «Mostra risposta» o il tocco girano la carta, i quattro
 * gradi la valutano (SM-2, §19) e passano alla prossima; «Niente» la rimette in fondo alla coda della sessione (I1).
 */
function Carte(p: {
  titolo: string;
  sottotitolo: string;
  carte: CartaDaRipassare[];
  indietro: () => void;
  fine: { titolo: Chiave; testo: string };
}) {
  const [coda, setCoda] = useState(p.carte);
  const [k, setK] = useState(0);
  const [retro, setRetro] = useState(false);
  // Un grado alla volta: un secondo tocco durante la scrittura applicherebbe SM-2 due volte
  const [occupato, setOccupato] = useState(false);
  // Il fuoco segue la carta girata o nuova (il bottone si rimonta, e «Mostra risposta» sparisce)
  const cartaRef = useRef<HTMLButtonElement>(null);
  useEffect(() => cartaRef.current?.focus(), [k, retro]);
  const c = coda[k];
  if (!c)
    return (
      <div className={s.pagina}>
        <Testa titolo={p.titolo} sottotitolo={p.sottotitolo} indietro={p.indietro} />
        <div className={s.finito}>
          <span className={s.discoFinito}>
            <Check size={24} strokeWidth={2} />
          </span>
          <span className={s.titoloFinito}>{t(p.fine.titolo)}</span>
          <span className={s.testoFinito}>{p.fine.testo}</span>
          <button type="button" className={s.secondarioGrande} onClick={p.indietro}>
            {t('chiudi')}
          </button>
        </div>
      </div>
    );
  const valuta = async (v: Valutazione) => {
    setOccupato(true);
    const r = await valutaCarta(c.id, v);
    setOccupato(false);
    if (r?.rimettiInCoda) setCoda([...coda, { ...c, ripassi: c.ripassi + 1 }]);
    setRetro(false);
    setK(k + 1);
  };
  return (
    <div className={s.pagina}>
      <Testa titolo={p.titolo} sottotitolo={p.sottotitolo} progresso={[k + 1, coda.length]} indietro={p.indietro} />
      <div className={s.corpoCarte}>
        <button key={`${k}-${retro}`} ref={cartaRef} type="button" className={s.carta} onClick={() => setRetro(!retro)}>
          <span className={s.lato}>
            <span className={s.etichettaLato} data-retro={retro || undefined}>
              {t(retro ? 'retro' : 'fronte')}
            </span>
            <span className={s.metaCarta}>
              {c.ripassi
                ? t(c.ripassi === 1 ? 'ripassataUnaVolta' : 'ripassataVolte', { n: c.ripassi })
                : t('cartaNuova', { n: k + 1 })}
            </span>
          </span>
          <span className={s.testoCarta}>{retro ? c.retro : c.fronte}</span>
          {retro ? <Fonte citazione={c.citazione} /> : <span className={s.tocca}>{t('toccaCarta')}</span>}
        </button>
        {retro ? (
          <div className={s.gradi}>
            <span className={s.quanto}>{t('quantoRicordavi')}</span>
            <span className={s.bottoniGradi}>
              {GRADI.map(([v, chiave]) => (
                <button key={v} type="button" className={s.grado} disabled={occupato} onClick={() => void valuta(v)}>
                  {t(chiave)}
                </button>
              ))}
            </span>
          </div>
        ) : (
          <button type="button" className={s.primario} onClick={() => setRetro(true)}>
            {t('mostraRisposta')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Il mazzo di un'unità dai Recenti di S12: le sue carte scadute (§19). */
export function DeckScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [v, setV] = useState<Awaited<ReturnType<typeof readDeckView>> | null>();
  useEffect(() => {
    void readDeckView(appDb, id, Date.now()).then((x) => setV(x ?? null));
  }, [id]);
  if (v === undefined) return null;
  if (v === null) return <Indietro />;
  return (
    <Carte
      titolo={t('praticaFlashcard')}
      sottotitolo={t('mazzoSottotitolo', { u: v.numero, n: v.carte.length })}
      carte={v.carte}
      indietro={() => void navigate(rottaUnita(v))}
      fine={{ titolo: 'mazzoFinito', testo: t('mazzoFinitoTesto') }}
    />
  );
}

/** Il ripasso trasversale (§19, `/ripasso`): le carte scadute di tutti i mazzi, dalle più scadute. */
export function ReviewScreen() {
  const navigate = useNavigate();
  const primaSchermata = useLocation().key === 'default';
  const [carte, setCarte] = useState<CartaDaRipassare[]>();
  useEffect(() => {
    void readDueCards(appDb, Date.now()).then(setCarte);
  }, []);
  if (!carte) return null;
  return (
    <Carte
      titolo={t('ripassoTrasversale')}
      sottotitolo={
        carte.length
          ? t(carte.length === 1 ? 'ripassoSottotitoloUna' : 'ripassoSottotitolo', { n: carte.length })
          : t('ripassoNessuna')
      }
      carte={carte}
      indietro={() => void (primaSchermata ? navigate('/') : navigate(-1))}
      fine={{
        titolo: 'ripassoFinito',
        testo: t(carte.length === 1 ? 'ripassoFinitoTestoUna' : 'ripassoFinitoTesto', { n: carte.length }),
      }}
    />
  );
}
