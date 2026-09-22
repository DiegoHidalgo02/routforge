# RoutForge — Formato del corso importabile

*Specifica del file ZIP di markdown che l'app importa come corso. I file di riferimento sono `M0-Riattivazione_JavaScript.md` e `M1-Tooling_Moderno.md` in questa cartella: devono importarsi senza avvisi. `course-data.js` alla radice del progetto è il risultato atteso della lettura di quei due file.*

---

## 1. Contenuto dello ZIP

- Solo file `.md` vengono letti; qualunque altro file è ignorato. I percorsi interni allo ZIP sono irrilevanti: conta solo il nome del file.
- **File modulo** (obbligatorio, almeno uno): nome che inizia con `M<numero>` seguito da `-` o `_` (es. `M0-Riattivazione_JavaScript.md`, `M12_Backend.md`). L'ordine dei moduli è il numero nel nome.
- **File struttura** (opzionale): nome che inizia con `00_` e contiene `struttura`, `mappa` o `syllabus`. Fornisce titolo (primo `# `) e sottotitolo (primo `## `) del corso. Se assente: titolo chiesto all'utente in fase di import, default "Corso importato".

---

## 2. File modulo

```markdown
# MODULO M0 — Titolo del modulo

**Tipo:** CONSOLIDAMENTO | NUOVO CONTENUTO
**Prerequisiti:** testo libero
**Finestra indicativa:** settimane 1–8
**Trasversali attivi in questo modulo:** testo libero (opzionale)

Paragrafi introduttivi (opzionali, conservati come `intro`).

### Obiettivi di Apprendimento
- **Verbo** resto dell'obiettivo
- …

---

#### Unità 0.1 — Titolo
(vedi §3)

---

### 📌 Test di fit opzionale …          (opzionale, solo testo + link)

### Verifica della Comprensione
**Domande Socratiche di auto-valutazione** …
1. …

**Esercizi pratici progressivi:**
1. …

**Criteri Go/No-Go (binari):**
- [ ] testo del criterio → sì/no

**No-Go:** testo libero

#### Riassunto di fine Modulo
Testo libero.

### Progetto del Modulo
- **Titolo:** …
- **Descrizione tecnica (ordine del cliente):** …
- **Risorsa online progetto:** [titolo](https://…)

### Self-Critique del Comitato
- **Ruolo:** «…»
```

Regole:
- L'intestazione `# MODULO M0 — Titolo` è **obbligatoria** (`#` o `##`, `M` opzionale davanti al numero, trattino lungo o breve). Senza: il file è saltato con un avviso.
- I campi in grassetto a livello modulo devono iniziare la riga. Solo `Tipo` e `Prerequisiti` sono obbligatori; `Finestra indicativa` compare in interfaccia (testa del modulo e sub della riga modulo nel corso); `Trasversali attivi` compare accanto al tipo. Il testo tra parentesi nella finestra (rimandi alla mappa) viene rimosso.
- Le unità iniziano con `#### Unità N.M — Titolo`. Un'unità con intestazione non leggibile è saltata con avviso.
- Tutto ciò che segue l'ultima unità e inizia con `###` è contenuto di modulo, non dell'unità.
- **Domande** ed **esercizi**: liste numerate sotto il rispettivo grassetto, fino al prossimo grassetto o intestazione. **Criteri Go/No-Go**: righe `- [ ] …`; il suffisso `→ sì/no` viene rimosso. Un criterio che contiene "Domande socratiche" è **auto**: lo spunta l'app quando il quiz del modulo raggiunge la soglia scritta nel testo (es. `≥8/10`). Tutti gli altri sono manuali.
- **Progetto del Modulo**: i tre campi sono bullet in grassetto; la risorsa è il primo link del campo.
- `Self-Critique del Comitato` e `Riassunto del modulo` in coda sono conservati nel markdown del modulo ma non compaiono in interfaccia.

---

## 3. Unità: le quattro sezioni

```markdown
#### Unità 0.7 — Event loop visualizzato (l'esperimento che ripara il file rotto)

**🎯 Concetto Core: una sola corsia, e le code che la alimentano**
Testo del concetto (uno o più paragrafi, fino al prossimo grassetto).

**📖 1. Teoria (Fondamenta)**
- [Titolo risorsa](https://esempio.org/pagina)
- Descrizione: cosa si impara da questa risorsa.

**📺 2. Studio (Visualizzazione)**
- [Titolo video](https://www.youtube.com/watch?v=xxxxxxxxxxx)
- Descrizione: …

**🛠️ 3. Pratica (Testing & Debugging)**
- [Esercizi](https://esempio.org/esercizi)
- Descrizione: …

**🏗️ 4. Mini Progetto Finale: "Nome del progetto"**
- [Traccia](https://esempio.org/progetto)
- Descrizione del progetto: …
```

Regole:
- Ogni unità ha **esattamente quattro sezioni**, riconosciute dall'emoji all'inizio del grassetto: 📖 `teoria` · 📺 `studio` · 🛠️ `pratica` · 🏗️ `progetto`. Il numero (`1.`…`4.`) è opzionale. Etichette in interfaccia: Teoria · Studio · Pratica · Mini progetto. Il testo dopo emoji e numero è l'**intestazione** della sezione (es. "Fondamenta", "Mini Progetto Finale: \"Batteria di previsioni\"").
- Un'unità con meno di quattro sezioni si importa con avviso ("importata con N sezioni"); una sezione ripetuta prende la prima occorrenza.
- Una sezione dura fino al prossimo grassetto a inizio riga, alla prossima intestazione o a `---`.
- **Risorse** = ogni link markdown `[titolo](http…)` dentro la sezione (anche più di uno, anche in mezzo alla descrizione). `host` = dominio senza `www.`. **Descrizione** = le righe `Descrizione:` / `Descrizione del progetto…:` della sezione, altrimenti il testo discorsivo della sezione senza i bullet dei link. Il grassetto viene rimosso, il resto è verbatim.
- I link YouTube (`youtube.com/watch?v=`, `youtu.be/`, `shorts/`, `embed/`) sono video incorporabili: il primo della sezione Studio alimenta la VideoCard di S12.
- **Concetto core**: `**🎯 Concetto Core: titolo**` seguito dal testo. Titolo e testo sono campi separati (l'interfaccia mostra "Concetto core · titolo" come etichetta e il testo nel box).
- **Ore stimate** e **Difficoltà** (opzionali): `~8 h`, `6–8 ore`, `Difficoltà: alta|media|bassa` ovunque nell'unità.

---

## 4. Cosa produce l'import

| Livello | Campi |
|---|---|
| Corso | titolo, sottotitolo, data di import, moduli, numero unità, unità completate, unità corrente (puntatore) |
| Modulo | numero, `nn` a due cifre, titolo, tipo, prerequisiti, finestra indicativa, trasversali, intro, obiettivi, unità, domande, esercizi, criteri (testo + `auto`), no-go, riassunto, progetto (titolo, descrizione, risorsa), test di fit, stato `bloccato / aperto / passato` |
| Unità | numero, titolo, **markdown integrale** (fonte primaria dell'AI), concetto core (titolo, testo), 4 sezioni, ore, difficoltà, stato `non iniziata · parziale · da rivedere · completata · saltata`, progresso, minuti, confidenza |
| Sezione | tipo, etichetta, intestazione, risorse, descrizione, stato `da fare · in corso · fatta` |
| Risorsa | titolo, URL, host |

Ordine del puntatore: modulo (numero nel nome del file) → unità (ordine nel file). Un modulo è **bloccato** finché il modulo precedente non ha tutti i criteri Go/No-Go sì; il primo modulo è sempre aperto. Il puntatore non entra in un modulo bloccato.

---

## 5. Corso dei mock

`M0-Riattivazione_JavaScript.md` (9 unità, 7 criteri, test di fit) e `M1-Tooling_Moderno.md` (4 unità, 5 criteri). Titolo del corso: "Syllabus Software Engineer 2026". I moduli M2–M4 mostrati bloccati nelle schermate non hanno file: sono segnaposto con solo numero e titolo.
