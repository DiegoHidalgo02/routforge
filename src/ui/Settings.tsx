// Impostazioni (S22, `/impostazioni`; FUNZ §23, §7.7; MECC §13; T-032). Radice a gruppi (Generale, Account, Dati,
// Avanzate) con le righe del mock; Animazioni, Celebrazioni, Feedback aptico e Inizio settimana non hanno una vista nel
// mock: la riga apre il selettore del sistema (D-IMPOST-1). Notifiche (`/impostazioni/notifiche`): generale, per tipo
// (avvisi, anticipo, silenzioso; un tipo aperto per volta), digest del mattino, permesso e notifica di prova, che chiede
// il permesso col gesto (D-NOTIF-2 n. 6). Informazioni con la versione della build. Account, AI, backup, materiali ed
// eliminazione dei dati arrivano coi loro task (T-033, T-026, T-030, T-024).
import { Check, ChevronRight, TriangleAlert, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { eraseAllData, exportBackup, importBackup, lastBackup, readBackup, type BackupLetto } from '../app/backup';
import { appDb, watch } from '../app/db';
import { logError, readDiagnostics, type Diagnostica } from '../app/diagnostics';
import { readInbox } from '../app/inbox';
import { materialsSpace } from '../app/materials';
import {
  editNotificationSettings,
  readNotificationPermissions,
  readNotificationSettings,
  sendTestNotification,
} from '../app/notifications';
import type { PermessiNotifiche } from '../app/ports/notifications';
import { doNotDisturbAccess } from '../app/sessionDevice';
import { saveSettings } from '../app/settings';
import type { ImpostazioniNotifiche, ImpostazioniTipo } from '../domain/notifications/desiredSet';
import type { Impostazioni } from '../domain/settings';
import type { TipoBlocco } from '../domain/types';
import { useMinuto } from './clock';
import { maiuscola } from './format';
import { lingua, t, type Chiave } from './i18n';
import { animazioniRidotte, useSettings } from './preferenze';
import { dimensione } from './Materials';
import { Section } from './Section';
import s from './Settings.module.css';

/** «Backup · 11 set» della radice (S22). */
const fmtGiornoBackup = new Intl.DateTimeFormat(lingua, { day: 'numeric', month: 'short' });

const giornoSettimana = (g: 0 | 1) =>
  maiuscola(new Intl.DateTimeFormat(lingua, { weekday: 'long' }).format(new Date(2026, 8, 20 + g)));

function Gruppo({ titolo, children, spento }: { titolo?: string; children: ReactNode; spento?: boolean }) {
  return (
    <section className={s.gruppo} data-spento={spento || undefined}>
      {titolo && <h2 className={s.etichettaGruppo}>{titolo}</h2>}
      <div className={s.card}>{children}</div>
    </section>
  );
}

type Tono = 'successo' | 'avviso' | 'chiaro';

function RigaLink(p: { etichetta: string; valore?: string; tono?: Tono; to?: string; pericolo?: boolean }) {
  const dentro = (
    <>
      <span className={s.etichettaRiga} data-pericolo={p.pericolo || undefined}>
        {p.etichetta}
      </span>
      {p.valore && (
        <span className={s.valore} data-tono={p.tono}>
          {p.valore}
        </span>
      )}
      <ChevronRight size={16} className={s.chevron} />
    </>
  );
  return p.to ? (
    <Link to={p.to} className={s.riga}>
      {dentro}
    </Link>
  ) : (
    <button type="button" className={s.riga} disabled>
      {dentro}
    </button>
  );
}

/** Riga di scelta: il valore del mock e, sopra la riga, il selettore del sistema (D-IMPOST-1). */
function RigaScelta<T extends string | number | boolean>(p: {
  etichetta: string;
  valore: T;
  opzioni: readonly (readonly [T, string])[];
  onScegli: (v: T) => void;
}) {
  return (
    <label className={s.riga}>
      <span className={s.etichettaRiga}>{p.etichetta}</span>
      <span className={s.valore}>{p.opzioni.find(([v]) => v === p.valore)?.[1]}</span>
      <ChevronRight size={16} className={s.chevron} />
      <select
        className={s.selettore}
        value={p.opzioni.findIndex(([v]) => v === p.valore)}
        onChange={(e) => {
          const scelta = p.opzioni[Number(e.currentTarget.value)];
          if (scelta) p.onScegli(scelta[0]);
        }}
      >
        {p.opzioni.map(([, nome], i) => (
          <option key={nome} value={i}>
            {nome}
          </option>
        ))}
      </select>
    </label>
  );
}

function Interruttore(p: { acceso: boolean; etichetta: string; onCambia: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={p.acceso}
      aria-label={p.etichetta}
      className={s.interruttore}
      onClick={() => p.onCambia(!p.acceso)}
    />
  );
}

export function Settings() {
  const v = useSettings();
  const [notifiche, setNotifiche] = useState<ImpostazioniNotifiche>();
  const [esiti, setEsiti] = useState<number>();
  useEffect(() => watch(() => readNotificationSettings(appDb), setNotifiche), []);
  useEffect(
    () =>
      watch(
        () => readInbox(appDb, Date.now()),
        (i) => setEsiti(i.esiti.length),
      ),
    [],
  );
  const [ultimoBackup, setUltimoBackup] = useState<number | null>(null);
  useEffect(() => watch(() => lastBackup(appDb), setUltimoBackup), []);
  const [spazio, setSpazio] = useState<number>();
  useEffect(
    () =>
      watch(
        () => materialsSpace(appDb),
        (x) => setSpazio(x.pdf + x.altri + x.codice),
      ),
    [],
  );
  const attivi = notifiche ? Object.values(notifiche.perTipo).filter((x) => x.attivo).length : 0;

  return (
    <div className={s.pagina}>
      <Section titolo="impostazioni" indietro />
      <div className={s.viste}>
        <Gruppo titolo={t('generale')}>
          <RigaLink
            etichetta={t('notifiche')}
            valore={
              notifiche &&
              (!notifiche.generale || attivi === 0
                ? t('notificheSpente')
                : attivi === 1
                  ? t('unTipoAttivo')
                  : t('tipiAttivi', { n: attivi }))
            }
            to="/impostazioni/notifiche"
          />
          <RigaLink
            etichetta={t('esitiDaRegistrareRiga')}
            valore={esiti === undefined ? undefined : String(esiti)}
            tono="chiaro"
            to="/notifiche"
          />
          <RigaScelta
            etichetta={t('animazioni')}
            valore={v.animazioni}
            opzioni={[
              ['auto', t('animazioniAuto')],
              ['sempre', t('animazioniSempre')],
              ['mai', t('animazioniMai')],
            ]}
            onScegli={(animazioni) => salva({ animazioni })}
          />
          <RigaScelta
            etichetta={t('celebrazioni')}
            valore={v.celebrazioni}
            opzioni={[
              ['sobria', t('celebrazioniSobria')],
              ['piena', t('celebrazioniPiena')],
              ['off', t('celebrazioniOff')],
            ]}
            onScegli={(celebrazioni) => salva({ celebrazioni })}
          />
          <RigaScelta
            etichetta={t('feedbackAptico')}
            valore={v.aptico}
            opzioni={[
              [true, t('acceso')],
              [false, t('spento')],
            ]}
            onScegli={(aptico) => salva({ aptico })}
          />
          <RigaScelta
            etichetta={t('inizioSettimana')}
            valore={v.inizioSettimana}
            opzioni={[
              [1, giornoSettimana(1)],
              [0, giornoSettimana(0)],
            ]}
            onScegli={(inizioSettimana) => salva({ inizioSettimana })}
          />
        </Gruppo>
        <Gruppo titolo={t('gruppoAccount')}>
          <RigaLink etichetta={t('account')} to="/account" />
          <RigaLink etichetta={t('modelloChiaveAi')} valore={t('nessunaChiave')} tono="avviso" to="/impostazioni/ai" />
        </Gruppo>
        <Gruppo titolo={t('gruppoDati')}>
          <RigaLink
            etichetta={t('backupRiga')}
            valore={ultimoBackup === null ? undefined : fmtGiornoBackup.format(ultimoBackup)}
            to="/impostazioni/backup"
          />
          <RigaLink
            etichetta={t('spazioMateriali')}
            valore={spazio ? dimensione(spazio) : undefined}
            to="/impostazioni/materiali"
          />
          <RigaLink etichetta={t('eliminaTuttiIDati')} pericolo to="/impostazioni/backup" />
        </Gruppo>
        <Gruppo titolo={t('avanzate')}>
          <RigaLink etichetta={t('diagnostica')} to="/diagnostica" />
          <RigaLink etichetta={t('informazioni')} to="/impostazioni/informazioni" />
        </Gruppo>
      </div>
    </div>
  );
}

/** I tipi nell'ordine del mock. */
const TIPI: [TipoBlocco, Chiave][] = [
  ['studio', 'routineDiStudio'],
  ['todo', 'todoConOrario'],
  ['routine', 'tipoRoutine'],
  ['evento', 'eventi'],
];
/** Anticipi del mock: Inizio · 5' · 10' · 15' · 30' · 1 h · 1 g (in minuti). */
const ANTICIPI = [0, 5, 10, 15, 30, 60, 1440];
const anticipo = (m: number) =>
  m === 0
    ? t('anticipoInizioBreve')
    : m % 1440 === 0
      ? t('giorniBreviSpazio', { n: m / 1440 })
      : m % 60 === 0
        ? t('oreBreviSpazio', { n: m / 60 })
        : t('minutiApice', { n: m });

// Scritture fuori dai componenti: l'istante si legge al gesto
const salva = (m: Partial<Impostazioni>) => void saveSettings(appDb, m, Date.now());
const cambia = (f: (x: ImpostazioniNotifiche) => ImpostazioniNotifiche) =>
  void editNotificationSettings(appDb, f, Date.now());

type Permesso = PermessiNotifiche['notifiche'];

export function NotificationSettings() {
  const [v, setV] = useState<ImpostazioniNotifiche>();
  const [aperto, setAperto] = useState<TipoBlocco | null>(null);
  // Il permesso viene dalla porta delle notifiche: dal browser sul web, dal sistema su Android (T-021)
  const [permesso, setPermesso] = useState<Permesso>(null);
  const rileggi = () => void readNotificationPermissions().then((p) => setPermesso(p.notifiche));
  useEffect(rileggi, []);
  useEffect(() => watch(() => readNotificationSettings(appDb), setV), []);
  if (!v) return <Section titolo="notifiche" indietro sottotitolo={t('impostazioni')} />;

  const tipo = (k: TipoBlocco, f: (x: ImpostazioniTipo) => ImpostazioniTipo) =>
    cambia((x) => ({ ...x, perTipo: { ...x.perTipo, [k]: f(x.perTipo[k]) } }));
  const prova = () => void sendTestNotification(Date.now()).finally(rileggi);

  return (
    <div className={s.pagina}>
      <Section titolo="notifiche" indietro sottotitolo={t('impostazioni')} />
      <div className={s.viste}>
        <Gruppo>
          <div className={s.riga} data-alta>
            <span className={s.etichettaRiga}>{t('notifiche')}</span>
            <Interruttore
              acceso={v.generale}
              etichetta={t('notifiche')}
              onCambia={(generale) => cambia((x) => ({ ...x, generale }))}
            />
          </div>
        </Gruppo>
        <Gruppo titolo={t('perTipo')} spento={!v.generale}>
          {TIPI.map(([k, nome]) => {
            const x = v.perTipo[k];
            const apri = aperto === k;
            return (
              <div key={k} className={s.tipo} data-tipo={k}>
                <button
                  type="button"
                  className={s.riga}
                  aria-expanded={apri}
                  onClick={() => setAperto(apri ? null : k)}
                >
                  <span className={s.pallino} />
                  <span className={s.etichettaRiga}>{t(nome)}</span>
                  <span className={s.valore} data-tono={x.attivo ? 'chiaro' : 'spento'}>
                    {x.attivo ? anticipo(x.anticipi[0] ?? 0) : t('celebrazioniOff')}
                  </span>
                  {x.attivo && x.silenzioso && <VolumeX size={13} className={s.muto} aria-label={t('silenzioso')} />}
                  <ChevronRight size={16} className={s.chevron} data-aperto={apri || undefined} />
                </button>
                {apri && (
                  <div className={s.pannello}>
                    <div className={s.sottoRiga}>
                      <span className={s.etichettaSotto}>{t('avvisiTipo')}</span>
                      <Interruttore
                        acceso={x.attivo}
                        etichetta={t(nome)}
                        onCambia={(attivo) => tipo(k, (y) => ({ ...y, attivo }))}
                      />
                    </div>
                    {x.attivo && (
                      <>
                        <span className={s.etichettaAnticipo}>{t('anticipoTitolo')}</span>
                        <div className={s.chip} role="group" aria-label={t('anticipoTitolo')}>
                          {ANTICIPI.map((m) => (
                            <button
                              key={m}
                              type="button"
                              aria-pressed={x.anticipi[0] === m}
                              onClick={() => tipo(k, (y) => ({ ...y, anticipi: [m] }))}
                            >
                              {anticipo(m)}
                            </button>
                          ))}
                        </div>
                        <div className={s.sottoRiga}>
                          <span className={s.testi}>
                            <span className={s.etichettaSotto}>{t('silenzioso')}</span>
                            <span className={s.sottotitolo}>{t('silenziosoTesto')}</span>
                          </span>
                          <Interruttore
                            acceso={x.silenzioso}
                            etichetta={t('silenzioso')}
                            onCambia={(silenzioso) => tipo(k, (y) => ({ ...y, silenzioso }))}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Gruppo>
        <Gruppo titolo={t('digestGruppo')}>
          <div className={s.riga}>
            <span className={s.testi}>
              <span className={s.etichettaRiga}>{t('digestMattino')}</span>
              <span className={s.sottotitolo}>{t('digestTesto')}</span>
            </span>
            <span className={s.ora}>{v.digest.orario}</span>
          </div>
        </Gruppo>
        {permesso && (
          <Gruppo titolo={t('sistemaGruppo')}>
            <div className={s.permesso} data-permesso={permesso}>
              <span className={s.pallinoStato} />
              <span className={s.testi}>
                <span className={s.etichettaRiga}>
                  {t(
                    permesso === 'granted'
                      ? 'permessoConcesso'
                      : permesso === 'denied'
                        ? 'permessoNegato'
                        : 'permessoDaChiedere',
                  )}
                </span>
                {permesso === 'denied' && <span className={s.sottotitolo}>{t('permessoNegatoTesto')}</span>}
              </span>
              {permesso !== 'denied' && (
                <button type="button" className={s.contorno} onClick={prova}>
                  {t('notificaDiProva')}
                </button>
              )}
            </div>
          </Gruppo>
        )}
      </div>
    </div>
  );
}

/** Conferma in linea di S22 (import, «Elimina tutti i dati»): avviso, titolo, corpo, «Annulla» e l'azione distruttiva. */
function Conferma(p: {
  titolo: string;
  corpo: ReactNode;
  azione: string;
  lavoro: boolean;
  onAnnulla: () => void;
  onConferma: () => void;
}) {
  return (
    <div className={s.conferma} role="alertdialog" aria-label={p.titolo}>
      <span className={s.testaConferma}>
        <TriangleAlert size={18} className={s.iconaPericolo} />
        <span className={s.testi}>
          <span className={s.titoloConferma}>{p.titolo}</span>
          <span className={s.corpoConferma}>{p.corpo}</span>
        </span>
      </span>
      <span className={s.azioniConferma}>
        <button type="button" className={s.annullaConferma} onClick={p.onAnnulla}>
          {t('annulla')}
        </button>
        <button type="button" className={s.pericoloConferma} disabled={p.lavoro} onClick={p.onConferma}>
          {p.azione}
        </button>
      </span>
    </div>
  );
}

/** «ven 11 set · 22:10» (S22). */
const fmtBackup = new Intl.DateTimeFormat(lingua, { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Backup e dati (S22 `backup`, CONTROLLI; MECC §22; T-030): «Esporta backup» salva il file (Documenti su Android, download
 * sul web) e lo dice in linea con l'ora; «Importa backup» sceglie il file, lo valida e chiede in linea «Sostituire tutti
 * i dati locali?» coi suoi numeri, poi sostituisce e ricarica; «Elimina tutti i dati» chiede in linea e azzera.
 */
export function Backup() {
  const [ultimo, setUltimo] = useState<number | null>(null);
  const [stima, setStima] = useState(0);
  const [esito, setEsito] = useState<{ dove: 'documenti' | 'download'; ora: number } | null>(null);
  const [scelto, setScelto] = useState<{ nome: string; letto: BackupLetto } | null>(null);
  const [avviso, setAvviso] = useState<Chiave | null>(null);
  const [elimina, setElimina] = useState(false);
  const [lavoro, setLavoro] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => watch(() => lastBackup(appDb), setUltimo), []);
  // «~ 14 MB»: i PDF pesano un terzo in più nel file (base64), il resto dei dati è poca cosa
  useEffect(
    () =>
      watch(
        () => materialsSpace(appDb),
        (x) => setStima((x.pdf * 4) / 3 + x.altri + x.codice),
      ),
    [],
  );

  const esporta = async () => {
    setLavoro(true);
    setAvviso(null);
    const ora = Date.now();
    const dove = await exportBackup(appDb, ora);
    setEsito(dove && { dove, ora });
    if (!dove) setAvviso('backupNonSalvato');
    setLavoro(false);
  };
  const leggi = async (f: File | undefined) => {
    if (!f) return;
    setEsito(null);
    let testo: string;
    try {
      testo = await f.text();
    } catch {
      // Un file che il dispositivo non riesce a leggere (per esempio su un servizio cloud non scaricato)
      return setAvviso('backupIlleggibile');
    }
    const letto = readBackup(appDb, testo);
    if ('errore' in letto) {
      setScelto(null);
      setAvviso(letto.errore === 'versione' ? 'backupVersione' : 'backupIlleggibile');
    } else {
      setAvviso(null);
      setScelto({ nome: f.name, letto });
    }
  };
  // Dopo la sostituzione o l'azzeramento l'app riparte da capo coi dati nuovi (MECC §22: «ricarica»)
  const esegui = async (azione: () => Promise<void>, errore: Chiave) => {
    setLavoro(true);
    try {
      await azione();
      location.reload();
    } catch (e) {
      logError('backup', e);
      setAvviso(errore);
      setLavoro(false);
    }
  };

  return (
    <div className={s.pagina}>
      <Section titolo="backupDati" indietro sottotitolo={t('impostazioni')} />
      <div className={s.viste}>
        <Gruppo titolo={t('backupRiga')}>
          <button type="button" className={s.riga} data-alta disabled={lavoro} onClick={() => void esporta()}>
            <span className={s.testi}>
              <span className={s.etichettaRiga}>{t('esportaBackup')}</span>
              <span className={s.sottotitolo}>
                {t('unSoloFilePdf')}
                {stima > 0 && (
                  <>
                    {' · '}
                    <span className={s.num}>~ {dimensione(stima)}</span>
                  </>
                )}
              </span>
            </span>
          </button>
          <button type="button" className={s.riga} data-alta disabled={lavoro} onClick={() => file.current?.click()}>
            <span className={s.testi}>
              <span className={s.etichettaRiga}>{t('importaBackup')}</span>
              <span className={s.sottotitolo}>{t('sostituisceDatiLocali')}</span>
            </span>
            <ChevronRight size={16} className={s.chevron} />
          </button>
        </Gruppo>
        {ultimo !== null && (
          <span className={s.ultimoBackup}>
            {t('ultimoBackup')} ·{' '}
            <span className={s.numChiaro}>
              {fmtBackup.format(ultimo)} · {ora(ultimo)}
            </span>
          </span>
        )}
        {esito && (
          <span className={s.esitoBackup} role="status">
            <Check size={16} strokeWidth={2} />
            {t(esito.dove === 'documenti' ? 'backupSalvatoDocumenti' : 'backupScaricato')}
            <span className={s.num}>{ora(esito.ora)}</span>
          </span>
        )}
        {avviso && (
          <span className={s.avvisoBackup} role="alert">
            {t(avviso)}
          </span>
        )}
        {scelto && (
          <Conferma
            titolo={t('sostituireTitolo')}
            corpo={
              <>
                <span className={s.numChiaro}>{scelto.nome}</span> ·{' '}
                {t('sostituireCorpo', {
                  corsi: scelto.letto.corsi === 1 ? t('unCorso') : t('nCorsi', { n: scelto.letto.corsi }),
                  attivita:
                    scelto.letto.attivita === 1 ? t('unaAttivita') : t('nAttivita', { n: scelto.letto.attivita }),
                  pdf: scelto.letto.pdf === 1 ? t('unPdf') : t('nPdf', { n: scelto.letto.pdf }),
                })}
              </>
            }
            azione={t('sostituisciRicarica')}
            lavoro={lavoro}
            onAnnulla={() => setScelto(null)}
            onConferma={() => void esegui(() => importBackup(appDb, scelto.letto), 'backupNonImportato')}
          />
        )}
        <Gruppo titolo={t('zonaPericolosa')}>
          <button type="button" className={s.riga} disabled={lavoro} onClick={() => setElimina(true)}>
            <span className={s.etichettaRiga} data-pericolo>
              {t('eliminaTuttiIDati')}
            </span>
          </button>
        </Gruppo>
        {elimina && (
          <Conferma
            titolo={t('eliminareTuttiTitolo')}
            corpo={t('eliminareTuttiCorpo')}
            azione={t('eliminaTuttiIDati')}
            lavoro={lavoro}
            onAnnulla={() => setElimina(false)}
            onConferma={() => void esegui(() => eraseAllData(appDb), 'eliminaTuttiNonRiuscito')}
          />
        )}
        <input
          ref={file}
          type="file"
          // Nessun filtro: il selettore di Android scarta le estensioni che non conosce (.rfbackup); valida parseBackup
          hidden
          onChange={(e) => {
            void leggi(e.currentTarget.files?.[0]);
            e.currentTarget.value = '';
          }}
        />
      </div>
    </div>
  );
}

export function About() {
  return (
    <div className={s.pagina}>
      <Section titolo="informazioni" indietro sottotitolo={t('impostazioni')} />
      <div className={s.viste}>
        <Gruppo>
          <div className={s.riga}>
            <span className={s.etichettaRiga}>{t('versione')}</span>
            <span className={s.valore}>{__VERSIONE__}</span>
          </div>
        </Gruppo>
      </div>
    </div>
  );
}

type Tinta = 'successo' | 'avviso' | 'neutro';
interface Riquadro {
  etichetta: string;
  valore: string;
  meta: string;
  tinta: Tinta;
}
interface Spazio {
  dati: number;
  cache: number;
  persistente: boolean;
}

const decimali = new Intl.NumberFormat(lingua, { maximumFractionDigits: 2 });
const unDecimale = new Intl.NumberFormat(lingua, { maximumFractionDigits: 1 });
const memoria = (byte: number) =>
  byte >= 1e9
    ? `${unDecimale.format(byte / 1e9)} GB`
    : byte >= 1e6
      ? `${unDecimale.format(byte / 1e6)} MB`
      : `${unDecimale.format(byte / 1e3)} KB`;
const ora = (istante: number) =>
  new Intl.DateTimeFormat(lingua, { hour: '2-digit', minute: '2-digit' }).format(istante);
const SORGENTE = {
  ciclo: 'sorgenteCiclo',
  notifiche: 'sorgenteNotifiche',
  dispositivo: 'sorgenteDispositivo',
  materiali: 'sorgenteMateriali',
  backup: 'sorgenteBackup',
} as const;
/** Il testo di un evento: quelli noti hanno un codice e si scrivono nella lingua dell'app. */
const testoEvento = (e: Diagnostica['eventi'][number]) =>
  e.codice === 'ricorrenze_non_lette' ? t('ricorrenzeNonLette', { id: e.messaggio }) : e.messaggio;

/** Spazio del browser (FUNZ §24): dati dell'app e cache; il dettaglio per categoria c'è solo dove il browser lo dà. */
async function misuraSpazio(): Promise<Spazio | null> {
  if (!navigator.storage?.estimate) return null;
  const s: StorageEstimate & { usageDetails?: Record<string, number> } = await navigator.storage.estimate();
  const cache = s.usageDetails?.caches ?? 0;
  return { dati: (s.usage ?? 0) - cache, cache, persistente: (await navigator.storage.persisted?.()) ?? false };
}

/** Svuota cache (FUNZ §24): solo la cache dell'app web, mai i dati dell'utente. */
async function svuotaCache(): Promise<void> {
  if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
}

/** Reinstalla PWA (MECC §23): deregistra il service worker e ricarica. */
async function reinstalla(): Promise<void> {
  const registrazioni = (await navigator.serviceWorker?.getRegistrations()) ?? [];
  await Promise.all(registrazioni.map((r) => r.unregister()));
  location.reload();
}

/**
 * Diagnostica (S22 `diagnostics`; FUNZ §24, MECC §23): permessi, coda e riconciliazione delle notifiche, account, scala
 * del testo e animazioni, margini dello schermo; spazio locale con «Svuota cache»; gli ultimi errori dei servizi
 * (`app/diagnostics.ts`); rapporto copiabile e «Reinstalla PWA». Permesso, allarmi precisi e accesso a Non Disturbare
 * vengono dalle porte (T-021): sul web gli ultimi due non esistono.
 */
/** Un permesso che la piattaforma può non avere (il web): «Non disponibile», altrimenti sì o no con la tinta. */
const sìNo = (x: boolean | null | undefined, sì: Chiave, no: Chiave) => t(x == null ? 'nonDisponibile' : x ? sì : no);
const tinta = (x: boolean | null | undefined): Riquadro['tinta'] => (x == null ? 'neutro' : x ? 'successo' : 'avviso');

export function Diagnostics() {
  const [d, setD] = useState<Diagnostica>();
  const [notifiche, setNotifiche] = useState<ImpostazioniNotifiche>();
  const [spazio, setSpazio] = useState<Spazio | null>(null);
  const [schermo, setSchermo] = useState({ scala: 1, margini: '0 · 0 · 0 · 0' });
  const [copiata, setCopiata] = useState(false);
  const [permessi, setPermessi] = useState<PermessiNotifiche & { nonDisturbare: boolean | null }>();
  useEffect(
    () =>
      void Promise.all([readNotificationPermissions(), doNotDisturbAccess()]).then(([p, nonDisturbare]) =>
        setPermessi({ ...p, nonDisturbare }),
      ),
    [],
  );
  const sonda = useRef<HTMLDivElement>(null);
  // Gli eventi e la riconciliazione stanno in memoria: oltre alle scritture sul registro, si rileggono a ogni minuto
  const minuto = useMinuto();
  useEffect(() => watch(() => readDiagnostics(appDb, Date.now()), setD), [minuto]);
  useEffect(() => watch(() => readNotificationSettings(appDb), setNotifiche), []);
  useEffect(() => void misuraSpazio().then(setSpazio), []);
  useEffect(() => {
    const c = sonda.current && getComputedStyle(sonda.current);
    if (!c) return;
    setSchermo({
      scala: parseFloat(getComputedStyle(document.documentElement).fontSize) / 16,
      margini: [c.paddingTop, c.paddingRight, c.paddingBottom, c.paddingLeft]
        .map((x) => Math.round(parseFloat(x)))
        .join(' · '),
    });
  }, []);
  const permesso = permessi?.notifiche ?? null;
  const attivi = notifiche ? Object.values(notifiche.perTipo).filter((x) => x.attivo).length : 0;
  const errore = d?.riconciliazione?.errore;
  const riquadri: Riquadro[] = [
    {
      etichetta: t('permessoNotificheBreve'),
      valore: t(
        permesso === 'granted'
          ? 'concesso'
          : permesso === 'denied'
            ? 'negato'
            : permesso
              ? 'daChiedere'
              : 'nonDisponibile',
      ),
      meta: !notifiche?.generale || attivi === 0 ? t('notificheSpente') : t('tipiAttivi', { n: attivi }),
      tinta: permesso === 'granted' ? 'successo' : permesso === 'denied' ? 'avviso' : 'neutro',
    },
    {
      etichetta: t('allarmiPrecisi'),
      valore: sìNo(permessi?.allarmiEsatti, 'allarmiConcessi', 'allarmiNegati'),
      meta: t('comeNotifiche'),
      tinta: tinta(permessi?.allarmiEsatti),
    },
    {
      etichetta: t('nonDisturbare'),
      valore: sìNo(permessi?.nonDisturbare, 'accessoDato', 'senzaAccesso'),
      meta: t('iperfocus'),
      tinta: tinta(permessi?.nonDisturbare),
    },
    {
      etichetta: t('codaNotifiche'),
      valore: t('armate', { n: d?.armate ?? 0 }),
      meta: d?.prossima ? t('prossimaOra', { ora: ora(d.prossima) }) : t('nessunaInCoda'),
      tinta: 'neutro',
    },
    {
      etichetta: t('riconciliazione'),
      valore: d?.riconciliazione ? ora(d.riconciliazione.istante) : '—',
      meta: errore ?? t('nessunErrore'),
      tinta: errore ? 'avviso' : d?.riconciliazione ? 'successo' : 'neutro',
    },
    { etichetta: t('gruppoAccount'), valore: t('nonAttivo'), meta: '—', tinta: 'neutro' },
    {
      etichetta: t('scalaTesto'),
      valore: `${decimali.format(schermo.scala)}×`,
      meta: t(animazioniRidotte() ? 'animazioniRidotteMeta' : 'animazioniOn'),
      tinta: 'neutro',
    },
    { etichetta: t('margini'), valore: schermo.margini, meta: t('px'), tinta: 'neutro' },
  ];
  const totale = spazio ? spazio.dati + spazio.cache : 0;
  const copia = () => {
    const righe = [
      ...riquadri.map((r) => `${r.etichetta}: ${r.valore} · ${r.meta}`),
      spazio &&
        `${t('spazioLocale')}: ${t('datiSpazio', { spazio: memoria(spazio.dati) })} · ${t('cacheSpazio', {
          spazio: memoria(spazio.cache),
        })} · ${t(spazio.persistente ? 'persistente' : 'nonPersistente')}`,
      `${t('versione')}: ${__VERSIONE__}`,
      ...(d?.eventi ?? []).map((e) => `${ora(e.istante)} · ${t(SORGENTE[e.sorgente])} · ${testoEvento(e)}`),
    ];
    void navigator.clipboard?.writeText(righe.filter(Boolean).join('\n')).then(() => setCopiata(true));
  };

  return (
    <div className={s.pagina}>
      <Section titolo="diagnostica" indietro sottotitolo={t('impostazioni')} />
      <div className={s.sonda} ref={sonda} aria-hidden />
      <div className={s.viste}>
        <div className={s.griglia}>
          {riquadri.map((r) => (
            <div key={r.etichetta} className={`${s.card} ${s.riquadro}`} data-tinta={r.tinta}>
              <span className={s.testaRiquadro}>
                <span className={s.pallinoStato} />
                {r.etichetta}
              </span>
              <span className={s.valoreRiquadro}>{r.valore}</span>
              <span className={s.metaRiquadro}>{r.meta}</span>
            </div>
          ))}
        </div>
        {spazio && (
          <Gruppo titolo={t('spazioLocale')}>
            <div className={s.spazio}>
              <span className={s.barraSpazio} aria-hidden>
                <span style={{ width: `${totale ? (spazio.dati / totale) * 100 : 0}%` }} />
                <span style={{ width: `${totale ? (spazio.cache / totale) * 100 : 0}%` }} />
              </span>
              <div className={s.legendaSpazio}>
                <span>
                  <span className={s.quadratino} data-dati />
                  {t('datiSpazio', { spazio: memoria(spazio.dati) })}
                </span>
                <span>
                  <span className={s.quadratino} />
                  {t('cacheSpazio', { spazio: memoria(spazio.cache) })}
                </span>
                <span className={s.metaRiquadro}>{t(spazio.persistente ? 'persistente' : 'nonPersistente')}</span>
                <button
                  type="button"
                  className={s.contorno}
                  onClick={() => void svuotaCache().then(misuraSpazio).then(setSpazio)}
                >
                  {t('svuotaCache')}
                </button>
              </div>
            </div>
          </Gruppo>
        )}
        <Gruppo titolo={t('registroEventi')}>
          {d?.eventi.length ? (
            d.eventi.map((e, i) => (
              <div key={i} className={s.evento}>
                <span className={s.oraEvento}>{ora(e.istante)}</span>
                <span className={s.messaggio}>
                  {t(SORGENTE[e.sorgente])} · {testoEvento(e)}
                </span>
                <span className={s.tag}>{t('errore')}</span>
              </div>
            ))
          ) : (
            <div className={s.evento}>
              <span className={s.messaggio}>{t('nessunEvento')}</span>
            </div>
          )}
        </Gruppo>
        <div className={s.azioni}>
          <button type="button" className={s.secondario} onClick={copia}>
            {t(copiata ? 'copiata' : 'copiaDiagnostica')}
          </button>
          <button type="button" className={s.fantasma} onClick={() => void reinstalla()}>
            {t('reinstallaPwa')}
          </button>
        </div>
      </div>
    </div>
  );
}
