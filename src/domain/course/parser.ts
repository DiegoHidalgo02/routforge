/**
 * Parser del corso importabile: markdown → Corso → Moduli → Unità → Sezioni → Risorse.
 * Fonti: RoutForge_FORMATO_CORSO.md §1–§4; RoutForge_MECCANISMI.md §16. Criterio: SCENARI H1.
 *
 * Funzione pura: riceve i file già estratti (nome + contenuto). La lettura dello ZIP è del layer
 * applicativo (T-003). Gli identificatori sono deterministici a partire da `corsoId`.
 *
 * Decisione D-PARSE-1: senza file struttura il titolo è quello passato dal chiamante (chiesto
 * all'utente) o "Corso importato" — FORMATO_CORSO §1 prevale su MECC §16 ("primo H1 dei moduli").
 * Decisione D-PARSE-2: l'intestazione di sezione "Teoria (Fondamenta)" → "Fondamenta" (FORMATO §3, esempio);
 * in tutti gli altri casi è il testo dopo emoji e numero, verbatim.
 */
import type { StatoUnita, StatoModulo } from '../types';
import { statiModuli } from '../pointer';

// ------------------------------------------------------------------ tipi di output (FORMATO §4)

export type TipoSezione = 'teoria' | 'studio' | 'pratica' | 'progetto';
export type StatoSezione = 'da_fare' | 'in_corso' | 'fatta';
export type Difficolta = 'alta' | 'media' | 'bassa';

export interface RisorsaImportata {
  titolo: string;
  url: string;
  host: string;
  youtube: boolean;
}

export interface SezioneImportata {
  id: string;
  tipo: TipoSezione;
  etichetta: string;
  intestazione: string;
  risorse: RisorsaImportata[];
  descrizione: string;
  stato: StatoSezione;
}

export interface UnitaImportata {
  id: string;
  moduloNumero: number;
  numero: string; // "0.7"
  ordine: number; // posizione nel modulo (1-based)
  titolo: string;
  markdown: string;
  concettoCore: { titolo: string; testo: string } | null;
  sezioni: SezioneImportata[];
  oreStimate: number | null;
  difficolta: Difficolta | null;
  stato: StatoUnita;
  progresso: number;
  minuti: number;
  confidenza: number | null;
}

export interface CriterioImportato {
  testo: string;
  auto: boolean;
  /** Per i criteri auto: soglia 0..1 letta dal testo (es. "≥8/10" → 0,8). */
  soglia: number | null;
  fatto: boolean;
}

export interface ModuloImportato {
  id: string;
  numero: number;
  nn: string;
  titolo: string;
  tipo: string;
  prerequisiti: string;
  finestraIndicativa: string;
  trasversali: string;
  intro: string;
  obiettivi: string[];
  unita: UnitaImportata[];
  domande: string[];
  esercizi: string[];
  criteri: CriterioImportato[];
  noGo: string;
  riassunto: string;
  progetto: { titolo: string; descrizione: string; risorsa: RisorsaImportata | null } | null;
  testDiFit: { testo: string; risorse: RisorsaImportata[] } | null;
  markdown: string;
  stato: StatoModulo;
}

export interface CorsoImportato {
  id: string;
  titolo: string;
  sottotitolo: string;
  importatoIl: number;
  moduli: ModuloImportato[];
  numeroUnita: number;
  unitaCompletate: number;
  unitaCorrenteId: string | null;
}

export interface FileCorso {
  /** Nome (o percorso) del file nello ZIP: conta solo il nome (FORMATO §1). */
  name: string;
  content: string;
}

export interface AvvisoImport {
  file: string;
  messaggio: string;
}

export interface OpzioniImport {
  corsoId: string;
  now: number;
  /** Titolo chiesto all'utente quando manca il file struttura. */
  titolo?: string | undefined;
}

export class ErroreImportCorso extends Error {}

// ------------------------------------------------------------------ espressioni regolari

const MODULE_FILE = /^M(\d+)[-_]/i;
const STRUCTURE_FILE = /^00_.*(struttura|mappa|syllabus)/i;
const MODULE_HEADER = /^#{1,2}\s*MODULO\s+M?(\d+)\s*[—–-]\s*(.+?)\s*$/i;
const UNIT_HEADER = /^####\s*Unit[àa]\s+(\d+)\.(\d+)\s*[—–-]\s*(.+?)\s*$/i;
const UNIT_HEADER_ANY = /^####\s*Unit[àa]\s/i; // niente \b: "à" non è un carattere di parola per la regex ASCII
const HEADING = /^(#{3,4})\s+(.*?)\s*$/;
const MODULE_FIELD =
  /^\*\*\s*(Tipo|Prerequisiti|Finestra indicativa|Trasversali attivi in questo modulo)\s*:?\s*\*\*\s*:?\s*(.*)$/i;
const BOLD_LINE = /^\*\*(.+?)\*\*\s*$/;
const CORE_CONCEPT = /^\*\*\s*🎯\s*Concetto Core\s*:\s*(.+?)\s*\*\*\s*$/iu;
const SECTION_MARK = /^\*\*\s*(📖|📺|🛠\uFE0F?|🏗\uFE0F?)\s*(?:(\d)\s*\.\s*)?(.+?)\s*\*\*\s*$/u;
const LINK = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
const DESCRIPTION_LINE = /^-?\s*Descrizione(?:\s+del\s+progetto[^:]*)?\s*:\s*(.*)$/i;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const BULLET = /^\s*[-*]\s+(.*)$/;
const CHECKBOX = /^\s*-\s*\[( |x|X)\]\s*(.*)$/;
const CRITERION_SUFFIX = /\s*→\s*s[iì]\s*\/\s*no\s*$/i;
const HOURS_TILDE = /~\s*(\d+(?:[.,]\d+)?)\s*(?:h|ore)\b/i;
const HOURS_RANGE = /(\d+(?:[.,]\d+)?)\s*[–-]\s*(\d+(?:[.,]\d+)?)\s*(?:h|ore)\b/i;
const DIFFICULTY = /Difficolt[àa]\s*:\s*(alta|media|bassa)/i;
const YOUTUBE = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)/i;

const SECTION_BY_EMOJI: Record<string, TipoSezione> = {
  '📖': 'teoria',
  '📺': 'studio',
  '🛠': 'pratica',
  '🏗': 'progetto',
};
const SECTION_LABEL: Record<TipoSezione, string> = {
  teoria: 'Teoria',
  studio: 'Studio',
  pratica: 'Pratica',
  progetto: 'Mini progetto',
};
const SECTION_ORDER: TipoSezione[] = ['teoria', 'studio', 'pratica', 'progetto'];

// ------------------------------------------------------------------ helper

export const fileNameOf = (path: string): string => path.split(/[\\/]/).pop() ?? path;
export const stripBold = (s: string): string => s.replace(/\*\*(.+?)\*\*/g, '$1').trim();
const num = (s: string): number => Number(s.replace(',', '.'));

/** Host di un URL http(s) senza `www.` (FORMATO §3). Regex e non `URL`: il dominio non usa API di piattaforma. */
export function hostOf(url: string): string {
  const m = /^https?:\/\/(?:[^@/?#]*@)?([^/?#:]+)/i.exec(url);
  return m ? m[1]!.toLowerCase().replace(/^www\./, '') : '';
}

export function extractLinks(text: string): RisorsaImportata[] {
  const out: RisorsaImportata[] = [];
  for (const m of text.matchAll(LINK)) {
    const url = m[2]!;
    out.push({ titolo: m[1]!.trim(), url, host: hostOf(url), youtube: YOUTUBE.test(url) });
  }
  return out;
}

/** Ore stimate (MECC §16): `~N h/ore`, oppure intervallo `N–M ore` → media. */
export function parseEstimatedHours(text: string): number | null {
  const range = HOURS_RANGE.exec(text);
  if (range) return (num(range[1]!) + num(range[2]!)) / 2;
  const tilde = HOURS_TILDE.exec(text);
  return tilde ? num(tilde[1]!) : null;
}

export function parseDifficulty(text: string): Difficolta | null {
  const m = DIFFICULTY.exec(text);
  return m ? (m[1]!.toLowerCase() as Difficolta) : null;
}

/** Soglia di un criterio auto: "≥8/10" → 0,8; "≥ 80%" → 0,8. */
export function parseThreshold(text: string): number | null {
  const frac = /[≥>]=?\s*(\d+)\s*\/\s*(\d+)/.exec(text);
  if (frac && Number(frac[2]) > 0) return Number(frac[1]) / Number(frac[2]);
  const pct = /[≥>]=?\s*(\d+)\s*%/.exec(text);
  return pct ? Number(pct[1]) / 100 : null;
}

// ------------------------------------------------------------------ sezione di un'unità

interface RawBlock {
  header: string; // riga bold (senza **) o intestazione
  lines: string[];
}

/** Spezza il corpo di un'unità in blocchi delimitati da righe bold a inizio riga; `---` chiude un blocco. */
function splitBoldBlocks(lines: string[]): RawBlock[] {
  const blocks: RawBlock[] = [];
  let current: RawBlock | null = null;
  for (const line of lines) {
    if (/^---+\s*$/.test(line)) {
      current = null;
      continue;
    }
    if (BOLD_LINE.test(line)) {
      current = { header: line, lines: [] };
      blocks.push(current);
      continue;
    }
    if (current) current.lines.push(line);
  }
  return blocks;
}

function sectionDescription(lines: string[]): string {
  const described: string[] = [];
  let inDescription = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const d = DESCRIPTION_LINE.exec(line);
    if (d) {
      described.push(stripBold(d[1]!));
      inDescription = true;
      continue;
    }
    if (inDescription && line.trim() !== '' && !BULLET.test(line)) {
      described.push(stripBold(line));
      continue;
    }
    inDescription = false;
  }
  if (described.length > 0) return described.join('\n').trim();
  // Altrimenti: testo discorsivo senza i bullet dei link.
  const discursive = lines
    .filter((l) => l.trim() !== '')
    .filter((l) => {
      const b = BULLET.exec(l);
      return !(b && /^\[[^\]]+\]\(https?:\/\/[^)\s]+\)\s*$/.test(b[1]!.trim()));
    })
    .map(stripBold);
  return discursive.join('\n').trim();
}

function parseSection(unitId: string, block: RawBlock): SezioneImportata | null {
  const m = SECTION_MARK.exec(block.header);
  if (!m) return null;
  const tipo = SECTION_BY_EMOJI[m[1]!.replace('\uFE0F', '')];
  if (!tipo) return null;
  const rawHeading = m[3]!.trim();
  const canonical = /^(Teoria|Studio|Pratica)\s*\((.+)\)\s*$/i.exec(rawHeading);
  const intestazione = canonical ? canonical[2]!.trim() : rawHeading;
  const body = block.lines.join('\n');
  return {
    id: `${unitId}:${tipo}`,
    tipo,
    etichetta: SECTION_LABEL[tipo],
    intestazione,
    risorse: extractLinks(body),
    descrizione: sectionDescription(block.lines),
    stato: 'da_fare',
  };
}

// ------------------------------------------------------------------ unità

function parseUnit(
  moduleId: string,
  moduleNumber: number,
  ordine: number,
  headerLine: string,
  bodyLines: string[],
  file: string,
  warnings: AvvisoImport[],
): UnitaImportata | null {
  const h = UNIT_HEADER.exec(headerLine);
  if (!h) {
    warnings.push({ file, messaggio: `unità con intestazione non leggibile saltata: "${headerLine.trim()}"` });
    return null;
  }
  const numero = `${h[1]}.${h[2]}`;
  const titolo = h[3]!.trim();
  const id = `${moduleId}:U${numero}`;
  const markdown = [headerLine, ...bodyLines].join('\n').trim();

  let concettoCore: UnitaImportata['concettoCore'] = null;
  const sezioni = new Map<TipoSezione, SezioneImportata>();
  for (const block of splitBoldBlocks(bodyLines)) {
    const core = CORE_CONCEPT.exec(block.header);
    if (core) {
      if (!concettoCore) concettoCore = { titolo: core[1]!.trim(), testo: block.lines.join('\n').trim() };
      continue;
    }
    const section = parseSection(id, block);
    if (section && !sezioni.has(section.tipo)) sezioni.set(section.tipo, section); // ripetuta → prima occorrenza
  }
  const ordered = SECTION_ORDER.filter((k) => sezioni.has(k)).map((k) => sezioni.get(k)!);
  if (ordered.length < 4) {
    warnings.push({ file, messaggio: `unità ${numero} importata con ${ordered.length} sezioni` });
  }
  return {
    id,
    moduloNumero: moduleNumber,
    numero,
    ordine,
    titolo,
    markdown,
    concettoCore,
    sezioni: ordered,
    oreStimate: parseEstimatedHours(markdown),
    difficolta: parseDifficulty(markdown),
    stato: 'non_iniziata',
    progresso: 0,
    minuti: 0,
    confidenza: null,
  };
}

// ------------------------------------------------------------------ modulo

interface Chunk {
  level: number;
  heading: string;
  headerLine: string;
  lines: string[];
}

function chunkByHeadings(lines: string[]): { head: string[]; chunks: Chunk[] } {
  const head: string[] = [];
  const chunks: Chunk[] = [];
  let current: Chunk | null = null;
  for (const line of lines) {
    const h = HEADING.exec(line);
    if (h) {
      current = { level: h[1]!.length, heading: h[2]!, headerLine: line, lines: [] };
      chunks.push(current);
    } else if (current) current.lines.push(line);
    else head.push(line);
  }
  return { head, chunks };
}

/** Liste numerate sotto un grassetto, fino al prossimo grassetto o intestazione (FORMATO §2). */
function parseVerification(lines: string[]): Pick<ModuloImportato, 'domande' | 'esercizi' | 'criteri' | 'noGo'> {
  const out: Pick<ModuloImportato, 'domande' | 'esercizi' | 'criteri' | 'noGo'> = {
    domande: [],
    esercizi: [],
    criteri: [],
    noGo: '',
  };
  let mode: 'domande' | 'esercizi' | 'criteri' | 'nogo' | null = null;
  for (const line of lines) {
    const boldStart = /^\*\*\s*([^*]+?)\s*\*\*\s*(.*)$/.exec(line);
    if (boldStart) {
      const label = boldStart[1]!.toLowerCase();
      const rest = boldStart[2]!.trim();
      if (label.startsWith('domande')) mode = 'domande';
      else if (label.startsWith('esercizi')) mode = 'esercizi';
      else if (label.startsWith('criteri')) mode = 'criteri';
      else if (label.startsWith('no-go')) {
        mode = 'nogo';
        if (rest) out.noGo = rest;
      } else mode = null;
      continue;
    }
    if (mode === 'domande' || mode === 'esercizi') {
      const n = NUMBERED.exec(line);
      if (n) out[mode].push(stripBold(n[1]!));
    } else if (mode === 'criteri') {
      const c = CHECKBOX.exec(line);
      if (c) {
        const testo = stripBold(c[2]!.replace(CRITERION_SUFFIX, ''));
        const auto = /domande socratiche/i.test(testo);
        out.criteri.push({ testo, auto, soglia: auto ? parseThreshold(testo) : null, fatto: c[1] !== ' ' });
      }
    } else if (mode === 'nogo' && line.trim() !== '') {
      out.noGo = out.noGo ? `${out.noGo}\n${stripBold(line)}` : stripBold(line);
    }
  }
  return out;
}

function parseProject(lines: string[]): ModuloImportato['progetto'] {
  let titolo = '';
  let descrizione = '';
  let risorsa: RisorsaImportata | null = null;
  for (const line of lines) {
    const m = /^\s*[-*]\s*\*\*\s*([^*]+?)\s*:?\s*\*\*\s*:?\s*(.*)$/.exec(line);
    if (!m) continue;
    const label = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (label.startsWith('titolo')) titolo = stripBold(value);
    else if (label.startsWith('descrizione')) descrizione = stripBold(value);
    else if (label.startsWith('risorsa')) risorsa = extractLinks(value)[0] ?? null;
  }
  if (!titolo && !descrizione && !risorsa) return null;
  return { titolo, descrizione, risorsa };
}

export interface RisultatoImportModulo {
  modulo: ModuloImportato | null;
  avvisi: AvvisoImport[];
}

export function parseModule(file: FileCorso, courseId: string): RisultatoImportModulo {
  const warnings: AvvisoImport[] = [];
  const name = fileNameOf(file.name);
  const lines = file.content.split(/\r?\n/);
  const headerIndex = lines.findIndex((l) => MODULE_HEADER.test(l));
  if (headerIndex < 0) {
    warnings.push({ file: name, messaggio: 'intestazione di modulo mancante, file saltato' });
    return { modulo: null, avvisi: warnings };
  }
  const header = MODULE_HEADER.exec(lines[headerIndex]!)!;
  const numero = Number(header[1]);
  const titolo = header[2]!.trim();
  const id = `${courseId}:M${numero}`;

  const { head, chunks } = chunkByHeadings(lines.slice(headerIndex + 1));
  const fields = { tipo: '', prerequisiti: '', finestra: '', trasversali: '' };
  const intro: string[] = [];
  for (const line of head) {
    const f = MODULE_FIELD.exec(line);
    if (f) {
      const key = f[1]!.toLowerCase();
      const value = f[2]!.trim();
      if (key === 'tipo') fields.tipo = value;
      else if (key === 'prerequisiti') fields.prerequisiti = value;
      else if (key === 'finestra indicativa') fields.finestra = value.replace(/\s*\([^)]*\)/g, '').trim();
      else fields.trasversali = value;
    } else if (line.trim() !== '' && !/^---+\s*$/.test(line)) intro.push(line);
  }
  if (!fields.tipo) warnings.push({ file: name, messaggio: `modulo ${numero}: campo "Tipo" mancante` });
  if (!fields.prerequisiti) warnings.push({ file: name, messaggio: `modulo ${numero}: campo "Prerequisiti" mancante` });

  const unita: UnitaImportata[] = [];
  let obiettivi: string[] = [];
  let verification: ReturnType<typeof parseVerification> = { domande: [], esercizi: [], criteri: [], noGo: '' };
  let riassunto = '';
  let progetto: ModuloImportato['progetto'] = null;
  let testDiFit: ModuloImportato['testDiFit'] = null;

  for (const chunk of chunks) {
    const heading = chunk.heading.trim();
    if (UNIT_HEADER_ANY.test(chunk.headerLine)) {
      const u = parseUnit(id, numero, unita.length + 1, chunk.headerLine, chunk.lines, name, warnings);
      if (u) unita.push(u);
    } else if (/^Obiettivi di Apprendimento/i.test(heading)) {
      obiettivi = chunk.lines
        .map((l) => BULLET.exec(l)?.[1])
        .filter((s): s is string => !!s)
        .map(stripBold);
    } else if (/Test di fit/i.test(heading)) {
      const testo = chunk.lines
        .filter((l) => l.trim() !== '')
        .map(stripBold)
        .join('\n')
        .trim();
      testDiFit = { testo, risorse: extractLinks(chunk.lines.join('\n')) };
    } else if (/^Verifica della Comprensione/i.test(heading)) {
      verification = parseVerification(chunk.lines);
    } else if (/^Riassunto/i.test(heading)) {
      riassunto = chunk.lines
        .filter((l) => l.trim() !== '' && !/^---+\s*$/.test(l))
        .map(stripBold)
        .join('\n')
        .trim();
    } else if (/^Progetto del Modulo/i.test(heading)) {
      progetto = parseProject(chunk.lines);
    }
    // "Self-Critique del Comitato" e blocchi sconosciuti restano solo nel markdown del modulo.
  }

  const module: ModuloImportato = {
    id,
    numero,
    nn: String(numero).padStart(2, '0'),
    titolo,
    tipo: fields.tipo,
    prerequisiti: fields.prerequisiti,
    finestraIndicativa: fields.finestra,
    trasversali: fields.trasversali,
    intro: intro.join('\n').trim(),
    obiettivi,
    unita,
    ...verification,
    riassunto,
    progetto,
    testDiFit,
    markdown: file.content,
    stato: 'aperto',
  };
  return { modulo: module, avvisi: warnings };
}

// ------------------------------------------------------------------ corso

export interface RisultatoImportCorso {
  corso: CorsoImportato;
  avvisi: AvvisoImport[];
}

/**
 * Importa un corso da un elenco di file. Solo i `.md` vengono letti; i percorsi sono appiattiti al nome;
 * serve almeno un file modulo, altrimenti `ErroreImportCorso`. Ogni chiamata produce un corso nuovo.
 */
export function parseCourse(files: readonly FileCorso[], opts: OpzioniImport): RisultatoImportCorso {
  const warnings: AvvisoImport[] = [];
  const md = files.map((f) => ({ name: fileNameOf(f.name), content: f.content })).filter((f) => /\.md$/i.test(f.name));

  const moduleFiles = md
    .filter((f) => MODULE_FILE.test(f.name))
    .map((f) => ({ file: f, order: Number(MODULE_FILE.exec(f.name)![1]) }))
    .sort((a, b) => a.order - b.order || a.file.name.localeCompare(b.file.name));
  if (moduleFiles.length === 0) {
    throw new ErroreImportCorso('Nessun file modulo (M<numero>-…md) trovato nello ZIP');
  }

  let titolo = opts.titolo?.trim() || 'Corso importato';
  let sottotitolo = '';
  const structure = md.find((f) => STRUCTURE_FILE.test(f.name));
  if (structure) {
    const h1 = structure.content.split(/\r?\n/).find((l) => /^#\s+\S/.test(l));
    const h2 = structure.content.split(/\r?\n/).find((l) => /^##\s+\S/.test(l));
    if (h1) titolo = h1.replace(/^#\s+/, '').trim();
    if (h2) sottotitolo = h2.replace(/^##\s+/, '').trim();
  }

  const moduli: ModuloImportato[] = [];
  for (const { file } of moduleFiles) {
    const r = parseModule(file, opts.corsoId);
    warnings.push(...r.avvisi);
    if (r.modulo) moduli.push(r.modulo);
  }
  if (moduli.length === 0) throw new ErroreImportCorso('Nessun modulo con intestazione valida');

  // Stati dei moduli: stessa regola del puntatore (pointer.ts → statiModuli), nessuna copia locale.
  const stati = statiModuli(
    moduli.map((m) => ({ numero: m.numero, criteriSoddisfatti: m.criteri.every((c) => c.fatto) })),
  );
  for (const m of moduli) m.stato = stati.get(m.numero) ?? 'bloccato';
  const firstOpen = moduli.find((m) => m.stato !== 'bloccato');
  const unitaCorrenteId = firstOpen?.unita[0]?.id ?? null;

  return {
    corso: {
      id: opts.corsoId,
      titolo,
      sottotitolo,
      importatoIl: opts.now,
      moduli,
      numeroUnita: moduli.reduce((n, m) => n + m.unita.length, 0),
      unitaCompletate: 0,
      unitaCorrenteId,
    },
    avvisi: warnings,
  };
}

/** Massimo avvisi mostrati all'utente (MECC §16). Il parser li restituisce tutti; la UI ne mostra 5. */
export const MAX_WARNINGS_SHOWN = 5;
