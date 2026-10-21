// =============================================================================
// Login e menu lateral por papel.
//
// Estes testes começam SEM sessão (não usam test.use({ papel })), porque o que se
// testa aqui é justamente a tela de login.
//
// Menu esperado: espelha src/lib/nav.ts (campo `papeis` de cada item) e a última
// linha da "Matriz papel × ação" de docs/qa/auditoria/01-papeis-permissoes.md.
// Se o produto mudar o menu, atualize este mapa JUNTO com o nav.ts.
// =============================================================================

import { test, expect, login } from "./fixtures/auth";
import { credenciaisDe, PAPEIS, type PapelE2E } from "./fixtures/usuarios";

/** Itens do menu lateral, na ordem em que aparecem, para cada usuário de papel único. */
const MENU_ESPERADO: Record<PapelE2E, string[]> = {
  ADMIN: ["Home", "Pipeline", "Leads", "Inbox", "Alunos", "Financeiro", "Configuração"],
  GERENTE_COMERCIAL: ["Home", "Pipeline", "Leads", "Inbox", "Financeiro", "Configuração"],
  VENDEDOR: ["Home", "Pipeline", "Leads", "Inbox"],
  VENDEDOR2: ["Home", "Pipeline", "Leads", "Inbox"],
  VENDEDOR3: ["Home", "Pipeline", "Leads", "Inbox"],
  GERENTE_PEDAGOGICO: ["Home", "Alunos", "Configuração"],
  PROFESSOR: ["Home", "Alunos"],
  PROFESSOR2: ["Home", "Alunos"],
  FINANCEIRO: ["Home", "Inbox", "Alunos", "Financeiro"],
  SECRETARIA: ["Home", "Inbox", "Alunos"],
};

test.describe("Login", () => {
  for (const papel of PAPEIS) {
    test(`ACE-01 login com sucesso e menu lateral do papel ${papel} (cobre ACE-09 a ACE-15)`, async ({ page }) => {
      await login(page, papel);

      // Cada link do menu fica em <aside><nav><a>. Comparamos o INÍCIO do texto
      // (regex ^...) porque o item "Inbox" pode ter um contador de não lidas ao lado.
      const itensDoMenu = page.locator("aside nav a");
      await expect(itensDoMenu).toHaveText(
        MENU_ESPERADO[papel].map((rotulo) => new RegExp(`^${rotulo}`)),
      );
    });
  }

  test("ACE-02 login com senha errada mostra erro e continua em /login", async ({ page }) => {
    // Usamos o e-mail do VENDEDOR2 com uma senha inválida de propósito.
    // Atenção: o sistema bloqueia o e-mail após 5 falhas em 15 min (rate-limit de login).
    // Cada execução gasta 1 tentativa; o login com sucesso do ACE-01 zera o contador.
    const { email } = credenciaisDe("VENDEDOR2");

    await page.goto("/login");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="senha"]').fill("senha-errada-e2e");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  for (const url of ["/alunos", "/financeiro", "/configuracao/usuarios"]) {
    test(`ACE-05 rota protegida sem sessão redireciona para /login: ${url}`, async ({ page }) => {
      // Sem login, tentamos abrir uma página interna direto pela URL.
      await page.goto(url);

      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    });
  }
});
