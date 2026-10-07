/**
 * La sincronizzazione fra dispositivi (MECC §1, §25; T-033; piano `docs/piani/T-033.md`): l'account email + codice, la
 * coda delle modifiche locali spedita al servizio, le righe degli altri dispositivi ricevute con «ultimo vince» per
 * record (`decide`, D-SYNC-1, D-SYNC-2), la fusione al primo accesso (J4), l'uscita che lascia i dati (J5), «Scollega»
 * e «Cancella i dati remoti». Una sincronizzazione alla volta (una richiesta durante la riesegue alla fine); parte
 * all'avvio, al ritorno in primo piano, al ritorno della rete, all'accesso e dopo 3 s da una modifica locale. Gli errori
 * vanno in Diagnostica, mai alla UI (INV-16). Criteri: SCENARI J1, J2, J4, J5; il ciclo dopo la ricezione è di T-034.
 */
import type { RoutForgeDb } from '../data/db';
import {
  dequeue,
  enqueueAll,
  get,
  inTransaction,
  list,
  purge,
  putRemote,
  rawRow,
  save,
  watch,
} from '../data/repository';
import {
  CHIAVE_STATO_SYNC,
  decide,
  isSynced,
  mergeLocalFields,
  TABELLE_SINCRONIZZATE,
  toEnvelope,
  validEnvelope,
  type BustaRicevuta,
  type TabellaSincronizzata,
} from '../domain/sync';
import { missingOccurrences } from '../domain/scheduler/occurrences';
import type { Ricorrenza } from '../domain/types';
import { logError } from './diagnostics';
import type { Clock } from './ports/clock';
import type { Rete } from './ports/network';
import { RevocatoError, type Dispositivo, type SyncBackend } from './ports/sync';
import { dropOccurrences, followRecurrence } from './recurrences';

/** Lo stato della sync su questo dispositivo: account, cursore, ultima riuscita. Mai in sync né nel backup. */
export const CHIAVE_SYNC = CHIAVE_STATO_SYNC;
/** Il nome facoltativo dell'account (S22 Account): viaggia con la sync, per il saluto su ogni dispositivo. */
export const CHIAVE_PROFILO = 'profilo';
/** «Raggruppata entro pochi secondi» (piano §2.9): la sync parte 3 s dopo l'ultima modifica locale. */
const RITARDO_MS = 3000;
const LOTTO = 200;

interface StatoLocale {
  userId: string;
  cursore: number;
  ultimaSync: number | null;
}
export type FaseSync = 'senza_account' | 'in_pari' | 'in_corso' | 'offline' | 'errore' | 'scollegato';
export interface StatoSync {
  account: { email: string; nome: string | null } | null;
  fase: FaseSync;
  inCoda: number;
  ultimaSync: number | null;
  dispositivi: Dispositivo[];
  /** Il servizio è quello finto in memoria (mancano le chiavi di Supabase): la Diagnostica lo dice. */
  finto: boolean;
}

const leggiStato = async (db: RoutForgeDb) =>
  (await get(db, 'preferenze', CHIAVE_SYNC))?.valore as StatoLocale | undefined;
const scriviStato = (db: RoutForgeDb, s: StatoLocale, now: number) =>
  save(db, 'preferenze', { id: CHIAVE_SYNC, valore: s }, now);
const contaCoda = async (db: RoutForgeDb) => (await list(db, 'syncCoda')).length;
export const readProfileName = async (db: RoutForgeDb): Promise<string | null> => {
  const v = (await get(db, 'preferenze', CHIAVE_PROFILO))?.valore as { nome?: unknown } | undefined;
  return typeof v?.nome === 'string' && v.nome.trim() ? v.nome.trim() : null;
};

/** Il giro si ferma: l'account è uscito o i dati sono stati azzerati mentre aspettava il servizio. */
class Fermata extends Error {}

/** Le occorrenze di qui seguono la ricorrenza ricevuta (§2.3 n. 4): viva, la nuova definizione; eliminata, spariscono. */
async function followReceived(db: RoutForgeDb, b: BustaRicevuta, now: number, fuso: string): Promise<void> {
  if (b.deletedAt !== null) return dropOccurrences(db, b.id, now);
  const r = b.dati as unknown as Ricorrenza;
  try {
    missingOccurrences(r, [], now);
  } catch (e) {
    // Una definizione che non si legge non blocca la pagina, come nel ciclo (D-SCHED-1 n. 8)
    return logError('sync', e);
  }
  await followRecurrence(db, r, now, fuso);
}

/**
 * Una pagina ricevuta, in una transazione (§2.3 n. 3): ogni busta va controllata (`validEnvelope`: un servizio
 * compromesso non scrive fuori dall'ambito); poi il vincitore, con l'istante del gesto della voce in coda (D-SYNC-4); la
 * remota si scrive così com'è (con i campi di questo dispositivo rimessi), toglie dalla coda la modifica locale che ha
 * battuto e, se è una ricorrenza, le occorrenze di qui la seguono al suo posto nella pagina (le righe dopo vincono). Il
 * cursore avanza nella stessa transazione, così una pagina interrotta si riapplica uguale.
 */
function applyPage(
  db: RoutForgeDb,
  buste: readonly BustaRicevuta[],
  mio: string,
  stato: StatoLocale,
  now: number,
  fuso: string,
): Promise<void> {
  return inTransaction(db, [...TABELLE_SINCRONIZZATE], async () => {
    // «Esci», l'import di un backup o «Elimina tutti i dati» durante l'attesa: di questa pagina non si scrive nulla
    if ((await leggiStato(db))?.userId !== stato.userId) throw new Fermata();
    for (const b of buste) {
      if (!validEnvelope(b)) {
        logError('sync', new Error(`busta scartata: ${b.tabella}`));
        continue;
      }
      const locale = await rawRow(db, b.tabella, b.id);
      const voce = await get(db, 'syncCoda', `${b.tabella}:${b.id}`);
      if (decide(locale, voce, b, mio) !== 'remota') continue;
      const riga = mergeLocalFields(
        b.tabella,
        b.dati as { id: string; updatedAt: number; deletedAt: number | null },
        locale,
      );
      await putRemote(db, b.tabella, [riga as never]);
      if (voce) await purge(db, 'syncCoda', [voce.id]);
      if (b.tabella === 'ricorrenze') await followReceived(db, b, now, fuso);
    }
    await scriviStato(db, stato, now);
  });
}

/**
 * La coda spedita a lotti (§2.3 n. 5): le righe lette adesso, con l'istante del gesto della voce (D-SYNC-4); una voce
 * fuori dall'ambito non parte mai; si tolgono le voci non cambiate durante il push.
 */
async function pushQueue(db: RoutForgeDb, backend: SyncBackend): Promise<void> {
  const voci = await list(db, 'syncCoda');
  for (let i = 0; i < voci.length; i += LOTTO) {
    const buste = [];
    const spedite = [];
    for (const v of voci.slice(i, i + LOTTO)) {
      spedite.push({ id: v.id, updatedAt: v.updatedAt });
      if (!isSynced(v.tabella, v.recordId)) continue;
      const tabella = v.tabella as TabellaSincronizzata;
      // Un record che non c'è più (azzerato con l'import di un backup): la voce non ha nulla da spedire
      const riga = await rawRow(db, tabella, v.recordId);
      if (riga) buste.push(toEnvelope(tabella, riga, v));
    }
    if (buste.length) await backend.push(buste);
    await dequeue(db, spedite);
  }
}

export interface SyncService {
  /** Inneschi: avvio, primo piano, rete, modifiche locali, fine della sessione dal servizio. Restituisce lo stop. */
  start(): () => void;
  /** Una sincronizzazione adesso («Sincronizza ora»); mai un'eccezione. */
  run(): Promise<void>;
  sendCode(email: string): Promise<boolean>;
  verifyCode(email: string, codice: string): Promise<boolean>;
  /** «Esci» (J5): il servizio scollega questo dispositivo; dati e coda restano, le modifiche partiranno al rientro. */
  signOut(): Promise<void>;
  /** La parte locale di «Esci», anche per «Elimina tutti i dati» (che altrimenti riscaricherebbe l'account). */
  signOutLocal(): Promise<void>;
  revokeDevice(id: string): Promise<void>;
  eraseRemote(): Promise<boolean>;
  setName(nome: string): Promise<void>;
  subscribe(f: () => void): () => void;
  snapshot(): StatoSync;
}

export function createSyncService(
  db: RoutForgeDb,
  backend: SyncBackend,
  rete: Rete,
  clock: Clock,
  dispositivo: { nome: string; piattaforma: string },
  { pagina = 500, finto = false }: { pagina?: number; finto?: boolean } = {},
): SyncService {
  let stato: StatoSync = {
    account: null,
    fase: 'senza_account',
    inCoda: 0,
    ultimaSync: null,
    dispositivi: [],
    finto,
  };
  const ascolti = new Set<() => void>();
  const aggiorna = (p: Partial<StatoSync>) => {
    stato = { ...stato, ...p };
    for (const f of ascolti) f();
  };
  const conta = async () => aggiorna({ inCoda: await contaCoda(db) });
  const account = async () => {
    const s = backend.session();
    aggiorna({ account: s ? { email: s.email, nome: await readProfileName(db) } : null });
  };

  let inCorso: Promise<void> | null = null;
  let ancora = false;
  let uscendo = false;
  let accedendo = false;

  const scollegato = async () => {
    await signOutLocal();
    aggiorna({ fase: 'scollegato', dispositivi: [] });
  };

  async function giro(): Promise<void> {
    try {
      const s = backend.session();
      await account();
      if (!s) {
        // Senza account le modifiche restano in coda e partiranno al rientro (J5): il conto si vede lo stesso
        await conta();
        return aggiorna({ fase: stato.fase === 'scollegato' ? 'scollegato' : 'senza_account' });
      }
      if (!rete.online()) {
        await conta();
        return aggiorna({ fase: 'offline' });
      }
      aggiorna({ fase: 'in_corso' });
      let locale = await leggiStato(db);
      // Primo accesso, altro account, dopo un import che ha azzerato lo stato: fusione (§2.7, J4)
      if (locale?.userId !== s.userId) {
        await enqueueAll(db);
        locale = { userId: s.userId, cursore: 0, ultimaSync: null };
        await scriviStato(db, locale, clock.now());
      }
      for (;;) {
        const { buste, ultimoSeq } = await backend.pull(locale.cursore, pagina);
        locale = { ...locale, cursore: ultimoSeq };
        await applyPage(db, buste, s.dispositivo, locale, clock.now(), clock.fuso());
        if (buste.length < pagina) break;
      }
      await pushQueue(db, backend);
      locale = { ...locale, ultimaSync: clock.now() };
      await scriviStato(db, locale, clock.now());
      aggiorna({ fase: 'in_pari', ultimaSync: locale.ultimaSync, dispositivi: await backend.devices() });
      await conta();
    } catch (e) {
      if (e instanceof Fermata) return;
      if (e instanceof RevocatoError) return scollegato();
      logError('sync', e);
      aggiorna({ fase: 'errore' });
    }
  }

  async function run(): Promise<void> {
    if (inCorso) {
      ancora = true;
      return inCorso;
    }
    inCorso = (async () => {
      do {
        ancora = false;
        await giro();
      } while (ancora);
    })().finally(() => {
      inCorso = null;
    });
    return inCorso;
  }

  async function signOutLocal(): Promise<void> {
    uscendo = true;
    try {
      const locale = await leggiStato(db);
      // Il cursore riparte da 0: al rientro nello stesso account si riceve tutto di nuovo (idempotente), senza fusione
      if (locale) await scriviStato(db, { ...locale, cursore: 0 }, clock.now());
      await backend.signOut();
    } catch (e) {
      logError('sync', e);
    } finally {
      uscendo = false;
    }
    await account();
    await conta();
  }

  // La sync dopo l'ultima modifica locale: un controllo al secondo finché non passano 3 s senza modifiche
  let ultimaModifica = 0;
  let fermaAttesa: (() => void) | null = null;
  const programma = () => {
    ultimaModifica = clock.now();
    fermaAttesa ??= clock.every(1000, () => {
      if (clock.now() - ultimaModifica < RITARDO_MS) return;
      fermaAttesa?.();
      fermaAttesa = null;
      void run();
    });
  };

  let ultimaSessione = backend.session();
  return {
    start() {
      const stop = [
        clock.onForeground(() => void run()),
        rete.onOnline(() => void run()),
        watch(
          () => contaCoda(db),
          (n) => {
            aggiorna({ inCoda: n });
            if (n > 0 && backend.session()) programma();
          },
        ),
        // Una sessione che arriva (quella salvata, all'avvio) fa partire la sync; una che si chiude dal servizio (revoca,
        // rinnovo fallito) e non da «Esci» fa uscire, coi dati che restano. Nessuna sessione all'avvio = senza account.
        backend.onSessionChange((s) => {
          // Durante l'accesso la sync parte da `verifyCode`, dopo la registrazione del dispositivo
          if (s) {
            if (!accedendo) void run();
          } else if (ultimaSessione && !uscendo) void scollegato();
          ultimaSessione = s;
        }),
      ];
      void run();
      return () => {
        for (const f of stop) f();
        fermaAttesa?.();
        fermaAttesa = null;
      };
    },
    run,
    async sendCode(email) {
      try {
        await backend.sendCode(email);
        return true;
      } catch (e) {
        logError('sync', e);
        return false;
      }
    },
    async verifyCode(email, codice) {
      accedendo = true;
      try {
        await backend.verifyCode(email, codice);
        try {
          await backend.registerDevice(dispositivo.nome, dispositivo.piattaforma);
        } catch (e) {
          // Una sessione senza dispositivo verrebbe rifiutata a ogni giro: si esce e si riprova
          await backend.signOut().catch(() => undefined);
          throw e;
        }
      } catch (e) {
        logError('sync', e);
        return false;
      } finally {
        accedendo = false;
      }
      aggiorna({ fase: 'in_corso' });
      void run();
      return true;
    },
    async signOut() {
      const s = backend.session();
      if (s) await backend.revokeDevice(s.dispositivo).catch((e: unknown) => logError('sync', e));
      await signOutLocal();
      aggiorna({ fase: 'senza_account', dispositivi: [] });
    },
    signOutLocal,
    async revokeDevice(id) {
      try {
        await backend.revokeDevice(id);
        aggiorna({ dispositivi: await backend.devices() });
      } catch (e) {
        logError('sync', e);
      }
    },
    async eraseRemote() {
      try {
        await backend.eraseRemote();
        const locale = await leggiStato(db);
        if (locale) await scriviStato(db, { ...locale, cursore: 0 }, clock.now());
        return true;
      } catch (e) {
        logError('sync', e);
        return false;
      }
    },
    async setName(nome) {
      await save(db, 'preferenze', { id: CHIAVE_PROFILO, valore: { nome: nome.trim() || null } }, clock.now());
      await account();
    },
    subscribe(f) {
      ascolti.add(f);
      return () => void ascolti.delete(f);
    },
    snapshot: () => stato,
  };
}

let registrato: SyncService | null = null;
/** Il servizio dell'app, registrato dal punto di composizione: S22 Account, il menu, «Elimina tutti i dati». */
export const registerSyncService = (s: SyncService): void => {
  registrato = s;
};
export const currentSyncService = (): SyncService | null => registrato;
