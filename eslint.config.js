import js from '@eslint/js';

/** Flat ESLint config (ESLint 9+). */
export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        structuredClone: 'readonly',
        globalThis: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        queueMicrotask: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
    },
  },
  {
    // CLI scripts legitimately write to stdout.
    files: ['scripts/**'],
    rules: { 'no-console': 'off' },
  },
  {
    // mta/ is the Haraka MTA — a separate CommonJS service with its own runtime.
    ignores: ['node_modules/', 'logs/', 'coverage/', 'dist/', 'mta/'],
  },
];
