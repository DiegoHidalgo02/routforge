import { describe, expect, it, vi } from 'vitest';
import { RevocatoError } from '../app/ports/sync';
import type { Busta } from '../domain/sync';

// Client finto di `@supabase/supabase-js` (audit P2-7): l'ultima RPC chiamata, la sua risposta, l'ascolto della sessione.
const sb = vi.hoisted(() => ({
  chiamate: [] as [string, unknown][],
  risposta: { data: null, error: null } as { data: unknown; error: { message: string } | null },
  ascolto: null as ((evento: string, s: unknown) => void) | null,
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc: (nome: string, parametri: unknown) => {
      sb.chiamate.push([nome, parametri]);
      return Promise.resolve(sb.risposta);
    },
    auth: { onAuthStateChange: (f: (evento: string, s: unknown) => void) => void (sb.ascolto = f) },
  }),
}));

const { supabaseSyncBackend } = await import('./syncSupabase');
const servizio = () => supabaseSyncBackend('https://x.supabase.co', 'chiave-anonima');

describe('Adapter Supabase della sync — MECCANISMI §25, T-033 (audit P2-7)', () => {
  it('il pull chiama pull_records e converte i bigint che PostgREST manda come stringhe', async () => {
    const s = servizio();
    sb.risposta = {
      data: [
        {
          tabella: 'blocchi',
          id: 'b1',
          dati: { id: 'b1' },
          updated_at: '1700000000000',
          deleted_at: '1700000000500',
          generata: false,
          device_id: 'd2',
          seq: '42',
        },
      ],
      error: null,
    };
    const r = await s.pull(7, 100);
    expect(sb.chiamate.at(-1)).toEqual(['pull_records', { p_da: 7, p_limite: 100 }]);
    expect(r).toEqual({
      buste: [
        {
          tabella: 'blocchi',
          id: 'b1',
          dati: { id: 'b1' },
          updatedAt: 1700000000000,
          deletedAt: 1700000000500,
          generata: false,
          dispositivo: 'd2',
          seq: 42,
        },
      ],
      ultimoSeq: 42,
    });
  });

  it('il push manda le buste coi nomi delle colonne di records', async () => {
    const s = servizio();
    sb.risposta = { data: null, error: null };
    const b: Busta = {
      tabella: 'logFasi',
      id: 'l1',
      dati: { id: 'l1' },
      updatedAt: 5,
      deletedAt: null,
      generata: true,
    };
    await s.push([b]);
    expect(sb.chiamate.at(-1)).toEqual([
      'push_records',
      {
        p_righe: [
          { tabella: 'logFasi', id: 'l1', dati: { id: 'l1' }, updated_at: 5, deleted_at: null, generata: true },
        ],
      },
    ]);
  });

  it('«dispositivo_revocato» diventa RevocatoError; gli altri errori tengono il messaggio', async () => {
    const s = servizio();
    sb.risposta = { data: null, error: { message: 'P0001: dispositivo_revocato' } };
    await expect(s.pull(0, 10)).rejects.toBeInstanceOf(RevocatoError);
    sb.risposta = { data: null, error: { message: 'dispositivo_sconosciuto' } };
    const e: unknown = await s.push([]).catch((x: unknown) => x);
    expect(e).not.toBeInstanceOf(RevocatoError);
    expect((e as Error).message).toBe('dispositivo_sconosciuto');
  });

  it('la sessione salvata prende il dispositivo dal session_id del token (base64url)', () => {
    const s = servizio();
    // `{"session_id":"s?~>"}` in base64url contiene `_` e `-`, che `atob` da solo non legge
    const payload = Buffer.from('{"session_id":"s?~>"}').toString('base64url');
    expect(payload).toMatch(/[-_]/);
    sb.ascolto?.('INITIAL_SESSION', { access_token: `h.${payload}.f`, user: { id: 'u1', email: 'a@b.it' } });
    expect(s.session()).toEqual({ userId: 'u1', email: 'a@b.it', dispositivo: 's?~>' });
  });
});
