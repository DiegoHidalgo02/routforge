// Lo stato della sync per la UI (T-033): account, fase, modifiche in coda, ultima riuscita, dispositivi. Il servizio lo
// registra `main.tsx`; senza servizio (nei test della UI) lo stato è quello di chi non ha un account.
import { useSyncExternalStore } from 'react';
import { currentSyncService, SENZA_ACCOUNT, type StatoSync } from '../app/sync';

const iscrivi = (f: () => void) => currentSyncService()?.subscribe(f) ?? (() => undefined);
const leggi = () => currentSyncService()?.snapshot() ?? SENZA_ACCOUNT;

export const useSync = (): StatoSync => useSyncExternalStore(iscrivi, leggi);
