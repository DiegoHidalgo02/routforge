// Il database locale dell'app (D-DATA-1): uno per processo, lo passano ai servizi le schermate.
import { openDb } from '../data/db';

export const appDb = openDb();
