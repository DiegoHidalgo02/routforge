package com.routforge.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin locali (D-MAT-2, T-021, T-023, T-057): si registrano prima della creazione del ponte
        registerPlugin(VisorePdfPlugin.class);
        registerPlugin(NonDisturbarePlugin.class);
        registerPlugin(SessioneNativaPlugin.class);
        registerPlugin(WidgetNativoPlugin.class);
        registerPlugin(PromemoriaNativiPlugin.class);
        // Una ricreazione (processo chiuso in sfondo, riapertura dai recenti) non ripete il gesto della notifica, la sveglia
        // né il collegamento del widget che avevano aperto l'app: il ponte rilancerebbe l'intent d'avvio (revisione di T-021)
        Intent avvio = getIntent();
        if (avvio != null && (savedInstanceState != null || (avvio.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0)) {
            avvio.removeExtra("LocalNotificationId");
            avvio.removeExtra(PromemoriaNativiPlugin.SVEGLIA);
            avvio.setData(null);
        }
        super.onCreate(savedInstanceState);
        // La scala del testo del sistema anche nella WebView, che altrimenti la ignora (i token sono in px; FUNZ §23)
        getBridge().getWebView().getSettings().setTextZoom(Math.round(getResources().getConfiguration().fontScale * 100));
    }
}
