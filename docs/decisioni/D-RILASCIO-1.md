# D-RILASCIO-1 — Rilascio: PWA, icone, firma Android e deploy web

**Stato**: applicata il 09/10/2026 (T-035), su richiesta dell'utente di «portare il progetto a rilascio per la parte
web e android». Le scelte di CP6 (firma, nome e icona, deploy) le ha prese l'agente: l'utente può cambiarle. Riga nel
registro: `docs/01_DECISIONI.md`.

## Contesto

CONTESTO §3 vuole Android, iOS e web installabile, tutto offline salvo AI e sync; T-035 chiede l'APK firmato, la PWA
con `vite-plugin-pwa` e la CI, con CP6 alla chiusura (firma con la copia della chiave fuori dal repository, nome e icona
definitivi, deploy della PWA, `docs/06_SUPERVISIONE.md`). L'audit del 09/10 (C-9) chiede per il web un'origine propria:
la chiave Gemini (IndexedDB) e la sessione di Supabase (`localStorage`) sono legate all'origine, e ogni altra pagina
della stessa origine le leggerebbe.

## Decisione

1. **PWA**: `vite-plugin-pwa` 1.3.0 (la 2.0.0 è uscita il 03/10/2026), `generateSW`, `registerType: 'autoUpdate'`:
   Workbox mette in cache tutti i file della build (anche il worker di pdf.js e i font) e serve `index.html` per ogni
   rotta, così l'app si apre offline; nessuna risposta di rete in cache (AI e sync restano solo in linea). Dopo un nuovo
   deploy il service worker nuovo prende subito il controllo (`skipWaiting`, `clientsClaim`: con `injectRegister: false`
   il plugin non li mette da solo) e la pagina si ricarica: i dati sono in IndexedDB.
2. **Solo nel browser**: `src/platform/pwa.ts` registra il service worker se l'app non gira in Capacitor (nell'APK i
   file arrivano dal pacchetto e una cache terrebbe la versione di prima). «Reinstalla PWA» di Diagnostica compare solo
   dove un service worker controlla la pagina («(web)» del design, `COMPONENTI.md`): svuota la cache dell'app, deregistra
   e ricarica. Con la PWA attiva anche «Svuota cache» la reinstalla (la cache è la sua: svuotata e basta, l'app non si
   aprirebbe più offline); offline le due azioni non fanno nulla.
3. **Nome e icona**: «RoutForge»; l'icona è il logo del design (riquadro `.logo` della Shell: `--color-primary`, raggio
   9/30, Logomark in `--color-text` largo metà del lato). `scripts/icone.mjs` lo disegna dai token (INV-20) in tutte le
   misure: favicon SVG, icone del manifest (192 e 512 arrotondate, 512 piena per le maschere), `apple-touch-icon`,
   icona adattiva di Android (fondo primary, barre vettoriali, versione monocromatica) e icone per Android 7, splash sul
   fondo `--color-bg` (Android 7–11 col drawable, dal 12 lo splash del sistema con gli stessi colori).
4. **Firma Android**: chiave PKCS12 (RSA 4096, alias `routforge`) in `~/.routforge/routforge-release.jks`, password in
   `~/.routforge/keystore.properties`, creata il 09/10/2026; `android/app/build.gradle` la legge da lì e senza il file la
   release non è firmata. Mai nel repository. **Copia di sicurezza della cartella `~/.routforge` a carico dell'utente**:
   senza quella chiave un'app installata non si aggiorna più. `npm run apk` (release firmata) e `npm run apk:debug`.
5. **Deploy web**: non GitHub Pages, perché l'origine `diegohidalgo02.github.io` ospita già altri due siti dell'utente
   (C-9). La build è pronta per un host con un'origine propria, Cloudflare Pages o Netlify: comando `npm run build`,
   cartella `dist`; la build scrive `dist/_headers` con la CSP (rete solo verso l'app, Gemini e l'origine esatta di
   `VITE_SUPABASE_URL`, senza `wss:`; YouTube senza cookie; wasm di pdf.js; font `data:`) e le intestazioni di
   sicurezza; `public/_redirects` per le rotte su Netlify (Cloudflare Pages fa da sé il ripiego SPA). Per la sync vera sul
   web l'host deve avere `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Collegare l'host è un'azione dell'utente
   (serve il suo account).
6. **CI**: la build di rilascio gira dopo il gate.

## Motivazione

L'offline di CONTESTO §3 chiede la cache di tutta la build; l'aggiornamento automatico evita una richiesta all'utente
che il design non disegna. L'icona viene dal design, non da una scelta nuova. La chiave fuori dal repository rispetta
CLAUDE.md §8; un'origine propria è l'unica difesa contro le altre pagine dello stesso host.

## Alternative scartate

- GitHub Pages: gratuito e già collegato al repository, ma con l'origine condivisa con altri siti dell'utente.
- Aggiornamento «prompt» del service worker: serve un avviso che il design non ha.
- Service worker anche nell'APK: cache vecchie dopo un aggiornamento dell'app.
- Icone generate con `sharp` o `@vite-pwa/assets-generator`: dipendenze nuove per poche immagini.
- Chiave nel repository o in `android/`: un segreto versionato o a portata di `git add`.

## Conseguenze

- Passare da un APK di debug all'APK firmato: la firma è diversa, quindi prima si esporta un backup, poi si disinstalla
  la versione di debug, si installa la release e si importa il backup.
- La CSP segue `VITE_SUPABASE_URL` della build: l'host del deploy deve avere le stesse variabili della sync.
- Un aggiornamento appena scaricato ricarica la pagina: un testo non ancora salvato (una bozza in Crea, un messaggio
  in Chat) si perde; succede solo dopo un nuovo deploy, di solito nei primi secondi dall'apertura.
- Il bundle principale supera i 500 kB (avviso di Vite): lo copre la cache del service worker; la divisione in pezzi
  resta un miglioramento separato.

## Verifica

Edge headless sulla build servita con `_headers` e `_redirects` (09/10/2026): nessun errore d'installabilità
(`Page.getInstallabilityErrors`), manifest senza errori, service worker attivo che controlla la pagina, rotte e corso di
esempio caricati anche offline, «Reinstalla PWA» presente, nessuna violazione della CSP. `npm run apk`: APK firmato
(schema v2, `CN=RoutForge`), `versionCode` 100, `versionName` 0.1.0. Test: `src/ui/Settings.test.tsx` («Reinstalla PWA»,
«Svuota cache»). Revisione indipendente del 12/10/2026: corretti l'aggiornamento che non partiva, «Svuota cache» che
rompeva l'offline, la CSP troppo larga su Supabase, le azioni offline e i controlli della firma (`keystore.properties`
incompleto, letto in UTF-8; APK annunciato solo se scritto da questa build).
