import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const arquivoEnv = path.resolve(__dirname, ".env.e2e");
if (fs.existsSync(arquivoEnv)) {
  process.loadEnvFile(arquivoEnv);
}

const baseURL = process.env.E2E_BASE_URL?.trim();
if (!baseURL) {
  throw new Error(
    "[e2e] E2E_BASE_URL não definida. Copie .env.e2e.example para .env.e2e e preencha a URL " +
      "do UAT (ex.: E2E_BASE_URL=https://uat.exemplo.com), ou defina no terminal: " +
      "bash: export E2E_BASE_URL=... | PowerShell: $env:E2E_BASE_URL='...'. " +
      "Nunca aponte para produção.",
  );
}

const emCI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e",

  timeout: 60_000,
  expect: { timeout: 10_000 },

  fullyParallel: true,
  forbidOnly: emCI,
  retries: emCI ? 1 : 0,
  workers: emCI ? 2 : undefined,

  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },

  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
});
