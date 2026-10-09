/**
 * Backup (MECC §22, FUNZ §20; T-030; D-BACKUP-1, D-BACKUP-2): un file con tutte le tabelle tranne il registro delle
 * notifiche (derivato) e la chiave dell'AI (resta sul dispositivo), l'import che sostituisce tutto dopo la conferma
 * (notifiche armate tolte, poi azzeramento e scrittura in una transazione; la sessione attiva del backup non torna) e
 * l'eliminazione di tutti i dati. La UI ricarica l'app dopo import ed eliminazione. Il file scelto dall'utente è un dato
 * non fidato: lo valida `parseBackup` prima di toccare qualcosa.
 */
import type { RoutForgeDb, Tabelle } from '../data/db';
import { allTables, get, replaceAll, save, tableNames } from '../data/repository';
import { backupFile, parseBackup, type RigaBackup } from '../domain/backup';
import { localDayKey } from '../domain/time';
import { logError } from './diagnostics';
import { cancelAllNotifications } from './notifications';
import type { ArchivioFile } from './ports/files';
import { CHIAVE_STATO_SYNC } from '../domain/sync';
import { CHIAVE_SESSIONE_ATTIVA } from './session';
import { currentSyncService } from './sync';

type NomeTabella = keyof Tabelle;
/** Le tabelle del file: tutte quelle del database tranne le derivate del dispositivo, registro delle notifiche e coda della sync (MECC §1, §22; T-033). */
const tabelle = (db: RoutForgeDb): NomeTabella[] =>
  tableNames(db).filter((n) => n !== 'registroNotifiche' && n !== 'syncCoda');
/** La chiave Gemini dell'utente (la scrive T-026): mai nel file né nella sync, resta sul dispositivo (D-BACKUP-1). */
export const CHIAVE_AI = 'chiaveAi';
const CHIAVE_ULTIMO_BACKUP = 'ultimoBackup';

let archivio: ArchivioFile = { salva: () => Promise.resolve(null) };

export function configureBackupFiles(a: ArchivioFile): void {
  archivio = a;
}

/** Il nome e il testo del file («routforge-2026-09-11.rfbackup», S22). */
export async function backupText(db: RoutForgeDb, now: number): Promise<{ nome: string; testo: string }> {
  const righe = await allTables(db, tabelle(db));
  righe.preferenze =
    (righe.preferenze as RigaBackup[] | undefined)?.filter((r) => r.id !== CHIAVE_AI && r.id !== CHIAVE_STATO_SYNC) ??
    [];
  return { nome: `routforge-${localDayKey(now)}.rfbackup`, testo: JSON.stringify(backupFile(righe, now)) };
}

/** «Esporta backup»: salva il file e ricorda l'ora per «Ultimo backup»; `null` se non si salva (in Diagnostica). */
export async function exportBackup(db: RoutForgeDb, now: number): Promise<'documenti' | 'download' | null> {
  try {
    const { nome, testo } = await backupText(db, now);
    const dove = await archivio.salva(nome, testo);
    if (dove) await save(db, 'preferenze', { id: CHIAVE_ULTIMO_BACKUP, valore: now }, now);
    else logError('backup', new Error('backup non salvato'));
    return dove;
  } catch (e) {
    logError('backup', e);
    return null;
  }
}

export const lastBackup = async (db: RoutForgeDb): Promise<number | null> => {
  const v = (await get(db, 'preferenze', CHIAVE_ULTIMO_BACKUP))?.valore;
  return typeof v === 'number' ? v : null;
};

export type BackupLetto = Extract<ReturnType<typeof parseBackup>, { tabelle: unknown }> & {
  corsi: number;
  attivita: number;
  pdf: number;
};

/** Il file scelto, letto e validato, coi numeri della conferma («2 corsi, 148 attività, 9 PDF»), o il motivo del no. */
export function readBackup(db: RoutForgeDb, testo: string): BackupLetto | { errore: 'illeggibile' | 'versione' } {
  const r = parseBackup(testo, tabelle(db));
  if ('errore' in r) return r;
  const vive = (n: NomeTabella) => (r.tabelle[n] ?? []).filter((x) => x.deletedAt === null);
  return {
    ...r,
    corsi: vive('corsi').length,
    attivita: vive('blocchi').length,
    pdf: vive('materiali').filter((m) => m.tipo === 'pdf').length,
  };
}

/**
 * «Sostituisci e ricarica» (MECC §22): in una transazione azzera e scrive il backup, senza la sessione attiva del
 * backup; la chiave dell'AI di questo dispositivo resta (non viaggia nel file); «Ultimo backup» diventa l'ora del file.
 * Solo dopo, a scrittura riuscita, toglie le notifiche armate e svuota il registro: se l'azzeramento fallisce restano
 * dati e promemoria di prima; la prima riconciliazione dopo il ricaricamento arma quelle dei dati nuovi (D-BACKUP-2).
 */
export async function importBackup(db: RoutForgeDb, letto: BackupLetto): Promise<void> {
  // Si esce dall'account (T-033): il servizio non rimanda a questo dispositivo le righe che ha scritto, e i dati importati
  // devono ripartire con la fusione di un nuovo accesso
  await currentSyncService()?.signOutLocal();
  const chiave = await get(db, 'preferenze', CHIAVE_AI);
  const preferenze = (letto.tabelle.preferenze ?? []).filter(
    (r) =>
      r.id !== CHIAVE_SESSIONE_ATTIVA &&
      r.id !== CHIAVE_AI &&
      r.id !== CHIAVE_ULTIMO_BACKUP &&
      // Lo stato della sync è di questo dispositivo: senza, dopo l'import la sync rifà la fusione (T-033)
      r.id !== CHIAVE_STATO_SYNC,
  );
  const ultimo = { id: CHIAVE_ULTIMO_BACKUP, valore: letto.creatoIl, createdAt: letto.creatoIl };
  await replaceAll(db, {
    ...letto.tabelle,
    preferenze: [...preferenze, { ...ultimo, updatedAt: letto.creatoIl, deletedAt: null }, ...(chiave ? [chiave] : [])],
  });
  await cancelAllNotifications();
}

/** «Elimina tutti i dati» (MECC §22): azzeramento completo del dispositivo; i dati dell'account restano. */
export async function eraseAllData(db: RoutForgeDb): Promise<void> {
  // Prima si esce dall'account: un dispositivo azzerato ma ancora collegato si riscaricherebbe l'account (T-033)
  await currentSyncService()?.signOutLocal();
  await replaceAll(db, {});
  await cancelAllNotifications();
}
