import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'dist',
    'coverage',
    'node_modules',
    'scripts/**/*.mjs',
    'src/lib/database.types.ts',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    plugins: { 'react-refresh': reactRefresh },
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'Raw HTML is not allowed. Render user content through <Markdown />.',
        },
      ],
    },
  },
  {
    // Context providers export their hook next to the component; router/UI helpers export factories.
    files: [
      'src/providers/**/*.tsx',
      'src/router.tsx',
      'src/components/ui/Button.tsx',
      'src/components/common/Markdown.tsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
]);
