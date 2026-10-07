/**
 * Porta della rete (MECC §18 «Offline»; T-026): se c'è connessione e quando torna, per i messaggi della chat scritti
 * offline. Adapter in `src/platform/network.ts` (eventi del browser, validi anche nella WebView di Capacitor).
 */
export interface Rete {
  online(): boolean;
  /** Chiama `fn` a ogni ritorno della connessione; restituisce lo stop. */
  onOnline(fn: () => void): () => void;
}
