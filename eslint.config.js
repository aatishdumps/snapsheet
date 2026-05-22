import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import { globalIgnores } from 'eslint/config';

// Engine folders that must stay UI-decoupled — no React, no Konva, no ui/.
const ENGINE_GLOBS = [
  'src/editor/**',
  'src/layout-engine/**',
  'src/print-engine/**',
  'src/export-engine/**',
  'src/storage/**',
  'src/workers/**',
  'src/templates/**',
  'src/utils/**',
];

export default tseslint.config(
  globalIgnores(['dist', 'dev-dist']),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // D-08: the engine-decoupling rule — the single most important config artifact.
    files: ENGINE_GLOBS,
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ui/**', '*/ui', 'src/ui/*'],
              message: 'Engine modules must not import from ui/ — keep engines UI-decoupled.',
            },
            {
              group: ['react-konva', 'konva'],
              message:
                'Engine modules must not import react-konva/konva — engines are headless.',
            },
            {
              group: ['react', 'react-dom'],
              message:
                'Engine modules must not import React — engines are pure and framework-free.',
            },
          ],
        },
      ],
    },
  },
  prettier, // must be LAST — disables formatting rules that conflict with Prettier
);
