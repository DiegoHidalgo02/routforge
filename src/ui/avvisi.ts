// Avvisi che una schermata lascia a quella sotto di lei quando si chiude (Crea → Oggi, SCENARI G5: «Todo creato · …» con
// «Annulla»; Modifica → Oggi, «Modifiche salvate» senza): uno alla volta; se nessuno ascolta ancora, aspetta il primo
// che arriva.
/** Il pallino del toast (S1): verde per ciò che è fatto, colore del todo per i todo nuovi, primary per il resto. */
export type Tono = 'successo' | 'todo' | 'info';

export interface Avviso {
  id: string;
  testo: string;
  tono: Tono;
  annulla?: () => Promise<unknown>;
}

let inAttesa: Avviso | null = null;
const ascolti = new Set<(a: Avviso) => void>();

export function lascia(a: Avviso): void {
  if (ascolti.size === 0) inAttesa = a;
  else for (const f of ascolti) f(a);
}

export function ascolta(f: (a: Avviso) => void): () => void {
  ascolti.add(f);
  if (inAttesa) {
    f(inAttesa);
    inAttesa = null;
  }
  return () => void ascolti.delete(f);
}
