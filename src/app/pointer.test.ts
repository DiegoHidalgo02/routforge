// IndexedDB finto: va importato prima di Dexie, che legge le API globali quando viene caricato.
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type RoutForgeDb } from '../data/db';
import { listBy, saveCourse } from '../data/repository';
import type { BozzaAttivita } from '../domain/activity';
import { parseCourse } from '../domain/course/parser';
import { local } from '../domain/time';
import { createActivity } from './activities';
import { recomputePointer } from './pointer';

const FUSO = 'Europe/Rome';
/** Lunedì 21 settembre 2026 alle 08:00. */
const NOW = local(2026, 9, 21, 8, 0);

let db: RoutForgeDb;
let n = 0;
beforeEach(() => {
  db = openDb(`test-puntatore-${++n}`);
});
afterEach(() => db.delete());

/** Il corso di C1: unità 1.1 e 1.2 nel modulo 1, 2.1 nel modulo 2; `criterio` aggiunge un criterio Go/No-Go al modulo 1. */
async function corsoC1(criterio?: '[ ]' | '[x]'): Promise<string> {
  const verifica = criterio
    ? `\n### Verifica della Comprensione\n**Criteri Go/No-Go**\n- ${criterio} Ripasso fatto\n`
    : '';
  const files = [
    { name: 'M1-Uno.md', content: `# MODULO M1 — Uno\n\n#### Unità 1.1 — A\n\n#### Unità 1.2 — B\n${verifica}` },
    { name: 'M2-Due.md', content: '# MODULO M2 — Due\n\n#### Unità 2.1 — C\n' },
  ];
  const { corso } = parseCourse(files, { corsoId: 'c1', now: NOW });
  await saveCourse(db, corso, NOW);
  return corso.id;
}

/** Routine di studio lun–ven 09:00–10:00 da oggi, sul corso dato (C1). */
async function routineDiStudio(corsoId: string): Promise<void> {
  const bozza: BozzaAttivita = {
    tipo: 'studio',
    titolo: 'Studio',
    note: '',
    promemoria: { modo: 'auto' },
    corsoId,
    giorni: [1, 2, 3, 4, 5],
    inizio: '09:00',
    fine: '10:00',
    dataInizio: '2026-09-21',
    termine: null,
  };
  const r = await createActivity(db, bozza, NOW, FUSO);
  if (!r.ok) throw new Error(r.errori.join());
}

/** Le unità delle occorrenze in ordine d'inizio, come numeri («1.1»), `null` senza unità. */
async function puntate(corsoId: string): Promise<(string | null)[]> {
  const numero = new Map((await listBy(db, 'unita', 'corsoId', corsoId)).map((u) => [u.id, u.numero]));
  return (await listBy(db, 'blocchi', 'corsoId', corsoId))
    .sort((a, b) => a.inizio - b.inizio)
    .map((b) => (b.unitaId ? (numero.get(b.unitaId) ?? b.unitaId) : null));
}

describe('Puntatore — SCENARI C1 (dal database)', () => {
  it('creata la routine di studio lun–ven, le occorrenze future puntano in ordine a 1.1, 1.2, 2.1, poi a nessuna', async () => {
    const corsoId = await corsoC1();
    await routineDiStudio(corsoId);
    await recomputePointer(db, corsoId, NOW, FUSO);
    const unita = await puntate(corsoId);
    expect(unita.slice(0, 4)).toEqual(['1.1', '1.2', '2.1', null]);
    expect(unita.slice(3).every((u) => u === null)).toBe(true);
    expect(unita).toHaveLength(21); // da lunedì 21 settembre a lunedì 19 ottobre, giorni feriali (§7: 28 giorni)
  });

  it('ricalcolare senza cambiamenti non scrive nulla (INV-15)', async () => {
    const corsoId = await corsoC1();
    await routineDiStudio(corsoId);
    await recomputePointer(db, corsoId, NOW, FUSO);
    const prima = await db.blocchi.toArray();
    await recomputePointer(db, corsoId, NOW + 60_000, FUSO);
    expect(await db.blocchi.toArray()).toEqual(prima);
  });
});

describe('Puntatore — D-PTR-1 (FORMATO_CORSO §4: moduli bloccati)', () => {
  it('con un criterio Go/No-Go a no nel modulo 1, il puntatore non entra nel modulo 2', async () => {
    const corsoId = await corsoC1('[ ]');
    await routineDiStudio(corsoId);
    await recomputePointer(db, corsoId, NOW, FUSO);
    expect((await puntate(corsoId)).slice(0, 3)).toEqual(['1.1', '1.2', null]);
  });

  it('con il criterio a sì il modulo 2 è aperto', async () => {
    const corsoId = await corsoC1('[x]');
    await routineDiStudio(corsoId);
    await recomputePointer(db, corsoId, NOW, FUSO);
    expect((await puntate(corsoId)).slice(0, 3)).toEqual(['1.1', '1.2', '2.1']);
  });
});
