// Profilo → Corsi (S10 Corsi Mobile/Desktop; FUNZ §9.1, MECC §16). Senza corsi: «Carica esempio» e «Importa ZIP»;
// con corsi: elenco con badge «Esempio» e numeri contati dalle righe salvate (D-SAMPLE-1). Titolo chiesto solo se
// nello ZIP manca 00_struttura (D-PARSE-1); avvisi al massimo 5. Dettaglio del corso (S11) e «Prossima» con il
// puntatore arrivano con il loro task; l'avanzamento dell'import non si mostra: la lettura è sincrona.
import { GraduationCap, TriangleAlert, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ErroreImportCorso, importSampleCourse, importZip, zipNeedsTitle } from '../app/courseImport';
import { MAX_WARNINGS_SHOWN } from '../domain/course/parser';
import { watchCourseCards, type SchedaCorso } from '../app/courses';
import { appDb } from '../app/db';
import { t } from './i18n';
import { Section } from './Section';
import s from './Courses.module.css';

type Avvisi = Awaited<ReturnType<typeof importZip>>;
// `file` null: l'errore non viene dallo ZIP ma dal salvataggio
type Esito =
  | { tipo: 'titolo'; file: string; zip: Uint8Array }
  | { tipo: 'errore'; file: string | null }
  | ({ tipo: 'avvisi' } & Avvisi);

const durata = (min: number) => t('durata', { h: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') });
const errore = (file: string, e: unknown): Esito => ({
  tipo: 'errore',
  file: e instanceof ErroreImportCorso ? file : null,
});

export function Courses() {
  const [schede, setSchede] = useState<SchedaCorso[]>();
  const [esito, setEsito] = useState<Esito | null>(null);
  const scelta = useRef<HTMLInputElement>(null);
  useEffect(() => watchCourseCards(appDb, setSchede), []);

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

  if (!schede) return <Section titolo="corsi" />;

  if (schede.length === 0 && !esito)
    return (
      <>
        <Section titolo="corsi" />
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
      <Section titolo="corsi" />
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
            {/* I messaggi del parser sono in italiano fino a T-031 (D-I18N-2) */}
            <ul className={s.avvisi}>
              {esito.avvisi.map((a, i) => (
                <li key={i}>
                  <span className={s.file}>{a.file}</span>: {a.messaggio}
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
          <article key={c.id} className={s.card}>
            <div className={s.intestazione}>
              <span className={s.colonna}>
                <h2 className={s.titoloCorso}>{c.titolo}</h2>
                <span className={s.cardTesto}>
                  {t('corsoNumeri', { moduli: c.moduli, unita: c.unita, tempo: durata(c.minuti) })}
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
          </article>
        ))}
      </div>
    </>
  );
}
