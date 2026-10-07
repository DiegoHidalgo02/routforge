package com.routforge.app;

import android.content.Context;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * La voce dell'Audio Flash-Trivia (MECC §18, T-028, D-NATIVO-4): la playlist intera entra nella coda del motore di
 * sintesi del sistema (domanda, silenzio, spiegazione per ogni elemento), così la lettura continua a schermo spento
 * senza i timer della WebView. Gli eventi `fase` e `fine` dicono alla pagina dove è arrivata; quelli di una lettura
 * fermata non arrivano (il numero di generazione negli id). Il motore si collega al primo Play, non a ogni avvio
 * dell'app; durante la lettura un wake lock parziale tiene acceso il processore, perché i 5 s di silenzio non hanno
 * audio che lo tenga sveglio a schermo spento. `leggi`, `ferma` e la risposta del motore all'avvio girano su thread
 * diversi: sono sincronizzati sul plugin.
 */
@CapacitorPlugin(name = "VoceTrivia")
public class VoceTriviaPlugin extends Plugin {

    /** Un minuto per elemento: abbondante per domanda, silenzio e spiegazione, e il wake lock non resta acceso. */
    private static final long MS_PER_ELEMENTO = 60_000;

    private TextToSpeech tts;
    /** null finché il motore non ha risposto all'avvio. */
    private Boolean pronta;
    private volatile int generazione;
    private volatile int ultimo;
    private PluginCall inAttesa;
    private PowerManager.WakeLock sveglio;

    private void avviaMotore() {
        tts = new TextToSpeech(getContext(), stato -> {
            synchronized (VoceTriviaPlugin.this) {
                pronta = stato == TextToSpeech.SUCCESS;
                PluginCall c = inAttesa;
                inAttesa = null;
                if (c != null) leggi(c);
            }
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override
            public void onStart(String id) {
                evento(id, true);
            }

            @Override
            public void onDone(String id) {
                evento(id, false);
            }

            @Override
            public void onError(String id) {
                if (id == null || !id.startsWith(generazione + ":")) return;
                rilascia();
                notifyListeners("errore", new JSObject());
            }
        });
    }

    /** Id «generazione:indice:parte»: inizio della domanda e della spiegazione, fine della domanda (silenzio), fine. */
    private void evento(String id, boolean inizio) {
        String[] p = id == null ? new String[0] : id.split(":");
        if (p.length != 3 || !p[0].equals(String.valueOf(generazione))) return;
        int indice = Integer.parseInt(p[1]);
        String parte = p[2];
        if (inizio && !parte.equals("pausa")) fase(indice, parte);
        else if (!inizio && parte.equals("domanda")) fase(indice, "pausa");
        else if (!inizio && parte.equals("spiegazione") && indice == ultimo) {
            rilascia();
            notifyListeners("fine", new JSObject());
        }
    }

    private void fase(int indice, String fase) {
        JSObject e = new JSObject();
        e.put("indice", indice);
        e.put("fase", fase);
        notifyListeners("fase", e);
    }

    @PluginMethod
    public synchronized void leggi(PluginCall call) {
        if (tts == null) avviaMotore();
        if (pronta == null) {
            // Una chiamata sostituita prima che il motore risponda non è un errore
            if (inAttesa != null) inAttesa.resolve();
            inAttesa = call;
            return;
        }
        if (!pronta) {
            call.reject("sintesi vocale non disponibile");
            return;
        }
        JSArray elementi = call.getArray("elementi");
        int da = call.getInt("da", 0);
        int pausa = call.getInt("pausaMs", 5000);
        String lingua = call.getString("lingua");
        try {
            int g = ++generazione;
            tts.stop();
            // Lingua non installata o non supportata: resta la voce di sistema; senza lingua torna quella del telefono
            tts.setLanguage(lingua != null ? Locale.forLanguageTag(lingua) : Locale.getDefault());
            ultimo = elementi.length() - 1;
            for (int i = da; i < elementi.length(); i++) {
                JSONObject e = elementi.getJSONObject(i);
                accodata(tts.speak(e.getString("domanda"), TextToSpeech.QUEUE_ADD, null, g + ":" + i + ":domanda"));
                accodata(tts.playSilentUtterance(pausa, TextToSpeech.QUEUE_ADD, g + ":" + i + ":pausa"));
                accodata(
                    tts.speak(e.getString("spiegazione"), TextToSpeech.QUEUE_ADD, null, g + ":" + i + ":spiegazione")
                );
            }
            tieniSveglio((long) (elementi.length() - da) * MS_PER_ELEMENTO);
            call.resolve();
        } catch (JSONException | RuntimeException e) {
            generazione++;
            tts.stop();
            rilascia();
            call.reject("playlist non letta", e);
        }
    }

    /** Il motore che rifiuta un enunciato (scollegato, aggiornato, chiuso): la chiamata fallisce invece di restare muta. */
    private static void accodata(int esito) {
        if (esito == TextToSpeech.ERROR) throw new IllegalStateException("motore di sintesi non disponibile");
    }

    private void tieniSveglio(long ms) {
        if (sveglio == null) {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            sveglio = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "routforge:trivia");
            sveglio.setReferenceCounted(false);
        }
        sveglio.acquire(ms);
    }

    private synchronized void rilascia() {
        if (sveglio != null && sveglio.isHeld()) sveglio.release();
    }

    @PluginMethod
    public synchronized void ferma(PluginCall call) {
        generazione++;
        if (inAttesa != null) {
            inAttesa.resolve();
            inAttesa = null;
        }
        if (tts != null) tts.stop();
        rilascia();
        call.resolve();
    }

    @Override
    protected synchronized void handleOnDestroy() {
        rilascia();
        if (tts != null) tts.shutdown();
    }
}
