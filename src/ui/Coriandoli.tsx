// Celebrazioni «Piena» (claude-design/CLAUDE.md, S1 `burst`): sei coriandoli nei colori dei tipi intorno al cerchio
// spuntato, `rf-burst` in 600 ms con 20 ms fra l'uno e l'altro. Fissi sullo schermo nel punto del cerchio, così restano
// anche se la card lascia la lista; senza puntatore, nascosti ai lettori di schermo.
import type { CSSProperties } from 'react';
import s from './Coriandoli.module.css';

/** Spostamento finale di ogni coriandolo, in px (mock S1). */
const SPOSTAMENTI = [
  [-16, -14],
  [15, -15],
  [19, 4],
  [-19, 6],
  [-6, 19],
  [9, 17],
];

/** Centro del cerchio spuntato, da `getBoundingClientRect()`. */
export const centro = (el: Element) => {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
};

export function Coriandoli({ x, y }: { x: number; y: number }) {
  return (
    <span className={s.origine} style={{ left: x, top: y }} aria-hidden>
      {SPOSTAMENTI.map(([dx, dy], i) => (
        <span
          key={i}
          style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${i * 20}ms` } as CSSProperties}
        />
      ))}
    </span>
  );
}
