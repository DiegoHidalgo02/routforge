// Materiali dell'utente (T-024; FUNZ §10, MECC §17; D-MAT-1). «Tuoi» nella pagina dell'unità (S12: elenco, «Nuovo
// link», «Nuova nota · markdown», «PDF troppo grande», pill per aggiungere); il visualizzatore `/materiali/:id` (S13:
// le pagine del PDF disegnate dalla porta, o il testo della nota, mostrato senza HTML); lo spazio dei materiali in
// Impostazioni (S22) con «Elimina» e «Annulla» per 5 s, come il cestino di ogni riga di «Tuoi» (D-MAT-1).
import {
  ArrowUpRight,
  ChevronLeft,
  Code,
  ExternalLink,
  File,
  FileText,
  Folder,
  Plus,
  StickyNote,
  Trash2,
  TriangleAlert,
  User,
} from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { deleteUpload, readCode, restoreUpload, uploadCode } from '../app/codeFiles';
import { appDb, watch } from '../app/db';
import { logError } from '../app/diagnostics';
import {
  addLink,
  addNote,
  addPdf,
  deleteMaterial,
  materialsSpace,
  readMaterial,
  readMaterials,
  readPdf,
  renderPdfPage,
  restoreMaterial,
} from '../app/materials';
import { hostOf } from '../domain/course/parser';
import { isGroundable, type Materiale } from '../domain/materials';
import { IconaLink } from './Course';
import { lingua, t } from './i18n';
import { Section } from './Section';
import s from './Materials.module.css';

const unDecimale = new Intl.NumberFormat(lingua, { maximumFractionDigits: 1 });
/**
 * Dimensione di un file come nei mock: «0,4 MB», «84 KB» (base 1024, come il limite di 20 MB); `perEccesso` per il
 * rifiuto, così un file appena oltre il limite non si legge «20 MB».
 */
export const dimensione = (byte: number, perEccesso = false) =>
  byte >= 1024 * 1024
    ? `${unDecimale.format((perEccesso ? Math.ceil : Math.round)((byte / (1024 * 1024)) * 10) / 10)} MB`
    : `${byte > 0 ? Math.max(1, Math.round(byte / 1024)) : 0} KB`;
const fmtGiorno = new Intl.DateTimeFormat(lingua, { day: 'numeric', month: 'short' });
/** L'istante delle scritture, letto al gesto (fuori dal render). */
const adesso = () => Date.now();

type Aperto = 'link' | 'nota' | { file: string; byte: number } | null;

type RigaMateriale = Awaited<ReturnType<typeof readMaterials>>[number];

/** «Materiale eliminato · …» con «Annulla» per 5 s (S22; e le righe di «Tuoi», scelta dell'utente del 06/10/2026). */
function useAnnulla() {
  const [avviso, setAvviso] = useState<{ testo: string; annulla: () => void }>();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const mostra = (titolo: string, ripristina: () => Promise<unknown>) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setAvviso(undefined), 5000);
    setAvviso({
      testo: t('materialeEliminato', { titolo }),
      annulla: () => {
        clearTimeout(timer.current);
        setAvviso(undefined);
        void ripristina();
      },
    });
  };
  const toast = (
    <div className={s.regioneToast} role="status">
      {avviso && (
        <div className={s.toast}>
          <span className={s.puntoToast} data-tono="info" />
          <span className={s.testoToast}>{avviso.testo}</span>
          <button type="button" className={s.annullaToast} onClick={avviso.annulla}>
            {t('annullaAzione')}
          </button>
        </div>
      )}
    </div>
  );
  return { mostra, toast };
}

function Riga({ m }: { m: RigaMateriale }) {
  if (m.tipo === 'link')
    return (
      <a className={s.riga} href={m.url} target="_blank" rel="noopener noreferrer">
        <IconaLink host={hostOf(m.url ?? '')} youtube={/youtu\.?be/.test(m.url ?? '')} />
        <span className={s.testi}>
          <span className={s.titolo}>{m.titolo}</span>
          <span className={s.sotto}>{hostOf(m.url ?? '')}</span>
        </span>
        <ArrowUpRight size={14} className={s.freccia} />
      </a>
    );
  return (
    <Link className={s.riga} to={`/materiali/${encodeURIComponent(m.id)}`}>
      {m.tipo === 'nota' ? <StickyNote size={16} className={s.icona} /> : <FileText size={16} className={s.icona} />}
      <span className={s.testi}>
        {m.tipo === 'nota' ? (
          <>
            <span className={s.titolo}>
              {m.titolo} · <span className={s.num}>{fmtGiorno.format(m.createdAt)}</span>
            </span>
            <span className={s.sotto}>{m.testo?.split('\n').find((x) => x.trim())}</span>
          </>
        ) : (
          <>
            <span className={s.titolo}>{m.titolo}</span>
            <span className={s.stato} data-attivo={isGroundable(m) || undefined}>
              <span className={s.num}>{dimensione(m.byte ?? 0)}</span> · <span className={s.pallino} />
              {t(isGroundable(m) ? 'testoEstrattoAi' : 'senzaTestoAi')}
            </span>
          </>
        )}
      </span>
    </Link>
  );
}

/** «Tuoi» (S12): i materiali dell'unità, i moduli per aggiungerli, il rifiuto del PDF oltre 20 MB. */
export function TuoiMateriali({ corsoId, unitaId }: { corsoId: string; unitaId: string }) {
  const [materiali, setMateriali] = useState<RigaMateriale[]>([]);
  const [aperto, setAperto] = useState<Aperto>(null);
  const [lavoro, setLavoro] = useState(false);
  // Una scrittura fallita (spazio esaurito, database) resta aperta col suo avviso e va in Diagnostica (INV-16)
  const [errore, setErrore] = useState(false);
  const fallito = (e: unknown) => {
    logError('materiali', e);
    setErrore(true);
  };
  const chiudi = () => {
    setErrore(false);
    setAperto(null);
  };
  const scelta = useRef<HTMLInputElement>(null);
  const { mostra, toast } = useAnnulla();
  useEffect(() => watch(() => readMaterials(appDb, unitaId), setMateriali), [unitaId]);
  const posto = { corsoId, unitaId };
  const elimina = (m: RigaMateriale) =>
    void deleteMaterial(appDb, m.id, adesso()).then(
      (copia) => copia && mostra(m.titolo, () => restoreMaterial(appDb, copia, adesso())),
      fallito,
    );

  const salvaLink = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void addLink(appDb, posto, String(f.get('titolo') ?? ''), String(f.get('indirizzo') ?? ''), adesso()).then(
      (m) => m && chiudi(),
      fallito,
    );
  };
  const salvaNota = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void addNote(appDb, posto, String(f.get('titolo') ?? ''), String(f.get('testo') ?? ''), adesso()).then(
      chiudi,
      fallito,
    );
  };
  const pdfScelto = async (file: File | undefined) => {
    if (!file) return;
    setLavoro(true);
    try {
      const r = await addPdf(
        appDb,
        posto,
        { nome: file.name, byte: file.size, leggi: async () => new Uint8Array(await file.arrayBuffer()) },
        adesso(),
      );
      setAperto(r.esito === 'troppo_grande' ? { file: file.name, byte: r.byte } : null);
    } catch (e) {
      fallito(e);
    } finally {
      setLavoro(false);
    }
  };

  return (
    <section className={s.tuoi}>
      <div className={s.testa}>
        <span className={s.etichetta}>
          <User size={14} />
          {t('tuoi')}
        </span>
        {materiali.length > 0 && <span className={s.conteggio}>{t('restanoReimport', { n: materiali.length })}</span>}
      </div>
      {materiali.length > 0 && (
        <div className={s.elenco}>
          {materiali.map((m) => (
            <div key={m.id} className={s.rigaTuoi}>
              <Riga m={m} />
              <button
                type="button"
                className={s.eliminaRiga}
                aria-label={t('eliminaMateriale', { titolo: m.titolo })}
                title={t('elimina')}
                onClick={() => elimina(m)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
      {aperto === 'link' && (
        <form className={s.modulo} onSubmit={salvaLink}>
          <span className={s.etichettaModulo}>{t('nuovoLink')}</span>
          <input
            name="titolo"
            className={s.campo}
            aria-label={t('titoloDelLink')}
            placeholder={t('segnapostoTitolo')}
          />
          <input
            name="indirizzo"
            className={`${s.campo} ${s.num}`}
            aria-label={t('indirizzoDelLink')}
            placeholder={t('segnapostoIndirizzo')}
            inputMode="url"
            autoCapitalize="off"
            required
          />
          <span className={s.nota}>{t('protocolloAutomatico')}</span>
          <span className={s.azioni}>
            <button type="button" className={s.fantasma} onClick={() => setAperto(null)}>
              {t('annulla')}
            </button>
            <button type="submit" className={s.secondario}>
              {t('aggiungiLink')}
            </button>
          </span>
        </form>
      )}
      {aperto === 'nota' && (
        <form className={s.modulo} onSubmit={salvaNota}>
          <span className={s.etichettaModulo}>{t('nuovaNota')}</span>
          <input
            name="titolo"
            className={s.campo}
            aria-label={t('titoloDellaNota')}
            placeholder={t('segnapostoTitolo')}
          />
          <textarea
            name="testo"
            className={s.area}
            aria-label={t('testoDellaNota')}
            placeholder={t('scriviInMarkdown')}
            required
          />
          <span className={s.nota}>{t('noteNelContesto')}</span>
          <span className={s.azioni}>
            <button type="button" className={s.fantasma} onClick={() => setAperto(null)}>
              {t('annulla')}
            </button>
            <button type="submit" className={s.secondario}>
              {t('salvaNota')}
            </button>
          </span>
        </form>
      )}
      {aperto && typeof aperto === 'object' && (
        <div className={s.modulo} role="alert">
          <span className={s.rifiuto}>
            <TriangleAlert size={18} className={s.allarme} />
            <span className={s.testiRifiuto}>
              <span className={s.titoloRifiuto}>{t('pdfTroppoGrande')}</span>
              <span className={s.nota}>
                {t('pdfTroppoGrandeTesto', { file: aperto.file, mb: dimensione(aperto.byte, true) })}
              </span>
            </span>
          </span>
          <span className={s.azioni}>
            <button type="button" className={s.fantasma} onClick={() => setAperto(null)}>
              {t('chiudi')}
            </button>
            <button type="button" className={s.secondario} onClick={() => scelta.current?.click()}>
              {t('scegliAltroFile')}
            </button>
          </span>
        </div>
      )}
      {errore && (
        <span className={s.nota} role="alert">
          {t('nonSalvato')}
        </span>
      )}
      <div className={s.pill}>
        <button type="button" onClick={() => setAperto('link')}>
          <Plus size={14} strokeWidth={2} />
          {t('pillLink')}
        </button>
        <button type="button" onClick={() => setAperto('nota')}>
          <Plus size={14} strokeWidth={2} />
          {t('pillNota')}
        </button>
        <button type="button" disabled={lavoro} aria-busy={lavoro} onClick={() => scelta.current?.click()}>
          <Plus size={14} strokeWidth={2} />
          {t('pillPdf')} <span className={s.limite}>{t('max20Mb')}</span>
        </button>
      </div>
      <input
        ref={scelta}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          void pdfScelto(e.currentTarget.files?.[0]);
          e.currentTarget.value = '';
        }}
      />
      {toast}
    </section>
  );
}

/** Dimensione di un file di codice: «2,1 KB». */
const dimensioneFine = (byte: number) =>
  byte >= 1024 * 1024 ? dimensione(byte) : `${unDecimale.format(Math.max(0.1, byte / 1024))} KB`;

/**
 * «File di codice» (S12, T-025; MECC §17): l'albero dei file caricati con gli esclusi, i contatori e la pill per file o
 * ZIP. Il contenuto non si mostra: serve solo all'AI.
 */
export function CodiceUnita({ corsoId, unitaId }: { corsoId: string; unitaId: string }) {
  const [v, setV] = useState<Awaited<ReturnType<typeof readCode>>>();
  const [lavoro, setLavoro] = useState(false);
  const [errore, setErrore] = useState(false);
  const scelta = useRef<HTMLInputElement>(null);
  useEffect(() => watch(() => readCode(appDb, unitaId), setV), [unitaId]);
  const carica = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setLavoro(true);
    try {
      // La lettura è pigra: un file escluso o uno ZIP oltre il tetto non si legge nemmeno (D-CODE-1)
      const scelti = [...lista].map((f) => ({
        nome: f.name,
        byte: f.size,
        leggi: async () => new Uint8Array(await f.arrayBuffer()),
      }));
      await uploadCode(appDb, { corsoId, unitaId }, scelti, adesso());
      setErrore(false);
    } catch (e) {
      logError('materiali', e);
      setErrore(true);
    } finally {
      setLavoro(false);
    }
  };
  const pieno = v && v.righe.length > 0;
  return (
    <section className={s.tuoi}>
      <div className={s.testa}>
        <span className={s.etichetta}>
          <Code size={14} />
          {t('fileDiCodice')}
        </span>
        {pieno && <span className={s.conteggio}>{t('contatoreCodice', { n: v.file, m: v.esclusi })}</span>}
      </div>
      {pieno ? (
        <div className={s.albero}>
          {v.righe.map((r) => (
            <span
              key={r.percorso}
              className={s.rigaAlbero}
              data-escluso={r.motivo ? '' : undefined}
              style={{ '--livello': r.livello } as CSSProperties}
            >
              {r.cartella ? (
                <Folder size={13} className={s.iconaAlbero} />
              ) : (
                <File size={13} className={s.iconaAlbero} />
              )}
              <span className={s.nomeFile}>{r.nome}</span>
              {(r.motivo || !r.cartella) && (
                <span className={s.metaFile}>{r.motivo ? t('esclusoBreve') : dimensioneFine(r.byte ?? 0)}</span>
              )}
            </span>
          ))}
          <span className={s.notaCodice}>{t('notaCodice')}</span>
        </div>
      ) : (
        <span className={s.notaCodice}>{t('notaCodice')}</span>
      )}
      {errore && (
        <span className={s.nota} role="alert">
          {t('nonSalvato')}
        </span>
      )}
      <div className={s.pill}>
        <button type="button" disabled={lavoro} aria-busy={lavoro} onClick={() => scelta.current?.click()}>
          <Plus size={14} strokeWidth={2} />
          {t('fileOZip')}
        </button>
      </div>
      <input
        ref={scelta}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void carica(e.currentTarget.files);
          e.currentTarget.value = '';
        }}
      />
    </section>
  );
}

type Vista = Awaited<ReturnType<typeof readMaterial>>;

/** Una pagina del PDF: si disegna quando entra nello schermo. */
function Pagina({ dati, numero, onVista }: { dati: Uint8Array; numero: number; onVista: (n: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let url: string | undefined;
    let disegnata = false;
    const osserva = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        onVista(numero);
        if (disegnata) return;
        disegnata = true;
        void renderPdfPage(dati, numero, Math.round(el.clientWidth * devicePixelRatio)).then((png) => {
          if (!png) return;
          url = URL.createObjectURL(new Blob([png.slice()], { type: 'image/png' }));
          setSrc(url);
        });
      },
      { threshold: 0.5 },
    );
    osserva.observe(el);
    return () => {
      osserva.disconnect();
      if (url) URL.revokeObjectURL(url);
    };
  }, [dati, numero, onVista]);
  return (
    <div ref={ref} className={s.pagina}>
      <span className={s.numeroPagina}>{numero}</span>
      {src && <img src={src} alt="" className={s.immagine} />}
    </div>
  );
}

/** Il visualizzatore (S13, `/materiali/:id`): le pagine del PDF, o il testo della nota. */
export function MaterialViewer() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const primaSchermata = useLocation().key === 'default';
  const [m, setM] = useState<Vista>();
  const [dati, setDati] = useState<Uint8Array | null>(null);
  const [corrente, setCorrente] = useState(1);
  useEffect(() => watch(() => readMaterial(appDb, id), setM), [id]);
  useEffect(() => void readPdf(appDb, id).then(setDati), [id]);
  if (m === undefined) return null;
  if (m === null) return <Section titolo="tuoi" indietro />;
  const pagine = m.pagine ?? 0;
  const attivo = isGroundable(m);
  const meta = [
    m.numeroUnita ? t('tuoiUnita', { n: m.numeroUnita }) : t('tuoi'),
    ...(m.tipo === 'pdf'
      ? [
          dimensione(m.byte ?? 0),
          t('pagineN', { n: pagine }),
          t(attivo ? 'testoEstrattoGroundabile' : 'scansionatoPassivo'),
        ]
      : [t('notaBreve')]),
  ].join(' · ');
  const esterna = () => {
    if (!dati) return;
    const url = URL.createObjectURL(new Blob([dati.slice()], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className={s.visore}>
      <div className={s.cimaVisore}>
        <header className={s.testaVisore}>
          <button
            type="button"
            className={s.iconaBottone}
            aria-label={t('indietro')}
            onClick={() => (primaSchermata ? navigate('/') : navigate(-1))}
          >
            <ChevronLeft size={18} />
          </button>
          <span className={s.testiVisore}>
            <h1 className={s.nome}>{m.titolo}</h1>
            <span className={s.sotto}>{meta}</span>
          </span>
          {m.tipo === 'pdf' && (
            <button
              type="button"
              className={s.iconaBottone}
              aria-label={t('apriConAppEsterna')}
              title={t('apriConAppEsterna')}
              onClick={esterna}
            >
              <ExternalLink size={17} />
            </button>
          )}
        </header>
        {m.tipo === 'pdf' && pagine > 0 && (
          <div className={s.barraVisore}>
            <span className={s.num}>{t('paginaDi', { n: corrente, totale: pagine })}</span>
            <span className={s.traccia}>
              <span style={{ width: `${(corrente / pagine) * 100}%` }} />
            </span>
            <span className={s.stato} data-attivo={attivo || undefined}>
              <span className={s.pallino} />
              {t(attivo ? 'testoEstrattoBreve' : 'passivoBreve')}
            </span>
          </div>
        )}
      </div>
      {m.tipo === 'nota' ? (
        <div className={s.testoNota}>{m.testo}</div>
      ) : (
        <div className={s.pagine}>
          {dati &&
            Array.from({ length: pagine }, (_, i) => (
              <Pagina key={i} dati={dati} numero={i + 1} onVista={setCorrente} />
            ))}
        </div>
      )}
    </div>
  );
}

/** Impostazioni → Spazio dei materiali (S22, MECC §17): per tipo, dal più pesante, con «Elimina» e «Annulla». */
export function MaterialsSpace() {
  const [v, setV] = useState<Awaited<ReturnType<typeof materialsSpace>>>();
  const { mostra, toast } = useAnnulla();
  useEffect(() => watch(() => materialsSpace(appDb), setV), []);
  const elimina = async (m: Materiale) => {
    const copia = await deleteMaterial(appDb, m.id, adesso());
    if (copia) mostra(m.titolo, () => restoreMaterial(appDb, copia, adesso()));
  };
  const totale = v ? v.pdf + v.altri + v.codice : 0;
  const eliminaCaricamento = async (c: NonNullable<typeof v>['caricamenti'][number], nome: string) => {
    const righe = await deleteUpload(appDb, c.caricamento, adesso());
    mostra(nome, () => restoreUpload(appDb, righe, adesso()));
  };
  const pdf = v?.righe.filter((m) => m.tipo === 'pdf') ?? [];
  return (
    <div className={s.paginaSpazio}>
      <Section titolo="spazioMateriali" indietro sottotitolo={t('impostazioni')} />
      {v && (
        <div className={s.cartaSpazio}>
          <span className={s.barra} aria-hidden>
            <span style={{ width: `${totale ? (v.pdf / totale) * 100 : 0}%` }} />
            <span style={{ width: `${totale ? (v.altri / totale) * 100 : 0}%` }} />
            <span style={{ width: `${totale ? (v.codice / totale) * 100 : 0}%` }} />
          </span>
          <span className={s.legenda}>
            <span>
              <span className={s.quadratino} data-pdf />
              {t('pdfSpazio', { spazio: dimensione(v.pdf), n: pdf.length })}
            </span>
            <span>
              <span className={s.quadratino} />
              {t('noteLinkSpazio', { spazio: dimensione(v.altri), n: v.righe.length - pdf.length })}
            </span>
            <span>
              <span className={s.quadratino} data-codice />
              {t('fileCodiceSpazio', {
                spazio: dimensione(v.codice),
                n: v.caricamenti.reduce((n, c) => n + c.file, 0),
              })}
            </span>
          </span>
          {v.caricamenti.map((c) => {
            const nome = c.nome || t('nFile', { n: c.file });
            return (
              <div key={c.caricamento} className={s.rigaSpazio}>
                <span className={s.testi}>
                  <span className={s.nomeSpazio}>{nome}</span>
                  <span className={s.sotto}>
                    {[
                      c.numeroUnita ? t('tuoiUnita', { n: c.numeroUnita }) : t('delCorso'),
                      t('nFile', { n: c.file }),
                    ].join(' · ')}
                  </span>
                </span>
                <span className={`${s.num} ${s.peso}`}>{dimensione(c.byte)}</span>
                <button type="button" className={s.elimina} onClick={() => void eliminaCaricamento(c, nome)}>
                  {t('elimina')}
                </button>
              </div>
            );
          })}
          {v.righe.length + v.caricamenti.length === 0 ? (
            <span className={s.nota}>{t('nessunMateriale')}</span>
          ) : (
            v.righe.map((m) => (
              <div key={m.id} className={s.rigaSpazio}>
                <span className={s.testi}>
                  <span className={s.nomeSpazio}>{m.titolo}</span>
                  <span className={s.sotto}>
                    {m.numeroUnita ? t('tuoiUnita', { n: m.numeroUnita }) : t('delCorso')}
                  </span>
                </span>
                <span className={`${s.num} ${s.peso}`}>{dimensione(m.peso)}</span>
                <button type="button" className={s.elimina} onClick={() => void elimina(m)}>
                  {t('elimina')}
                </button>
              </div>
            ))
          )}
        </div>
      )}
      {toast}
    </div>
  );
}
