// =============================================================================
// Login e reaproveitamento de sessão.
//
// - login(page, papel): faz o login "de verdade" pela tela /login. Use nos testes
//   que testam o próprio login, ou no setup (e2e/auth.setup.ts).
// - test (exportado aqui): igual ao test do Playwright, com a opção extra `papel`.
//   Quando você escreve test.use({ papel: "PROFESSOR" }), os testes daquele bloco
//   já começam LOGADOS como Professor, reaproveitando a sessão salva pelo setup em
//   e2e/.auth/PROFESSOR.json (não loga a cada teste, fica bem mais rápido).
// =============================================================================

import fs from "node:fs";
import path from "node:path";
import { test as base, expect, type Locator, type Page } from "@playwright/test";
import { credenciaisDe, type PapelE2E } from "./usuarios";

/** Pasta das sessões salvas. Está no .gitignore: contém cookies de sessão. */
export const PASTA_AUTH = path.join(__dirname, "..", ".auth");

/** Caminho do arquivo de sessão de um papel, ex.: e2e/.auth/PROFESSOR.json */
export function caminhoSessao(papel: PapelE2E): string {
  return path.join(PASTA_AUTH, `${papel}.json`);
}

/**
 * Menu lateral (Sidebar) da equipe: <nav aria-label="Navegação principal"> em
 * src/components/Sidebar.tsx (NavLinks). Só aparece a partir de 768 px de largura
 * (o projeto "chromium" usa 1280 px). No celular a mesma lista fica numa gaveta com
 * outro rótulo ("Menu de navegação", src/components/BarraMobile.tsx), por isso o
 * localizador é pelo rótulo, e não por "nav" solto.
 */
export function menuPrincipal(page: Page): Locator {
  return page.getByRole("navigation", { name: "Navegação principal", exact: true });
}

/**
 * Faz login pela tela, como um usuário faria, e espera chegar na Home.
 * Seletores (src/app/login/page.tsx): os campos usam name="email" e name="senha"
 * (vêm do register() do react-hook-form) e o botão de envio tem o texto "Entrar"
 * (vira "Entrando…" enquanto envia).
 */
export async function login(page: Page, papel: PapelE2E): Promise<void> {
  const { email, senha } = credenciaisDe(papel);

  await page.goto("/login");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="senha"]').fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Sem callbackUrl na URL, a aplicação faz router.push("/home") após o login
  // (destinoAposLogin em src/lib/destino-interno.ts).
  await page.waitForURL("**/home");
  await expect(menuPrincipal(page)).toBeVisible();
}

/** Opções extras que os specs podem configurar com test.use({ ... }). */
interface OpcoesE2E {
  /** Papel já logado no início do teste. null = sem sessão (visitante). */
  papel: PapelE2E | null;
}

/**
 * Use este `test` (e não o de "@playwright/test") nos specs que precisam de usuário logado.
 * Exemplo:
 *   test.describe("Professor", () => {
 *     test.use({ papel: "PROFESSOR" });
 *     test("PER-13a ...", async ({ page }) => { ... });
 *   });
 */
export const test = base.extend<OpcoesE2E>({
  // Opção configurável; padrão = sem login.
  papel: [null, { option: true }],

  // Substitui o storageState padrão pelo arquivo de sessão do papel escolhido.
  // (O 2º parâmetro do fixture é a função que "entrega" o valor ao teste; aqui ele se
  // chama `usar` — na documentação do Playwright costuma aparecer como `use`.)
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
