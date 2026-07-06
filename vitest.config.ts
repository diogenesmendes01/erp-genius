import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Testes unitários das regras puras (ver docs/14). Integração contra DB de teste:
// arquivos `*.int.test.ts`, rodados à parte por `npm run test:int` (vitest.integration.config.ts) —
// exigem o Postgres de teste em docker (porta 54329) e ficam FORA do `npm test` comum.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "src/**/*.int.test.ts"],
  },
});
