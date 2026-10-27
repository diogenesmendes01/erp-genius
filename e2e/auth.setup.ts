import fs from "node:fs";
import { test as setup } from "@playwright/test";
import { caminhoSessao, login } from "./fixtures/auth";
import { PAPEIS, senhaConfigurada } from "./fixtures/usuarios";

for (const papel of PAPEIS) {
  setup(`autenticar ${papel}`, async ({ page }) => {
    if (!senhaConfigurada(papel)) {
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
