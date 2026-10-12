// Il servizio della sync in memoria contro le regole dell'SQL di `supabase/schema.sql` che toccano i dati (audit P2-7):
// è la «specifica eseguibile» dell'SQL, e i test della sync valgono per il servizio vero solo se gli somiglia.
import { describe, expect, it } from 'vitest';
import type { Busta } from '../domain/sync';
import { CODICE_FINTO, createSyncStore, memorySyncBackend } from './syncMemory';

const busta = (tabella: string, id: string, dati: Record<string, unknown> = { id }): Busta =>
  ({ tabella, id, dati, updatedAt: 1000, deletedAt: null, generata: false }) as Busta;

async function dueDispositivi(trattieniMs?: number) {
  const archivio = createSyncStore();
  let ora = 10_000;
  let n = 0;
  const nuovo = () => `id-${++n}`;
  const servizio = () =>
    memorySyncBackend(archivio, () => ora, nuovo, trattieniMs === undefined ? {} : { trattieniMs });
  const [telefono, tablet] = [servizio(), servizio()];
  for (const d of [telefono, tablet]) {
    await d.verifyCode('diego@example.com', CODICE_FINTO);
    await d.registerDevice('prova', 'web');
  }
  return { telefono, tablet, avanza: (ms: number) => (ora += ms) };
}

describe('Servizio in memoria come l’SQL — MECCANISMI §25, D-SYNC-3, D-SYNC-4 n. 2 (audit P2-7)', () => {
  it('una busta fuori dall’ambito o con l’id dei dati diverso si scarta in silenzio, come la `where` di push_records', async () => {
    const { telefono, tablet } = await dueDispositivi();
    await telefono.push([
      busta('corsi', 'c1'),
      busta('preferenze', 'chiaveAi', { id: 'chiaveAi', valore: 'x' }),
      busta('blocchi', 'b1', { id: 'b2' }),
      busta('blocchi', 'b3'),
    ]);
    expect((await tablet.pull(0, 100)).buste.map((b) => `${b.tabella}:${b.id}`)).toEqual(['blocchi:b3']);
  });

  it('una riga che il servizio rifiuta fa fallire l’intera chiamata senza scrivere nulla, come il check di records', async () => {
    const { telefono, tablet } = await dueDispositivi();
    const enorme = busta('blocchi', 'b2', { id: 'b2', note: 'x'.repeat(1100 * 1024) });
    await expect(telefono.push([busta('blocchi', 'b1'), enorme])).rejects.toThrow();
    expect((await tablet.pull(0, 100)).buste).toEqual([]);
  });

  it('con la finestra dell’SQL una riga appena ricevuta aspetta 5 s prima di uscire dal pull', async () => {
    const { telefono, tablet, avanza } = await dueDispositivi(5000);
    await telefono.push([busta('blocchi', 'b1')]);
    avanza(1000);
    expect((await tablet.pull(0, 100)).buste).toEqual([]);
    avanza(5000);
    expect((await tablet.pull(0, 100)).buste.map((b) => b.id)).toEqual(['b1']);
  });
});

describe('Tetto del lotto — MECCANISMI §25, D-SYNC-4 n. 10 (audit P2-21)', () => {
  it('un lotto oltre 500 righe si rifiuta intero, come push_records; 500 passano', async () => {
    const { telefono, tablet } = await dueDispositivi();
    const lotto = (n: number) => Array.from({ length: n }, (_, i) => busta('blocchi', `b${i}`));
    await expect(telefono.push(lotto(501))).rejects.toThrow('lotto_troppo_grande');
    expect((await tablet.pull(0, 1000)).buste).toEqual([]);
    await telefono.push(lotto(500));
    expect((await tablet.pull(0, 1000)).buste).toHaveLength(500);
  });
});

describe('Istanti non interi — MECCANISMI §25 (audit N-4)', () => {
  it('un istante con la virgola fa fallire il lotto intero, come il cast a bigint di push_records', async () => {
    const { telefono, tablet } = await dueDispositivi();
    await expect(telefono.push([{ ...busta('blocchi', 'b1'), updatedAt: 1000.5 }])).rejects.toThrow();
    expect((await tablet.pull(0, 1000)).buste).toEqual([]);
  });
});
