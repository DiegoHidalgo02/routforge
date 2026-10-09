// L'icona di un link per dominio (S11 Modulo `linkIcon`), usata dalle risorse dell'unità e dai materiali: in un file
// proprio, così i Materiali non importano la schermata del corso (audit P2-17).
import { Book, Code, Globe, SquarePlay } from 'lucide-react';
import s from './Course.module.css';

const DOCUMENTAZIONE = /javascript\.info|git-scm|missing\.csail|developer\.mozilla/;
/** L'icona del link per dominio, come nel mock (S11 Modulo `linkIcon`): video, codice, documentazione, web. */
export const IconaLink = ({ host, youtube }: { host: string; youtube: boolean }) => {
  const Icona = youtube ? SquarePlay : /github/.test(host) ? Code : DOCUMENTAZIONE.test(host) ? Book : Globe;
  return <Icona size={16} className={s.iconaLink} />;
};
