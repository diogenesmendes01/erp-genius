import fs from "node:fs";
import path from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { credenciaisDe, type PapelE2E } from "./usuarios";

export const PASTA_AUTH = path.join(__dirname, "..", ".auth");

export function caminhoSessao(papel: PapelE2E): string {
  return path.join(PASTA_AUTH, `${papel}.json`);
}

export function menuPrincipal(page: Page): Locator {
  return page.getByRole("navigation", { name: "Navegação principal", exact: true });
}

export async function login(page: Page, papel: PapelE2E): Promise<void> {
  const { email, senha } = credenciaisDe(papel);

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="senha"]').fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();

  await page.waitForURL("**/home");
  await expect(menuPrincipal(page)).toBeVisible();
}

interface OpcoesE2E {
  papel: PapelE2E | null;
}

export const test = base.extend<OpcoesE2E>({
  papel: [null, { option: true }],

  storageState: async ({ papel, storageState }, usar) => {
    if (!papel) {
      await usar(storageState);
      return;
    }
    const arquivo = caminhoSessao(papel);
    if (!fs.existsSync(arquivo)) {
      throw new Error(
        `[e2e] Sessão de ${papel} não encontrada em ${arquivo}. Ela é criada pelo projeto ` +
          '"setup" (e2e/auth.setup.ts). Rode pelo `npm run test:e2e` (que executa o setup antes) ' +
          "e confira se a senha do papel está no .env.e2e (papel sem senha é pulado no setup).",
      );
    }
    await usar(arquivo);
  },
});

export { expect };
