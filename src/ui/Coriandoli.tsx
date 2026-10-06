// Celebrazioni «Piena» (claude-design/CLAUDE.md, S1 `burst`): sei coriandoli nei colori dei tipi intorno al cerchio
// spuntato, il `rf-burst` del mock (600 ms, `--dur-burst`, con 20 ms fra l'uno e l'altro) animato con Motion, che segue
// Impostazioni → Animazioni anche contro la riduzione del sistema (D-IMPOST-1). Fissi sullo schermo nel punto del
// cerchio, così restano anche se la card lascia la lista; senza puntatore, nascosti ai lettori di schermo.
import { motion } from 'motion/react';
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
        <motion.span
          key={i}
          // rf-burst: da scala .3 e trasparente, opaco al 25 %, poi spostato a scala 1 e svanito
          initial={{ x: 0, y: 0, scale: 0.3, opacity: 0 }}
          animate={{ x: dx, y: dy, scale: 1, opacity: [0, 1, 0] }}
          transition={{
            duration: 0.6,
            delay: i * 0.02,
            ease: [0.2, 0.8, 0.2, 1],
            opacity: { duration: 0.6, delay: i * 0.02, times: [0, 0.25, 1] },
          }}
        />
      ))}
    </span>
  );
}
