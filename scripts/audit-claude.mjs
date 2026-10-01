#!/usr/bin/env node
// =============================================================================
// audit-claude.mjs — Inventario e pulizia degli "accumuli" di Claude Code
// -----------------------------------------------------------------------------
// Perché esiste: tutto ciò che sta nel livello UTENTE (~/.claude/...) si carica
// in OGNI progetto, quindi skill, comandi, subagent, regole e plugin installati
// per altri progetti finiscono anche nelle sessioni di RoutForge: occupano
// contesto e, con lo stesso nome, possono OSCURARE i comandi del progetto
// (per le skill vale: personale > progetto).
//
// Uso (dalla radice del repository):
//   node scripts/audit-claude.mjs                          → solo inventario (non modifica nulla)
//   node scripts/audit-claude.mjs --archivia tutto         → mostra cosa sposterebbe (prova a vuoto)
//   node scripts/audit-claude.mjs --archivia skill:x,comando:y --conferma
//                                                          → sposta davvero in ~/.claude-archivio/<data>/
//   node scripts/audit-claude.mjs --ripristina <cartella-archivio>
//                                                          → rimette tutto al suo posto
//
// Cosa NON tocca mai: plugin, impostazioni, CLAUDE.md personale, server MCP,
// skill sincronizzate da claude.ai. Per quelli si usano i comandi ufficiali
// (/plugin, /skills, /mcp, /memory): lo script li elenca soltanto.
// Nessuna cancellazione: "archiviare" = spostare in una cartella fuori da ~/.claude.
// =============================================================================
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';

// --- Percorsi di base -------------------------------------------------------
// AUDIT_HOME permette di provare lo script su una home finta (usato nei test).
const HOME = process.env.AUDIT_HOME ?? homedir();
const CLAUDE_UTENTE = join(HOME, '.claude');
const PROGETTO = join(import.meta.dirname, '..');

// Skill integrate in Claude Code: un nome uguale le sostituisce o le confonde.
// Elenco dalla documentazione ufficiale (settembre 2026), non esaustivo.
const NOMI_INTEGRATI = [
  'verify',
  'run',
  'run-skill-generator',
  'debug',
  'batch',
  'loop',
  'code-review',
  'review',
  'doctor',
  'claude-api',
  'security-review',
  'init',
  'status',
  'skill-doctor',
  'design',
  'compact',
  'model',
  'context',
];

// --- Piccoli helper ----------------------------------------------------------
const leggiJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null; // file assente o non valido: lo trattiamo come vuoto
  }
};
const elencaCartelle = (dir) =>
  existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory() || d.isSymbolicLink())
        .map((d) => d.name)
    : [];

/** Tutti i file .md sotto `dir`, con percorso relativo (per i comandi in sottocartelle). */
function fileMd(dir) {
  const out = [];
  const visita = (d) => {
    if (!existsSync(d)) return;
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) visita(p);
      else if (e.name.toLowerCase().endsWith('.md')) out.push(relative(dir, p));
    }
  };
  visita(dir);
  return out;
}

/** Dimensione totale in byte (ricorsiva, senza seguire i collegamenti simbolici). */
function dimensione(p) {
  try {
    const s = lstatSync(p);
    if (s.isSymbolicLink()) return 0;
    if (s.isFile()) return s.size;
    return readdirSync(p).reduce((tot, n) => tot + dimensione(join(p, n)), 0);
  } catch {
    return 0;
  }
}
const kb = (b) => (b < 1024 ? `${b} B` : `${(b / 1024).toFixed(1)} KB`);

/** Riga `description:` del frontmatter, accorciata: basta per riconoscere a cosa serve. */
function descrizione(fileMdPath) {
  try {
    const testo = readFileSync(fileMdPath, 'utf8');
    const m = /^description:\s*['"]?(.+?)['"]?\s*$/m.exec(testo);
    const d = m ? m[1] : (testo.split('\n').find((l) => l.trim() && !l.startsWith('---')) ?? '');
    return d.length > 70 ? d.slice(0, 67) + '…' : d;
  } catch {
    return '';
  }
}

/** Nome del comando come lo digiti: sottocartelle → ":" (es. frontend/component.md → frontend:component). */
const nomeComando = (rel) => rel.replace(/\.md$/i, '').split(sep).join(':').split('/').join(':');

// --- Raccolta dell'inventario -----------------------------------------------
function inventario() {
  const skillDir = join(CLAUDE_UTENTE, 'skills');
  const skill = elencaCartelle(skillDir)
    .filter((n) => !n.startsWith('.') && n.toLowerCase() !== 'synced') // .trash e synced a parte
    .map((n) => {
      const p = join(skillDir, n);
      return {
        tipo: 'skill',
        nome: n,
        percorso: p,
        collegamento: lstatSync(p).isSymbolicLink(),
        byte: dimensione(p),
        descrizione: descrizione(join(p, 'SKILL.md')),
      };
    });
  const sincronizzate = elencaCartelle(join(skillDir, 'synced'));

  const comandi = fileMd(join(CLAUDE_UTENTE, 'commands')).map((rel) => ({
    tipo: 'comando',
    nome: nomeComando(rel),
    percorso: join(CLAUDE_UTENTE, 'commands', rel),
    byte: dimensione(join(CLAUDE_UTENTE, 'commands', rel)),
    descrizione: descrizione(join(CLAUDE_UTENTE, 'commands', rel)),
  }));
  const agenti = fileMd(join(CLAUDE_UTENTE, 'agents')).map((rel) => ({
    tipo: 'agente',
    nome: rel.replace(/\.md$/i, ''),
    percorso: join(CLAUDE_UTENTE, 'agents', rel),
    byte: dimensione(join(CLAUDE_UTENTE, 'agents', rel)),
    descrizione: descrizione(join(CLAUDE_UTENTE, 'agents', rel)),
  }));
  const regole = fileMd(join(CLAUDE_UTENTE, 'rules')).map((rel) => ({
    tipo: 'regola',
    nome: rel.replace(/\.md$/i, ''),
    percorso: join(CLAUDE_UTENTE, 'rules', rel),
    byte: dimensione(join(CLAUDE_UTENTE, 'rules', rel)),
    descrizione: '',
  }));

  // CLAUDE.md personale: si carica in ogni progetto, con tutti i file che importa (righe "@percorso").
  const claudeMdPath = join(CLAUDE_UTENTE, 'CLAUDE.md');
  let claudeMd = null;
  if (existsSync(claudeMdPath)) {
    const testo = readFileSync(claudeMdPath, 'utf8');
    claudeMd = {
      righe: testo.split('\n').length,
      byte: statSync(claudeMdPath).size,
      importazioni: testo
        .split('\n')
        .filter((l) => /^\s*@\S+/.test(l))
        .map((l) => l.trim()),
    };
  }

  const settings = leggiJson(join(CLAUDE_UTENTE, 'settings.json')) ?? {};
  const pluginAttivi = Object.entries(settings.enabledPlugins ?? {})
    .filter(([, v]) => v === true)
    .map(([k]) => k);
  const hookUtente = Object.keys(settings.hooks ?? {});

  // Registro dei plugin installati: forma non documentata → lettura difensiva.
  const registro = leggiJson(join(CLAUDE_UTENTE, 'plugins', 'installed_plugins.json'));
  const pluginInstallati = [];
  for (const [nome, v] of Object.entries(registro?.plugins ?? {})) {
    const installazioni = Array.isArray(v) ? v : [v];
    for (const i of installazioni)
      pluginInstallati.push({ nome, ambito: i?.scope ?? '?', progetto: i?.projectPath ?? '' });
  }

  // Server MCP: ~/.claude.json contiene quelli di ambito utente e quelli per progetto.
  const claudeJson = leggiJson(join(HOME, '.claude.json')) ?? {};
  const mcpUtente = Object.keys(claudeJson.mcpServers ?? {});
  const progettiConMcp = Object.entries(claudeJson.projects ?? {})
    .filter(([, p]) => p && Object.keys(p.mcpServers ?? {}).length > 0)
    .map(([percorso, p]) => ({ percorso, server: Object.keys(p.mcpServers) }));

  // Altri agenti (Codex, OpenCode, CLI "skills" globale): solo conteggi.
  const altri = [
    ['~/.agents/skills (skill globali condivise fra agenti)', join(HOME, '.agents', 'skills')],
    ['~/.codex/skills', join(HOME, '.codex', 'skills')],
    ['~/.config/opencode/skills', join(HOME, '.config', 'opencode', 'skills')],
  ].map(([etichetta, p]) => ({ etichetta, numero: elencaCartelle(p).filter((n) => !n.startsWith('.')).length }));
  const agentsMdGlobali = [join(HOME, '.codex', 'AGENTS.md'), join(HOME, '.config', 'opencode', 'AGENTS.md')].filter(
    existsSync,
  );

  // Lato progetto: cosa definisce RoutForge (serve per trovare i conflitti di nome).
  const progettoSkill = elencaCartelle(join(PROGETTO, '.claude', 'skills'));
  const progettoComandi = fileMd(join(PROGETTO, '.claude', 'commands')).map(nomeComando);
  const progettoAgenti = fileMd(join(PROGETTO, '.claude', 'agents')).map((r) => r.replace(/\.md$/i, ''));
  const settingsProgetto = leggiJson(join(PROGETTO, '.claude', 'settings.json')) ?? {};
  const settingsLocali = leggiJson(join(PROGETTO, '.claude', 'settings.local.json')) ?? {};

  return {
    skill,
    sincronizzate,
    comandi,
    agenti,
    regole,
    claudeMd,
    settings,
    pluginAttivi,
    hookUtente,
    pluginInstallati,
    mcpUtente,
    progettiConMcp,
    altri,
    agentsMdGlobali,
    progetto: {
      skill: progettoSkill,
      comandi: progettoComandi,
      agenti: progettoAgenti,
      settingsProgetto,
      settingsLocali,
    },
  };
}

// --- Stampa dell'inventario --------------------------------------------------
function stampa(inv) {
  const riga = (s = '') => console.log(s);
  const elenco = (voci) => {
    if (voci.length === 0) return riga('   (nessuno)');
    for (const v of voci)
      riga(
        `   - ${v.nome}${v.collegamento ? ' [collegamento]' : ''}  ${kb(v.byte)}${v.descrizione ? '  — ' + v.descrizione : ''}`,
      );
  };

  riga('=== LIVELLO UTENTE (~/.claude): si carica in OGNI progetto ===');
  riga(`\n1. Skill personali: ${inv.skill.length}`);
  elenco(inv.skill);
  riga(
    `\n2. Skill sincronizzate da claude.ai: ${inv.sincronizzate.length}${inv.sincronizzate.length ? ' → ' + inv.sincronizzate.join(', ') : ''}`,
  );
  riga('   (si gestiscono su claude.ai o con "syncClaudeAiSkills": false nelle impostazioni utente)');
  riga(`\n3. Comandi personali: ${inv.comandi.length}`);
  elenco(inv.comandi);
  riga(`\n4. Subagent personali: ${inv.agenti.length}`);
  elenco(inv.agenti);
  riga(`\n5. Regole personali: ${inv.regole.length}`);
  elenco(inv.regole);
  riga('\n6. CLAUDE.md personale:');
  if (!inv.claudeMd) riga('   (assente)');
  else {
    riga(`   ${inv.claudeMd.righe} righe, ${kb(inv.claudeMd.byte)}`);
    for (const imp of inv.claudeMd.importazioni) riga(`   importa: ${imp}  ← si carica anche in RoutForge`);
  }
  riga(
    `\n7. Plugin attivi a livello utente (settings.json): ${inv.pluginAttivi.length}${inv.pluginAttivi.length ? ' → ' + inv.pluginAttivi.join(', ') : ''}`,
  );
  riga(`   Plugin nel registro di installazione: ${inv.pluginInstallati.length}`);
  for (const p of inv.pluginInstallati)
    riga(`   - ${p.nome}  ambito: ${p.ambito}${p.progetto ? '  progetto: ' + p.progetto : ''}`);
  riga(`\n8. Hook a livello utente: ${inv.hookUtente.length ? inv.hookUtente.join(', ') : 'nessuno'}`);
  riga(`\n9. Server MCP di ambito utente: ${inv.mcpUtente.length ? inv.mcpUtente.join(', ') : 'nessuno'}`);
  if (inv.progettiConMcp.length)
    riga(`   Altri progetti con server MCP propri: ${inv.progettiConMcp.length} (restano confinati a quei progetti)`);
  riga('\n10. Altri agenti (solo conteggi):');
  for (const a of inv.altri) riga(`   - ${a.etichetta}: ${a.numero}`);
  for (const p of inv.agentsMdGlobali) riga(`   - istruzioni globali: ${p}`);

  // --- Conflitti con RoutForge ---
  riga('\n=== CONFLITTI CON ROUTFORGE ===');
  const nomiProgetto = new Set([...inv.progetto.skill, ...inv.progetto.comandi]);
  const personali = [...inv.skill, ...inv.comandi];
  const conflitti = [];
  for (const v of personali) {
    if (nomiProgetto.has(v.nome))
      conflitti.push(`${v.tipo} personale "${v.nome}" ha lo stesso nome di un comando di RoutForge: può oscurarlo`);
    if (NOMI_INTEGRATI.includes(v.nome))
      conflitti.push(`${v.tipo} personale "${v.nome}" ha il nome di un comando integrato di Claude Code`);
  }
  for (const a of inv.agenti)
    if (inv.progetto.agenti.includes(a.nome))
      conflitti.push(`subagent personale "${a.nome}" ha lo stesso nome di uno di RoutForge`);
  for (const n of nomiProgetto)
    if (NOMI_INTEGRATI.includes(n))
      conflitti.push(`comando di RoutForge "${n}" ha il nome di un comando integrato: rinominalo`);
  if (conflitti.length === 0) riga('   nessuno');
  else for (const c of conflitti) riga(`   ! ${c}`);

  // --- Cosa è già nascosto solo in RoutForge ---
  const override = {
    ...(inv.progetto.settingsProgetto.skillOverrides ?? {}),
    ...(inv.progetto.settingsLocali.skillOverrides ?? {}),
  };
  const spenti = Object.entries(override)
    .filter(([, v]) => v === 'off')
    .map(([k]) => k);
  const pluginSpenti = Object.entries({
    ...(inv.progetto.settingsProgetto.enabledPlugins ?? {}),
    ...(inv.progetto.settingsLocali.enabledPlugins ?? {}),
  })
    .filter(([, v]) => v === false)
    .map(([k]) => k);
  riga('\n=== GIÀ ISOLATO IN ROUTFORGE ===');
  riga(`   skill spente qui (skillOverrides "off"): ${spenti.length ? spenti.join(', ') : 'nessuna'}`);
  riga(`   plugin spenti qui (enabledPlugins false): ${pluginSpenti.length ? pluginSpenti.join(', ') : 'nessuno'}`);

  // --- Riepilogo e prossimi passi ---
  const candidati = [...inv.skill, ...inv.comandi, ...inv.agenti, ...inv.regole];
  riga('\n=== RIEPILOGO ===');
  riga(`   Elementi personali archiviabili: ${candidati.length} (${kb(candidati.reduce((t, v) => t + v.byte, 0))})`);
  if (candidati.length) {
    riga('   Prova a vuoto (non sposta nulla):');
    riga('     node scripts/audit-claude.mjs --archivia tutto');
    riga(
      `   Esempio mirato: node scripts/audit-claude.mjs --archivia ${candidati
        .slice(0, 2)
        .map((v) => `${v.tipo}:${v.nome}`)
        .join(',')} --conferma`,
    );
  }
  riga('   In Claude Code: /context (peso in contesto), /skill-doctor (skill mai usate), /plugin, /mcp, /memory.');
}

// --- Archiviazione reversibile -----------------------------------------------
function sposta(da, a) {
  mkdirSync(dirname(a), { recursive: true });
  try {
    renameSync(da, a);
  } catch (e) {
    // Dischi diversi (EXDEV) o cartelle bloccate su Windows: copia e poi rimuovi l'originale.
    if (e && (e.code === 'EXDEV' || e.code === 'EPERM')) {
      cpSync(da, a, { recursive: true, verbatimSymlinks: true });
      rmSync(da, { recursive: true, force: true });
    } else throw e;
  }
}

function archivia(spec, conferma) {
  const inv = inventario();
  const tutti = [...inv.skill, ...inv.comandi, ...inv.agenti, ...inv.regole];
  let scelti;
  if (spec === 'tutto') scelti = tutti;
  else {
    const richieste = spec
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    scelti = [];
    for (const r of richieste) {
      const [tipo, ...resto] = r.split(':');
      const nome = resto.join(':');
      const trovato = tutti.find((v) => v.tipo === tipo && v.nome === nome);
      if (!trovato) {
        console.error(
          `Non trovato: "${r}". Formato: skill:nome, comando:nome, agente:nome, regola:nome (vedi l'inventario).`,
        );
        process.exitCode = 1;
      } else scelti.push(trovato);
    }
  }
  // Prudenza: se anche un solo nome è sbagliato non si sposta nulla (niente esecuzioni a metà).
  if (process.exitCode === 1) return console.log('Nessuno spostamento eseguito: correggi i nomi e riprova.');
  if (scelti.length === 0) return console.log('Niente da archiviare.');

  const data = new Date();
  const timbro = `${data.getFullYear()}${String(data.getMonth() + 1).padStart(2, '0')}${String(data.getDate()).padStart(2, '0')}-${String(data.getHours()).padStart(2, '0')}${String(data.getMinutes()).padStart(2, '0')}${String(data.getSeconds()).padStart(2, '0')}`;
  const archivio = join(HOME, '.claude-archivio', timbro);
  const voci = scelti.map((v) => ({ ...v, destinazione: join(archivio, relative(CLAUDE_UTENTE, v.percorso)) }));

  console.log(
    conferma
      ? `Sposto ${voci.length} elementi in ${archivio}`
      : `PROVA A VUOTO — sposterei ${voci.length} elementi in ${archivio}:`,
  );
  for (const v of voci) console.log(`   ${v.tipo} ${v.nome}`);
  if (!conferma) return console.log('\nPer eseguire davvero aggiungi --conferma. Nulla è stato modificato.');

  for (const v of voci) sposta(v.percorso, v.destinazione);
  // File di ripristino: tiene la mappa originale → archivio (fuori da ~/.claude, non viene letto da Claude Code).
  writeFileSync(
    join(archivio, 'ripristino.json'),
    JSON.stringify(
      voci.map(({ percorso, destinazione, tipo, nome }) => ({ tipo, nome, percorso, destinazione })),
      null,
      2,
    ),
  );
  console.log(`\nFatto. Per annullare: node scripts/audit-claude.mjs --ripristina "${archivio}"`);
  console.log('Riavvia la sessione di Claude Code (o apri una sessione nuova) per vedere il risultato.');
}

function ripristina(cartella) {
  const mappa = leggiJson(join(cartella, 'ripristino.json'));
  if (!Array.isArray(mappa)) {
    console.error(`Nessun ripristino.json valido in ${cartella}`);
    process.exitCode = 1;
    return;
  }
  let fatti = 0;
  for (const v of mappa) {
    if (!existsSync(v.destinazione)) {
      console.log(`   salto ${v.tipo} ${v.nome}: non è più nell'archivio`);
      continue;
    }
    if (existsSync(v.percorso)) {
      console.log(`   salto ${v.tipo} ${v.nome}: esiste già al suo posto (nessuna sovrascrittura)`);
      continue;
    }
    sposta(v.destinazione, v.percorso);
    fatti++;
  }
  console.log(`Ripristinati ${fatti} elementi su ${mappa.length}. L'archivio resta in ${cartella} per sicurezza.`);
}

// --- Punto d'ingresso ----------------------------------------------------------
const args = process.argv.slice(2);
const valore = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
if (args.includes('--ripristina')) ripristina(valore('--ripristina') ?? '');
else if (args.includes('--archivia')) archivia(valore('--archivia') ?? '', args.includes('--conferma'));
else stampa(inventario());
