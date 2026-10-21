import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// =============================================================================
// Configuração dos testes E2E (ponta a ponta) com Playwright.
//
// IMPORTANTE: estes testes NÃO sobem servidor local. Eles rodam contra um
// ambiente UAT (homologação) já publicado, cuja URL vem de E2E_BASE_URL.
// Guia completo: e2e/README.md
//
// Os testes unitários/integração continuam no Vitest (vitest.config.ts) e não
// enxergam a pasta e2e/ — os dois não se misturam.
// =============================================================================

// 1) Carrega o arquivo .env.e2e (se existir) usando o recurso nativo do Node
//    (process.loadEnvFile, Node 20.12+). Não usamos o pacote "dotenv" porque ele
//    não é dependência do projeto. Variáveis já definidas no terminal
//    (export / $env:) têm prioridade sobre o que está no arquivo.
const arquivoEnv = path.resolve(__dirname, ".env.e2e");
if (fs.existsSync(arquivoEnv)) {
  process.loadEnvFile(arquivoEnv);
}

// 2) A URL do ambiente é OBRIGATÓRIA. Sem ela, paramos aqui com uma mensagem clara
//    em vez de deixar cada teste falhar com um erro confuso de navegação.
const baseURL = process.env.E2E_BASE_URL?.trim();
if (!baseURL) {
  throw new Error(
    "[e2e] E2E_BASE_URL não definida. Copie .env.e2e.example para .env.e2e e preencha a URL " +
      "do UAT (ex.: E2E_BASE_URL=https://uat.exemplo.com), ou defina no terminal: " +
      "bash: export E2E_BASE_URL=... | PowerShell: $env:E2E_BASE_URL='...'. " +
      "Nunca aponte para produção.",
  );
}

// No CI (GitHub Actions etc.) a variável CI vem definida automaticamente.
const emCI = !!process.env.CI;

export default defineConfig({
  // Onde ficam os testes (*.spec.ts) e o setup de login (*.setup.ts).
  testDir: "./e2e",

  // Tempo máximo de UM teste (inclui navegação). O UAT é remoto, então damos folga.
  timeout: 60_000,
  // Tempo máximo de cada expect(...) que espera algo aparecer na tela.
  expect: { timeout: 10_000 },

  // Os testes não dependem uns dos outros: podem rodar em paralelo.
  fullyParallel: true,
  // No CI, falha se alguém esquecer um test.only() no código.
  forbidOnly: emCI,
  // No CI, tenta de novo 1 vez (absorve instabilidade de rede). Local: 0, para você
  // perceber o problema na hora.
  retries: emCI ? 1 : 0,
  // No CI, limita o paralelismo para não sobrecarregar o UAT.
  workers: emCI ? 2 : undefined,

  // Relatórios: "list" mostra o andamento no terminal; "html" gera o relatório
  // navegável em playwright-report/ (abra com: npx playwright show-report).
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    // Permite escrever page.goto("/login") em vez da URL completa.
    baseURL,
    // Evidências: só guardamos quando o teste falha (para anexar no bug).
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Tempos de ações (clique, preencher) e de navegação.
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // O sistema é em português; mantém datas/números como o usuário vê.
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },

  projects: [
    // Projeto "setup": faz login uma vez por papel e salva a sessão em
    // e2e/.auth/<papel>.json (ver e2e/auth.setup.ts). Os demais testes reaproveitam.
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    // Projeto padrão: Chromium (Chrome). Depende do setup acima.
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
});
