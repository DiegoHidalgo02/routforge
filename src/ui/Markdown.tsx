// Il markdown conciso delle risposte dell'AI (MECC §18; ui.md: mai HTML grezzo): titoli, elenchi, blocchi di codice,
// codice in linea, grassetto e corsivo diventano elementi React, il resto resta testo. Le citazioni arrivano già come
// segnaposto `⟦n⟧` (`citations` del dominio) e diventano il numero di `cita`.
import type { ReactNode } from 'react';

const IN_LINEA = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\s][^*\n]*\*|⟦\d+⟧)/g;

function inLinea(testo: string, cita: (n: number) => ReactNode): ReactNode[] {
  return testo.split(IN_LINEA).map((p, i) => {
    if (p.startsWith('⟦') && p.endsWith('⟧')) return <span key={i}>{cita(Number(p.slice(1, -1)))}</span>;
    if (p.length > 2 && p.startsWith('`') && p.endsWith('`')) return <code key={i}>{p.slice(1, -1)}</code>;
    if (p.length > 4 && p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.length > 2 && p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>;
    return p;
  });
}

type Blocco =
  | { tipo: 'codice'; righe: string[] }
  | { tipo: 'titolo'; testo: string }
  | { tipo: 'elenco'; ordinato: boolean; voci: string[] }
  | { tipo: 'paragrafo'; righe: string[] };

function blocchi(testo: string): Blocco[] {
  const fuori: Blocco[] = [];
  const righe = testo.split('\n');
  for (let i = 0; i < righe.length; i++) {
    const r = righe[i] ?? '';
    const ultimo = fuori[fuori.length - 1];
    if (r.startsWith('```')) {
      const codice: string[] = [];
      while (++i < righe.length && !(righe[i] ?? '').startsWith('```')) codice.push(righe[i] ?? '');
      fuori.push({ tipo: 'codice', righe: codice });
    } else if (/^#{1,6}\s/.test(r)) {
      fuori.push({ tipo: 'titolo', testo: r.replace(/^#+\s+/, '') });
    } else if (/^\s*([-*•]|\d+[.)])\s+/.test(r)) {
      const ordinato = /^\s*\d/.test(r);
      const voce = r.replace(/^\s*([-*•]|\d+[.)])\s+/, '');
      if (ultimo?.tipo === 'elenco' && ultimo.ordinato === ordinato) ultimo.voci.push(voce);
      else fuori.push({ tipo: 'elenco', ordinato, voci: [voce] });
    } else if (!r.trim()) {
      fuori.push({ tipo: 'paragrafo', righe: [] });
    } else if (ultimo?.tipo === 'paragrafo' && ultimo.righe.length) {
      ultimo.righe.push(r);
    } else {
      fuori.push({ tipo: 'paragrafo', righe: [r] });
    }
  }
  return fuori.filter((b) => b.tipo !== 'paragrafo' || b.righe.length > 0);
}

export function Markdown({ testo, cita }: { testo: string; cita: (n: number) => ReactNode }) {
  return (
    <>
      {blocchi(testo).map((b, i) => {
        switch (b.tipo) {
          case 'codice':
            return (
              <pre key={i}>
                <code>{b.righe.join('\n')}</code>
              </pre>
            );
          case 'titolo':
            return <h3 key={i}>{inLinea(b.testo, cita)}</h3>;
          case 'elenco': {
            const Lista = b.ordinato ? 'ol' : 'ul';
            return (
              <Lista key={i}>
                {b.voci.map((v, j) => (
                  <li key={j}>{inLinea(v, cita)}</li>
                ))}
              </Lista>
            );
          }
          case 'paragrafo':
            return <p key={i}>{inLinea(b.righe.join(' '), cita)}</p>;
        }
      })}
    </>
  );
}
