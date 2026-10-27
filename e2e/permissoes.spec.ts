import { test, expect, menuPrincipal } from "./fixtures/auth";
import type { PapelE2E } from "./fixtures/usuarios";
import type { Page } from "@playwright/test";

type Mecanismo = "redirect" | "na-pagina";

interface CasoNegado {
  id: string;
  papel: PapelE2E;
  url: string;
  mecanismo: Mecanismo;
  descricao: string;
}

function tituloAcessoNegado(page: Page) {
  return page.getByRole("heading", { name: "Acesso negado", exact: true });
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const CASOS_NEGADOS: CasoNegado[] = [
  {
    id: "PER-13a",
    papel: "PROFESSOR",
    url: "/financeiro",
    mecanismo: "na-pagina",
    descricao: "Professor não abre o painel Financeiro",
  },
  {
    id: "PER-13b",
    papel: "PROFESSOR",
    url: "/empresas",
    mecanismo: "na-pagina",
    descricao: "Professor não abre Empresas (B2B)",
  },
  {
    id: "PER-02a",
    papel: "VENDEDOR",
    url: "/alunos",
    mecanismo: "na-pagina",
    descricao: "Vendedor não abre a lista de alunos",
  },
  {
    id: "PER-02b",
    papel: "VENDEDOR",
    url: "/configuracao/usuarios",
    mecanismo: "redirect",
    descricao: "Vendedor não abre Configuração › Usuários",
  },
  {
    id: "PER-02c",
    papel: "VENDEDOR",
    url: "/diario",
    mecanismo: "redirect",
    descricao: "Vendedor não abre o Diário de aulas",
  },
  {
    id: "PER-11a",
    papel: "GERENTE_PEDAGOGICO",
    url: "/funil",
    mecanismo: "redirect",
    descricao: "Gerente Pedagógico não abre o Funil",
  },
  {
    id: "PER-11b",
    papel: "GERENTE_PEDAGOGICO",
    url: "/configuracao/usuarios",
    mecanismo: "na-pagina",
    descricao: "Gerente Pedagógico não abre Configuração › Usuários",
  },
  {
    id: "PER-07a",
    papel: "SECRETARIA",
    url: "/financeiro",
    mecanismo: "na-pagina",
    descricao: "Secretaria não abre o painel Financeiro",
  },
  {
    id: "PER-07b",
    papel: "SECRETARIA",
    url: "/academico/regras",
    mecanismo: "redirect",
    descricao: "Secretaria não abre Regras de avaliação",
  },
  {
    id: "PER-07c",
    papel: "SECRETARIA",
    url: "/comissoes",
    mecanismo: "redirect",
    descricao: "Secretaria não abre Comissões",
  },
  {
    id: "PER-09a",
    papel: "FINANCEIRO",
    url: "/relatorios",
    mecanismo: "redirect",
    descricao: "Financeiro não abre Relatórios comerciais",
  },
  {
    id: "PER-09b",
    papel: "FINANCEIRO",
    url: "/aria",
    mecanismo: "redirect",
    descricao: "Financeiro não abre o Agente de IA",
  },
];

for (const caso of CASOS_NEGADOS) {
  test.describe(`${caso.papel} em ${caso.url}`, () => {
    test.use({ papel: caso.papel });

    test(`${caso.id} ${caso.descricao}`, async ({ page }) => {
      await page.goto(caso.url);

      await expect(tituloAcessoNegado(page)).toBeVisible();
      if (caso.mecanismo === "redirect") {
        await expect(page).toHaveURL(/\/acesso-negado$/);
        await expect(page.getByRole("link", { name: "Voltar ao início" })).toBeVisible();
      } else {
        await expect(page).toHaveURL(new RegExp(`${escaparRegex(caso.url)}(\\?|$)`));
      }
    });
  });
}

async function conferirMenuCoerenteComPagina(page: Page, rotuloMenu: string, url: string): Promise<void> {
  await page.goto("/home");
  const item = menuPrincipal(page).getByRole("link", { name: rotuloMenu, exact: true });
  const noMenu = (await item.count()) > 0;

  await page.goto(url);
  await expect(page.locator("main").getByRole("heading").first()).toBeVisible();

  if (noMenu) {
    await expect(tituloAcessoNegado(page)).toHaveCount(0);
    await expect(page.getByText(/Não foi possível carregar/)).toHaveCount(0);
  } else {
    await expect(tituloAcessoNegado(page)).toBeVisible();
  }
}

for (const [id, papel] of [
  ["PER-05a", "GERENTE_COMERCIAL"],
  ["PER-07d", "SECRETARIA"],
] as const) {
  test.describe(`${papel}: menu Empresas × página /empresas`, () => {
    test.use({ papel });

    test.fixme(`${id} item Empresas do menu e página /empresas coerentes (bug X2)`, async ({ page }) => {
      await conferirMenuCoerenteComPagina(page, "Empresas", "/empresas");
    });
  });
}

const CASOS_X3: Omit<CasoNegado, "mecanismo">[] = [
  {
    id: "PER-02d",
    papel: "VENDEDOR",
    url: "/financeiro/permuta",
    descricao: "Vendedor em Permutas vê Acesso negado, não a tela de erro (bug X3)",
  },
  {
    id: "PER-11c",
    papel: "GERENTE_PEDAGOGICO",
    url: "/configuracao/contratos",
    descricao: "Gerente Pedagógico em Modelos contratuais vê Acesso negado, não a tela de erro (bug X3)",
  },
];

for (const caso of CASOS_X3) {
  test.describe(`${caso.papel} em ${caso.url}`, () => {
    test.use({ papel: caso.papel });

    test.fixme(`${caso.id} ${caso.descricao}`, async ({ page }) => {
      await page.goto(caso.url);

      await expect(tituloAcessoNegado(page)).toBeVisible();
      await expect(page.getByText(/Não foi possível carregar/)).toHaveCount(0);
    });
  });
}

test.describe("GERENTE_COMERCIAL: menu Configuração × /configuracao/crm", () => {
  test.use({ papel: "GERENTE_COMERCIAL" });

  test.fixme("PER-04a item Configuração do menu e página /configuracao/crm coerentes (decisão R13)", async ({ page }) => {
    await conferirMenuCoerenteComPagina(page, "Configuração", "/configuracao/crm");
  });
});
