import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolverBancoTeste } from "./scripts/test-profile.mjs";

export const DATABASE_URL_TESTE = resolverBancoTeste().url;

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["src/test/setup-integracao.ts"],
    fileParallelism: false,
    env: { DATABASE_URL: DATABASE_URL_TESTE, MOTOR_URL: "", MOTOR_API_KEY: "" },
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
