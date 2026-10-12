# RoutForge — Collaudo sul telefono

*Le prove che qui non si fanno: niente emulatore né dispositivo (T-021, D-NATIVO-2, D-RILASCIO-1). Si spuntano
installando l'APK sul telefono; un difetto trovato diventa un task o una riga di `audit/nuovi-problemi.md`.*

## Installare l'APK di rilascio

1. `npm run apk` → `android/app/build/outputs/apk/release/app-release.apk` (firmato con la chiave di `~/.routforge`).
2. Se sul telefono c'è un APK di debug: **prima** Impostazioni → Backup → «Esporta backup» (la firma è diversa e
   Android non aggiorna l'app: va disinstallata, e coi dati se ne va tutto), poi disinstalla, installa la release e
   importa il backup. Corsi, PDF, sessioni e chat tornano solo dal backup.
3. Impostazioni → Informazioni mostra la versione 0.1.0, come «Info app» di Android.

## Notifiche e sveglie

- Permesso e canali delle notifiche; allarmi esatti; «Sveglie a schermo intero» in Diagnostica.
- Azioni Posticipa · Inizia · Segna fatto · Registra esito e tocco (rotta giusta, `toccoVerificaIl`); Posticipa e
  «Segna fatto» ad app chiusa (nessun gesto ripetuto dopo `am kill` con l'app in sfondo); riarmo dopo il riavvio.
- Sveglia S8 sopra il blocco: sblocco prima di aprire, indietro, Chiudi.
- Utili: `adb shell dumpsys alarm`, `dumpsys deviceidle force-idle`, 35' a schermo spento.

## Sessione di studio

- Notifica fissa della sessione col cronometro e battiti con l'app chiusa (Doze, arresto forzato = intervallo non
  verificato); schermo acceso; Non Disturbare con l'accesso dato; tasto indietro nell'iperfocus; vibrazione.

## Il resto

- Scala del testo; cambio di fuso ad app aperta; PDF col visore del sistema; backup in Documenti e import.
- Widget e collegamenti (a 110 dp d'altezza se taglia: 3 righe d'agenda).
- Voce della Trivia: lingua, 5 s, una playlist a schermo spento, Salta, uscita, Play dopo un errore; swipe di DevSwipe
  partendo dal codice.
- Icona sul launcher (tonda, quadrata, a tema su Android 13+) e splash scuro col logo all'avvio.
