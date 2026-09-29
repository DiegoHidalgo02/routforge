// Orologio delle schermate: l'istante al minuto e il giorno locale, riallineati al ritorno in primo piano. Oggi cambia
// giorno a mezzanotte senza riavvio (SCENARI G4) e il blocco Adesso non aspetta il minuto dopo il ritorno (MECC §9,
// §14). Le schermate leggono ancora `Date.now()`: la porta Clock resta ai servizi di `app` (D-SCHED-1 n. 9).
import { useEffect, useState } from 'react';
import { localDayKey, MINUTE } from '../domain/time';

/** Chiama `fn` al cambio di ogni minuto (o di ogni `ms`) e quando la pagina torna visibile; restituisce lo stop. */
function aOgniMinuto(fn: () => void, ms = MINUTE): () => void {
  let timer: ReturnType<typeof setTimeout>;
  const prossimo = () => {
    timer = setTimeout(
      () => {
        fn();
        prossimo();
      },
      ms - (Date.now() % ms),
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

/** L'istante corrente al secondo, per il timer della sessione (T-017): i valori li deriva `domain/timer.ts`. */
export function useSecondo(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => aOgniMinuto(() => setNow(Date.now()), 1000), []);
  return now;
}

/** Il giorno locale "YYYY-MM-DD": la schermata si ridisegna solo quando cambia, non a ogni minuto. */
export function useOggi(): string {
  const [oggi, setOggi] = useState(() => localDayKey(Date.now()));
  useEffect(() => aOgniMinuto(() => setOggi(localDayKey(Date.now()))), []);
  return oggi;
}
