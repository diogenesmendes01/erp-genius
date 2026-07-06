import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Testes de INTEGRAÇÃO (Server Actions × Postgres real) — ver docs/14 §prioridades.
// O banco é um Postgres DESCARTÁVEL em docker (porta 54329, npm run test:db) — a URL é
// fixada AQUI, nunca lida do .env, para ser IMPOSSÍVEL apontar para produção por engano.
// `fileParallelism: false`: as suites compartilham o banco e truncam tabelas entre si.
export const DATABASE_URL_TESTE = "postgres://postgres:teste@localhost:54329/erp_genius_test";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["src/test/setup-integracao.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: DATABASE_URL_TESTE },
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
