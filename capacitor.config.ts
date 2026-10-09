import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.routforge.app',
  appName: 'RoutForge',
  webDir: 'dist',
  plugins: {
    // Icona monocromatica nella barra di stato (T-021): quella del launcher diventa una macchia bianca. `iconColor` è
    // `--color-primary` di claude-design/design/tokens.css copiato a mano (questa config non legge il CSS): al reimport del
    // design si riallinea (docs/03_HANDOFF_DESIGN_CODE.md §0)
    LocalNotifications: { smallIcon: 'ic_stat_routforge', iconColor: '#6E96F2' },
  },
};

export default config;
