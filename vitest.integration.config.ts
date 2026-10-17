import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolverBancoTeste } from "./scripts/test-profile.mjs";

// Testes de INTEGRAÇÃO (Server Actions × Postgres real) — ver docs/14 §prioridades.
// O banco é um Postgres DESCARTÁVEL em docker (porta 54329, npm run test:db) — a URL é
// fixada AQUI, nunca lida do .env, para ser IMPOSSÍVEL apontar para produção por engano.
// `fileParallelism: false`: as suites compartilham o banco e truncam tabelas entre si.
export const DATABASE_URL_TESTE = resolverBancoTeste().url;

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["src/test/setup-integracao.ts"],
    fileParallelism: false,
    // Nunca enviar mensagem real em teste (Fase 4): MOTOR_URL/MOTOR_API_KEY do shell são
    // apagados aqui, então um teste live que esqueça de mockar `drivers/motor` cai em
    // SEM_CONFIG em vez de fazer HTTP para um motor de verdade.
    env: { DATABASE_URL: DATABASE_URL_TESTE, MOTOR_URL: "", MOTOR_API_KEY: "" },
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
