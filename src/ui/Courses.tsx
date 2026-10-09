// Profilo → Corsi (S10 Corsi Mobile/Desktop; FUNZ §9.1, MECC §16). Senza corsi: «Carica esempio» e «Importa ZIP»;
// con corsi: elenco con badge «Esempio» e numeri contati dalle righe salvate (D-SAMPLE-1). Titolo chiesto solo se
// nello ZIP manca 00_struttura (D-PARSE-1); avvisi al massimo 5. La card apre il corso (S11, T-053) e dice la
// «Prossima» unità del puntatore; l'avanzamento dell'import non si mostra: la lettura è sincrona.
import { GraduationCap, SlidersVertical, Target, TriangleAlert, Upload } from 'lucide-react';
import { Link, Navigate, NavLink, useOutlet } from 'react-router';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { importSampleCourse, importZip, zipNeedsTitle } from '../app/courseImport';
import { MAX_BYTE_ZIP } from '../domain/codeFiles';
import { ErroreImportCorso, type CodiceAvviso } from '../domain/course/parser';
import { MAX_WARNINGS_SHOWN } from '../domain/course/parser';
import { courseCards, type SchedaCorso } from '../app/courses';
import { appDb, watch } from '../app/db';
import { useDesktop } from './desktop';
import { durataCorso } from './format';
import { t, type Chiave } from './i18n';
import { ProfileMenu } from './ProfileMenu';
import { SessionBannerSlot } from './SessionBanner';
import s from './Courses.module.css';

type Avvisi = Awaited<ReturnType<typeof importZip>>;
const AVVISO: Record<CodiceAvviso, Chiave> = {
  unita_illeggibile: 'avvisoUnitaIlleggibile',
  unita_sezioni: 'avvisoUnitaSezioni',
  modulo_senza_intestazione: 'avvisoModuloSenzaIntestazione',
  modulo_senza_tipo: 'avvisoModuloSenzaTipo',
  modulo_senza_prerequisiti: 'avvisoModuloSenzaPrerequisiti',
  unita_duplicata: 'avvisoUnitaDuplicata',
  modulo_duplicato: 'avvisoModuloDuplicato',
};
// `file` null: l'errore non viene dallo ZIP ma dal salvataggio
type Esito =
  | { tipo: 'titolo'; file: string; zip: Uint8Array }
  | { tipo: 'errore'; file: string | null }
  | ({ tipo: 'avvisi' } & Avvisi);

/** Le cifre di un testo nel font dei numeri (S10: «5 moduli · 13 unità · 11h 40m»). */
const cifre = (testo: string) =>
  testo.split(/(\d[\d:.,]*)/).map((x, i) =>
    i % 2 ? (
      <span key={i} className={s.num}>
        {x}
      </span>
    ) : (
      x
    ),
  );
const errore = (file: string, e: unknown): Esito => ({
  tipo: 'errore',
  file: e instanceof ErroreImportCorso ? file : null,
});

/**
 * Testata di S10 (Profilo / Corsi): logo del profilo su mobile, titolo con i numeri dei corsi, Impostazioni; su desktop
 * al posto di Impostazioni «Importa ZIP» (S10 Desktop r. 47-48).
 */
function Testa({ schede, importa }: { schede: SchedaCorso[] | undefined; importa?: ReactNode }) {
  const completate = schede?.reduce((n, c) => n + c.completate, 0) ?? 0;
  return (
    <>
      <header className={s.testa}>
        <span className={s.soloMobile}>
          <ProfileMenu variante="logo" />
        </span>
        <span className={s.titoli}>
          <h1 className={s.titoloPagina}>{t('corsi')}</h1>
          {schede && schede.length > 0 && (
            <span className={s.sottotitolo}>
              {t(schede.length === 1 ? 'unCorso' : 'nCorsi', { n: schede.length })} ·{' '}
              {t('unitaCompletateN', { n: completate })}
            </span>
          )}
        </span>
        <Link to="/impostazioni" className={`${s.impostazioni} ${s.soloMobile}`} aria-label={t('impostazioni')}>
          <SlidersVertical size={17} />
        </Link>
        {importa}
      </header>
      <SessionBannerSlot />
    </>
  );
}

export function Courses() {
  const [schede, setSchede] = useState<SchedaCorso[]>();
  const [esito, setEsito] = useState<Esito | null>(null);
  const scelta = useRef<HTMLInputElement>(null);
  useEffect(() => watch(() => courseCards(appDb), setSchede), []);

  const scegli = () => scelta.current?.click();

  const importa = async (file: string, zip: Uint8Array, titolo?: string) => {
    try {
      const r = await importZip(appDb, zip, Date.now(), titolo);
      setEsito(r.totaleAvvisi > 0 ? { tipo: 'avvisi', ...r } : null);
    } catch (e) {
      setEsito(errore(file, e));
    }
  };

  const esempio = () => importSampleCourse(appDb, Date.now()).catch(() => setEsito({ tipo: 'errore', file: null }));

  const zipScelto = async (f: File | undefined) => {
    if (!f) return;
    // Uno ZIP oltre il tetto di lettura non si apre nemmeno (D-IMPORT-2, lo stesso dei file di codice di D-CODE-1)
    if (f.size > MAX_BYTE_ZIP) return setEsito({ tipo: 'errore', file: f.name });
    const zip = new Uint8Array(await f.arrayBuffer());
    try {
      if (zipNeedsTitle(zip)) return setEsito({ tipo: 'titolo', file: f.name, zip });
    } catch (e) {
      return setEsito(errore(f.name, e));
    }
    await importa(f.name, zip);
  };

  const conTitolo = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (esito?.tipo !== 'titolo') return;
    void importa(esito.file, esito.zip, String(new FormData(e.currentTarget).get('titolo') ?? ''));
  };

  const input = (
    <input
      ref={scelta}
      type="file"
      accept=".zip,application/zip"
      hidden
      onChange={(e) => {
        void zipScelto(e.currentTarget.files?.[0]);
        e.currentTarget.value = ''; // lo stesso file si può scegliere di nuovo: ogni import crea un corso nuovo
      }}
    />
  );

  if (!schede) return <Testa schede={schede} />;

  if (schede.length === 0 && !esito)
    return (
      <>
        {/* Su desktop lo stato vuoto è solo il blocco, centrato (S10 Desktop r. 34-43) */}
        <div className={s.soloMobile}>
          <Testa schede={schede} />
        </div>
        <div className={s.vuoto}>
          <span className={s.iconaVuoto}>
            <GraduationCap size={24} />
          </span>
          <div className={s.testoVuoto}>
            <h2 className={s.titoloVuoto}>{t('corsiVuoto')}</h2>
            <p className={s.spiegazione}>{t('corsiVuotoTesto')}</p>
          </div>
          <div className={s.azioniVuoto}>
            <button type="button" className={s.primario} onClick={() => void esempio()}>
              {t('caricaEsempio')}
            </button>
            <button type="button" className={s.secondario} onClick={scegli}>
              <Upload size={16} />
              {t('importaZip')}
            </button>
          </div>
          {input}
        </div>
      </>
    );

  return (
    <>
      <Testa
        schede={schede}
        importa={
          <button type="button" className={`${s.pill} ${s.soloDesktop}`} onClick={scegli}>
            <Upload size={14} />
            {t('importaZip')}
          </button>
        }
      />
      <div className={s.elenco}>
        <div className={s.gruppo}>
          <span className={s.etichetta}>
            <GraduationCap size={14} />
            {t('corsi')}
          </span>
          <button type="button" className={s.pill} onClick={scegli}>
            <Upload size={14} />
            {t('importaZip')}
          </button>
          {input}
        </div>

        {esito?.tipo === 'titolo' && (
          <form className={s.card} onSubmit={conTitolo}>
            <label className={s.campo}>
              <span className={s.cardTitolo}>{t('titoloCorso')}</span>
              <span className={s.cardTesto}>{t('titoloCorsoAiuto', { file: esito.file })}</span>
              {/* eslint-disable-next-line jsx-a11y/no-autofocus -- il campo è l'unica cosa da fare dopo la scelta */}
              <input name="titolo" className={s.input} autoFocus />
            </label>
            <div className={s.azioni}>
              <button type="button" className={s.testuale} onClick={() => setEsito(null)}>
                {t('annulla')}
              </button>
              <button type="submit" className={s.secondario}>
                {t('importa')}
              </button>
            </div>
          </form>
        )}

        {esito?.tipo === 'errore' && (
          <div className={s.card} role="alert">
            <div className={s.riga}>
              <TriangleAlert size={18} className={s.errore} />
              <span className={s.colonna}>
                <span className={s.cardTitolo}>{t('importNonRiuscito')}</span>
                <span className={s.cardCorpo}>
                  {esito.file === null
                    ? t('salvataggioNonRiuscito')
                    : t('importNonRiuscitoTesto', { file: esito.file })}
                </span>
              </span>
            </div>
            <div className={s.azioni}>
              <button type="button" className={s.testuale} onClick={() => setEsito(null)}>
                {t('chiudi')}
              </button>
              <button type="button" className={s.secondario} onClick={scegli}>
                {t('altroFile')}
              </button>
            </div>
          </div>
        )}

        {esito?.tipo === 'avvisi' && (
          <div className={s.card} role="status">
            <div className={s.riga}>
              <TriangleAlert size={18} className={s.avviso} />
              <span className={s.colonna}>
                <span className={s.cardTitolo}>{t('importatoConAvvisi', { n: esito.totaleAvvisi })}</span>
                <span className={s.cardCorpo}>
                  {t('importatoConAvvisiTesto', {
                    moduli: esito.corso.moduli.length,
                    unita: esito.corso.numeroUnita,
                    max: MAX_WARNINGS_SHOWN,
                  })}
                </span>
              </span>
            </div>
            {/* Gli avvisi del parser si traducono dal loro codice (T-031, D-I18N-2) */}
            <ul className={s.avvisi}>
              {esito.avvisi.map((a, i) => (
                <li key={i}>
                  <span className={s.file}>{a.file}</span>: {t(AVVISO[a.codice], a.parametri)}
                </li>
              ))}
            </ul>
            <div className={s.azioni}>
              <button type="button" className={s.testuale} onClick={() => setEsito(null)}>
                {t('ok')}
              </button>
            </div>
          </div>
        )}

        {schede.map((c) => (
          // Su desktop la card del corso aperto (anche dentro un suo modulo o unità) è quella selezionata (aria-current)
          <NavLink key={c.id} to={`/corsi/${c.id}`} className={`${s.card} ${s.cardCorso}`}>
            <div className={s.intestazione}>
              <span className={s.colonna}>
                <h2 className={s.titoloCorso}>{c.titolo}</h2>
                <span className={s.cardTesto}>
                  {cifre(t('corsoNumeri', { moduli: c.moduli, unita: c.unita }))}
                  {/* Il tempo dedicato solo su mobile: S10 Desktop non lo mostra (D-DESIGN-1 n. 18) */}
                  <span className={s.tempo}>{cifre(t('corsoTempo', { tempo: durataCorso(c.minuti) }))}</span>
                </span>
              </span>
              {c.esempio && <span className={s.badge}>{t('esempio')}</span>}
            </div>
            <div className={s.progresso}>
              <progress className={s.barra} value={c.completate} max={c.unita || 1} aria-hidden />
              <span className={s.numero}>
                {t('corsoProgresso', { fatte: c.completate, unita: c.unita, pct: c.pct })}
              </span>
            </div>
            {c.prossima && (
              <span className={s.prossima}>
                <Target size={13} className={s.iconaProssima} />
                <span className={s.testoProssima}>
                  {t('prossima')} · <span className={s.num}>{c.prossima.numero}</span> {c.prossima.titolo}
                </span>
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </>
  );
}

/**
 * Corsi su desktop (S10 Corsi Desktop, handoff n. 71): l'elenco in una colonna di 320 e accanto il corso, il modulo o
 * l'unità, ognuno col suo scorrimento; all'apertura il primo corso, senza corsi lo stato vuoto da solo. Su mobile resta
 * una pagina alla volta.
 */
export function CorsiColonne() {
  const desktop = useDesktop();
  const figlio = useOutlet();
  const [schede, setSchede] = useState<SchedaCorso[]>();
  useEffect(() => watch(() => courseCards(appDb), setSchede), []);
  if (!desktop) return figlio ?? <Courses />;
  const primo = schede?.[0];
  if (!figlio) return primo ? <Navigate to={`/corsi/${encodeURIComponent(primo.id)}`} replace /> : <Courses />;
  return (
    <div className={s.colonne}>
      <div className={s.colonnaElenco}>
        <Courses />
      </div>
      <div className={s.colonnaPannello}>{figlio}</div>
    </div>
  );
}
