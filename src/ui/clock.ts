// Orologio delle schermate: l'istante al minuto e il giorno locale, riallineati al ritorno in primo piano. Oggi cambia
// giorno a mezzanotte senza riavvio (SCENARI G4) e il blocco Adesso non aspetta il minuto dopo il ritorno (MECC §9,
// §14). Le schermate leggono ancora `Date.now()`: la porta Clock resta ai servizi di `app` (D-SCHED-1 n. 9).
import { useEffect, useState } from 'react';
import { localDayKey, MINUTE } from '../domain/time';

/** Chiama `fn` al cambio di ogni minuto e quando la pagina torna visibile; restituisce lo stop. */
function aOgniMinuto(fn: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const prossimo = () => {
    timer = setTimeout(
      () => {
        fn();
        prossimo();
      },
      MINUTE - (Date.now() % MINUTE),
    );
  };
  const quandoVisibile = () => {
    if (document.visibilityState === 'visible') fn();
  };
  prossimo();
  document.addEventListener('visibilitychange', quandoVisibile);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', quandoVisibile);
  };
}

/** L'istante corrente, aggiornato al cambio di ogni minuto e al ritorno in primo piano. */
export function useMinuto(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => aOgniMinuto(() => setNow(Date.now())), []);
  return now;
}

/** Il giorno locale "YYYY-MM-DD": la schermata si ridisegna solo quando cambia, non a ogni minuto. */
export function useOggi(): string {
  const [oggi, setOggi] = useState(() => localDayKey(Date.now()));
  useEffect(() => aOgniMinuto(() => setOggi(localDayKey(Date.now()))), []);
  return oggi;
}
