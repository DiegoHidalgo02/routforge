package com.routforge.app;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Riceve dall'app il contenuto del widget (MECC §21; T-023), lo salva per i ridisegni del sistema e ridisegna subito
 * tutti i widget (`RoutForgeWidget`).
 */
@CapacitorPlugin(name = "WidgetNativo")
public class WidgetNativoPlugin extends Plugin {

    @PluginMethod
    public void aggiorna(PluginCall call) {
        String contenuto = call.getString("contenuto");
        if (contenuto == null) {
            call.reject("contenuto mancante");
            return;
        }
        // Un'eccezione in un metodo del plugin farebbe chiudere l'app (Capacitor la rilancia): torna all'app come errore
        try {
            getContext()
                .getSharedPreferences(RoutForgeWidget.PREFERENZE, Context.MODE_PRIVATE)
                .edit()
                .putString(RoutForgeWidget.CHIAVE, contenuto)
                .apply();
            RoutForgeWidget.ridisegna(getContext());
            call.resolve();
        } catch (RuntimeException e) {
            call.reject("widget non aggiornato", e);
        }
    }
}
