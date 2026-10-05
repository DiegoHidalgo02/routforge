// Avvisi che una schermata lascia a quella sotto di lei quando si chiude (Crea → Oggi, SCENARI G5: «Todo creato · …» con
// «Annulla»): uno alla volta; se nessuno ascolta ancora, aspetta il primo che arriva.
export interface Avviso {
  id: string;
  testo: string;
  annulla: () => Promise<unknown>;
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
