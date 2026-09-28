import { defineConfig } from 'vitest/config';

// I test dei meccanismi puri vivono accanto al codice (src/**/*.test.ts).
// Nessun DOM necessario per il dominio: ambiente "node" (più veloce). Un test della UI chiede jsdom in testa al file
// (`// @vitest-environment jsdom`, T-015) e ha il JSX di React 19 come la build (`jsx: 'automatic'`).
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
});
