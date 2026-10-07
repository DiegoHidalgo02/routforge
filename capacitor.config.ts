import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.routforge.app',
  appName: 'RoutForge',
  webDir: 'dist',
  plugins: {
    // Icona monocromatica nella barra di stato (T-021): quella del launcher diventa una macchia bianca
    LocalNotifications: { smallIcon: 'ic_stat_routforge', iconColor: '#6E96F2' },
  },
};

export default config;
