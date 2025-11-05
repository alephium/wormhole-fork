import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/lib/**',
      '**/*.e2e.test.ts',
      '**/e2e/**',
      '**/tests/**',
    ],
    watch: false,
  },
  resolve: {
    alias: {
      public: path.resolve(__dirname, './public'),
      exports: path.resolve(__dirname, './src/exports'),
    },
  },
});
