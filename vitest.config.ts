import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'tools/**/*.ts', 'blueprints/**/*.ts', '.pi/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'node_modules', 'dist'],
      lines: 80,
      statements: 80,
      branches: 80,
      functions: 80
    }
  }
});
