import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    // Aplica as migrations no banco de teste antes de qualquer suíte rodar.
    globalSetup: ['./test/global-setup.ts'],
    // As suítes compartilham o mesmo banco e limpam as tabelas entre si, então
    // rodar em paralelo faria uma suíte apagar os dados da outra.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
    },
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
