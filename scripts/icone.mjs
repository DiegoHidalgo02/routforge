// =============================================================================
// Icone dell'app (T-035, D-RILASCIO-1): il logo del design (Logomark di src/ui/Logomark.tsx nel riquadro `.logo` della
// Shell: quadrato col raggio 9/30 in --color-primary, tre barre in --color-text, larghe metà del lato) disegnato nelle
// misure del web e di Android. I colori si leggono da claude-design/design/tokens.css (INV-20). I PNG si scrivono qui,
// con zlib di Node, senza dipendenze. Uso: `node scripts/icone.mjs`, poi si committano i file generati.
// =============================================================================
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deflateSync } from 'node:zlib';

const ROOT = join(import.meta.dirname, '..');
const token = (nome) => {
  const m = new RegExp(`--${nome}:\\s*(#[0-9A-Fa-f]{6})`).exec(
    readFileSync(join(ROOT, 'claude-design', 'design', 'tokens.css'), 'utf8'),
  );
  if (!m) throw new Error(`token --${nome} non trovato`);
  return m[1];
};
const FONDO = token('color-primary');
const BARRE = token('color-text');
const SFONDO_APP = token('color-bg');

/** Le tre barre del Logomark nella sua viewBox 15×16: x, y, larghezza, altezza; estremi tondi (raggio 1,5). */
export const BARRE_LOGO = [
  [0, 3, 3, 10],
  [6, 0, 3, 16],
  [12, 2, 3, 12],
];

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** Dentro un rettangolo coi lati arrotondati di raggio r. */
const dentro = (px, py, x, y, w, h, r) => {
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  return px >= x && px <= x + w && py >= y && py <= y + h && (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
};

/**
 * L'icona in RGBA: `forma` = 'arrotondata' (raggio 30 % come il logo), 'piena' (quadrato intero: maschere di Android e
 * iOS) o 'tonda'. Le barre sono larghe metà del lato, al centro; 4×4 campioni per pixel per i bordi.
 */
export function disegna(lato, forma) {
  const [fr, fg, fb] = rgb(FONDO);
  const [br, bg, bb] = rgb(BARRE);
  const scala = (lato * 0.5) / 15;
  const x0 = (lato - 15 * scala) / 2;
  const y0 = (lato - 16 * scala) / 2;
  const raggio = forma === 'tonda' ? lato / 2 : forma === 'arrotondata' ? lato * 0.3 : 0;
  const pixel = Buffer.alloc(lato * lato * 4);
  const N = 4;
  for (let y = 0; y < lato; y++)
    for (let x = 0; x < lato; x++) {
      let a = 0;
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < N; sy++)
        for (let sx = 0; sx < N; sx++) {
          const px = x + (sx + 0.5) / N;
          const py = y + (sy + 0.5) / N;
          if (!dentro(px, py, 0, 0, lato, lato, raggio)) continue;
          const barra = BARRE_LOGO.some(([bx, by, bw, bh]) =>
            dentro(px, py, x0 + bx * scala, y0 + by * scala, bw * scala, bh * scala, 1.5 * scala),
          );
          a++;
          r += barra ? br : fr;
          g += barra ? bg : fg;
          b += barra ? bb : fb;
        }
      const i = (y * lato + x) * 4;
      if (a === 0) continue;
      pixel[i] = Math.round(r / a);
      pixel[i + 1] = Math.round(g / a);
      pixel[i + 2] = Math.round(b / a);
      pixel[i + 3] = Math.round((255 * a) / (N * N));
    }
  return pixel;
}

const TABELLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = TABELLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const blocco = (tipo, dati) => {
  const lunghezza = Buffer.alloc(4);
  lunghezza.writeUInt32BE(dati.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'latin1'), dati]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([lunghezza, corpo, crc]);
};

/** PNG RGBA a 8 bit, una riga per filtro 0. */
export function png(lato, pixel) {
  const intestazione = Buffer.alloc(13);
  intestazione.writeUInt32BE(lato, 0);
  intestazione.writeUInt32BE(lato, 4);
  intestazione.set([8, 6, 0, 0, 0], 8);
  const righe = Buffer.alloc(lato * (lato * 4 + 1));
  for (let y = 0; y < lato; y++) pixel.copy(righe, y * (lato * 4 + 1) + 1, y * lato * 4, (y + 1) * lato * 4);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    blocco('IHDR', intestazione),
    blocco('IDAT', deflateSync(righe, { level: 9 })),
    blocco('IEND', Buffer.alloc(0)),
  ]);
}

const scrivi = (percorso, contenuto) => {
  mkdirSync(dirname(join(ROOT, percorso)), { recursive: true });
  writeFileSync(join(ROOT, percorso), contenuto);
  console.log(percorso);
};
const icona = (percorso, lato, forma) => scrivi(percorso, png(lato, disegna(lato, forma)));

/** Le barre come tracciati, nella viewBox data: capsule di larghezza 2r. */
const tracciati = (scala, x0, y0) =>
  BARRE_LOGO.map(([bx, by, bw, bh]) => {
    const r = (bw * scala) / 2;
    const f = (n) => Number(n.toFixed(2));
    return `M${f(x0 + bx * scala)},${f(y0 + by * scala + r)} a${f(r)},${f(r)} 0 0 1 ${f(2 * r)},0 v${f(bh * scala - 2 * r)} a${f(r)},${f(r)} 0 0 1 ${f(-2 * r)},0 z`;
  });

if (process.argv[1] && import.meta.filename === process.argv[1]) {
  // Web: favicon vettoriale come il logo, icone del manifest e di iOS
  scrivi(
    'public/favicon.svg',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 30"><rect width="30" height="30" rx="9" fill="${FONDO}"/>` +
      `<path fill="${BARRE}" d="${tracciati(1, 7.5, 7).join(' ')}"/></svg>\n`,
  );
  icona('public/icon-192.png', 192, 'arrotondata');
  icona('public/icon-512.png', 512, 'arrotondata');
  icona('public/icon-maskable-512.png', 512, 'piena');
  icona('public/apple-touch-icon.png', 180, 'piena');
  // Android: le icone per Android 7 (senza icona adattiva), nelle cinque densità
  const RES = 'android/app/src/main/res';
  for (const [densita, lato] of [
    ['mdpi', 48],
    ['hdpi', 72],
    ['xhdpi', 96],
    ['xxhdpi', 144],
    ['xxxhdpi', 192],
  ]) {
    icona(`${RES}/mipmap-${densita}/ic_launcher.png`, lato, 'arrotondata');
    icona(`${RES}/mipmap-${densita}/ic_launcher_round.png`, lato, 'tonda');
  }
  // Android 8+: primo piano dell'icona adattiva (108 dp, la parte visibile è il cerchio di 72 dp: barre larghe 36 dp)
  const scala = 36 / 15;
  scrivi(
    `${RES}/drawable-v24/ic_launcher_foreground.xml`,
    `<?xml version="1.0" encoding="utf-8"?>
<!-- Generato da scripts/icone.mjs: il Logomark del design (T-035, D-RILASCIO-1) -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
${tracciati(scala, 54 - 7.5 * scala, 54 - 8 * scala)
  .map((d) => `    <path\n        android:fillColor="${BARRE}"\n        android:pathData="${d}" />`)
  .join('\n')}
</vector>
`,
  );
  scrivi(
    `${RES}/values/ic_launcher_background.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${FONDO}</color>\n</resources>\n`,
  );
  // Avvio (Android 7–11; dal 12 lo splash è del sistema, coi colori di styles.xml): il logo sul fondo dell'app
  scrivi(
    `${RES}/values/splash.xml`,
    `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="splash_background">${SFONDO_APP}</color>\n</resources>\n`,
  );
  scrivi(
    `${RES}/drawable/splash_logo.xml`,
    `<?xml version="1.0" encoding="utf-8"?>
<!-- Generato da scripts/icone.mjs: il logo del design (T-035, D-RILASCIO-1) -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="30dp"
    android:height="30dp"
    android:viewportWidth="30"
    android:viewportHeight="30">
    <path
        android:fillColor="${FONDO}"
        android:pathData="M9,0 h12 a9,9 0 0 1 9,9 v12 a9,9 0 0 1 -9,9 h-12 a9,9 0 0 1 -9,-9 v-12 a9,9 0 0 1 9,-9 z" />
    <path
        android:fillColor="${BARRE}"
        android:pathData="${tracciati(1, 7.5, 7).join(' ')}" />
</vector>
`,
  );
  scrivi(
    `${RES}/drawable/splash.xml`,
    `<?xml version="1.0" encoding="utf-8"?>
<!-- Generato da scripts/icone.mjs: fondo dell'app e logo al centro (T-035) -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/splash_background" />
    <item
        android:width="96dp"
        android:height="96dp"
        android:drawable="@drawable/splash_logo"
        android:gravity="center" />
</layer-list>
`,
  );
}
