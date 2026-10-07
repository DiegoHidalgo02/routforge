package com.routforge.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Servizio in primo piano della sessione di studio (MECC §10.4, D-TIMER-2; T-021): una notifica fissa col cronometro
 * dall'avvio tiene vivo il processo e, con un wake lock parziale, la CPU, così i battiti della WebView continuano anche a
 * schermo spento. Il tocco riapre l'app; lo fermano la chiusura della sessione e l'app tolta dai recenti (allora la
 * WebView non c'è più, e il tempo oltre 30' torna «non verificato»).
 */
public class SessioneService extends Service {

    private static final String CANALE = "sessione";
    private static final int ID = 7341;
    /** Tetto del wake lock: una sessione più lunga di 12 ore non tiene sveglio il telefono all'infinito. */
    private static final long TETTO_MS = 12L * 60 * 60 * 1000;

    private PowerManager.WakeLock sveglio;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String titolo = intent != null ? intent.getStringExtra("titolo") : null;
        String testo = intent != null ? intent.getStringExtra("testo") : null;
        long ora = System.currentTimeMillis();
        long avvio = intent != null ? intent.getLongExtra("avvio", ora) : ora;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            nm.createNotificationChannel(
                new NotificationChannel(CANALE, testo != null ? testo : "", NotificationManager.IMPORTANCE_LOW)
            );
        }
        Intent apri = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tocco = PendingIntent.getActivity(
            this,
            0,
            apri,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        Notification notifica = new NotificationCompat.Builder(this, CANALE)
            .setSmallIcon(R.drawable.ic_stat_routforge)
            .setContentTitle(titolo)
            .setContentText(testo)
            .setWhen(avvio)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setOngoing(true)
            .setContentIntent(tocco)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .build();
        try {
            ServiceCompat.startForeground(
                this,
                ID,
                notifica,
                Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0
            );
        } catch (RuntimeException e) {
            // Il sistema rifiuta il primo piano (per esempio da sfondo): la sessione prosegue come sul web
            stopSelf();
            return START_NOT_STICKY;
        }
        if (sveglio == null) {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                sveglio = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "routforge:sessione");
                sveglio.acquire(TETTO_MS);
            }
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        stopSelf();
    }

    @Override
    public void onDestroy() {
        if (sveglio != null && sveglio.isHeld()) sveglio.release();
        sveglio = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
