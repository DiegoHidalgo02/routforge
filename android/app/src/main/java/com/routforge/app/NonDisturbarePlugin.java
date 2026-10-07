package com.routforge.app;

import android.app.NotificationManager;
import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Non Disturbare dell'iperfocus (MECC §10.4; T-021): lo attiva solo se l'utente ha dato all'app l'accesso a Non
 * disturbare nelle impostazioni del sistema, e alla fine ripristina il filtro di prima, salvato nelle preferenze così
 * sopravvive alla ricreazione dell'app. Senza accesso risponde «non attivo» e non apre nulla: l'iperfocus vale comunque.
 */
@CapacitorPlugin(name = "NonDisturbare")
public class NonDisturbarePlugin extends Plugin {

    private static final String PREFERENZE = "routforge_non_disturbare";
    private static final String PRIMA = "prima";

    private NotificationManager gestore() {
        return (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
    }

    private SharedPreferences preferenze() {
        return getContext().getSharedPreferences(PREFERENZE, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void attiva(PluginCall call) {
        NotificationManager nm = gestore();
        JSObject esito = new JSObject();
        if (nm == null || !nm.isNotificationPolicyAccessGranted()) {
            esito.put("attivo", false);
            call.resolve(esito);
            return;
        }
        if (!preferenze().contains(PRIMA)) preferenze().edit().putInt(PRIMA, nm.getCurrentInterruptionFilter()).apply();
        nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
        esito.put("attivo", true);
        call.resolve(esito);
    }

    @PluginMethod
    public void stato(PluginCall call) {
        NotificationManager nm = gestore();
        JSObject esito = new JSObject();
        esito.put("accesso", nm != null && nm.isNotificationPolicyAccessGranted());
        call.resolve(esito);
    }

    @PluginMethod
    public void disattiva(PluginCall call) {
        NotificationManager nm = gestore();
        SharedPreferences p = preferenze();
        if (nm != null && p.contains(PRIMA) && nm.isNotificationPolicyAccessGranted()) {
            nm.setInterruptionFilter(p.getInt(PRIMA, NotificationManager.INTERRUPTION_FILTER_ALL));
        }
        p.edit().remove(PRIMA).apply();
        call.resolve();
    }
}
