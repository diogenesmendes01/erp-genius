// =============================================================================
// Permissões: papel X abre a URL Y por digitação direta e deve ver "Acesso negado".
//
// Fonte: "Matriz de acesso por área" de docs/qa/auditoria/01-acesso-papeis.md (guard
// real de cada página, com arquivo e linha) e os itens X2, X3 e R13 de
// docs/qa/auditoria-consolidada.md. IDs: PER-NN = um papel, sufixo a, b, c… = uma URL.
//   PER-01 Professor · PER-02 Vendedor · PER-03 Gerente Pedagógico · PER-04 Secretaria
//   PER-05 Financeiro · PER-06 a PER-08 casos sob bug conhecido ou decisão pendente.
//
// Lembrete: o menu esconder um item NÃO é segurança. O que vale é o servidor barrar
// quando o usuário digita a URL — é isso que estes testes verificam.
//
// Duas formas de "acesso negado" existem hoje, ambas com o título <h1>"Acesso negado":
//   - "redirect": exigirSessaoPagina (src/server/_shared/sessao.ts) manda para a página
//     /acesso-negado, que tem o botão "Voltar ao início" (ex.: /funil, /diario);
//   - "na-pagina": exigirPapelLeitura (src/lib/guards.ts) faz a própria URL renderizar o
//     componente <AcessoNegado> (src/components/AcessoNegado.tsx), sem trocar a URL
//     (ex.: /financeiro, /alunos, /empresas).
// O assert principal é o título; a URL final confere qual das duas formas apareceu.
// =============================================================================

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

/** Título comum às duas formas de negação. */
function tituloAcessoNegado(page: Page) {
  return page.getByRole("heading", { name: "Acesso negado", exact: true });
}

/** Escapa caracteres especiais para usar a URL dentro de uma RegExp. */
function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Casos que DEVEM mostrar "Acesso negado" (o guard da página existe no código atual). */
const CASOS_NEGADOS: CasoNegado[] = [
  // --- Professor ---
  {
    id: "PER-01a",
    papel: "PROFESSOR",
    url: "/financeiro",
    mecanismo: "na-pagina", // financeiro/(painel)/page.tsx: <AcessoNegado recurso="o financeiro" />
    descricao: "Professor não abre o painel Financeiro",
  },
  {
    id: "PER-01b",
    papel: "PROFESSOR",
    url: "/empresas",
    mecanismo: "na-pagina", // empresas/page.tsx: só FIN (e ADM)
    descricao: "Professor não abre Empresas (B2B)",
  },
  // --- Vendedor ---
  {
    id: "PER-02a",
    papel: "VENDEDOR",
    url: "/alunos",
    mecanismo: "na-pagina", // alunos/(lista)/page.tsx: SEC, GP, FIN, PRO
    descricao: "Vendedor não abre a lista de alunos",
  },
  {
    id: "PER-02b",
    papel: "VENDEDOR",
    url: "/configuracao/usuarios",
    mecanismo: "redirect", // configuracao/layout.tsx barra antes da página: só GP, GC, SEC (e ADM)
    descricao: "Vendedor não abre Configuração › Usuários",
  },
  {
    id: "PER-02c",
    papel: "VENDEDOR",
    url: "/diario",
    mecanismo: "redirect", // diario/page.tsx: PRO, GP
    descricao: "Vendedor não abre o Diário de aulas",
  },
  // --- Gerente Pedagógico ---
  {
    id: "PER-03a",
    papel: "GERENTE_PEDAGOGICO",
    url: "/funil",
    mecanismo: "redirect", // funil/page.tsx: GC, VEN
    descricao: "Gerente Pedagógico não abre o Funil",
  },
  {
    id: "PER-03b",
    papel: "GERENTE_PEDAGOGICO",
    url: "/configuracao/usuarios",
    mecanismo: "na-pagina", // o layout de Configuração aceita GP; a página exige ADM
    descricao: "Gerente Pedagógico não abre Configuração › Usuários",
  },
  // --- Secretaria ---
  {
    id: "PER-04a",
    papel: "SECRETARIA",
    url: "/financeiro",
    mecanismo: "na-pagina", // painel só ADM, FIN, GC (financeiro/papeis.ts)
    descricao: "Secretaria não abre o painel Financeiro",
  },
  {
    id: "PER-04b",
    papel: "SECRETARIA",
    url: "/academico/regras",
    mecanismo: "redirect", // academico/regras/page.tsx: só GP
    descricao: "Secretaria não abre Regras de avaliação",
  },
  {
    id: "PER-04c",
    papel: "SECRETARIA",
    url: "/comissoes",
    mecanismo: "redirect", // comissoes/page.tsx: FIN, GC, VEN
    descricao: "Secretaria não abre Comissões",
  },
  // --- Financeiro ---
  {
    id: "PER-05a",
    papel: "FINANCEIRO",
    url: "/relatorios",
    mecanismo: "redirect", // relatorios/page.tsx: GC, VEN
    descricao: "Financeiro não abre Relatórios comerciais",
  },
  {
    id: "PER-05b",
    papel: "FINANCEIRO",
    url: "/aria",
    mecanismo: "redirect", // aria/page.tsx: só GC
    descricao: "Financeiro não abre o Agente de IA",
  },
];

for (const caso of CASOS_NEGADOS) {
  test.describe(`${caso.papel} em ${caso.url}`, () => {
    // Começa o teste já logado com o papel do caso (sessão salva pelo setup).
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

// -----------------------------------------------------------------------------
// Bugs conhecidos e decisões pendentes (docs/qa/auditoria-consolidada.md §3 e §4).
//
// Marcados com test.fixme(): o Playwright os lista, mas não executa. Cada teste
// descreve o comportamento ESPERADO. Quando a correção (ou a decisão do PO) for
// publicada no UAT, troque test.fixme por test e rode. Se a decisão for manter o
// comportamento atual, ajuste ou apague o caso.
// -----------------------------------------------------------------------------

/**
 * Menu e guard da página precisam concordar: se o item aparece no menu, a página abre;
 * se não aparece, a URL digitada mostra "Acesso negado". Serve para os casos em que o
 * PO ainda vai decidir QUAL dos dois lados muda (tirar do menu ou liberar a página).
 */
async function conferirMenuCoerenteComPagina(page: Page, rotuloMenu: string, url: string): Promise<void> {
  await page.goto("/home");
  const item = menuPrincipal(page).getByRole("link", { name: rotuloMenu, exact: true });
  const noMenu = (await item.count()) > 0;

  await page.goto(url);
  // Espera o conteúdo principal ter um título antes de afirmar o que NÃO aparece.
  await expect(page.locator("main").getByRole("heading").first()).toBeVisible();

  if (noMenu) {
    await expect(tituloAcessoNegado(page)).toHaveCount(0);
    await expect(page.getByText(/Não foi possível carregar/)).toHaveCount(0);
  } else {
    await expect(tituloAcessoNegado(page)).toBeVisible();
  }
}

// X2: o menu mostra "Empresas" ao Gerente Comercial e à Secretaria (src/lib/nav.ts),
// mas a página só abre para Financeiro e Administrador (empresas/page.tsx). Hoje o
// clique no menu leva a "Acesso negado — ... as empresas (B2B)".
for (const [id, papel] of [
  ["PER-06a", "GERENTE_COMERCIAL"],
  ["PER-06b", "SECRETARIA"],
] as const) {
  test.describe(`${papel}: menu Empresas × página /empresas`, () => {
    test.use({ papel });

    test.fixme(`${id} item Empresas do menu e página /empresas coerentes (bug X2)`, async ({ page }) => {
      await conferirMenuCoerenteComPagina(page, "Empresas", "/empresas");
    });
  });
}

// X3: estas duas telas negam o acesso com a tela de erro da área (ErroArea: "Não foi
// possível carregar o financeiro" / "... esta configuração", com "Tentar de novo") em vez
// de "Acesso negado". O teste procura só o início, "Não foi possível carregar":
//   - /financeiro/permuta usa o guard de Server Action (exigirSessaoComPapel), que lança
//     exceção (financeiro/permuta/page.tsx:12);
//   - /configuracao/contratos não tem guard na página e a consulta lança exceção para
//     quem não é Secretaria (src/server/contratos/modelos.ts:48).
// Sem `mecanismo`: a forma da negação depende de como o X3 for corrigido.
const CASOS_X3: Omit<CasoNegado, "mecanismo">[] = [
  {
    id: "PER-07a",
    papel: "VENDEDOR",
    url: "/financeiro/permuta",
    descricao: "Vendedor em Permutas vê Acesso negado, não a tela de erro (bug X3)",
  },
  {
    id: "PER-07b",
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

      // O que importa é o título e a ausência da tela de erro genérica.
      await expect(tituloAcessoNegado(page)).toBeVisible();
      await expect(page.getByText(/Não foi possível carregar/)).toHaveCount(0);
    });
  });
}

// R13 (decisão pendente): o Gerente Comercial não tem "Configuração" no menu, mas abre
// /configuracao/crm pela URL e pelo link "Definir metas" (Relatórios › Equipe). O
// docs/09 diz diferente. Hoje: sem item no menu e a página abre (Configuração › CRM).
test.describe("GERENTE_COMERCIAL: menu Configuração × /configuracao/crm", () => {
  test.use({ papel: "GERENTE_COMERCIAL" });

  test.fixme("PER-08a item Configuração do menu e página /configuracao/crm coerentes (decisão R13)", async ({ page }) => {
    await conferirMenuCoerenteComPagina(page, "Configuração", "/configuracao/crm");
  });
});
