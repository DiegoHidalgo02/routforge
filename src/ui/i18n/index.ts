// Testi dell'interfaccia (FUNZ §22, D-I18N-1): un dizionario JSON per lingua con le chiavi di `it.json`; un dizionario
// senza una chiave non compila. La lingua si sceglie una volta, all'avvio del processo (MECC §23). Libreria: T-031.
import { pickLanguage, type Lingua } from '../../domain/language';
import de from './de.json';
import en from './en.json';
import es from './es.json';
import fr from './fr.json';
import it from './it.json';
import pt from './pt.json';

export type Chiave = keyof typeof it;
const DIZIONARI: Record<Lingua, Record<Chiave, string>> = { it, en, es, pt, fr, de };

export const lingua = pickLanguage(navigator.languages);
/** Testo della chiave; `{nome}` si sostituisce con `parametri.nome`. */
export const t = (chiave: Chiave, parametri: Record<string, string | number> = {}): string =>
  DIZIONARI[lingua][chiave].replace(/\{(\w+)\}/g, (tutto, nome: string) => String(parametri[nome] ?? tutto));
