import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Resolve os aliases de path declarados no tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    // Testes de unidade. Os e2e usam vitest.config.e2e.ts.
    include: ['src/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/**/*.spec.ts', 'src/main.ts'],
    },
  },
});
