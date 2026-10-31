import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Universal パッケージ（ブラウザでも Node でも動く）で使ってはいけないもの
const browserOnlyGlobals = [
  'window',
  'document',
  'localStorage',
  'sessionStorage',
  'navigator',
  'location',
].map((name) => ({
  name,
  message: 'Universal パッケージでは DOM に依存しないこと（呼び出し側から注入する）。',
}));

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**', 'prototype/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/schema/**', 'packages/core/**', 'packages/convert/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        ...browserOnlyGlobals,
        { name: 'process', message: 'Universal パッケージでは Node に依存しないこと。' },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['node:*'],
              message: 'Universal パッケージでは Node 固有のモジュールを使わないこと。',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/cli/**', '*.config.{js,ts}', 'workspace-aliases.ts', 'apps/*/vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['packages/ui/**', 'apps/player/**'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
