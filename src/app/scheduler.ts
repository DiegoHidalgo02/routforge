/**
 * Ciclo dello scheduler (MECC §9): nell'ordine vincolante, riancoraggio al cambio di fuso (D-TIME-2, INV-18) →
 * estensione delle ricorrenze (§7) → spostamento dei todo (§6) → reset degli orfani (§8) → marcatura dei persi (§8, con
 * l'avviso «in ritardo» dei todo, D-HOR-1) → puntatore dei corsi (§11, FUNZ §8). I passi sui dati stanno in una sola
 * transazione: tutto o niente, serializzata con le altre schede e con le azioni dell'utente; senza cambiamenti nessuna
 * scrittura (INV-15). Le regole stanno nel dominio (`reanchor`, `rollPlan`, `orphanPlan`, `lostPlan`, `pointerPlan`);
 * qui si leggono i blocchi e si scrive la differenza. Dopo la transazione vengono la riconciliazione delle notifiche
 * (T-019), gli avvisi «perso» e «in ritardo» (T-020, con gli id restituiti da `runCycle`) e la streak, che non si
 * scrive: `currentStreak` la azzera alla lettura (§12, T-018). Criteri: SCENARI C8, G4, B7; A1, A2, B1, B2, C1, E2.
 * All'avvio e al ritorno in primo piano `start()` registra anche l'apertura, per il ritorno dopo un'assenza (§9,
 * `registerOpening`). Decisioni: D-SCHED-1, D-ASSENZA-1.
 */
import type { RoutForgeDb } from '../data/db';
import { inTransaction, list, listBy, saveBlock, watch } from '../data/repository';
import { lostPlan, orphanPlan } from '../domain/scheduler/cycle';
import { missingOccurrences, reanchor } from '../domain/scheduler/occurrences';
import type { Ricorrenza } from '../domain/types';
import { minutes } from '../domain/time';
import { registerOpening } from './absence';
import { rollTodos } from './horizon';
import { recomputePointer } from './pointer';
import type { Clock } from './ports/clock';
import type { NotificationService } from './notifications';
import { generateOccurrences } from './recurrences';
import { readActiveSession } from './session';

/** Ciò che il ciclo consegna ai passi successivi: gli id da avvisare adesso (T-020). */
export interface AvvisiCiclo {
  /** Todo spostati o «non fatti» il cui avviso «in ritardo» parte adesso (§6, §13.6; D-HOR-1). */
  avvisiRitardo: string[];
  /** Routine e studio persi adesso con la fine nelle ultime 2 ore: avviso «blocco perso» (§8, §13.6). */
  avvisiPerso: string[];
  /** Ricorrenze non estese perché la definizione non si legge (dato rotto, anche da sync): per la Diagnostica (T-032). */
  ricorrenzeSaltate: string[];
}

const TABELLE_CICLO = ['blocchi', 'ricorrenze', 'preferenze', 'corsi', 'unita', 'moduli'] as const;

function leggibile(r: Ricorrenza, now: number): boolean {
  try {
    missingOccurrences(r, [], now);
    return true;
  } catch {
    return false;
  }
}

/** Esegue il ciclo adesso; `fuso` è quello corrente del dispositivo (D-TIME-2). Senza cambiamenti non scrive nulla. */
export function runCycle(db: RoutForgeDb, now: number, fuso: string): Promise<AvvisiCiclo> {
  return inTransaction(db, TABELLE_CICLO, async () => {
    // 0. Riancoraggio (D-TIME-2): i blocchi di oggi e futuri calcolati in un altro fuso, prima di estendere e giudicare
    for (const b of reanchor(await listBy(db, 'blocchi', 'stato', 'programmato'), fuso, now))
      await saveBlock(db, b, now, fuso);
    // 1. Estensione delle ricorrenze (§7): una ricorrenza scaduta non genera nulla; una definizione che non si legge
    //    (il piano puro fallisce) si salta prima di aprire la sua transazione, che fallendo annullerebbe il ciclo, e si
    //    riporta (D-SCHED-1 n. 8)
    const ricorrenzeSaltate: string[] = [];
    for (const r of await list(db, 'ricorrenze')) {
      if (leggibile(r, now)) await generateOccurrences(db, r, now, fuso);
      else ricorrenzeSaltate.push(r.id);
    }
    // 2. Spostamento dei todo (§6)
    const spostati = await rollTodos(db, now, fuso);
    // 3. Reset degli orfani (§8): tornano `programmati` e il passo 4 li giudica
    // Il blocco che la sessione attiva punta (`preferenze.sessioneAttiva`, scritta da `app/session.ts`, D-SCHED-1)
    const attivo = (await readActiveSession(db))?.bloccoId ?? null;
    for (const b of orphanPlan(await listBy(db, 'blocchi', 'stato', 'in_corso'), attivo, now))
      await saveBlock(db, b, now, fuso);
    // 4. Marcatura dei persi (§8; il todo «non fatto», §6)
    const persi = lostPlan(await listBy(db, 'blocchi', 'stato', 'programmato'), now);
    for (const b of persi.persi) await saveBlock(db, b, now, fuso);
    // Puntatore dopo la generazione e la marcatura persa (§11), per ogni corso a ogni ciclo (FUNZ §8; D-SCHED-1)
    for (const c of await list(db, 'corsi')) await recomputePointer(db, c.id, now, fuso);
    return { avvisiRitardo: [...spostati, ...persi.avvisiRitardo], avvisiPerso: persi.avvisiPerso, ricorrenzeSaltate };
  });
}

/**
 * Battito del ciclo con l'app aperta (§9 «controllo ogni 60 s»): il ciclo intero, non solo al cambio di data, perché
 * B7 vuole la routine persa alle 20:30 e le fini alle 23:59 diventano perse alle 00:29; senza cambiamenti il ciclo non
 * scrive (D-SCHED-1 n. 3).
 */
export const BATTITO = minutes(1);

/** Il servizio dello scheduler (docs/02_ARCHITETTURA.md §4): il ciclo con il tempo della porta `Clock` e i suoi inneschi. */
export interface SchedulerService {
  /** Esegue il ciclo adesso (due insieme si serializzano); `undefined` se fallisce, senza eccezioni verso la UI (CONTESTO §3). */
  run(): Promise<AvvisiCiclo | undefined>;
  /**
   * Inneschi di §9: subito, al ritorno in primo piano, a ogni battito e a ogni scrittura sulle ricorrenze. L'avvio e il
   * ritorno in primo piano sono anche le aperture del ritorno dopo un'assenza (D-ASSENZA-1). Restituisce lo stop.
   */
  start(): () => void;
}

export function createScheduler(
  db: RoutForgeDb,
  clock: Clock,
  notifiche?: Pick<NotificationService, 'reconcile'>,
): SchedulerService {
  // Due cicli insieme si serializzano da soli: IndexedDB esegue una transazione di scrittura alla volta sulle stesse
  // tabelle (§7). Un errore non arriva al chiamante e non ferma i successivi; la Diagnostica è di T-032 (D-SCHED-1 n. 8).
  // Dopo la transazione, riuscita o no (i dati restano consistenti), la riconciliazione delle notifiche con lo stesso
  // istante (§13.3, D-NOTIF-1 n. 6)
  const run = async (): Promise<AvvisiCiclo | undefined> => {
    const now = clock.now();
    const esito = await runCycle(db, now, clock.fuso()).catch(() => undefined);
    await notifiche?.reconcile(now).catch(() => undefined);
    return esito;
  };
  return {
    run,
    start() {
      // Un'apertura (§9): il ciclo, poi l'ultima apertura con l'istante dell'apertura, solo se il ciclo è riuscito,
      // perché il messaggio dice che il piano si è già riallineato (FUNZ §2); un errore resta qui come quello del ciclo
      const apri = () => {
        const now = clock.now();
        void run()
          .then((esito) => (esito ? registerOpening(db, now) : undefined))
          .catch(() => undefined);
      };
      apri();
      // Creazione, modifica ed eliminazione di routine scrivono `ricorrenze`; la prima emissione è l'avvio, già eseguito
      let avvio = true;
      const stop = [
        clock.onForeground(apri),
        clock.every(BATTITO, () => void run()),
        watch(
          () => list(db, 'ricorrenze'),
          () => {
            if (avvio) avvio = false;
            else void run();
          },
        ),
      ];
      return () => stop.forEach((smetti) => smetti());
    },
  };
}
