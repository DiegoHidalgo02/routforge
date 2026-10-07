package com.routforge.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StrikethroughSpan;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.content.ContextCompat;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Widget della schermata Home (MECC §21; T-023; D-DESIGN-1 n. 17): disegna il contenuto che l'app ha calcolato e salvato
 * (`WidgetNativoPlugin`), già con i testi nella lingua dell'app. Mini mese col pallino nel colore del tipo prevalente,
 * weekend attenuati e oggi in bianco; agenda di oggi coi completati barrati; «Prossima»; «+». Ogni tocco apre l'app con
 * un collegamento `routforge://` (oggi, creazione, attività).
 */
public class RoutForgeWidget extends AppWidgetProvider {

    static final String PREFERENZE = "routforge_widget";
    static final String CHIAVE = "contenuto";
    private static final int RIGHE_AGENDA = 4;
    private static final int CELLE = 42;

    @Override
    public void onUpdate(Context context, AppWidgetManager gestore, int[] ids) {
        gestore.updateAppWidget(ids, viste(context));
    }

    /** Ridisegna tutti i widget col contenuto salvato: lo chiama il plugin a ogni aggiornamento dall'app. */
    static void ridisegna(Context context) {
        AppWidgetManager gestore = AppWidgetManager.getInstance(context);
        if (gestore == null) return;
        int[] ids = gestore.getAppWidgetIds(new ComponentName(context, RoutForgeWidget.class));
        if (ids.length > 0) gestore.updateAppWidget(ids, viste(context));
    }

    /** Il giorno locale di adesso, «AAAA-MM-GG» come `localDayKey` dell'app. */
    private static String oggi() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).format(new Date());
    }

    private static PendingIntent apri(Context context, String collegamento, int codice) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(collegamento), context, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            context,
            codice,
            intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
    }

    private static int id(Context context, String nome) {
        return context.getResources().getIdentifier(nome, "id", context.getPackageName());
    }

    private static int colore(Context context, String tipo) {
        int risorsa;
        switch (tipo) {
            case "studio":
                risorsa = R.color.widget_studio;
                break;
            case "routine":
                risorsa = R.color.widget_routine;
                break;
            case "todo":
                risorsa = R.color.widget_todo;
                break;
            case "evento":
                risorsa = R.color.widget_evento;
                break;
            default:
                risorsa = R.color.widget_testo_2;
        }
        return ContextCompat.getColor(context, risorsa);
    }

    private static RemoteViews viste(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_routforge);
        v.setOnClickPendingIntent(R.id.radice, apri(context, "routforge://oggi", 0));
        v.setOnClickPendingIntent(R.id.piu, apri(context, "routforge://crea", 1));
        String testo = context.getSharedPreferences(PREFERENZE, Context.MODE_PRIVATE).getString(CHIAVE, null);
        if (testo == null) return v;
        try {
            JSONObject j = new JSONObject(testo);
            // Contenuto di un giorno passato (app chiusa da ieri): né agenda né «oggi» evidenziato, solo il nome dell'app
            boolean attuale = oggi().equals(j.optString("giorno"));
            v.setTextViewText(R.id.mese, j.optString("mese"));
            JSONArray settimana = j.optJSONArray("settimana");
            for (int i = 0; i < 7; i++) {
                v.setTextViewText(id(context, "gs" + i), settimana != null ? settimana.optString(i) : "");
            }
            JSONArray giorni = j.optJSONArray("giorni");
            for (int i = 0; i < CELLE; i++) {
                JSONObject g = giorni != null ? giorni.optJSONObject(i) : null;
                int cella = id(context, "d" + i);
                if (g == null || !g.optBoolean("mese")) {
                    v.setTextViewText(cella, "");
                    continue;
                }
                boolean eOggi = attuale && g.optBoolean("oggi");
                SpannableStringBuilder s = new SpannableStringBuilder(g.optString("n"));
                if (eOggi) {
                    s.setSpan(new StyleSpan(Typeface.BOLD), 0, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                }
                String tipo = g.optString("tipo", "");
                if (!tipo.isEmpty()) {
                    int inizio = s.length();
                    s.append("•");
                    s.setSpan(new ForegroundColorSpan(colore(context, tipo)), inizio, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                }
                v.setTextViewText(cella, s);
                v.setTextColor(
                    cella,
                    ContextCompat.getColor(
                        context,
                        eOggi
                            ? R.color.widget_testo
                            : g.optBoolean("weekend") ? R.color.widget_testo_3 : R.color.widget_testo_2
                    )
                );
            }
            JSONArray agenda = j.optJSONArray("agenda");
            int righe = attuale && agenda != null ? Math.min(agenda.length(), RIGHE_AGENDA) : 0;
            for (int i = 0; i < RIGHE_AGENDA; i++) {
                int riga = id(context, "a" + i);
                JSONObject a = i < righe ? agenda.optJSONObject(i) : null;
                if (a == null) {
                    v.setViewVisibility(riga, View.GONE);
                    continue;
                }
                SpannableStringBuilder s = new SpannableStringBuilder("● ");
                s.setSpan(new ForegroundColorSpan(colore(context, a.optString("tipo"))), 0, 1, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                int inizio = s.length();
                s.append(a.optString("testo"));
                if (a.optBoolean("fatto")) {
                    s.setSpan(new StrikethroughSpan(), inizio, s.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                }
                v.setTextViewText(riga, s);
                v.setViewVisibility(riga, View.VISIBLE);
                v.setOnClickPendingIntent(riga, apri(context, "routforge://attivita/" + Uri.encode(a.optString("id")), 2 + i));
            }
            v.setTextViewText(R.id.vuoto, attuale ? j.optString("vuoto") : context.getString(R.string.app_name));
            v.setViewVisibility(R.id.vuoto, righe == 0 ? View.VISIBLE : View.GONE);
            // «Prossima» vale fino alla fine del suo blocco; i ridisegni del launcher riapplicano solo ciò che si imposta,
            // quindi senza Prossima anche il tocco torna a Oggi (revisione di T-023)
            JSONObject prossima = j.optJSONObject("prossima");
            if (prossima != null && System.currentTimeMillis() >= prossima.optLong("fine", Long.MAX_VALUE)) prossima = null;
            v.setTextViewText(R.id.prossima, prossima != null ? prossima.optString("testo") : "");
            v.setOnClickPendingIntent(
                R.id.prossima,
                apri(
                    context,
                    prossima != null ? "routforge://attivita/" + Uri.encode(prossima.optString("id")) : "routforge://oggi",
                    2 + RIGHE_AGENDA
                )
            );
        } catch (JSONException e) {
            // Un contenuto illeggibile lascia il widget com'era: il prossimo aggiornamento dell'app lo rimette a posto
        }
        return v;
    }
}
