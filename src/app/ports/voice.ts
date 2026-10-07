/**
 * La voce di sistema dell'Audio Flash-Trivia (MECC §18, FUNZ §14.5; T-028): legge una playlist da un elemento in poi,
 * domanda → silenzio → spiegazione → elemento successivo, senza tocchi, nella lingua data (null: la voce di sistema).
 * Su Android la coda è del motore nativo e continua a schermo spento; sul web è `speechSynthesis`. `ferma` serve a
 * pausa, salta e stop: dopo, la lettura fermata non manda più eventi.
 */
export type FaseVoce = 'domanda' | 'pausa' | 'spiegazione';

export interface EventiVoce {
  fase(indice: number, fase: FaseVoce): void;
  fine(): void;
  errore(): void;
}

export interface Voce {
  leggi(
    elementi: readonly { domanda: string; spiegazione: string }[],
    da: number,
    lingua: string | null,
    pausaMs: number,
    eventi: EventiVoce,
  ): Promise<void>;
  ferma(): Promise<void>;
}
