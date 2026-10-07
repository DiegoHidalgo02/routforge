package com.routforge.app;

import android.content.Intent;
import androidx.core.content.ContextCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Avvia e ferma il servizio in primo piano della sessione (`SessioneService`; MECC §10.4, D-TIMER-2; T-021). Un avvio
 * rifiutato dal sistema (per esempio da sfondo su Android 12+) torna come errore: la sessione prosegue come sul web.
 */
@CapacitorPlugin(name = "SessioneNativa")
public class SessioneNativaPlugin extends Plugin {

    @PluginMethod
    public void avvia(PluginCall call) {
        Intent servizio = new Intent(getContext(), SessioneService.class)
            .putExtra("titolo", call.getString("titolo", ""))
            .putExtra("testo", call.getString("testo", ""))
            .putExtra("avvio", call.getLong("avvio", System.currentTimeMillis()));
        try {
            ContextCompat.startForegroundService(getContext(), servizio);
            call.resolve();
        } catch (RuntimeException e) {
            call.reject("servizio della sessione non avviato", e);
        }
    }

    @PluginMethod
    public void ferma(PluginCall call) {
        getContext().stopService(new Intent(getContext(), SessioneService.class));
        call.resolve();
    }
}
