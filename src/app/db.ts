// Il database locale dell'app (D-DATA-1): uno per processo, lo passano ai servizi le schermate.
import { openDb } from '../data/db';

export const appDb = openDb();
/** Query live (D-STACK-1): le schermate osservano `watch(() => readX(appDb, …), set)`; Dexie resta dietro `data`. */
export { watch } from '../data/repository';
