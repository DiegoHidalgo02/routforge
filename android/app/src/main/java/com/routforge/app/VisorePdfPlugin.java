package com.routforge.app;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;

/**
 * Apre col visore del sistema un PDF che l'app ha scritto nella sua cache (D-MAT-2): su Android il PDF non passa dalla
 * WebView. Il percorso arriva relativo alla cache e deve restarci dentro; all'app dei PDF va solo il permesso di
 * lettura su quell'URI del FileProvider.
 */
@CapacitorPlugin(name = "VisorePdf")
public class VisorePdfPlugin extends Plugin {

    @PluginMethod
    public void apri(PluginCall call) {
        String percorso = call.getString("percorso");
        if (percorso == null) {
            call.reject("percorso mancante");
            return;
        }
        try {
            File cartella = new File(getContext().getCacheDir(), "pdf").getCanonicalFile();
            File file = new File(getContext().getCacheDir(), percorso).getCanonicalFile();
            if (!cartella.equals(file.getParentFile()) || !file.isFile()) {
                call.reject("percorso fuori dalla cache dei PDF");
                return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/pdf")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (IOException | RuntimeException e) {
            // Nessuna app per i PDF (ActivityNotFoundException), URI rifiutato dal FileProvider, permessi: mai un crash
            call.reject("PDF non aperto", e);
        }
    }
}
