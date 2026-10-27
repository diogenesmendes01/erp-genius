import { test, expect, login, menuPrincipal } from "./fixtures/auth";
import { emailDe, PAPEIS, type PapelE2E } from "./fixtures/usuarios";

const ADMIN_COMPLETO = [
  "Permutas",
  "Mudanças acadêmicas",
  "Comissões",
  "Matrículas",
  "Envios do portal",
  "Diário de aulas",
  "Home",
  "Funil",
  "Relatórios",
  "Agente de IA",
  "Carteira",
  "Contatos",
  "Tarefas",
  "Inbox",
  "Alunos",
  "Financeiro",
  "Empresas",
  "Configuração",
];

const MENU_GERENTE_COMERCIAL = [
  "Comissões",
  "Matrículas",
  "Home",
  "Funil",
  "Relatórios",
  "Agente de IA",
  "Carteira",
  "Contatos",
  "Tarefas",
  "Inbox",
  "Financeiro",
  "Empresas",
];
const MENU_VENDEDOR = ["Comissões", "Matrículas", "Home", "Funil", "Relatórios", "Carteira", "Contatos", "Tarefas", "Inbox"];
const MENU_GERENTE_PEDAGOGICO = [
  "Permutas",
  "Mudanças acadêmicas",
  "Diário de aulas",
  "Home",
  "Inbox",
  "Alunos",
  "Configuração",
];
const MENU_PROFESSOR = ["Mudanças acadêmicas", "Diário de aulas", "Home", "Inbox", "Alunos"];
const MENU_FINANCEIRO = ["Permutas", "Comissões", "Home", "Tarefas", "Inbox", "Alunos", "Financeiro", "Empresas"];

const MENU_ESPERADO: Record<PapelE2E, string[]> = {
  ADMIN: ADMIN_COMPLETO,
  ADMIN2: ADMIN_COMPLETO,
  GERENTE_COMERCIAL: MENU_GERENTE_COMERCIAL,
  VENDEDOR: MENU_VENDEDOR,
  VENDEDOR2: MENU_VENDEDOR,
  VENDEDOR3: MENU_VENDEDOR,
  GERENTE_PEDAGOGICO: MENU_GERENTE_PEDAGOGICO,
  GERENTE_PEDAGOGICO2: MENU_GERENTE_PEDAGOGICO,
  PROFESSOR: MENU_PROFESSOR,
  PROFESSOR2: MENU_PROFESSOR,
  FINANCEIRO: MENU_FINANCEIRO,
  FINANCEIRO2: MENU_FINANCEIRO,
  SECRETARIA: [
    "Mudanças acadêmicas",
    "Matrículas",
    "Envios do portal",
    "Home",
    "Contatos",
    "Tarefas",
    "Inbox",
    "Alunos",
    "Empresas",
    "Configuração",
  ],
  VENDEDOR_PROFESSOR: [
    "Mudanças acadêmicas",
    "Comissões",
    "Matrículas",
    "Diário de aulas",
    "Home",
    "Funil",
    "Relatórios",
    "Carteira",
    "Contatos",
    "Tarefas",
    "Inbox",
    "Alunos",
  ],
};

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function textoDoItem(rotulo: string): RegExp {
  return new RegExp(`^\\s*${escaparRegex(rotulo)}(\\s*(\\d+|99\\+)\\s*mensagens não lidas)?\\s*$`);
}

const MENSAGEM_LOGIN_RECUSADO = "E-mail ou senha incorretos.";

test.describe("Login", () => {
  for (const papel of PAPEIS) {
    test(`ACE-03 login com sucesso e menu lateral do papel ${papel}`, async ({ page }) => {
      await login(page, papel);

      await expect(menuPrincipal(page).getByRole("link")).toHaveText(MENU_ESPERADO[papel].map(textoDoItem));
    });
  }

  test("ACE-07 senha errada e e-mail inexistente mostram a mesma mensagem e continuam em /login", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(emailDe("VENDEDOR2"));
    await page.locator('input[name="senha"]').fill("senha-errada-e2e");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText(MENSAGEM_LOGIN_RECUSADO)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    await page.locator('input[name="email"]').fill("nao-existe-e2e@genius.com");
    await page.locator('input[name="senha"]').fill("senha-errada-e2e");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText(MENSAGEM_LOGIN_RECUSADO)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  for (const url of ["/alunos", "/financeiro", "/configuracao/usuarios", "/funil"]) {
    test(`ACE-06 rota protegida sem sessão redireciona para /login: ${url}`, async ({ page }) => {
      await page.goto(url);

      await expect(page).toHaveURL(/\/login(\?|$)/);
      expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(url);
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
      await expect(menuPrincipal(page)).toHaveCount(0);
    });
  }
});
