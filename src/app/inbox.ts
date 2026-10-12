/**
 * Notifiche (S21; MECC §8 «Esiti pendenti», §13; FUNZ §7; SCENARI C6): gli esiti da registrare (`pendingOutcomes`: studio
 * perso negli ultimi 3 giorni o programmato con la fine passata, dal più recente, al più 5) con l'unità del blocco, il
 * contatore delle novità e «Ieri · gestite» dal registro delle notifiche (le voci scattate ieri). «Segna tutte lette»
 * registra l'istante in `preferenze`: il contatore si svuota, le pendenti restano finché non c'è l'esito (CONTROLLI).
 */
import type { RoutForgeDb } from '../data/db';
import { blocksBetween, get, list, listBy, save } from '../data/repository';
import { effectiveEnd, pendingOutcomes } from '../domain/lost';
import type { TriggerNotifica } from '../domain/notifications/desiredSet';
import { addLocalDays, localDayKey, startOfLocalDay } from '../domain/time';
import type { TipoBlocco } from '../domain/types';

/** Riga di `preferenze`: l'istante dell'ultimo «Segna tutte lette». */
const CHIAVE_LETTE = 'notificheLette';

export interface EsitoPendente {
  id: string;
  titolo: string;
  /** L'unità del blocco, se ne ha una («Ripasso Modulo 0 · Unità 0.7», «Apri unità»). */
  unita: { id: string; numero: string; corsoId: string } | null;
  inizio: number;
  fine: number;
  stato: 'perso' | 'programmato';
}

export interface VoceIeri {
  chiave: string;
  titolo: string;
  tipo: TipoBlocco;
  trigger: TriggerNotifica;
  anticipo: number;
  istante: number;
  /** Solo per il digest: quanti todo senza orario. */
  todo: number | null;
}

export interface Inbox {
  esiti: EsitoPendente[];
  /** Esiti diventati pendenti dopo l'ultimo «Segna tutte lette» (il contatore di S21 e del menu). */
  nuove: number;
  ieri: VoceIeri[];
  /** Il prossimo avviso in programma (S21 «Tutto in ordine»: «Il prossimo avviso è alle 16:00, …»). */
  prossimo: { istante: number; titolo: string } | null;
}

export async function readInbox(db: RoutForgeDb, now: number): Promise<Inbox> {
  const oggi = startOfLocalDay(now);
  // pendingOutcomes guarda i persi marcati negli ultimi 3 giorni: si leggono per stato, perché dopo un'assenza uno
  // marcato oggi può essere di una settimana fa (audit P3-2); per i programmati con la fine passata basta la finestra
  const [finestra, persi] = await Promise.all([
    blocksBetween(db, localDayKey(addLocalDays(oggi, -4)), localDayKey(now)),
    listBy(db, 'blocchi', 'stato', 'perso'),
  ]);
  const pendenti = pendingOutcomes([...new Map([...finestra, ...persi].map((b) => [b.id, b])).values()], now);
  const lette = Number((await get(db, 'preferenze', CHIAVE_LETTE))?.valore ?? 0);
  const esiti = await Promise.all(
    pendenti.map(async (b) => {
      const u = b.unitaId ? await get(db, 'unita', b.unitaId) : undefined;
      return {
        id: b.id,
        titolo: b.titolo ?? '',
        unita: u ? { id: u.id, numero: u.numero, corsoId: u.corsoId } : null,
        inizio: b.inizio,
        fine: effectiveEnd(b),
        stato: b.stato === 'perso' ? ('perso' as const) : ('programmato' as const),
        dal: b.persoIl ?? effectiveEnd(b),
      };
    }),
  );
  const registro = await list(db, 'registroNotifiche');
  const futuro = registro
    .filter((v) => v.istante > now && v.trigger !== 'prova')
    .sort((a, b) => a.istante - b.istante)[0];
  const ieri = registro
    .filter((v) => v.istante >= addLocalDays(oggi, -1) && v.istante < oggi && v.trigger !== 'prova')
    .sort((a, b) => b.istante - a.istante)
    .map((v) => ({
      chiave: v.chiave,
      titolo: v.titolo,
      tipo: v.tipo,
      trigger: v.trigger,
      anticipo: v.anticipo,
      istante: v.istante,
      todo: v.digest ? v.digest.totale : null,
    }));
  return {
    esiti: esiti.map(({ dal: _dal, ...e }) => e),
    nuove: esiti.filter((e) => e.dal > lette).length,
    ieri,
    prossimo: futuro ? { istante: futuro.istante, titolo: futuro.titolo } : null,
  };
}

/** «Segna tutte lette» (S21): svuota il contatore; gli esiti pendenti restano. */
export async function markAllRead(db: RoutForgeDb, now: number): Promise<void> {
  await save(db, 'preferenze', { id: CHIAVE_LETTE, valore: now }, now);
}
