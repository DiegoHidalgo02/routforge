// S19 Chat AI (MECC §18; FUNZ §16; T-026; `claude-design/S19 AI Panel.dc.html`, stati `chat*`): la conversazione con
// l'ambito (pill: unità → modulo → corso → globale; cambiarlo apre una conversazione nuova), la risposta in streaming con
// «Interrompi», le citazioni numerate con le fonti sotto la bolla, il messaggio in attesa offline, gli stati senza
// chiave e d'errore come il mock. `/chat?unita=…`, `?modulo=…`, `?c=<conversazione>` o nulla (globale); le conversazioni
// in `/chat/conversazioni`, raggruppate per età. Il pannello serve anche alla scheda AI della sessione (S15).
import {
  ArrowUp,
  History,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Key,
  MessageSquare,
  SlidersVertical,
  Square,
  TriangleAlert,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  answer,
  moduleScope,
  readMaskedAiKey,
  readChat,
  readConversations,
  scopeName,
  sendMessage,
  takeBackLastMessage,
  unitScope,
  waitForNetwork,
  type NomeAmbito,
} from '../app/ai';
import { appDb, watch } from '../app/db';
import { citations, conversationGroups, GLOBALE, nextScope, type AmbitoAperto, type ErroreAi } from '../domain/ai';
import { useMinuto } from './clock';
import { fmtData, fmtGiornoMese, fmtOra, FONTE } from './format';
import { t, tn, type Chiave } from './i18n';
import { Markdown } from './Markdown';
import { useSettings } from './preferenze';
import { useIndietro } from './useIndietro';
import s from './Chat.module.css';

/** In linea o no (§18 «Offline»): gli eventi del browser, gli stessi nella WebView. */
function useOnline(): boolean {
  return useSyncExternalStore(
    (cambia) => {
      addEventListener('online', cambia);
      addEventListener('offline', cambia);
      return () => {
        removeEventListener('online', cambia);
        removeEventListener('offline', cambia);
      };
    },
    () => navigator.onLine,
  );
}

/** La risposta col markdown, i numeri delle citazioni al loro posto e le fonti sotto (§18). */
function Risposta({ testo }: { testo: string }) {
  const { parti, fonti } = citations(testo);
  const conNumeri = parti.map((p) => (typeof p === 'number' ? `⟦${p}⟧` : p)).join('');
  return (
    <div className={s.risposta}>
      <div className={s.bollaAi}>
        <Markdown testo={conNumeri} cita={(n) => <span className={s.numero}>{n}</span>} />
      </div>
      {fonti.length > 0 && (
        <ul className={s.fonti}>
          {fonti.map((f) => (
            <li key={f.n} className={s.fonte}>
              <span className={s.quadrato}>{f.n}</span>
              <span className={s.etichettaFonte}>{t(FONTE[f.tipo], { etichetta: f.etichetta })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ERRORI: Record<Exclude<ErroreAi, 'rete'>, [Chiave, Chiave]> = {
  chiave: ['erroreChiaveTitolo', 'erroreChiaveTesto'],
  modello: ['erroreModelloTitolo', 'erroreModelloTesto'],
  limite: ['erroreLimiteTitolo', 'erroreLimiteTesto'],
  sicurezza: ['erroreSicurezzaTitolo', 'erroreSicurezzaTesto'],
  generico: ['erroreGenericoTitolo', 'erroreGenericoTesto'],
};

/** Gli errori di §18 come S19 (`chat-error*`): limite → Impostazioni o Riprova; chiave e modello → Impostazioni; sicurezza → Riformula. */
function ErroreChat(p: { errore: Exclude<ErroreAi, 'rete'>; onRiprova: () => void; onRiformula: () => void }) {
  const [titolo, testo] = ERRORI[p.errore];
  return (
    <div className={s.stato}>
      <span className={s.disco} data-tono="pericolo">
        <TriangleAlert size={24} />
      </span>
      <span className={s.testiStato}>
        <span className={s.titoloStato}>{t(titolo)}</span>
        <span className={s.testoStato}>{t(testo)}</span>
      </span>
      <span className={s.azioni}>
        {p.errore === 'limite' || p.errore === 'generico' ? (
          <>
            <Link to="/impostazioni/ai" className={s.secondario}>
              {t('impostazioniModelloAi')}
            </Link>
            <button type="button" className={s.primario} onClick={p.onRiprova}>
              {t('riprova')}
            </button>
          </>
        ) : p.errore === 'sicurezza' ? (
          <button type="button" className={s.primario} onClick={p.onRiformula}>
            {t('riformula')}
          </button>
        ) : (
          <Link to="/impostazioni/ai" className={s.primario}>
            {t('apriImpostazioni')}
          </Link>
        )}
      </span>
    </div>
  );
}

/** Senza chiave (S19 `chat-nokey`): la chat e le generazioni chiedono la chiave in Impostazioni; il resto funziona. */
function SenzaChiave() {
  return (
    <div className={s.stato}>
      <span className={s.disco}>
        <Key size={24} />
      </span>
      <span className={s.testiStato}>
        <span className={s.titoloStato}>{t('chiaveGeminiTitolo')}</span>
        <span className={s.testoStato}>{t('chiaveGeminiTesto')}</span>
      </span>
      <Link to="/impostazioni/ai" className={s.secondario}>
        <SlidersVertical size={16} />
        {t('impostazioniModelloAi')}
      </Link>
      <a className={s.collegamento} href={CHIAVI_GEMINI} target="_blank" rel="noopener noreferrer">
        {t('comeOttenereChiave')}
      </a>
    </div>
  );
}

/** Dove si crea una chiave Gemini (Google AI Studio). */
export const CHIAVI_GEMINI = 'https://aistudio.google.com/app/apikey';

const SUGGERIMENTO: Record<NomeAmbito['ambito'], (n: NomeAmbito) => string> = {
  unita: (n) => (n.ambito === 'unita' ? t('contestoUnita', { n: n.unita }) : ''),
  modulo: (n) => (n.ambito === 'modulo' ? t('contestoModulo', { n: n.modulo }) : ''),
  corso: (n) => (n.ambito === 'corso' ? t('contestoCorso', { corso: n.corso }) : ''),
  globale: () => t('contestoGlobale'),
};

/**
 * La conversazione e il campo (S19): domande a destra, risposte a sinistra; la risposta in arrivo con «Interrompi»;
 * offline la domanda resta in attesa (un solo messaggio per conversazione, l'invio spento finché non parte).
 */
export function ChatPanel(p: {
  ambito: AmbitoAperto;
  conversazioneId: string | null;
  onConversazione: (id: string) => void;
  /** Nella scheda della sessione: senza la riga dell'ambito. */
  compatta?: boolean;
}) {
  const online = useOnline();
  const [chiave, setChiave] = useState<boolean>();
  useEffect(
    () =>
      watch(
        () => readMaskedAiKey(appDb),
        (k) => setChiave(k !== null),
      ),
    [],
  );
  const [chat, setChat] = useState<Awaited<ReturnType<typeof readChat>>>();
  useEffect(() => {
    const id = p.conversazioneId;
    return id ? watch(() => readChat(appDb, id), setChat) : undefined;
  }, [p.conversazioneId]);
  const [nome, setNome] = useState<NomeAmbito>();
  const { ambito, corsoId, moduloId, unitaId } = p.ambito;
  useEffect(() => {
    void scopeName(appDb, { ambito, corsoId, moduloId, unitaId }).then(setNome);
  }, [ambito, corsoId, moduloId, unitaId]);
  const [testo, setTesto] = useState('');
  const [risposta, setRisposta] = useState<string | null>(null);
  const [errore, setErrore] = useState<ErroreAi | null>(null);
  // Fra l'invio e la fine della risposta: la domanda senza risposta non è ancora un errore
  const [inviando, setInviando] = useState(false);
  const fermo = useRef<AbortController | null>(null);
  // Lasciata la chat, la risposta in arrivo si ferma e resta col testo arrivato (D-AI-2)
  useEffect(() => () => fermo.current?.abort(), []);
  const fine = useRef<HTMLDivElement>(null);
  // Una conversazione nuova (ambito cambiato) non mostra quella di prima
  const messaggi = chat && chat.conversazione.id === p.conversazioneId ? chat.messaggi : [];
  useEffect(() => {
    fine.current?.scrollIntoView?.({ block: 'end' });
  }, [messaggi.length, risposta]);

  const inAttesa = messaggi.some((m) => m.stato === 'in_attesa');
  const ultimo = messaggi[messaggi.length - 1];
  // Una domanda rimasta senza risposta (errore della risposta partita al ritorno della rete): si può riprovare
  const senzaRisposta = !inviando && risposta === null && ultimo?.ruolo === 'utente' && ultimo.stato === 'inviato';
  const rispondi = async (id: string) => {
    const c = new AbortController();
    fermo.current = c;
    setErrore(null);
    setRisposta('');
    const e = await answer(appDb, id, () => Date.now(), setRisposta, c.signal);
    setRisposta(null);
    // In attesa solo se la rete manca davvero: con la rete «accesa» che non risponde serve «Riprova»
    if (e === 'rete' && !navigator.onLine) await waitForNetwork(appDb, id, Date.now());
    else setErrore(e === 'rete' ? 'generico' : e);
  };
  const invia = async (ev: FormEvent) => {
    ev.preventDefault();
    const domanda = testo.trim();
    if (!domanda || risposta !== null || inAttesa || inviando) return;
    setTesto('');
    setInviando(true);
    try {
      const id = await sendMessage(appDb, p.ambito, p.conversazioneId, domanda, Date.now(), online);
      if (id !== p.conversazioneId) p.onConversazione(id);
      if (online) await rispondi(id);
    } catch {
      // Non salvata (memoria piena, database chiuso): la domanda torna nel campo
      setTesto(domanda);
      setErrore('generico');
    } finally {
      setInviando(false);
    }
  };

  if (chiave === false) return <SenzaChiave />;
  if ((errore && errore !== 'rete') || senzaRisposta)
    return (
      <ErroreChat
        errore={errore && errore !== 'rete' ? errore : 'generico'}
        onRiprova={() => {
          if (p.conversazioneId) void rispondi(p.conversazioneId);
          else setErrore(null);
        }}
        onRiformula={() =>
          void (async () => {
            setErrore(null);
            if (p.conversazioneId)
              setTesto(await takeBackLastMessage(appDb, p.conversazioneId, Date.now()).catch(() => ''));
          })()
        }
      />
    );
  return (
    <>
      <div className={s.conversazione} data-compatta={p.compatta || undefined}>
        {!p.compatta && nome && <p className={s.suggerimento}>{SUGGERIMENTO[nome.ambito](nome)}</p>}
        {/* L'elenco delle conversazioni non ha un ingresso nel mock (handoff n. 36): qui, prima del primo messaggio */}
        {!p.compatta && !messaggi.length && risposta === null && (
          <Link to="/chat/conversazioni" className={s.cronologia}>
            <History size={14} />
            {t('conversazioni')}
          </Link>
        )}
        {messaggi.map((m) =>
          m.ruolo === 'utente' ? (
            <p key={m.id} className={s.domanda}>
              {m.testo}
            </p>
          ) : (
            <Risposta key={m.id} testo={m.testo} />
          ),
        )}
        {risposta !== null && (
          <div className={s.inArrivo} data-testo={risposta ? '' : undefined}>
            {risposta ? (
              <Risposta testo={risposta} />
            ) : (
              <span className={s.scrive} aria-label={t('staScrivendo')}>
                <span />
                <span />
                <span />
              </span>
            )}
            <button type="button" className={s.interrompi} onClick={() => fermo.current?.abort()}>
              <Square size={10} fill="currentColor" strokeWidth={0} />
              {t('interrompi')}
            </button>
          </div>
        )}
        {/* In attesa e la rete c'è: la domanda sta partendo da sola, si vede solo che sta scrivendo */}
        {inAttesa && online && (
          <span className={s.scrive} aria-label={t('staScrivendo')}>
            <span />
            <span />
            <span />
          </span>
        )}
        {inAttesa && !online && (
          <p className={s.offline}>
            <WifiOff size={16} />
            {t('offlineAvviso')}
          </p>
        )}
        <div ref={fine} />
      </div>
      <form className={s.compositore} onSubmit={(e) => void invia(e)} data-spento={inAttesa || undefined}>
        <input
          className={s.campo}
          value={testo}
          onChange={(e) => setTesto(e.currentTarget.value)}
          placeholder={
            inAttesa || !online
              ? t('offlineSegnaposto')
              : ambito === 'globale'
                ? t('scriviSegnaposto')
                : t('chiediSegnaposto')
          }
          aria-label={t('chatAi')}
          disabled={inAttesa}
        />
        <button type="submit" className={s.invia} aria-label={t('invia')} disabled={inAttesa}>
          <ArrowUp size={18} strokeWidth={2} />
        </button>
      </form>
    </>
  );
}

const PILL: Record<NomeAmbito['ambito'], (n: NomeAmbito) => string> = {
  unita: (n) => (n.ambito === 'unita' ? t('ambitoUnita', { n: n.unita }) : ''),
  modulo: (n) => (n.ambito === 'modulo' ? t('ambitoModulo', { n: n.modulo }) : ''),
  corso: () => t('ambitoCorso'),
  globale: () => t('ambitoGlobale'),
};

/** S19 Chat: intestazione con l'ambito e il pannello. */
export function ChatScreen() {
  const [q] = useSearchParams();
  const indietro = useIndietro();
  const { modelloAi } = useSettings();
  const [stato, setStato] = useState<{ origine: AmbitoAperto; ambito: AmbitoAperto; conversazioneId: string | null }>();
  const [nome, setNome] = useState<NomeAmbito>();
  const parametri = q.toString();
  useEffect(() => {
    const cerca = new URLSearchParams(parametri);
    void (async () => {
      const c = cerca.get('c');
      const u = cerca.get('unita');
      const m = cerca.get('modulo');
      const x = c ? await readChat(appDb, c) : undefined;
      if (x) {
        const { ambito, corsoId, moduloId, unitaId } = x.conversazione;
        const a = { ambito, corsoId, moduloId, unitaId };
        return setStato({ origine: a, ambito: a, conversazioneId: x.conversazione.id });
      }
      const a = (u && (await unitScope(appDb, u))) || (m && (await moduleScope(appDb, m))) || GLOBALE;
      setStato({ origine: a, ambito: a, conversazioneId: null });
    })();
  }, [parametri]);
  useEffect(() => {
    if (stato) void scopeName(appDb, stato.ambito).then(setNome);
  }, [stato]);
  if (!stato) return null;
  const modello = t(modelloAi === 'pro' ? 'geminiPro' : 'geminiFlash');
  return (
    <div className={s.pagina}>
      <header className={s.testa}>
        <button type="button" className={s.icona} aria-label={t('indietro')} onClick={indietro}>
          <ChevronLeft size={18} />
        </button>
        <span className={s.titoli}>
          <span className={s.titolo}>{t('chatAi')}</span>
          <span className={s.sottotitolo}>
            {t(stato.ambito.ambito === 'globale' ? 'modelloSenzaContesto' : 'modelloConContesto', { modello })}
          </span>
        </span>
        <button
          type="button"
          className={s.pill}
          onClick={() => setStato({ ...stato, ambito: nextScope(stato.origine, stato.ambito), conversazioneId: null })}
        >
          {nome && PILL[nome.ambito](nome)}
          <ChevronDown size={12} strokeWidth={2} className={s.chevron} />
        </button>
      </header>
      <div className={s.corpo}>
        {/* Un ambito nuovo è una chat nuova: risposta in arrivo ed errore restano a quella di prima */}
        <ChatPanel
          key={`${stato.ambito.ambito}:${stato.ambito.corsoId ?? ''}:${stato.ambito.moduloId ?? ''}:${stato.ambito.unitaId ?? ''}`}
          ambito={stato.ambito}
          conversazioneId={stato.conversazioneId}
          onConversazione={(id) => setStato((x) => x && { ...x, conversazioneId: id })}
        />
      </div>
    </div>
  );
}

const GRUPPO = { oggi: 'oggi', ieri: 'ieri', settimana: 'gruppoSettimana', prima: 'gruppoPrima' } as const;
const LISTA: Record<NomeAmbito['ambito'], (n: NomeAmbito) => string> = {
  unita: (n) => (n.ambito === 'unita' ? t('listaUnita', { n: n.unita }) : ''),
  modulo: (n) => (n.ambito === 'modulo' ? t('listaModulo', { n: n.modulo }) : ''),
  corso: (n) => (n.ambito === 'corso' ? t('listaCorso', { corso: n.corso }) : ''),
  globale: () => t('listaGlobale'),
};

/** S19 Conversazioni (`chat-history`): per età, con l'ambito, i messaggi e la data; il tocco riapre la conversazione. */
export function Conversations() {
  const indietro = useIndietro();
  const { inizioSettimana } = useSettings();
  const adesso = useMinuto();
  const [elenco, setElenco] = useState<Awaited<ReturnType<typeof readConversations>>>();
  useEffect(() => watch(() => readConversations(appDb), setElenco), []);
  if (!elenco) return null;
  const gruppi = conversationGroups(elenco, adesso, inizioSettimana);
  const data = (istante: number, gruppo: keyof typeof GRUPPO) =>
    gruppo === 'oggi'
      ? fmtOra.format(istante)
      : gruppo === 'ieri'
        ? t('ieriAlle', { ora: fmtOra.format(istante) })
        : gruppo === 'settimana'
          ? fmtData.format(istante)
          : fmtGiornoMese.format(istante);
  return (
    <div className={s.pagina}>
      <header className={s.testa}>
        <button type="button" className={s.icona} aria-label={t('indietro')} onClick={indietro}>
          <ChevronLeft size={18} />
        </button>
        <span className={s.titoli}>
          <span className={s.titolo}>{t('conversazioni')}</span>
          <span className={s.sottotitolo}>{t('cronologiaChat')}</span>
        </span>
      </header>
      {gruppi.length === 0 ? (
        <div className={s.vuoto}>
          <span className={s.disco}>
            <MessageSquare size={24} />
          </span>
          <span className={s.titoloVuoto}>{t('nessunaConversazione')}</span>
          <span className={s.testoVuoto}>{t('conversazioniVuoto')}</span>
        </div>
      ) : (
        <div className={s.elenco}>
          {gruppi.map((g) => (
            <section key={g.gruppo} className={s.gruppo}>
              <h2 className={s.etichettaGruppo}>{t(GRUPPO[g.gruppo])}</h2>
              <div className={s.card}>
                {g.conversazioni.map((c) => (
                  <Link key={c.id} to={`/chat?c=${encodeURIComponent(c.id)}`} className={s.riga}>
                    <span className={s.discoRiga} data-globale={c.nome.ambito === 'globale' || undefined}>
                      <MessageSquare size={16} />
                    </span>
                    <span className={s.testiRiga}>
                      <span className={s.titoloRiga}>{c.titolo}</span>
                      <span className={s.metaRiga}>
                        {LISTA[c.nome.ambito](c.nome)} · <span className={s.cifra}>{c.messaggi}</span>{' '}
                        {tn('messaggioUno', 'messaggiMolti', c.messaggi)}
                      </span>
                    </span>
                    <span className={s.data}>{data(c.ultimoMessaggio, g.gruppo)}</span>
                    <ChevronRight size={16} className={s.chevronRiga} />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
