// Il database locale dell'app (D-DATA-1): uno per processo, lo passano ai servizi le schermate.
import { openDb } from '../data/db';
import { watch as osserva } from '../data/repository';
import { logError } from './diagnostics';

export const appDb = openDb();
/**
 * Query live (D-STACK-1): le schermate osservano `watch(() => readX(appDb, …), set)`; Dexie resta dietro `data`. Una
 * lettura che fallisce va in Diagnostica (INV-16): prima restava muta e la schermata vuota non lasciava traccia (audit
 * P1-13).
 */
export const watch = <T>(query: () => Promise<T>, onChange: (v: T) => void): (() => void) =>
  osserva(query, onChange, (e) => logError('interfaccia', e));
