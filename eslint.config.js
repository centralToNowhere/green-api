import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores([
    'dist',
    '.yarn',
    '.pnp.*',
    'playwright-report',
    'test-results',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      '@stylistic': stylistic,
    },
    rules: {
      curly: 'error',
      '@stylistic/padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          prev: '*',
          next: ['enum', 'interface', 'type', 'return'],
        },
        { blankLine: 'always', prev: ['const', 'let', 'var'], next: '*' },
        {
          blankLine: 'never',
          prev: ['singleline-const', 'singleline-let', 'singleline-var'],
          next: ['singleline-const', 'singleline-let', 'singleline-var'],
        },
        { blankLine: 'always', prev: '*', next: ['block', 'block-like'] },
        { blankLine: 'always', prev: ['block', 'block-like'], next: '*' },
        { blankLine: 'always', prev: ['multiline-expression'], next: '*' },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-debugger": "error",
    },
    languageOptions: {
      globals: globals.browser,
    },
  },
]);
