import { defineConfig } from 'vitest/config';

// I test dei meccanismi puri vivono accanto al codice (src/**/*.test.ts).
// Nessun DOM necessario per il dominio: ambiente "node" (più veloce).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
});
