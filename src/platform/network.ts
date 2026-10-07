// La rete (porta `Rete`; MECC §18 offline; T-026): `navigator.onLine` e l'evento `online`, gli stessi nella WebView.
import type { Rete } from '../app/ports/network';

export const webNetwork: Rete = {
  online: () => navigator.onLine,
  onOnline(fn) {
    addEventListener('online', fn);
    return () => removeEventListener('online', fn);
  },
};
