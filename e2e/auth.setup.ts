// =============================================================================
// Setup de autenticação (projeto "setup" do playwright.config.ts).
//
// Roda ANTES dos specs: faz login uma vez com cada papel e salva a sessão
// (cookies) em e2e/.auth/<PAPEL>.json. Os specs reaproveitam esses arquivos via
// test.use({ papel: "..." }) — ver e2e/fixtures/auth.ts.
//
// Papel SEM senha configurada é PULADO aqui (aparece como "skipped"), em vez de
// falhar: no Playwright, uma falha no setup impede o projeto "chromium" inteiro de
// rodar, e um papel novo ainda sem senha (ex.: ADMIN2) travaria todos os testes.
// Os testes que usam esse papel falham depois com a mensagem do fixture
// ("Sessão de <PAPEL> não encontrada... confira se a senha do papel está no .env.e2e").
//
// Senha configurada mas ERRADA continua falhando aqui: é erro de configuração.
// =============================================================================

import fs from "node:fs";
import { test as setup } from "@playwright/test";
import { caminhoSessao, login } from "./fixtures/auth";
import { PAPEIS, senhaConfigurada } from "./fixtures/usuarios";

for (const papel of PAPEIS) {
  setup(`autenticar ${papel}`, async ({ page }) => {
    if (!senhaConfigurada(papel)) {
      // Apaga a sessão de uma execução anterior, para nenhum teste rodar com cookie velho.
      fs.rmSync(caminhoSessao(papel), { force: true });
    }
    setup.skip(
      !senhaConfigurada(papel),
      `E2E_PASSWORD_${papel} não definida: papel pulado no setup (ver .env.e2e.example).`,
    );
    await login(page, papel);
    await page.context().storageState({ path: caminhoSessao(papel) });
  });
}
