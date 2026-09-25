import { describe, expect, it } from 'vitest';
import {
  ErroreImportCorso,
  extractLinks,
  hasStructureFile,
  hostOf,
  parseCourse,
  parseEstimatedHours,
  parseModule,
  parseThreshold,
} from './parser';
import { local } from '../time';
import { assignPointer, type UnitaPercorso } from '../pointer';

/** Un modulo conforme al template di FORMATO_CORSO §2–§3 (due unità, una con tre sezioni). */
const M1 = `# MODULO M1 — Tooling Moderno

**Tipo:** NUOVO CONTENUTO
**Prerequisiti:** Modulo M0 completato
**Finestra indicativa:** settimane 9–12 (vedi mappa §3)
**Trasversali attivi in questo modulo:** Git, terminale

Questo modulo introduce gli strumenti del lavoro quotidiano.
Seconda riga di introduzione.

---

### Obiettivi di Apprendimento
- **Configurare** un progetto con Vite
- **Usare** npm scripts in modo consapevole

---

#### Unità 1.1 — Node e npm (le fondamenta)

**🎯 Concetto Core: il runtime e il suo gestore di pacchetti**
Node esegue JavaScript fuori dal browser.
npm distribuisce i pacchetti. ~6 h · Difficoltà: media

**📖 1. Teoria (Fondamenta)**
- [Node.js: introduzione](https://nodejs.org/en/learn)
- Descrizione: cosa sono runtime, moduli e package.json.

**📺 2. Studio (Visualizzazione)**
- [npm in 100 secondi](https://www.youtube.com/watch?v=P3aKRdUyr0s)
- Descrizione: panoramica visiva di npm.

**🛠️ 3. Pratica (Testing & Debugging)**
- [Esercizi npm](https://esempio.org/esercizi-npm)
- Descrizione: inizializza un progetto e aggiungi due script.

**🏗️ 4. Mini Progetto Finale: "Toolbox CLI"**
- [Traccia](https://esempio.org/toolbox)
- Descrizione del progetto: una CLI con tre comandi.

---

#### Unità 1.2 — Vite (6–8 ore)

**🎯 Concetto Core: il dev server istantaneo**
Vite serve i moduli ES nativi in sviluppo.

**📖 Teoria (Fondamenta)**
Vite nasce per velocizzare lo sviluppo: leggi [la guida ufficiale](https://vite.dev/guide/) e poi [il perché di Vite](https://vite.dev/guide/why.html).

**📺 Studio (Visualizzazione)**
- [Vite spiegato](https://youtu.be/KCrXgy8qtjM)

**🏗️ Mini Progetto Finale: "Starter"**
- [Traccia](https://esempio.org/starter)
- Descrizione del progetto: uno starter con alias e proxy.

---

### 📌 Test di fit opzionale
Se hai già usato Vite, prova [il test](https://esempio.org/fit) e salta alla 1.2.

---

### Verifica della Comprensione
**Domande Socratiche di auto-valutazione** (rispondi a voce)
1. Cosa fa \`npm install\` senza argomenti?
2. Perché Vite non fa bundling in sviluppo?

**Esercizi pratici progressivi:**
1. Crea un progetto Vite vuoto.
2. Aggiungi uno script \`lint\`.

**Criteri Go/No-Go (binari):**
- [ ] Domande socratiche superate (quiz ≥8/10) → sì/no
- [ ] Il progetto parte con \`npm run dev\` → sì/no
- [x] Repository inizializzato → sì/no

**No-Go:** Se il progetto non parte, ripeti la 1.1.

#### Riassunto di fine Modulo
Hai un ambiente moderno funzionante.

---

### Progetto del Modulo
- **Titolo:** Toolbox personale
- **Descrizione tecnica (ordine del cliente):** una CLI che crea progetti da template.
- **Risorsa online progetto:** [Traccia completa](https://esempio.org/progetto-m1) e [extra](https://esempio.org/extra)

### Self-Critique del Comitato
- **Mentore:** «Non anticipare gli strumenti che non servono.»
`;

const M3 = `## MODULO 3 - Backend

**Tipo:** NUOVO CONTENUTO
**Prerequisiti:** M1

#### Unità 3.1 — Node server
**🎯 Concetto Core: HTTP**
Testo.
**📖 Teoria**
- [Docs](https://nodejs.org/api/http.html)
**📺 Studio**
- [Video](https://www.youtube.com/shorts/abc123)
**🛠 Pratica**
- [Es](https://esempio.org/es)
**🏗 Mini Progetto Finale: "API"**
- [Traccia](https://esempio.org/api)
`;

const M2_BROKEN = `# Modulo senza intestazione valida

**Tipo:** NUOVO CONTENUTO
#### Unità 2.1 — Orfana
`;

const STRUTTURA = `# Syllabus Software Engineer 2026
## Percorso autodidatta in 5 moduli
Testo libero.
`;

const opts = { corsoId: 'corso-1', now: local(2026, 9, 22, 10, 0) };

describe('Import corso — SCENARI H1', () => {
  const zip = [
    { name: 'cartella/00_struttura.md', content: STRUTTURA },
    { name: 'M3-Backend.md', content: M3 },
    { name: 'sub/M1-Tooling_Moderno.md', content: M1 },
    { name: 'note.txt', content: '# MODULO M9 — non deve essere letto' },
    { name: 'M2-Rotto.md', content: M2_BROKEN },
  ];

  it('il corso ha 2 moduli in ordine 1, 3; il .txt è ignorato; M2 senza intestazione genera un avviso ed è saltato', () => {
    const { corso, avvisi } = parseCourse(zip, opts);
    expect(corso.moduli.map((m) => m.numero)).toEqual([1, 3]);
    expect(corso.moduli.map((m) => m.nn)).toEqual(['01', '03']);
    expect(avvisi.some((w) => w.file === 'M2-Rotto.md' && /intestazione di modulo mancante/.test(w.messaggio))).toBe(
      true,
    );
    expect(avvisi.some((w) => /M9/.test(w.messaggio))).toBe(false);
  });

  it('titolo e sottotitolo vengono dal file struttura (percorso appiattito)', () => {
    const { corso } = parseCourse(zip, opts);
    expect(corso.titolo).toBe('Syllabus Software Engineer 2026');
    expect(corso.sottotitolo).toBe('Percorso autodidatta in 5 moduli');
  });

  it('un secondo import dello stesso ZIP crea un secondo corso identico (id diverso)', () => {
    const a = parseCourse(zip, opts);
    const b = parseCourse(zip, { ...opts, corsoId: 'corso-2' });
    expect(b.corso.id).not.toBe(a.corso.id);
    const strip = (o: unknown) => JSON.parse(JSON.stringify(o).replaceAll('corso-2', 'corso-1'));
    expect(strip(b.corso)).toEqual(a.corso);
    expect(b.avvisi).toEqual(a.avvisi);
  });

  it('senza file struttura: titolo passato dal chiamante, altrimenti "Corso importato" (D-PARSE-1)', () => {
    const files = [{ name: 'M1-Tooling_Moderno.md', content: M1 }];
    expect(parseCourse(files, opts).corso.titolo).toBe('Corso importato');
    expect(parseCourse(files, { ...opts, titolo: 'Il mio corso' }).corso.titolo).toBe('Il mio corso');
  });

  it('senza alcun file modulo → errore', () => {
    expect(() => parseCourse([{ name: 'README.md', content: '# ciao' }], opts)).toThrow(ErroreImportCorso);
  });
});

describe('File struttura: titolo da chiedere — FORMATO_CORSO §1 (D-PARSE-1)', () => {
  it('riconosce 00_struttura anche in una sottocartella; un .txt o un modulo non contano', () => {
    expect(hasStructureFile([{ name: 'corso/00_struttura.md' }, { name: 'M1-a.md' }])).toBe(true);
    expect(hasStructureFile([{ name: '00_Mappa_corso.md' }])).toBe(true);
    expect(hasStructureFile([{ name: 'M1-a.md' }, { name: '00_struttura.txt' }])).toBe(false);
  });
});

describe('Moduli e unità duplicati — MECC §16, FORMATO_CORSO §1 (D-PARSE-3)', () => {
  const M1_A = `# MODULO M1 — Prima versione

**Tipo:** NUOVO CONTENUTO
**Prerequisiti:** —

#### Unità 1.1 — Uno
**🎯 Concetto Core: x**
testo
`;
  const M1_B = `# MODULO M1 — Seconda versione (duplicata)

**Tipo:** NUOVO CONTENUTO
**Prerequisiti:** —

#### Unità 1.1 — Due
**🎯 Concetto Core: y**
testo
`;

  it('due file M1-… con lo stesso numero: il secondo è saltato con avviso, il primo vince', () => {
    const files = [
      { name: 'M1-A.md', content: M1_A },
      { name: 'M1-B.md', content: M1_B },
    ];
    const { corso, avvisi } = parseCourse(files, opts);
    expect(corso.moduli).toHaveLength(1);
    expect(corso.moduli[0]?.titolo).toBe('Prima versione');
    expect(avvisi.some((w) => w.file === 'M1-B.md' && /modulo 1: numero duplicato/.test(w.messaggio))).toBe(true);
  });

  it('due intestazioni «Unità 1.1» nello stesso file: la seconda è saltata con avviso, la prima vince', () => {
    const dup = `# MODULO M1 — Con unità duplicata

**Tipo:** NUOVO CONTENUTO
**Prerequisiti:** —

#### Unità 1.1 — Prima
**🎯 Concetto Core: x**
testo

#### Unità 1.1 — Ripetuta
**🎯 Concetto Core: y**
testo
`;
    const { modulo, avvisi } = parseModule({ name: 'M1.md', content: dup }, 'corso-1');
    expect(modulo?.unita).toHaveLength(1);
    expect(modulo?.unita[0]?.titolo).toBe('Prima');
    expect(avvisi.some((w) => /unità 1\.1: numero duplicato/.test(w.messaggio))).toBe(true);
  });
});

describe('Modulo — FORMATO_CORSO §2', () => {
  const { modulo: m, avvisi } = parseModule({ name: 'M1-Tooling_Moderno.md', content: M1 }, 'corso-1');
  if (!m) throw new Error('modulo atteso');

  it('intestazione, campi in grassetto, finestra senza parentesi, trasversali, intro', () => {
    expect(m.numero).toBe(1);
    expect(m.titolo).toBe('Tooling Moderno');
    expect(m.tipo).toBe('NUOVO CONTENUTO');
    expect(m.prerequisiti).toBe('Modulo M0 completato');
    expect(m.finestraIndicativa).toBe('settimane 9–12');
    expect(m.trasversali).toBe('Git, terminale');
    expect(m.intro).toBe('Questo modulo introduce gli strumenti del lavoro quotidiano.\nSeconda riga di introduzione.');
  });

  it('obiettivi senza grassetto; domande ed esercizi come liste numerate', () => {
    expect(m.obiettivi).toEqual(['Configurare un progetto con Vite', 'Usare npm scripts in modo consapevole']);
    expect(m.domande).toHaveLength(2);
    expect(m.esercizi).toEqual(['Crea un progetto Vite vuoto.', 'Aggiungi uno script `lint`.']);
  });

  it('criteri Go/No-Go: suffisso rimosso, "Domande socratiche" è auto con soglia 0,8, [x] già fatto', () => {
    expect(m.criteri).toHaveLength(3);
    expect(m.criteri[0]).toEqual({
      testo: 'Domande socratiche superate (quiz ≥8/10)',
      auto: true,
      soglia: 0.8,
      fatto: false,
    });
    expect(m.criteri[1]?.auto).toBe(false);
    expect(m.criteri[1]?.testo).toBe('Il progetto parte con `npm run dev`');
    expect(m.criteri[2]?.fatto).toBe(true);
    expect(m.noGo).toBe('Se il progetto non parte, ripeti la 1.1.');
  });

  it('riassunto, progetto (prima risorsa del campo), test di fit; i separatori `---` restano fuori da intro, fit e riassunto', () => {
    expect(m.riassunto).toBe('Hai un ambiente moderno funzionante.');
    expect(m.progetto?.titolo).toBe('Toolbox personale');
    expect(m.progetto?.descrizione).toBe('una CLI che crea progetti da template.');
    expect(m.progetto?.risorsa?.url).toBe('https://esempio.org/progetto-m1');
    expect(m.testDiFit?.risorse[0]?.url).toBe('https://esempio.org/fit');
    // Il separatore `---` che chiude la sezione non è contenuto (emerso dal confronto con M0, T-000)
    expect(m.testDiFit?.testo).toBe(
      'Se hai già usato Vite, prova [il test](https://esempio.org/fit) e salta alla 1.2.',
    );
  });

  it('due unità in ordine; la seconda ha 3 sezioni → avviso "importata con 3 sezioni"', () => {
    expect(m.unita.map((u) => u.numero)).toEqual(['1.1', '1.2']);
    expect(m.unita[1]?.sezioni.map((s) => s.tipo)).toEqual(['teoria', 'studio', 'progetto']);
    expect(avvisi.map((w) => w.messaggio)).toContain('unità 1.2 importata con 3 sezioni');
    expect(avvisi).toHaveLength(1);
  });

  it('il modulo che apre il corso è "aperto"; il markdown integrale è conservato (Self-Critique inclusa)', () => {
    expect(m.stato).toBe('aperto');
    expect(m.markdown).toContain('Self-Critique del Comitato');
  });
});

describe('Unità — FORMATO_CORSO §3', () => {
  const { modulo: m } = parseModule({ name: 'M1-Tooling_Moderno.md', content: M1 }, 'corso-1');
  const u = m!.unita[0]!;

  it('concetto core con titolo e testo separati', () => {
    expect(u.concettoCore?.titolo).toBe('il runtime e il suo gestore di pacchetti');
    expect(u.concettoCore?.testo.startsWith('Node esegue JavaScript')).toBe(true);
  });

  it('quattro sezioni con tipo, etichetta e intestazione (D-PARSE-2)', () => {
    expect(u.sezioni.map((s) => s.tipo)).toEqual(['teoria', 'studio', 'pratica', 'progetto']);
    expect(u.sezioni.map((s) => s.etichetta)).toEqual(['Teoria', 'Studio', 'Pratica', 'Mini progetto']);
    expect(u.sezioni[0]?.intestazione).toBe('Fondamenta');
    expect(u.sezioni[1]?.intestazione).toBe('Visualizzazione');
    expect(u.sezioni[2]?.intestazione).toBe('Testing & Debugging');
    expect(u.sezioni[3]?.intestazione).toBe('Mini Progetto Finale: "Toolbox CLI"');
    expect(u.sezioni.every((s) => s.stato === 'da_fare')).toBe(true);
  });

  it('risorse con host senza www e video YouTube riconosciuti; descrizione dalla riga "Descrizione:"', () => {
    expect(u.sezioni[0]?.risorse[0]).toEqual({
      titolo: 'Node.js: introduzione',
      url: 'https://nodejs.org/en/learn',
      host: 'nodejs.org',
      youtube: false,
    });
    expect(u.sezioni[1]?.risorse[0]?.youtube).toBe(true);
    expect(u.sezioni[1]?.risorse[0]?.host).toBe('youtube.com');
    expect(u.sezioni[0]?.descrizione).toBe('cosa sono runtime, moduli e package.json.');
    expect(u.sezioni[3]?.descrizione).toBe('una CLI con tre comandi.');
  });

  it("ore stimate e difficoltà lette ovunque nell'unità; stato iniziale non iniziata", () => {
    expect(u.oreStimate).toBe(6);
    expect(u.difficolta).toBe('media');
    expect(m!.unita[1]?.oreStimate).toBe(7); // "6–8 ore" → media
    expect(u.stato).toBe('non_iniziata');
    expect(u.progresso).toBe(0);
  });

  it('più link in mezzo alla descrizione (senza bullet): tutti risorse, descrizione = testo discorsivo', () => {
    const teoria = m!.unita[1]!.sezioni[0]!;
    expect(teoria.risorse.map((r) => r.url)).toEqual(['https://vite.dev/guide/', 'https://vite.dev/guide/why.html']);
    expect(teoria.descrizione.startsWith('Vite nasce per velocizzare')).toBe(true);
  });

  it('host: senza www, minuscolo, senza porta né credenziali; URL non http → vuoto', () => {
    expect(hostOf('https://www.Example.org:8080/x?y#z')).toBe('example.org');
    expect(hostOf('http://user:pw@host.it/')).toBe('host.it');
    expect(hostOf('ftp://x.org/')).toBe('');
    // Dominio internazionalizzato conservato com'è (con `new URL` sarebbe punycode): scelta voluta, host leggibile
    expect(hostOf('https://münchen.de/x')).toBe('münchen.de');
  });

  it('youtu.be e shorts sono video incorporabili', () => {
    expect(
      extractLinks('[a](https://youtu.be/xyz) [b](https://www.youtube.com/shorts/q1) [c](https://vimeo.com/1)').map(
        (r) => r.youtube,
      ),
    ).toEqual([true, true, false]);
  });
});

describe("Puntatore all'import e stati dei moduli — FORMATO_CORSO §4", () => {
  it('unità corrente = prima unità del primo modulo aperto; M3 è bloccato perché M1 ha criteri non fatti', () => {
    const { corso } = parseCourse(
      [
        { name: 'M1-Tooling_Moderno.md', content: M1 },
        { name: 'M3-Backend.md', content: M3 },
      ],
      opts,
    );
    expect(corso.numeroUnita).toBe(3);
    expect(corso.unitaCompletate).toBe(0);
    expect(corso.unitaCorrenteId).toBe('corso-1:M1:U1.1');
    expect(corso.moduli.map((m) => m.stato)).toEqual(['aperto', 'bloccato']);
  });

  it('soglie: "≥8/10" → 0,8; "≥ 80%" → 0,8; assente → null', () => {
    expect(parseThreshold('quiz ≥8/10')).toBe(0.8);
    expect(parseThreshold('≥ 80%')).toBe(0.8);
    expect(parseThreshold('nessuna')).toBeNull();
    expect(parseEstimatedHours('~8 h')).toBe(8);
    expect(parseEstimatedHours('circa 6–8 ore')).toBe(7);
    expect(parseEstimatedHours('niente')).toBeNull();
  });
});

describe('Vocabolario unico — unità importate e puntatore (D-NAMING-1)', () => {
  it("un'unità importata è già un'UnitaPercorso: il puntatore la usa senza conversioni", () => {
    const { corso } = parseCourse([{ name: 'M1-Tooling_Moderno.md', content: M1 }], opts);
    const unita: UnitaPercorso[] = corso.moduli.flatMap((m) => m.unita); // verificato dal compilatore
    const mappa = assignPointer(unita, [{ id: 'b1', inizio: local(2026, 9, 23, 9, 0) }]);
    expect(mappa.get('b1')).toBe('corso-1:M1:U1.1');
  });
});
