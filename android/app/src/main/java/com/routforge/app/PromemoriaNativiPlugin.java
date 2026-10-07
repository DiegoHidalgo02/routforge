package com.routforge.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.view.View;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * I promemoria armati in proprio (T-057; D-NATIVO-3, `PromemoriaReceiver`) e la schermata della sveglia (S8). L'app va
 * sopra il blocco schermo solo per una sveglia salvata nell'archivio (non per un intent qualsiasi) e con la WebView
 * nascosta finché S8 non è disegnata (`mostra`): nessun'altra schermata si vede senza sblocco. Indietro, «Chiudi» e lo
 * sblocco la tolgono da sopra il blocco. Nessun metodo lancia verso l'app: Capacitor rilancerebbe e l'app si chiuderebbe.
 */
@CapacitorPlugin(name = "PromemoriaNativi")
public class PromemoriaNativiPlugin extends Plugin {

    static final String SVEGLIA = "com.routforge.app.SVEGLIA";
    private static PromemoriaNativiPlugin vivo;
    private OnBackPressedCallback indietro;

    @Override
    public void load() {
        vivo = this;
    }

    @Override
    protected void handleOnDestroy() {
        if (vivo == this) vivo = null;
    }

    /** Un gesto in sfondo è in coda: se l'app gira lo applica subito. `false` se l'app non gira. */
    static boolean avvisa() {
        PromemoriaNativiPlugin p = vivo;
        if (p == null) return false;
        p.notifyListeners("gesti", new JSObject());
        return true;
    }

    @PluginMethod
    public void programma(PluginCall call) {
        try {
            JSArray voci = call.getArray("voci");
            List<JSONObject> nuove = new ArrayList<>();
            for (int i = 0; i < voci.length(); i++) nuove.add(voci.getJSONObject(i));
            PromemoriaReceiver.programma(getContext(), nuove);
            PromemoriaReceiver.pulisci(getContext(), System.currentTimeMillis());
            call.resolve();
        } catch (JSONException | RuntimeException e) {
            call.reject("promemoria non armati", e);
        }
    }

    @PluginMethod
    public void annulla(PluginCall call) {
        try {
            JSArray ids = call.getArray("ids");
            List<Integer> via = new ArrayList<>();
            for (int i = 0; i < ids.length(); i++) via.add(ids.getInt(i));
            PromemoriaReceiver.annulla(getContext(), via, false);
            call.resolve();
        } catch (JSONException | RuntimeException e) {
            call.reject("promemoria non annullati", e);
        }
    }

    @PluginMethod
    public void prendiGesti(PluginCall call) {
        try {
            JSObject esito = new JSObject();
            esito.put("gesti", PromemoriaReceiver.prendiGesti(getContext()));
            call.resolve(esito);
        } catch (JSONException | RuntimeException e) {
            call.reject("gesti illeggibili", e);
        }
    }

    /** Le notifiche a schermo intero (Android 14+ le può negare): `null` dove il permesso non esiste. */
    @PluginMethod
    public void schermoIntero(PluginCall call) {
        JSObject esito = new JSObject();
        if (Build.VERSION.SDK_INT >= 34) esito.put("concesso", NotificationManagerCompat.from(getContext()).canUseFullScreenIntent());
        else esito.put("concesso", JSObject.NULL);
        call.resolve(esito);
    }

    /** Aperta dalla sveglia (schermo intero o tocco): S8 sopra il blocco, solo per una sveglia dell'archivio. */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (!SVEGLIA.equals(intent.getAction())) return;
        JSONObject v = PromemoriaReceiver.leggi(getContext(), intent.getIntExtra(SVEGLIA, Integer.MIN_VALUE));
        JSONObject extra = v != null && v.optBoolean("sveglia") ? v.optJSONObject("extra") : null;
        if (extra == null) return;
        JSObject sveglia = new JSObject();
        sveglia.put("id", v.optInt("id"));
        sveglia.put("chiave", extra.optString("chiave"));
        sveglia.put("trigger", extra.optString("trigger"));
        sveglia.put("bloccoId", extra.opt("bloccoId"));
        sveglia.put("anticipo", extra.optInt("anticipo"));
        sopraIlBlocco(true);
        notifyListeners("sveglia", sveglia, true);
    }

    private boolean bloccato() {
        KeyguardManager k = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        return k != null && k.isKeyguardLocked();
    }

    /** Sopra il blocco con la WebView nascosta finché S8 non chiama `mostra`; fuori, tutto come prima. */
    private void sopraIlBlocco(boolean si) {
        Activity a = getActivity();
        if (a == null) return;
        a.runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= 27) {
                a.setShowWhenLocked(si);
                a.setTurnScreenOn(si);
            } else if (si) {
                a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
            } else {
                a.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
            }
            getBridge().getWebView().setVisibility(si ? View.INVISIBLE : View.VISIBLE);
            if (indietro != null) indietro.remove();
            indietro = null;
            if (si && a instanceof AppCompatActivity) {
                // Indietro sopra il blocco non torna alla schermata di prima (si vedrebbe senza sblocco): rimette il blocco
                indietro = new OnBackPressedCallback(true) {
                    @Override
                    public void handleOnBackPressed() {
                        sopraIlBlocco(false);
                        a.moveTaskToBack(true);
                    }
                };
                ((AppCompatActivity) a).getOnBackPressedDispatcher().addCallback(indietro);
            }
        });
    }

    /** S8 è disegnata: la WebView si vede (ancora sopra il blocco, ma solo con S8). */
    @PluginMethod
    public void mostra(PluginCall call) {
        Activity a = getActivity();
        if (a != null) a.runOnUiThread(() -> getBridge().getWebView().setVisibility(View.VISIBLE));
        call.resolve();
    }

    private static void risolvi(PluginCall call, boolean sbloccato) {
        JSObject esito = new JSObject();
        esito.put("sbloccato", sbloccato);
        call.resolve(esito);
    }

    /** Prima di aprire l'app da S8: lo sblocco del telefono (PIN, impronta); annullato, S8 resta com'è. */
    @PluginMethod
    public void sblocca(PluginCall call) {
        Activity a = getActivity();
        KeyguardManager k = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        if (a == null || k == null || !k.isKeyguardLocked()) {
            sopraIlBlocco(false);
            risolvi(call, true);
            return;
        }
        if (Build.VERSION.SDK_INT < 26) {
            // Senza la richiesta con risposta: il sistema chiede lo sblocco togliendo la schermata dal blocco
            sopraIlBlocco(false);
            a.runOnUiThread(() -> a.getWindow().addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD));
            risolvi(call, true);
            return;
        }
        a.runOnUiThread(() ->
            k.requestDismissKeyguard(
                a,
                new KeyguardManager.KeyguardDismissCallback() {
                    @Override
                    public void onDismissSucceeded() {
                        sopraIlBlocco(false);
                        risolvi(call, true);
                    }

                    @Override
                    public void onDismissCancelled() {
                        risolvi(call, false);
                    }

                    @Override
                    public void onDismissError() {
                        risolvi(call, false);
                    }
                }
            )
        );
    }

    /**
     * Chiude S8: toglie la sveglia dalle notifiche e l'app da sopra il blocco; `sfondo` rimette il telefono al blocco
     * schermo se è bloccato (a telefono sbloccato l'app resta dov'è).
     */
    @PluginMethod
    public void chiudi(PluginCall call) {
        Integer id = call.getInt("id");
        if (id != null) NotificationManagerCompat.from(getContext()).cancel(id);
        boolean daMandareDietro = Boolean.TRUE.equals(call.getBoolean("sfondo", false)) && bloccato();
        sopraIlBlocco(false);
        Activity a = getActivity();
        if (a != null && daMandareDietro) a.runOnUiThread(() -> a.moveTaskToBack(true));
        call.resolve();
    }
}
