// Statistiche (S20, `/statistiche`; MECC §20; FUNZ §17): schede Panoramica · Comportamenti · Studio · Pratica col periodo
// 7g · 30g · 90g · tutto (90 all'apertura, come il mock). I numeri li calcola `app/stats.ts` con le definizioni di
// `domain/stats.ts` (D-STATS-1); le card sono di sola lettura (CONTROLLI S20). Lo stato vuoto del mock compare finché non
// c'è nessuna sessione e nessun blocco giudicato; un dato che manca nel periodo si scrive sulla sua riga (TESTI). La
// Pratica arriva con quiz, giochi e flashcard (T-027, T-028): fino ad allora le sue card non hanno dati.
import { Check, ChartColumn } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { appDb, watch } from '../app/db';
import { readStats, type Panoramica, type Statistiche } from '../app/stats';
import { GIORNI_MAPPA, SOGLIA_PUNTUALITA, type Periodo } from '../domain/stats';
import type { TipoBlocco } from '../domain/types';
import { durata, SETTIMANA, TIPO } from './format';
import { lingua, t, type Chiave } from './i18n';
import { useSettings } from './preferenze';
import { Section } from './Section';
import s from './Stats.module.css';

type Scheda = 'panoramica' | 'comportamenti' | 'studio' | 'pratica';
const SCHEDE: [Scheda, Chiave][] = [
  ['panoramica', 'statPanoramica'],
  ['comportamenti', 'statComportamenti'],
  ['studio', 'statStudio'],
  ['pratica', 'statPratica'],
];
const PERIODI: [Periodo, Chiave][] = [
  [7, 'periodo7'],
  [30, 'periodo30'],
  [90, 'periodo90'],
  ['tutto', 'periodoTutto'],
];
/** Righe di «Disciplina per tipo» nell'ordine del mock. */
const TIPI: [TipoBlocco, Chiave][] = [
  ['studio', 'routineDiStudio'],
  ['routine', 'tipoRoutine'],
  ['todo', 'tipoTodo'],
  ['evento', 'eventi'],
];
/** I quattro livelli della mappa di calore (mock: data-0 · 1 · 2 · 4); `livello` del dominio va da 0 a 1. */
const LIVELLI = ['var(--color-data-0)', 'var(--color-data-1)', 'var(--color-data-2)', 'var(--color-data-4)'];
const livello = (x: number) => (x <= 0 ? 0 : Math.min(3, Math.ceil(x * 3)));
/** Le fasce di §20 nell'ordine del dominio. */
const FASCE = ['06–12', '12–18', '18–24', '00–06'];
/** Esiti di Studio: colori del mock (success, primary, text-2, text-3). */
const ESITI: [keyof Statistiche['studio']['esiti'], Chiave, string][] = [
  ['completata', 'esitoCompletata', 'var(--color-success)'],
  ['continua', 'esitoContinua', 'var(--color-primary)'],
  ['indietro', 'esitoIndietro', 'var(--color-text-2)'],
  ['saltaPersa', 'esitoSalta', 'var(--color-text-3)'],
];

const pct = (x: number) => Math.round(x * 100);
/** «56 min» sotto l'ora, «1h 05m» sopra (mock: «media 56 min»). */
const minuti = (m: number) => (m < 60 ? `${m} ${t('unitaMinuti')}` : durata(m));
/** Delta col segno: «+» attaccato, meno tipografico; `null` se zero. */
const segno = (n: number, f: (x: number) => string = String) => (n > 0 ? `+${f(n)}` : n < 0 ? `−${f(-n)}` : null);
const decimale = new Intl.NumberFormat(lingua, { maximumFractionDigits: 1 });
/** Giorno della settimana per indice (0 = domenica): il 20/9/2026 è una domenica. */
const giornoSettimana = (g: number, weekday: 'long' | 'narrow') =>
  new Intl.DateTimeFormat(lingua, { weekday }).format(new Date(2026, 8, 20 + g));

/** Valore di una StatCard: cifre, segno e spazi nel font dei numeri, lettere e unità piccole in text-2 («38h 20m», «−4 min»). */
function Valore({ testo, unita }: { testo: string; unita?: string }) {
  return (
    <span className={s.valore}>
      {/\d/.test(testo)
        ? testo.split(/([+−]?\d+|\s+)/).map((x, i) =>
            i % 2 ? (
              x
            ) : x ? (
              <span key={i} className={s.unita}>
                {x}
              </span>
            ) : null,
          )
        : testo}
      {unita && <span className={s.unita}>{unita}</span>}
    </span>
  );
}

/** Confronto col periodo precedente: verde se migliora, text-2 se peggiora (DESIGN.md: mai rosso), niente se pari. */
function Delta({ testo, positivo }: { testo: string | null; positivo: boolean }) {
  return (
    testo && (
      <span className={s.meta} data-positivo={positivo || undefined}>
        {testo}
      </span>
    )
  );
}

function Card(p: { etichetta: string; destra?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={`${s.card} ${p.className ?? ''}`}>
      <div className={s.testaCard}>
        <h2 className={s.etichetta}>{p.etichetta}</h2>
        {p.destra}
      </div>
      {p.children}
    </section>
  );
}

const SenzaDati = () => <span className={s.senzaDati}>{t('nessunDatoPeriodo')}</span>;

/** Barre verticali (focus, persi, sessioni per settimana): altezza sul massimo, minimo 3 px. */
function Barre(p: { valori: number[]; className?: string; colore?: (v: number, i: number) => string | undefined }) {
  const massimo = Math.max(1, ...p.valori);
  return (
    <div className={`${s.barre} ${p.className ?? ''}`} aria-hidden>
      {p.valori.map((v, i) => (
        <span key={i} data-colore={p.colore?.(v, i)} style={{ height: `max(3px, ${(v / massimo) * 100}%)` }} />
      ))}
    </div>
  );
}

/** Al più un anno di barre settimanali («tutto»): oltre, con 3 px fra l'una e l'altra, non si vedrebbero. */
const ultimoAnno = <T,>(xs: T[]) => xs.slice(-52);

function KpiCard(p: { etichetta: string; valore: ReactNode; meta?: ReactNode; larga?: boolean }) {
  return (
    <Card etichetta={p.etichetta} className={`${s.kpi} ${p.larga ? s.largaMobile : ''}`}>
      {p.valore}
      {p.meta}
    </Card>
  );
}

function Overview({ p }: { p: Panoramica }) {
  const deltaFocus = p.focusPrima === null ? 0 : p.focus - p.focusPrima;
  const barre = ultimoAnno(p.barre);
  const disc = p.disciplina.globale;
  const deltaDisc = segno(disc === null || p.disciplinaPrima === null ? 0 : pct(disc) - pct(p.disciplinaPrima));
  return (
    <div className={s.griglia}>
      <Card
        etichetta={t('focus')}
        className={s.larga}
        destra={<Delta testo={segno(deltaFocus, durata)} positivo={deltaFocus > 0} />}
      >
        <Valore testo={durata(p.focus)} />
        <Barre
          valori={barre.map((b) => b.minuti)}
          className={s.barreFocus}
          colore={(_, i) => (i === barre.length - 1 ? 'ultima' : undefined)}
        />
      </Card>
      <KpiCard
        etichetta={t('costanza')}
        valore={
          <Valore
            testo={String(p.costanza.attuale)}
            unita={` ${t(p.costanza.attuale === 1 ? 'unitaGiorno' : 'unitaGiorni')}`}
          />
        }
        meta={<span className={s.meta}>{t('recordN', { n: p.costanza.record })}</span>}
      />
      <KpiCard
        etichetta={t('sessioniStat')}
        valore={<Valore testo={String(p.sessioni.numero)} />}
        meta={
          p.sessioni.numero > 0 && (
            <span className={s.meta}>{t('mediaDurata', { durata: minuti(p.sessioni.media) })}</span>
          )
        }
      />
      <KpiCard
        etichetta={t('disciplina')}
        larga
        valore={disc === null ? <Valore testo="—" /> : <Valore testo={String(pct(disc))} unita=" %" />}
        meta={
          disc === null ? (
            <SenzaDati />
          ) : (
            <Delta
              testo={deltaDisc && t('vsPrima', { delta: deltaDisc })}
              positivo={deltaDisc?.startsWith('+') === true}
            />
          )
        }
      />
      <Card etichetta={t('disciplinaPerTipo')} className={s.larga}>
        {TIPI.map(([tipo, nome]) => {
          const x = p.disciplina.perTipo[tipo];
          return (
            <div key={tipo} className={s.riga} data-tipo={tipo}>
              <span className={s.nomeRiga}>
                <span className={s.pallino} />
                <span className={s.nomeTipo}>{t(nome)}</span>
              </span>
              {x === null ? (
                <SenzaDati />
              ) : (
                <>
                  <span className={s.binario}>
                    <span style={{ width: `${pct(x)}%` }} />
                  </span>
                  <span className={s.numero}>{pct(x)} %</span>
                </>
              )}
            </div>
          );
        })}
      </Card>
      <Card
        etichetta={t('giorniConAttivita')}
        className={s.larga}
        destra={
          <span className={s.conteggio}>
            {p.attivita.giorni} / {GIORNI_MAPPA}
          </span>
        }
      >
        <div className={s.mappa} aria-hidden>
          {p.attivita.mappa.map((g) => (
            <span key={g.giorno} style={{ background: LIVELLI[livello(g.livello)] }} />
          ))}
        </div>
        <div className={s.legenda} aria-hidden>
          {t('meno')}
          {LIVELLI.map((c) => (
            <span key={c} style={{ background: c }} />
          ))}
          {t('piu')}
        </div>
      </Card>
      {p.corsi.length > 0 && (
        <Card etichetta={t('perCorso')} className={`${s.larga} ${s.corsi}`}>
          {p.corsi.map((c) => (
            <div key={c.id} className={s.corso}>
              <div className={s.rigaCorso}>
                <span className={s.ellissi}>{c.titolo}</span>
                <span className={s.numero}>
                  {c.completate} / {c.unita} · {c.pct} %
                </span>
              </div>
              <span className={s.binarioSottile}>
                <span style={{ width: `${c.pct}%` }} />
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function Behaviour({ c, trigger }: { c: Statistiche['comportamenti']; trigger: Statistiche['trigger'] }) {
  const totale = c.fasce.reduce((n, x) => n + x, 0);
  const quote = c.fasce.map((x) => (totale ? Math.round((x / totale) * 100) : 0));
  const migliore = Math.max(...quote);
  const persi = ultimoAnno(c.persi.settimane);
  return (
    <div className={s.griglia}>
      <Card etichetta={t('focusPerFascia')} className={`${s.larga} ${s.fasce}`}>
        {totale === 0 ? (
          <SenzaDati />
        ) : (
          <>
            <div className={s.colonneFasce}>
              {quote.map((q, i) => (
                <span key={FASCE[i]} className={s.fascia} data-migliore={q === migliore || undefined}>
                  <span className={s.quota}>{q} %</span>
                  <span className={s.barraFascia} style={{ height: `${Math.max(q, 3)}%` }} />
                </span>
              ))}
            </div>
            <div className={s.etichetteFasce} aria-hidden>
              {FASCE.map((f) => (
                <span key={f}>{f}</span>
              ))}
            </div>
          </>
        )}
      </Card>
      <Card etichetta={t('costanzaPerGiorno')}>
        <div className={s.giorni} aria-hidden>
          {SETTIMANA.map((g) => (
            <span
              key={g}
              // Il mock: sotto il 50 % in border-strong
              data-pieno={c.costanza[g]! >= 0.5 || undefined}
              style={{ height: `max(3px, ${pct(c.costanza[g]!)}%)` }}
            />
          ))}
        </div>
        <div className={s.etichetteGiorni} aria-hidden>
          {SETTIMANA.map((g) => (
            <span key={g}>{giornoSettimana(g, 'narrow')}</span>
          ))}
        </div>
      </Card>
      <Card etichetta={t('blocchiPersi')} destra={<span className={s.totale}>{c.persi.numero}</span>}>
        <Barre
          valori={persi.map((b) => b.numero)}
          className={s.barrePersi}
          colore={(v) => (v > 0 ? 'perso' : undefined)}
        />
        {c.persi.tasso !== null && c.persi.giorno !== null && c.persi.tipo !== null && (
          <p className={s.frase}>
            {t('persiPeggiori', {
              pct: pct(c.persi.tasso),
              giorno: giornoSettimana(c.persi.giorno, 'long'),
              tipo: t(TIPO[c.persi.tipo]),
            })}
          </p>
        )}
      </Card>
      <Card etichetta={t('verificaMetaDurata')} className={`${s.larga} ${s.fasce}`}>
        {trigger.scattati === 0 ? (
          <SenzaDati />
        ) : (
          <div className={s.tre}>
            {(
              [
                [String(pct(trigger.tasso ?? 0)), ' %', 'recuperiDopoAvviso'],
                [String(trigger.risposti), '', 'avvisiRisposti'],
                [String(trigger.persi), '', 'persiComunque'],
              ] as const
            ).map(([v, u, k]) => (
              <span key={k} className={s.voce}>
                <span className={s.valoreVoce}>
                  {v}
                  {u && <span className={s.unitaVoce}>{u}</span>}
                </span>
                <span className={s.etichettaVoce}>{t(k)}</span>
              </span>
            ))}
          </div>
        )}
      </Card>
      <Card etichetta={t('fasiSaltateStat')} className={s.larga}>
        {c.fasi.length === 0 ? (
          <SenzaDati />
        ) : (
          c.fasi.map((f, i) => (
            <div key={i} className={s.riga}>
              <span className={s.ellissi}>
                {f.etichetta} {f.padre && <span className={s.padre}>· {f.padre}</span>}
              </span>
              <span className={s.binario} data-colore="perso">
                <span style={{ width: `${pct(f.saltate / f.totali)}%` }} />
              </span>
              <span className={s.numero}>{pct(f.saltate / f.totali)} %</span>
            </div>
          ))
        )}
      </Card>
      <Card etichetta={t('routineSenzaDurata')} className={`${s.larga} ${s.senzaDurata}`}>
        {c.senzaDurata.length === 0 ? (
          <SenzaDati />
        ) : (
          c.senzaDurata.map((r, i) => (
            <div key={i} className={s.rigaRoutine} data-tipo="routine">
              <span className={s.pallino} />
              <span className={`${s.ellissi} ${s.titoloRoutine}`}>
                {[r.titolo || t('tipoRoutine'), r.ora].filter(Boolean).join(' · ')}
              </span>
              <span className={s.conteggio}>
                {r.fatte} / {r.totali} · {pct(r.fatte / r.totali)} %
              </span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function Study({ st, p }: { st: Statistiche['studio']; p: Panoramica }) {
  const deltaFocus = p.focusPrima ? Math.round(((p.focus - p.focusPrima) / p.focusPrima) * 100) : 0;
  const delta = segno(deltaFocus);
  const pu = st.puntualita;
  const esiti = ESITI.map(([k, nome, colore]) => ({ k, nome, colore, n: st.esiti[k] }));
  const totaleEsiti = esiti.reduce((n, e) => n + e.n, 0);
  const settimane = ultimoAnno(st.settimane);
  const voci: [string, string][] = [
    [durata(st.pause.minuti), t('pauseN', { n: st.pause.numero })],
    [String(st.interruzioni), t('interruzioniAnnotate')],
    [String(st.pomodoro.sessioni), t('pomodoroSegmenti', { n: st.pomodoro.segmenti })],
    [String(st.iperfocus.uscite), t('usciteEmergenza')],
    [String(st.iperfocus.abbandoni), t('abbandoni')],
    [
      String(pu.anticipi),
      pu.anticipoMedio === null
        ? t('anticipiMedia', { durata: '—' })
        : t('anticipiMedia', { durata: minuti(pu.anticipoMedio) }),
    ],
  ];
  return (
    <div className={s.griglia}>
      <KpiCard
        etichetta={t('focus')}
        valore={<Valore testo={durata(p.focus)} />}
        meta={<Delta testo={delta && t('vsPrima', { delta: `${delta} %` })} positivo={deltaFocus > 0} />}
      />
      <KpiCard
        etichetta={t('iperfocus')}
        valore={<Valore testo={String(st.iperfocus.sessioni)} unita={t('suN', { n: st.iperfocus.totali })} />}
        meta={
          st.iperfocus.extra > 0 && (
            <span className={s.meta} data-primario>
              {t('tempoExtraMeta', { durata: `+${minuti(st.iperfocus.extra)}` })}
            </span>
          )
        }
      />
      <KpiCard
        etichetta={t('puntualita')}
        larga
        valore={
          pu.scarto === null ? (
            <Valore testo="—" />
          ) : (
            <Valore testo={segno(pu.scarto) ?? '0'} unita={` ${t('unitaMinuti')}`} />
          )
        }
        meta={
          pu.entro === null ? (
            <SenzaDati />
          ) : (
            <span className={s.meta}>{t('entroMinuti', { pct: pct(pu.entro), n: SOGLIA_PUNTUALITA })}</span>
          )
        }
      />
      <Card
        etichetta={t('focusSulPianificato')}
        className={s.larga}
        destra={
          st.pianificato.piano > 0 && (
            <span className={s.conteggio}>
              {durata(st.pianificato.focus)} / {durata(st.pianificato.piano)}
            </span>
          )
        }
      >
        <span className={s.binarioSpesso}>
          <span
            style={{
              width: `${st.pianificato.piano ? Math.min(100, pct(st.pianificato.focus / st.pianificato.piano)) : 0}%`,
            }}
          />
        </span>
        <div className={s.sei}>
          {voci.map(([v, e]) => (
            <span key={e} className={s.voce}>
              <span className={s.valoreSei}>{v}</span>
              <span className={s.etichettaVoce}>{e}</span>
            </span>
          ))}
        </div>
      </Card>
      <Card etichetta={t('esitiStat')} className={s.larga}>
        {totaleEsiti === 0 ? (
          <SenzaDati />
        ) : (
          <>
            <span className={s.impilata} aria-hidden>
              {esiti.map(
                (e) =>
                  e.n > 0 && (
                    <span key={e.k} style={{ width: `${(e.n / totaleEsiti) * 100}%`, background: e.colore }} />
                  ),
              )}
            </span>
            <div className={s.legendaEsiti}>
              {esiti.map((e) => (
                <span key={e.k}>
                  <span className={s.quadratino} style={{ background: e.colore }} />
                  {t(e.nome)} <span className={s.numeroChiaro}>{Math.round((e.n / totaleEsiti) * 100)} %</span>
                </span>
              ))}
            </div>
          </>
        )}
      </Card>
      <Card etichetta={t('ultimeUnita')} className={s.larga}>
        {st.unita.length === 0 ? (
          <SenzaDati />
        ) : (
          st.unita.map((u) => (
            <div key={u.unitaId} className={s.rigaUnita}>
              <span className={s.numeroUnita}>{u.numero}</span>
              <span className={s.ellissi}>{u.titolo}</span>
              <span className={s.metaUnita} data-fatta={u.completata || undefined}>
                {minuti(u.minuti)}
                {u.completata && <Check size={14} strokeWidth={2.25} />}
              </span>
            </div>
          ))
        )}
      </Card>
      <Card
        etichetta={t('sessioniASettimana')}
        className={s.larga}
        destra={<span className={s.conteggio}>{t('mediaDurata', { durata: decimale.format(st.mediaSettimana) })}</span>}
      >
        <Barre valori={settimane.map((w) => w.numero)} className={s.barreSessioni} colore={() => 'primario'} />
      </Card>
    </div>
  );
}

/** Pratica (§20): quiz, DevSwipe, Bug Hunter, Trivia e flashcard arrivano con T-027 e T-028; per ora nessun dato. */
function Practice() {
  const kpi: [Chiave, boolean][] = [
    ['praticaQuiz', false],
    ['praticaDevSwipe', false],
    ['praticaBugHunter', false],
    ['praticaTrivia', false],
    ['carteDovuteOggi', true],
  ];
  return (
    <div className={s.griglia}>
      {kpi.map(([k, larga]) => (
        <KpiCard key={k} etichetta={t(k)} larga={larga} valore={<Valore testo="—" />} meta={<SenzaDati />} />
      ))}
      <Card etichetta={t('valutazioniFlashcard')} className={s.larga}>
        <SenzaDati />
      </Card>
    </div>
  );
}

export function Stats() {
  const [scheda, setScheda] = useState<Scheda>('panoramica');
  const [periodo, setPeriodo] = useState<Periodo>(90);
  const [v, setV] = useState<Statistiche>();
  const { inizioSettimana } = useSettings();
  useEffect(
    () => watch(() => readStats(appDb, periodo, Date.now(), inizioSettimana), setV),
    [periodo, inizioSettimana],
  );

  return (
    <div className={s.pagina}>
      <Section titolo="statistiche" />
      <div className={s.pannello}>
        <div className={s.schede} role="tablist">
          {SCHEDE.map(([id, nome]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={scheda === id}
              className={s.scheda}
              onClick={() => setScheda(id)}
            >
              {t(nome)}
            </button>
          ))}
        </div>
        <div className={s.periodo} role="group" aria-label={t('statPeriodo')}>
          {PERIODI.map(([id, nome]) => (
            <button
              key={id}
              type="button"
              aria-pressed={periodo === id}
              className={s.segmento}
              onClick={() => setPeriodo(id)}
            >
              {t(nome)}
            </button>
          ))}
        </div>
        {v?.vuoto ? (
          <div className={s.vuoto}>
            <span className={s.iconaVuoto}>
              <ChartColumn size={24} />
            </span>
            <h2 className={s.titoloVuoto}>{t('statVuotoTitolo')}</h2>
            <p className={s.testoVuoto}>{t('statVuotoTesto')}</p>
          </div>
        ) : (
          v && (
            <div key={scheda} role="tabpanel" className={s.contenuto}>
              {scheda === 'panoramica' && <Overview p={v.panoramica} />}
              {scheda === 'comportamenti' && <Behaviour c={v.comportamenti} trigger={v.trigger} />}
              {scheda === 'studio' && <Study st={v.studio} p={v.panoramica} />}
              {scheda === 'pratica' && <Practice />}
            </div>
          )
        )}
      </div>
    </div>
  );
}
