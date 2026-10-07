// Il modello AI (porta `AiClient`; MECC §18; T-026; D-AI-1): l'API REST di Gemini con `fetch` e la risposta in
// streaming (SSE, `alt=sse`), senza SDK: servono una chiamata e un lettore di righe. La chiave va nell'intestazione
// `x-goog-api-key`, mai nell'indirizzo (resterebbe nei log). Un blocco di sicurezza (`blockReason`, `finishReason`)
// diventa un errore col messaggio «SAFETY»; nessuna risposta HTTP (offline, rete) un errore con `status` `null`.
import type { AiClient, ErroreServizio } from '../app/ports/ai';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';
const BLOCCATA = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION']);

const errore = (status: number | null, message: string): Error & ErroreServizio =>
  Object.assign(new Error(message), { status });

async function chiama(url: string, init: RequestInit): Promise<Response> {
  const r = await fetch(url, init).catch((e: unknown) => {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw errore(null, e instanceof Error ? e.message : String(e));
  });
  if (!r.ok) {
    const corpo = (await r.json().catch(() => null)) as { error?: { message?: string; status?: string } } | null;
    throw errore(r.status, [corpo?.error?.status, corpo?.error?.message ?? r.statusText].filter(Boolean).join(' '));
  }
  return r;
}

interface Pezzo {
  promptFeedback?: { blockReason?: string };
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  error?: { code?: number; message?: string; status?: string };
}

export const geminiClient: AiClient = {
  async *stream({ chiave, modello, sistema, turni }, segnale) {
    const r = await chiama(`${BASE}/models/${encodeURIComponent(modello)}:streamGenerateContent?alt=sse`, {
      method: 'POST',
      signal: segnale,
      headers: { 'content-type': 'application/json', 'x-goog-api-key': chiave },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: turni.map((t) => ({ role: t.ruolo === 'utente' ? 'user' : 'model', parts: [{ text: t.testo }] })),
      }),
    });
    if (!r.body) return;
    const lettore = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let resto = '';
    for (let fine = false; !fine;) {
      const { value, done } = await lettore.read();
      fine = done;
      resto += value ?? '';
      const righe = resto.split('\n');
      // A fine flusso si legge anche l'ultima riga senza a capo
      resto = fine ? '' : (righe.pop() ?? '');
      for (const riga of righe) {
        if (!riga.startsWith('data:')) continue;
        let p: Pezzo;
        try {
          p = JSON.parse(riga.slice(5)) as Pezzo;
        } catch {
          // Una riga che non è JSON (un segnale di fine, un pezzo rotto) non ferma la risposta
          continue;
        }
        // Un errore arrivato dentro il flusso (quota, servizio) vale come la risposta HTTP che lo porta
        if (p.error) throw errore(p.error.code ?? null, [p.error.status, p.error.message].filter(Boolean).join(' '));
        if (p.promptFeedback?.blockReason) throw errore(null, `SAFETY ${p.promptFeedback.blockReason}`);
        const c = p.candidates?.[0];
        const testo = c?.content?.parts?.map((x) => x.text ?? '').join('') ?? '';
        if (testo) yield testo;
        if (c?.finishReason && BLOCCATA.has(c.finishReason)) throw errore(null, `SAFETY ${c.finishReason}`);
      }
    }
  },
  async verify(chiave) {
    // Una rete che non risponde non lascia «Verifica» in sospeso: dopo 15 s è un errore di rete
    await chiama(`${BASE}/models?pageSize=1`, {
      headers: { 'x-goog-api-key': chiave },
      signal: AbortSignal.timeout(15_000),
    }).catch((e: unknown) => {
      if (e instanceof DOMException && e.name === 'TimeoutError') throw errore(null, 'network timeout');
      throw e;
    });
  },
};
