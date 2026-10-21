// =============================================================================
// Permissões: papel X abre a URL Y por digitação direta e deve ver "Acesso negado".
//
// Fonte: cenários PER-01 a PER-14 de docs/qa/03-roteiro-testes-manuais.md (um cenário
// manual cobre várias URLs; aqui cada URL vira um teste com sufixo a, b, c…) e a
// "Matriz papel × ação" de docs/qa/auditoria/01-papeis-permissoes.md.
//
// Lembrete: o menu esconder um item NÃO é segurança. O que vale é o servidor barrar
// quando o usuário digita a URL — é isso que estes testes verificam.
//
// Duas formas de "acesso negado" existem hoje, ambas com o título "Acesso negado":
//   - a página /acesso-negado (redirect feito por exigirSessaoPagina, ex.: /inbox);
//   - o componente <AcessoNegado> renderizado na própria URL (ex.: /financeiro).
// Por isso o assert principal é pelo título, não pela URL.
// =============================================================================

import { test, expect } from "./fixtures/auth";
import type { PapelE2E } from "./fixtures/usuarios";

interface CasoNegado {
  id: string;
  papel: PapelE2E;
  url: string;
  descricao: string;
}

/** Casos que DEVEM mostrar "Acesso negado" (guard de leitura existe no código). */
const CASOS_NEGADOS: CasoNegado[] = [
  {
    id: "PER-09a",
    papel: "PROFESSOR",
    url: "/financeiro",
    descricao: "Professor não vê o painel Financeiro",
  },
  {
    id: "PER-05a",
    papel: "VENDEDOR",
    url: "/configuracao/usuarios",
    descricao: "Vendedor não vê Configuração › Usuários",
  },
  {
    id: "PER-07a",
    papel: "GERENTE_PEDAGOGICO",
    url: "/financeiro",
    descricao: "Gerente Pedagógico não vê o painel Financeiro",
  },
  {
    id: "PER-05b",
    papel: "VENDEDOR",
    url: "/alunos",
    descricao: "Vendedor não vê a lista de alunos",
  },
  {
    id: "PER-09b",
    papel: "PROFESSOR",
    url: "/inbox",
    descricao: "Professor não vê a Inbox do WhatsApp",
  },
];

for (const caso of CASOS_NEGADOS) {
  test.describe(`${caso.papel} em ${caso.url}`, () => {
    // Começa o teste já logado com o papel do caso (sessão salva pelo setup).
    test.use({ papel: caso.papel });

    test(`${caso.id} ${caso.descricao}`, async ({ page }) => {
      await page.goto(caso.url);

      await expect(page.getByRole("heading", { name: "Acesso negado" })).toBeVisible();
    });
  });
}

// -----------------------------------------------------------------------------
// Divergência R5 (docs/qa/auditoria-consolidada.md): "Leituras sem guard de papel".
// Hoje QUALQUER usuário logado abre estas páginas pela URL e lê os dados (preços,
// países, turmas). Pelo doc 09 elas deveriam ser só do Admin (Turmas: Admin + GP).
//
// Os testes abaixo descrevem o comportamento ESPERADO pelo doc (acesso negado) e
// estão marcados com test.fixme(): o Playwright os lista, mas não executa, até o
// gestor decidir o R5. Quando a correção for publicada no UAT, troque test.fixme
// por test e rode. Se o gestor decidir que o comportamento atual é o correto,
// apague o caso.
// -----------------------------------------------------------------------------

const CASOS_R5: CasoNegado[] = [
  {
    id: "PER-09c",
    papel: "PROFESSOR",
    url: "/configuracao/catalogo",
    descricao: "Professor não vê o catálogo com preços (R5)",
  },
  {
    id: "PER-05c",
    papel: "VENDEDOR",
    url: "/configuracao/paises",
    descricao: "Vendedor não vê Configuração › Países (R5)",
  },
  {
    id: "PER-09d",
    papel: "PROFESSOR",
    url: "/configuracao/turmas",
    descricao: "Professor não vê Configuração › Turmas (R5)",
  },
];

for (const caso of CASOS_R5) {
  test.describe(`${caso.papel} em ${caso.url}`, () => {
    test.use({ papel: caso.papel });

    test.fixme(`${caso.id} ${caso.descricao}`, async ({ page }) => {
      await page.goto(caso.url);

      await expect(page.getByRole("heading", { name: "Acesso negado" })).toBeVisible();
    });
  });
}
