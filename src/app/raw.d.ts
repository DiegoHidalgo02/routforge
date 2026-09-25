// Moduli `*.md?raw`: il contenuto del file come stringa, risolto da Vite e da Vitest. Serve al corso di esempio
// incluso nell'app (T-005). Dichiarato qui perché la radice non carica i tipi di `vite/client`, che citano API DOM (D-TS-1).
declare module '*.md?raw' {
  const testo: string;
  export default testo;
}
