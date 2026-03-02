import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'packages/**/test/**/*.test.ts'],
    environment: 'node',
    globals: true
  },
  resolve: {
    alias: {
      '@wargames/shared-types': path.resolve(__dirname, 'packages/shared-types/src/index.ts'),
      '@wargames/engine': path.resolve(__dirname, 'packages/engine/src/index.ts'),
      '@wargames/content': path.resolve(__dirname, 'packages/content/src/index.ts')
    }
  }
});
