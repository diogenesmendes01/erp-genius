import { defineConfig } from "vitest/config";
import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { DATABASE_URL_TESTE } from "../../vitest.integration.config";
export default defineConfig({
  plugins: [tsconfigPaths({ loose: true })],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../../src") } },
  test: {
    environment: "node",
    include: ["scripts/auditoria/*.test.mjs"],
    globalSetup: ["src/test/setup-integracao.ts"],
    fileParallelism: false,
    // Mesmo banco que o globalSetup confere (perfil de teste do worktree); motor real apagado.
    env: { DATABASE_URL: DATABASE_URL_TESTE, WHATSAPP_LIVE: "", MOTOR_URL: "", MOTOR_API_KEY: "" },
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});

