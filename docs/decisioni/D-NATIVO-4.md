# D-NATIVO-4 — La voce dell'Audio Flash-Trivia

**Stato**: applicata il 07/10/2026 con T-028, revisione indipendente applicata; da collaudare sul telefono. Riga nel registro: `docs/01_DECISIONI.md`.

## Contesto
MECC §18 e FUNZ §14.5 vogliono la Trivia a mani libere: la voce di sistema legge la domanda, lascia 5 s di silenzio,
legge la spiegazione e passa all'elemento successivo senza tocchi, nella lingua del materiale, anche a schermo spento
(SCENARI I4). La WebView di Android non ha una `speechSynthesis` che parli; a schermo spento i timer di una pagina
nascosta rallentano fino a un minuto, quindi un silenzio di 5 s contato in JavaScript non regge una playlist.

## Decisione
1. Porta `Voce` (`src/app/ports/voice.ts`): `leggi(elementi, da, lingua, pausaMs, eventi)` e `ferma()`; gli eventi
   dicono la fase (`domanda`, `pausa`, `spiegazione`) e la fine. Il servizio (`readAloud`, `stopReading` di
   `app/practice`) passa i 5 s di `PAUSA_TRIVIA_MS`; una voce che manca o non parla va in Diagnostica.
2. Android: plugin locale `VoceTrivia` (`TextToSpeech` di sistema). La playlist intera, dall'elemento chiesto, entra
   nella coda del motore (`QUEUE_ADD`: domanda, `playSilentUtterance` di 5 s, spiegazione): la lettura continua a
   schermo spento senza timer della WebView. Gli id portano un numero di generazione: dopo `ferma` (pausa, salta, stop,
   uscita) gli eventi della lettura vecchia non arrivano. Da Android 11 il motore è visibile solo con la `<queries>` di
   `TTS_SERVICE` nel manifest. Il motore si collega al primo Play, non a ogni avvio dell'app. Durante la lettura un wake
   lock parziale tiene acceso il processore (un minuto per elemento al massimo, rilasciato a fine, pausa, errore e
   chiusura): i 5 s di silenzio non hanno audio che tenga sveglio il telefono a schermo spento. Un enunciato rifiutato
   dal motore fa fallire la chiamata; un errore della voce ferma la coda (non va avanti da sola fino a salvare una
   playlist non ascoltata). `leggi`, `ferma` e la risposta del motore all'avvio sono sincronizzati.
3. Web: `speechSynthesis`, col silenzio contato da un timer; a schermo spento il browser la ferma.
4. La lingua della voce è un codice BCP 47 che il modello restituisce con la playlist (`triviaLanguage`); senza un
   codice valido parla la lingua del telefono, con una lingua non installata la voce di sistema.
5. Pausa e Play riprendono dall'inizio dell'elemento corrente (`TextToSpeech` non ha la pausa a metà); la Trivia parte
   col primo Play, perché il browser non lascia parlare una pagina senza un gesto.

## Motivazione
La coda nativa col wake lock tiene i 5 s a schermo spento senza un servizio in primo piano (da provare sul telefono per
una playlist intera); un plugin locale non aggiunge dipendenze (come `VisorePdf`, D-MAT-2, e `PromemoriaNativi`,
D-NATIVO-3).

## Alternative scartate
- `@capacitor-community/text-to-speech`: nessun silenzio nativo, quindi i 5 s contati in JavaScript, rallentati a schermo
  spento; una dipendenza in più.
- `speechSynthesis` anche su Android: nella WebView non parla.
- Un servizio in primo piano per la Trivia: più codice e una notifica fissa per una lettura che il motore fa già da sé.

## Conseguenze
- Senza comandi nella notifica: a schermo spento la playlist va avanti fino alla fine, i comandi stanno nell'app.
- Se Android chiude il processo dell'app durante la lettura, il motore si ferma: la playlist resta senza risultato.

## Verifica
Test di servizio e di UI con una voce finta (`src/app/practice.test.ts`, `src/ui/PracticeGames.test.tsx`); compilazione
Android (`./gradlew assembleDebug`). Sul telefono: voce nella lingua del materiale, 5 s di silenzio, schermo spento per
una playlist intera, Salta e Stop, uscita dalla schermata durante la lettura.
