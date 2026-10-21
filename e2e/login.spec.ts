// =============================================================================
// Login e menu lateral por papel (ACE-01 a ACE-03 do roteiro).
//
// Estes testes começam SEM sessão (não usam test.use({ papel })), porque o que se
// testa aqui é justamente a tela de login.
//
// Menu esperado: espelha src/lib/nav.ts (array NAV, campo `papeis` de cada item) e a
// tabela "Resultado por papel" de docs/qa/auditoria/01-acesso-papeis.md (seção
// "Papéis e menu"). A Sidebar NÃO reordena: navParaPapeis() só filtra o array NAV, e
// NavLinks (src/components/Sidebar.tsx) desenha na mesma ordem. Por isso a Home NÃO
// é o primeiro item (achado 5 do relatório 01, decisão do PO pendente).
// Se o produto mudar o menu, atualize este mapa JUNTO com o nav.ts.
// =============================================================================

import { test, expect, login, menuPrincipal } from "./fixtures/auth";
import { emailDe, PAPEIS, type PapelE2E } from "./fixtures/usuarios";

// Blocos do menu, na ordem do array NAV, para montar os papéis sem repetir texto.
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

// "Empresas" aparece para Gerente Comercial e Secretaria, mas a página nega o acesso
// (bug X2 da auditoria consolidada). O ACE-01 confere o menu como ele é HOJE; se o
// X2 for corrigido tirando o item do menu, remova "Empresas" das listas do GC e da SEC.
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

/** Itens do menu lateral, na ordem em que aparecem na tela, para cada usuário de teste. */
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
  // Usuário com dois papéis: o menu é a UNIÃO dos itens, mantida a ordem do array NAV.
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

/** Escapa caracteres especiais para usar o rótulo dentro de uma RegExp. */
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Texto esperado de um link do menu. O item "Inbox" pode trazer o contador de não
 * lidas logo depois do rótulo: um número (ou "99+") seguido do texto, só para leitor
 * de tela, " mensagens não lidas" (src/components/Sidebar.tsx). O sufixo é opcional
 * para qualquer item, mas o rótulo tem de bater do início ao fim.
 */
function textoDoItem(rotulo: string): RegExp {
  return new RegExp(`^\\s*${escaparRegex(rotulo)}(\\s*(\\d+|99\\+)\\s*mensagens não lidas)?\\s*$`);
}

const MENSAGEM_LOGIN_RECUSADO = "E-mail ou senha incorretos.";

test.describe("Login", () => {
  for (const papel of PAPEIS) {
    test(`ACE-01 login com sucesso e menu lateral do papel ${papel}`, async ({ page }) => {
      await login(page, papel);

      // Cada item do menu é um <a> dentro de <nav aria-label="Navegação principal">.
      await expect(menuPrincipal(page).getByRole("link")).toHaveText(MENU_ESPERADO[papel].map(textoDoItem));
    });
  }

  test("ACE-02 senha errada e e-mail inexistente mostram a mesma mensagem e continuam em /login", async ({ page }) => {
    // 1) E-mail real (VENDEDOR2) com senha inválida de propósito. Não precisa da senha
    //    verdadeira, por isso usamos emailDe (não exige E2E_PASSWORD_VENDEDOR2).
    // Atenção: o sistema bloqueia o e-mail após 5 falhas em 15 min (rate-limit em
    // memória). Cada execução gasta 1 tentativa do VENDEDOR2.
    await page.goto("/login");
    await page.locator('input[name="email"]').fill(emailDe("VENDEDOR2"));
    await page.locator('input[name="senha"]').fill("senha-errada-e2e");
    await page.getByRole("button", { name: "Entrar" }).click();

    // A mensagem fica num <p role="alert">. Não usamos getByRole("alert") porque o
    // Next.js também injeta um anunciador de rota com role="alert".
    await expect(page.getByText(MENSAGEM_LOGIN_RECUSADO)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);

    // 2) E-mail que não existe: a mensagem é a mesma (não revela se o e-mail existe).
    await page.locator('input[name="email"]').fill("nao-existe-e2e@genius.com");
    await page.locator('input[name="senha"]').fill("senha-errada-e2e");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText(MENSAGEM_LOGIN_RECUSADO)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  for (const url of ["/alunos", "/financeiro", "/configuracao/usuarios", "/funil"]) {
    test(`ACE-03 rota protegida sem sessão redireciona para /login: ${url}`, async ({ page }) => {
      // Sem login, tentamos abrir uma página interna direto pela URL. O guard do layout
      // (exigirSessaoPagina) manda para /login?callbackUrl=<rota pedida>, para o login
      // devolver a pessoa à página depois de entrar.
      await page.goto(url);

      await expect(page).toHaveURL(/\/login(\?|$)/);
      // Lê o parâmetro já decodificado, para não depender de como o navegador codifica a barra.
      expect(new URL(page.url()).searchParams.get("callbackUrl")).toBe(url);
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
      await expect(menuPrincipal(page)).toHaveCount(0);
    });
  }
});
