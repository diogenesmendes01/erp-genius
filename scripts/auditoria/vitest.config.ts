import { defineConfig } from "vitest/config";
import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
export default defineConfig({
  plugins: [tsconfigPaths({ loose: true })],
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "../../src") } },
  test: {
    environment: "node",
    include: ["scripts/auditoria/*.test.mjs"],
    globalSetup: ["src/test/setup-integracao.ts"],
    fileParallelism: false,
    env: {
      DATABASE_URL: "postgres://postgres:teste@localhost:54329/erp_genius_test",
      WHATSAPP_LIVE: "",
    },
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});

