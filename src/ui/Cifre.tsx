// Le cifre di un testo nel font dei numeri (DESIGN: cifre in `--font-num`; S10 «5 moduli · 13 unità · 11h 40m»), con
// la classe di chi le mostra: era scritta uguale in Corsi e in Sessione (audit P3-14).
export const cifre = (testo: string, classe: string | undefined) =>
  testo.split(/(\d[\d:.,]*)/).map((x, i) =>
    i % 2 ? (
      <span key={i} className={classe}>
        {x}
      </span>
    ) : (
      x
    ),
  );
