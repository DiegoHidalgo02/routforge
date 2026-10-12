package com.routforge.app;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Promemoria armati in proprio (MECC §13.1 n. 4, §13.2, §21; T-057; D-NATIVO-3): le sveglie a schermo intero e le
 * notifiche dei todo, le sole con azioni che non aprono l'app («Segna fatto» senza voci aperte e «Posticipa», A6). Il
 * plugin delle notifiche apre sempre l'app e non ha lo schermo intero; il resto passa ancora da lui.
 *
 * Le voci (JSON preparato dall'app: id, istante, canale, testi, azioni, extra) stanno nelle preferenze della memoria
 * del dispositivo, leggibili anche prima del primo sblocco, così il riavvio le riarma. Allo scatto la notifica: il tocco
 * e le azioni che aprono l'app hanno gli extra del plugin delle notifiche, così il gesto arriva all'app per la stessa
 * strada; le azioni in sfondo arrivano qui, si accodano e l'app le applica appena gira. Se l'app gira gli allarmi li
 * cambia lei con la riconciliazione, che conosce lo stato del blocco (§13.2); ad app ferma li cambia questo ricevitore.
 */
public class PromemoriaReceiver extends BroadcastReceiver {

    static final String SCATTA = "com.routforge.app.SCATTA";
    static final String AZIONE = "com.routforge.app.AZIONE";
    private static final String QUICKBOOT = "android.intent.action.QUICKBOOT_POWERON";
    private static final String PREFERENZE = "routforge_promemoria";
    private static final String GESTI = "gesti";
    private static final long POSTICIPO_MS = 10 * 60 * 1000L;
    private static final long GIORNO_MS = 24 * 60 * 60 * 1000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        String azione = intent.getAction();
        if (azione == null) return;
        try {
            switch (azione) {
                case SCATTA:
                    JSONObject v = leggi(context, intent.getIntExtra("id", 0));
                    if (v != null) mostra(context, v);
                    break;
                case AZIONE:
                    gesto(context, new JSONObject(intent.getStringExtra("voce")), intent.getStringExtra("azione"));
                    break;
                case Intent.ACTION_BOOT_COMPLETED:
                case Intent.ACTION_LOCKED_BOOT_COMPLETED:
                case QUICKBOOT:
                    riarma(context);
                    break;
                default:
            }
        } catch (JSONException | RuntimeException e) {
            // Nessuna eccezione esce dal ricevitore: l'app riarma tutto alla prima riconciliazione del processo
        }
    }

    // --- Archivio -----------------------------------------------------------------------------------------------------

    private static SharedPreferences archivio(Context context) {
        Context c = Build.VERSION.SDK_INT >= 24 ? context.createDeviceProtectedStorageContext() : context;
        return c.getSharedPreferences(PREFERENZE, Context.MODE_PRIVATE);
    }

    static JSONObject leggi(Context context, int id) {
        String s = archivio(context).getString("v" + id, null);
        try {
            return s == null ? null : new JSONObject(s);
        } catch (JSONException e) {
            return null;
        }
    }

    /** Le voci salvate, saltando quelle illeggibili. */
    private static List<JSONObject> voci(Context context) {
        List<JSONObject> tutte = new ArrayList<>();
        for (Map.Entry<String, ?> e : archivio(context).getAll().entrySet()) {
            if (!e.getKey().startsWith("v") || !(e.getValue() instanceof String)) continue;
            try {
                tutte.add(new JSONObject((String) e.getValue()));
            } catch (JSONException ignorata) {
                // Una voce illeggibile non ferma le altre
            }
        }
        return tutte;
    }

    /** Salva e arma le voci, con una sola scrittura; stesso id = sostituzione. */
    static void programma(Context context, List<JSONObject> nuove) throws JSONException {
        SharedPreferences.Editor e = archivio(context).edit();
        for (JSONObject v : nuove) e.putString("v" + v.getInt("id"), v.toString());
        e.commit();
        for (JSONObject v : nuove) arma(context, v);
    }

    /** Toglie allarmi e voci, con una sola scrittura; `tendina` toglie anche le notifiche mostrate. */
    static void annulla(Context context, List<Integer> ids, boolean tendina) {
        AlarmManager am = context.getSystemService(AlarmManager.class);
        SharedPreferences.Editor e = archivio(context).edit();
        for (int id : ids) {
            PendingIntent pi = scatto(context, id, PendingIntent.FLAG_NO_CREATE);
            if (pi != null && am != null) {
                am.cancel(pi);
                pi.cancel();
            }
            if (tendina) NotificationManagerCompat.from(context).cancel(id);
            e.remove("v" + id);
        }
        e.commit();
    }

    /** I gesti fatti senza aprire l'app, in ordine; la coda si svuota. Sincronizzato con l'accodamento del ricevitore. */
    static synchronized JSONArray prendiGesti(Context context) throws JSONException {
        SharedPreferences p = archivio(context);
        JSONArray gesti = new JSONArray(p.getString(GESTI, "[]"));
        p.edit().remove(GESTI).commit();
        return gesti;
    }

    private static synchronized void accoda(Context context, JSONObject gesto) throws JSONException {
        SharedPreferences p = archivio(context);
        JSONArray gesti = new JSONArray(p.getString(GESTI, "[]"));
        gesti.put(gesto);
        p.edit().putString(GESTI, gesti.toString()).commit();
    }

    // --- Allarmi ------------------------------------------------------------------------------------------------------

    private static PendingIntent scatto(Context context, int id, int flag) {
        Intent i = new Intent(context, PromemoriaReceiver.class)
            .setAction(SCATTA)
            .setData(Uri.parse("routforge-promemoria://" + id))
            .putExtra("id", id);
        return PendingIntent.getBroadcast(context, id, i, PendingIntent.FLAG_IMMUTABLE | flag);
    }

    /** All'istante esatto anche col telefono a riposo; la sveglia come sveglia del sistema (icona e schermo intero). */
    private static void arma(Context context, JSONObject v) throws JSONException {
        AlarmManager am = context.getSystemService(AlarmManager.class);
        if (am == null) return;
        int id = v.getInt("id");
        long istante = v.getLong("istante");
        PendingIntent pi = scatto(context, id, PendingIntent.FLAG_UPDATE_CURRENT);
        boolean esatto = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
        if (esatto && v.optBoolean("sveglia")) {
            // Il tocco sulla prossima sveglia del sistema apre l'app, non S8: prima dello scatto niente sopra il blocco
            PendingIntent app = PendingIntent.getActivity(
                context,
                id,
                new Intent(context, MainActivity.class),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );
            am.setAlarmClock(new AlarmManager.AlarmClockInfo(istante, app), pi);
        } else if (esatto) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, istante, pi);
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, istante, pi);
        }
    }

    /** Dopo il riavvio: riarma le voci future, toglie le altre (le sveglie perse col telefono spento non suonano in ritardo). */
    private static void riarma(Context context) {
        long ora = System.currentTimeMillis();
        List<Integer> passate = new ArrayList<>();
        for (JSONObject v : voci(context)) {
            try {
                if (v.getLong("istante") > ora) arma(context, v);
                else passate.add(v.getInt("id"));
            } catch (JSONException | RuntimeException ignorata) {
                // Una voce illeggibile non ferma le altre
            }
        }
        annulla(context, passate, false);
    }

    /** Le altre voci dello stesso blocco, allarmi e notifiche in tendina: un todo completato in sfondo non suona più (A6). */
    private static void annullaBlocco(Context context, String bloccoId) {
        if (bloccoId == null) return;
        List<Integer> ids = new ArrayList<>();
        for (JSONObject v : voci(context)) {
            JSONObject extra = v.optJSONObject("extra");
            if (extra != null && bloccoId.equals(extra.optString("bloccoId")) && v.has("id")) ids.add(v.optInt("id"));
        }
        annulla(context, ids, true);
    }

    /** Le voci scattate da più di un giorno: l'app non le cancella (sono scattate), qui escono dall'archivio. */
    static void pulisci(Context context, long ora) {
        List<Integer> vecchie = new ArrayList<>();
        for (JSONObject v : voci(context)) if (v.optLong("istante") < ora - GIORNO_MS && v.has("id")) vecchie.add(v.optInt("id"));
        if (!vecchie.isEmpty()) annulla(context, vecchie, false);
    }

    // --- Notifica -----------------------------------------------------------------------------------------------------

    /** Apre l'app con gli extra del plugin delle notifiche: il gesto arriva come `localNotificationActionPerformed`. */
    private static PendingIntent apri(Context context, JSONObject v, String azione) throws JSONException {
        int id = v.getInt("id");
        JSONObject notifica = new JSONObject().put("id", id).put("extra", v.getJSONObject("extra"));
        Intent i = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_MAIN)
            .addCategory(Intent.CATEGORY_LAUNCHER)
            .setData(Uri.parse("routforge-promemoria://" + id + "/" + azione))
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra("LocalNotificationId", id)
            .putExtra("LocalNotificationUserAction", azione)
            .putExtra("LocalNotficationObject", notifica.toString());
        return PendingIntent.getActivity(context, id, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Un'azione che non apre l'app: torna a questo ricevitore. */
    private static PendingIntent sfondo(Context context, JSONObject v, String azione) throws JSONException {
        int id = v.getInt("id");
        Intent i = new Intent(context, PromemoriaReceiver.class)
            .setAction(AZIONE)
            .setData(Uri.parse("routforge-promemoria://" + id + "/" + azione))
            .putExtra("voce", v.toString())
            .putExtra("azione", azione);
        return PendingIntent.getBroadcast(context, id, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** La schermata della sveglia (S8): l'app sopra il blocco schermo; il plugin rilegge la voce dall'archivio (id). */
    static PendingIntent schermo(Context context, JSONObject v) throws JSONException {
        int id = v.getInt("id");
        JSONObject extra = v.optJSONObject("extra");
        Intent i = new Intent(context, MainActivity.class)
            .setAction(PromemoriaNativiPlugin.SVEGLIA)
            .setData(Uri.parse("routforge-sveglia://" + id))
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(PromemoriaNativiPlugin.SVEGLIA, id)
            .putExtra(PromemoriaNativiPlugin.SEGRETO, extra != null ? extra.optString("segreto") : "");
        return PendingIntent.getActivity(context, id, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    /** Il canale c'è se l'app l'ha creato all'avvio; se quella creazione è fallita la notifica non va persa. */
    private static void canale(Context context, String id, boolean sveglia) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(id) != null) return;
        int importanza = sveglia ? NotificationManager.IMPORTANCE_HIGH : NotificationManager.IMPORTANCE_DEFAULT;
        nm.createNotificationChannel(new NotificationChannel(id, context.getString(R.string.app_name), importanza));
    }

    private static void mostra(Context context, JSONObject v) throws JSONException {
        NotificationManagerCompat nm = NotificationManagerCompat.from(context);
        if (!nm.areNotificationsEnabled()) return;
        boolean sveglia = v.optBoolean("sveglia");
        String canale = v.optString("canale", "todo");
        canale(context, canale, sveglia);
        NotificationCompat.Builder b = new NotificationCompat.Builder(context, canale)
            .setSmallIcon(R.drawable.ic_stat_routforge)
            .setColor(ContextCompat.getColor(context, R.color.widget_primary))
            .setContentTitle(v.optString("titolo"))
            .setContentText(v.optString("corpo"))
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentIntent(sveglia ? schermo(context, v) : apri(context, v, "tap"));
        JSONArray azioni = v.optJSONArray("azioni");
        for (int i = 0; azioni != null && i < azioni.length(); i++) {
            JSONObject a = azioni.getJSONObject(i);
            String id = a.getString("id");
            b.addAction(0, a.optString("titolo"), a.optBoolean("sfondo") ? sfondo(context, v, id) : apri(context, v, id));
        }
        if (sveglia) {
            b.setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setFullScreenIntent(schermo(context, v), true);
        }
        nm.notify(v.getInt("id"), b.build());
    }

    // --- Gesti in sfondo ----------------------------------------------------------------------------------------------

    /**
     * Posticipa e «Segna fatto» senza voci aperte: la notifica sparisce e il gesto si accoda con il suo istante. Ad app
     * ferma il telefono si aggiorna subito: il posticipo si riarma solo se la voce salvata è ancora quella scattata (un
     * blocco spostato nel frattempo ha la sua), «Segna fatto» toglie le altre voci del todo.
     */
    static void gesto(Context context, JSONObject v, String azione) throws JSONException {
        long ora = System.currentTimeMillis();
        int id = v.getInt("id");
        JSONObject extra = v.getJSONObject("extra");
        NotificationManagerCompat.from(context).cancel(id);
        accoda(
            context,
            new JSONObject()
                .put("chiave", extra.optString("chiave"))
                .put("trigger", extra.optString("trigger"))
                .put("bloccoId", extra.opt("bloccoId"))
                .put("gesto", azione)
                .put("istante", ora)
        );
        if (!PromemoriaNativiPlugin.avvisa()) {
            JSONObject salvata = leggi(context, id);
            if ("posticipa".equals(azione) && salvata != null && salvata.optLong("istante") == v.optLong("istante")) {
                List<JSONObject> una = new ArrayList<>();
                una.add(new JSONObject(v.toString()).put("istante", ora + POSTICIPO_MS));
                programma(context, una);
            } else if ("segna_fatto".equals(azione)) {
                annullaBlocco(context, extra.optString("bloccoId", null));
            }
        }
        pulisci(context, ora);
    }
}
