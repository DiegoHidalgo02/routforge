// Il lettore della risposta in streaming di Gemini (SSE; MECC §18; T-026): righe spezzate fra due pezzi, `\r\n`, righe
// che non sono JSON, blocco di sicurezza ed errori HTTP, con un `fetch` finto.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { geminiClient } from './aiGemini';

const richiesta = { chiave: 'AIza-prova', modello: 'gemini-2.5-flash', sistema: 'regole', turni: [] };
const flusso = (pezzi: string[], status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(c) {
              for (const p of pezzi) c.enqueue(new TextEncoder().encode(p));
              c.close();
            },
          }),
          { status },
        ),
      ),
    ),
  );
const testo = (t: string) => `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: t }] } }] })}`;
const leggi = async () => {
  const fuori: string[] = [];
  for await (const p of geminiClient.stream(richiesta, new AbortController().signal)) fuori.push(p);
  return fuori;
};

afterEach(() => vi.unstubAllGlobals());

describe('Lettore SSE di Gemini — MECCANISMI §18 (T-026)', () => {
  it('righe spezzate fra due pezzi, \\r\\n, righe non JSON e l’ultima senza a capo', async () => {
    const a = testo('Il micro');
    flusso([`${a.slice(0, 20)}`, `${a.slice(20)}\r\n\r\n`, 'data: [DONE]\n\n', testo('task')]);
    expect(await leggi()).toEqual(['Il micro', 'task']);
  });

  it('un blocco di sicurezza e un errore dentro il flusso diventano errori; la chiave va nell’intestazione', async () => {
    flusso([`data: ${JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })}\n\n`]);
    await expect(leggi()).rejects.toMatchObject({ status: null, message: 'SAFETY SAFETY' });
    flusso([`data: ${JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'quota' } })}\n\n`]);
    await expect(leggi()).rejects.toMatchObject({ status: 429 });
    const chiamata = vi.mocked(fetch).mock.calls[0];
    expect(String(chiamata?.[0])).not.toContain('AIza-prova');
    expect(chiamata?.[1]?.headers).toMatchObject({ 'x-goog-api-key': 'AIza-prova' });
  });

  it('generazione della pratica (T-027): JSON chiesto al servizio, le parti unite; un blocco è un errore', async () => {
    const risposta = (corpo: unknown) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve(new Response(JSON.stringify(corpo)))),
      );
    risposta({ candidates: [{ content: { parts: [{ text: '[{"fronte":' }, { text: '"a","retro":"b"}]' }] } }] });
    expect(await geminiClient.generate(richiesta, new AbortController().signal)).toBe('[{"fronte":"a","retro":"b"}]');
    const corpo = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body)) as {
      generationConfig?: { responseMimeType?: string };
    };
    expect(corpo.generationConfig?.responseMimeType).toBe('application/json');
    risposta({ candidates: [{ finishReason: 'SAFETY' }] });
    await expect(geminiClient.generate(richiesta, new AbortController().signal)).rejects.toMatchObject({
      status: null,
      message: 'SAFETY SAFETY',
    });
  });

  it('una risposta HTTP d’errore porta lo status e il messaggio del servizio', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'API key not valid' } }), {
            status: 400,
          }),
        ),
      ),
    );
    await expect(geminiClient.verify('x')).rejects.toMatchObject({
      status: 400,
      message: 'INVALID_ARGUMENT API key not valid',
    });
  });
});
