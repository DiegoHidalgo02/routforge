# RoutForge — Font, icone, immagini

## Font
Nessun file di font nel pacchetto: entrambe le famiglie vengono da Google Fonts.

| Famiglia | Pesi | Uso | Token |
|---|---|---|---|
| Manrope | 400 · 500 · 600 · 700 | tutta l'interfaccia | `--font-ui` |
| IBM Plex Mono | 400 · 500 · 600, `font-variant-numeric: tabular-nums` | ogni cifra che cambia nel tempo o si confronta in colonna: orari, timer, contatori, percentuali, numeri d'ordine, dimensioni | `--font-num` |

```html
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```
Ripiego: `system-ui, sans-serif` e `ui-monospace, monospace`. Nell'app installabile (Capacitor) i font vanno inclusi nel bundle per funzionare offline (CONTESTO §3). Scala e pesi in `design/DESIGN.md` §3.

## Icone
- **Lucide**, tratto 1.75 (2 nelle micro-azioni come chevron e frecce), estremi e giunzioni arrotondati, `currentColor`.
- Misure: 12 nei sub delle card · 14 nelle MetaRow e nelle label di gruppo · 16 nelle righe · 18 nella navigazione e negli header · 20–24 negli stati vuoti e nei dischi.
- Icone di tipo: `check-square` todo · `graduation-cap` studio · `repeat` routine · `calendar` evento.
- Ricorrenti: `map-pin`, `video`, `dumbbell`, `book-open`, `chevron-left/right/up/down`, `plus`, `x`, `check`, `play`, `pause`, `lock`, `bell`, `bell-off`, `refresh-cw`, `settings`, `sliders-horizontal`, `bar-chart`, `home`, `arrow-up-right`, `youtube`, `github`, `globe`, `file-text`, `file-code`, `triangle-alert`.
- Maniglia di riordino: sei punti 16 (`grip-vertical`), in text-3 `#636975`.
- Nessuna icona in tile sopra i titoli, nessuna emoji.

## Marchio
Nessun file immagine: il logomark è costruito.
- **Mobile** (S1, header): cerchio 40 surface-2 `#1E232C` con bordo `#292E37`; dentro tre barre bianche 3 × 10 · 16 · 12 px, gap 3, r2; pallino 7 success in alto a destra (stato della sincronizzazione).
- **Desktop** (sidebar): quadrato 30 r9 primary `#6E96F2` con le tre barre bianche 3 × 9 · 16 · 12; wordmark «RoutForge» Manrope 700 16, tracking −.01em.
- Menu account: stessa costruzione su 32.

## Immagini
- Il prodotto non usa immagini raster. Le card video (S12) mostrano titolo e play su surface-2; l'anteprima del video è quella del lettore YouTube incorporato.
- I link delle risorse nei mock (javascript.info, YouTube, latentflip.com, dev.to) sono dati del corso (`design/course-data.js`), non asset.

## Scenografia (non prodotto)
Da non implementare: cornice del telefono (raggio 44), status bar, home indicator, fondale della schermata di blocco (S9) e del widget (S13). Le notifiche di sistema (S9) prendono la forma dal sistema operativo; l'app decide solo testo e azioni.

## Dati dei mock
`design/course-data.js`: il corso «Syllabus Software Engineer 2026» già letto (M0 e M1 completi, M2–M4 come segnaposto bloccati). Fixture per i test e risultato atteso del parser.
