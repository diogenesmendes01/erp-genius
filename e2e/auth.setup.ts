// =============================================================================
// Setup de autenticação (projeto "setup" do playwright.config.ts).
//
// Roda ANTES dos specs: faz login uma vez com cada papel e salva a sessão
// (cookies) em e2e/.auth/<PAPEL>.json. Os specs reaproveitam esses arquivos via
// test.use({ papel: "..." }) — ver e2e/fixtures/auth.ts.
//
// Se a senha de algum papel não estiver configurada, o setup daquele papel falha
// com mensagem clara, e os specs que dependem dele também falham.
// =============================================================================

import { test as setup } from "@playwright/test";
import { caminhoSessao, login } from "./fixtures/auth";
import { PAPEIS } from "./fixtures/usuarios";

for (const papel of PAPEIS) {
  setup(`autenticar ${papel}`, async ({ page }) => {
    await login(page, papel);
    await page.context().storageState({ path: caminhoSessao(papel) });
  });
}
