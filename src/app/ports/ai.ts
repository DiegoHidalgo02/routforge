/**
 * Porta del modello AI (MECC §18; T-026; D-AI-1): Gemini con la chiave dell'utente, senza proxy. La chiave arriva dal
 * servizio a ogni chiamata e non esce da questa porta (INV-17). Un errore porta lo `status` HTTP (`null` senza risposta,
 * per esempio offline) e il messaggio del servizio: lo traduce `aiError` del dominio.
 */

export interface TurnoAi {
  ruolo: 'utente' | 'modello';
  testo: string;
}

export interface RichiestaAi {
  chiave: string;
  modello: string;
  /** Le regole e il materiale (`systemInstruction` del dominio). */
  sistema: string;
  /** La cronologia come turni, l'ultimo è il messaggio dell'utente (§18). */
  turni: TurnoAi[];
}

export interface ErroreServizio {
  status: number | null;
  message: string;
}

export interface AiClient {
  /** I pezzi della risposta man mano che arrivano (streaming, §18); il segnale la interrompe. */
  stream(richiesta: RichiestaAi, segnale: AbortSignal): AsyncIterable<string>;
  /** Una chiamata leggera che rifiuta una chiave non valida («Verifica» di S22). */
  verify(chiave: string): Promise<void>;
}
