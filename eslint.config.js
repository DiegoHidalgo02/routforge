// Qualità del codice nel gate (decisione D-LINT-1): regole "recommended" di ESLint e typescript-eslint.
// Coprono le convenzioni di CLAUDE.md §4 che il compilatore non verifica (niente `any`, niente `@ts-ignore`,
// niente variabili inutilizzate). Le regole ARCHITETTURALI (strati, purezza del dominio) non stanno qui:
// vivono in scripts/architettura.test.mjs, un solo posto.
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['node_modules/', 'dist/', 'coverage/', 'claude-design/']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    // Script Node (ESM) e hook di Claude Code: globali di Node che ESLint non conosce da solo.
    files: ['scripts/**/*.mjs', '.claude/hooks/**/*.mjs'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly', URL: 'readonly' } },
  },
]);
