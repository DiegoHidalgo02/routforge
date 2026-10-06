package com.routforge.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Plugin locali (D-MAT-2): si registrano prima della creazione del ponte
        registerPlugin(VisorePdfPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
