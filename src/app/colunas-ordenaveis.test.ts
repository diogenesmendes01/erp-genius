import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StatusAluno, StatusComissao } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

// E1 / §5.6 A9 (docs/42-auditoria-frontend-ux.md): "0 colunas ordenáveis"; meta "≥ 3 (/comissoes,
// /alunos, /empresas)". Trava: (1) as tabelas dessas telas têm cabeçalhos ordenáveis, renderizados com
// aria-sort; (2) aria-sort só nasce de <ColunaOrdenavel> — um <th aria-sort> à mão costuma marcar a
// ordem sem ordenar no servidor (ou ordenar só a página exibida), o que mente para quem usa leitor de tela.

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock("@/server/empresas/acoes", () => ({ salvarEmpresa: vi.fn() }));
vi.mock("@/app/(app)/alunos/ImportarAlunosModal", () => ({ ImportarAlunosModal: () => null }));
// Sentinela no lugar do componente: nas tabelas renderizadas, todo aria-sort teria de vir dele — então
// o HTML não pode ter aria-sort nenhum, escrito de qualquer jeito (revisão R1 da #136, B3).
vi.mock("@/components/ColunaOrdenavel", async () => {
  const { createElement: h } = await import("react");
  return { ColunaOrdenavel: ({ campo, rotulo }: { campo: string; rotulo: string }) => h("th", { "data-coluna-ordenavel": campo }, rotulo) };
});

import { AlunosLista } from "./(app)/alunos/AlunosLista";
import { EmpresasCliente } from "./(app)/empresas/EmpresasCliente";
import { Comissoes } from "./(app)/financeiro/FinanceiroPainel";
import { lerFiltrosAlunos } from "@/server/alunos/filtros";
import { lerFiltrosEmpresas } from "@/server/empresas/filtros";
import { lerOrdemComissoes } from "@/server/financeiro/ordem-comissoes";

const COMPONENTE = "src/components/ColunaOrdenavel.tsx";

/** Código de produção (sem testes) de todo o src — inclusive src/lib e src/server, onde um helper poderia montar o atributo. */
const fontes = ["src"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

/** As telas da meta e o arquivo que monta cada tabela. */
const TELAS = [
  "src/app/(app)/alunos/AlunosLista.tsx",
  "src/app/(app)/empresas/EmpresasCliente.tsx",
  "src/app/(app)/financeiro/FinanceiroPainel.tsx",
  "src/app/(app)/comissoes/page.tsx",
];

/**
 * aria-sort escrito fora do componente, em qualquer grafia (revisão R2 da #136, B7): o texto de cada
 * expressão é AVALIADO — literal, template, concatenação (`"aria" + "-sort"`), `.join` de lista literal,
 * constante do arquivo — e não pode dar "aria-sort"; nem "aria" seguido de um pedaço desconhecido
 * (`` `aria${x}` ``, `"aria-" + y`). Nome de atributo JSX e chave/propriedade `ariaSort` também contam.
 */
const DESCONHECIDO = "\u0000";
export function ariaSortNoFonte(fonte: string, arquivo = "x.tsx"): string[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, arquivo.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.TSX);
  const consts = new Map<string, ts.Expression[]>();
  const coletar = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) consts.set(n.name.text, [...(consts.get(n.name.text) ?? []), n.initializer]);
    ts.forEachChild(n, coletar);
  };
  coletar(sf);
  const avaliar = (e: ts.Expression, prof = 0): string => {
    if (prof > 8) return DESCONHECIDO;
    while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e)) e = e.expression;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (ts.isTemplateExpression(e)) return e.head.text + e.templateSpans.map((s) => avaliar(s.expression, prof + 1) + s.literal.text).join("");
    if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) return avaliar(e.left, prof + 1) + avaliar(e.right, prof + 1);
    if (ts.isIdentifier(e)) { const i = consts.get(e.text); return i?.length === 1 ? avaliar(i[0], prof + 1) : DESCONHECIDO; }
    if (ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression)) {
      const alvo = e.expression.expression, metodo = e.expression.name.text;
      if (metodo === "join" && ts.isArrayLiteralExpression(alvo)) {
        const sep = e.arguments[0] ? avaliar(e.arguments[0], prof + 1) : ",";
        return alvo.elements.map((x) => avaliar(x as ts.Expression, prof + 1)).join(sep);
      }
      if (metodo === "concat") return avaliar(alvo, prof + 1) + e.arguments.map((a) => avaliar(a, prof + 1)).join("");
    }
    return DESCONHECIDO;
  };
  /** Expressão de texto "inteira" (não é pedaço de concatenação/template/join maior). */
  const inteira = (n: ts.Node) => {
    let p = n.parent;
    while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p))) p = p.parent;
    if (!p) return true;
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.PlusToken) return false;
    if (ts.isTemplateSpan(p)) return false;
    if (ts.isArrayLiteralExpression(p) && ts.isPropertyAccessExpression(p.parent) && p.parent.name.text === "join") return false;
    if (ts.isPropertyAccessExpression(p) && ["join", "concat"].includes(p.name.text)) return false;
    if (ts.isCallExpression(p) && ts.isPropertyAccessExpression(p.expression) && ["join", "concat"].includes(p.expression.name.text)) return false;
    return true;
  };
  const achados: string[] = [];
  const linha = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const visita = (n: ts.Node) => {
    if (ts.isJsxAttribute(n) && /^aria-?sort$/i.test(n.name.getText(sf))) achados.push(`${linha(n)}: atributo ${n.name.getText(sf)}`);
    else if (ts.isIdentifier(n) && /^ariaSort$/i.test(n.text)) achados.push(`${linha(n)}: identificador ${n.text}`);
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n) || (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken)
      || (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && ["join", "concat"].includes(n.expression.name.text))) && inteira(n) && !ts.isImportDeclaration(n.parent)) {
      const texto = avaliar(n as ts.Expression).toLowerCase();
      if (texto.includes("aria-sort") || /aria-?\u0000/.test(texto)) achados.push(`${linha(n)}: texto "${texto.split(DESCONHECIDO).join("…")}"`);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
}

const colunas = (html: string) => (html.match(/data-coluna-ordenavel="[^"]+"/g) ?? []).map((m) => m.slice(23, -1));

describe("colunas ordenáveis (E1)", () => {
  it("aria-sort só é escrito por <ColunaOrdenavel> — nenhum <th> do app o põe à mão", () => {
    const ofensores = fontes.filter(({ arquivo }) => arquivo !== COMPONENTE).flatMap(({ arquivo, conteudo }) => ariaSortNoFonte(conteudo, arquivo).map((a) => `${arquivo}:${a}`));
    expect(ofensores).toEqual([]);
    expect(fontes.find((f) => f.arquivo === COMPONENTE)?.conteudo).toMatch(/aria-sort=/);
  });

  it("as tabelas de /alunos, /empresas e /comissoes (as duas telas) usam <ColunaOrdenavel>", () => {
    const sem = TELAS.filter((t) => !/<ColunaOrdenavel\b/.test(fontes.find((f) => f.arquivo === t)?.conteudo ?? ""));
    expect(sem).toEqual([]);
  });

  it("/alunos: cabeçalhos ordenáveis vêm de <ColunaOrdenavel>, e nenhum aria-sort de outro lugar", () => {
    const html = renderToStaticMarkup(createElement(AlunosLista, {
      alunos: [{ id: "a1", codigo: "A-1", nome: "Ana", status: StatusAluno.ATIVO, pais: "Costa Rica", turmas: [], financeiro: null }],
      total: 1, totalBase: 1, filtros: lerFiltrosAlunos({}), opcoes: { paises: [], turmas: [] }, exibirFinanceiro: true,
    }));
    expect(colunas(html)).toEqual(["nome", "pais", "status"]);
    expect(html).not.toContain("aria-sort");
  });

  it("/empresas: cabeçalhos ordenáveis vêm de <ColunaOrdenavel>, e nenhum aria-sort de outro lugar", () => {
    const html = renderToStaticMarkup(createElement(EmpresasCliente, {
      empresas: [{ id: "e1", codigo: "E-1", nome: "Acme", pais: null, ativo: true, colaboradores: 2, faturasAReceber: 0 }],
      total: 1, totalBase: 1, filtros: lerFiltrosEmpresas({}), paises: [],
    }));
    expect(colunas(html)).toEqual(["codigo", "nome", "colaboradores", "situacao"]);
    expect(html).not.toContain("aria-sort");
  });

  it("/financeiro/comissoes: cabeçalhos ordenáveis vêm de <ColunaOrdenavel>, e nenhum aria-sort de outro lugar", () => {
    const html = renderToStaticMarkup(createElement(Comissoes, {
      comissoes: [{ id: "c1", vendedor: "Bia", valor: 10, moeda: "USD", percentual: 5, status: StatusComissao.PENDENTE }],
      aPagar: [], podePagar: false, onFechar: () => {}, fechamentoAutomatico: false, onToggleAutomatico: () => {}, isPending: false,
      ordenacao: { atual: lerOrdemComissoes({}), rota: "/financeiro/comissoes", parametros: {} },
    }));
    expect(colunas(html)).toEqual(["vendedor", "valor", "status"]);
    expect(html).not.toContain("aria-sort");
  });

  it("autoteste: aria-sort em qualquer grafia — literal, camelCase, concatenação em qualquer ponto, template, join, concat, constante, helper .ts", () => {
    for (const fonte of [
      '<th aria-sort="ascending">', "<th ariaSort={x}>", '<th {...{["aria-" + "sort"]: "ascending"}}>', "<th {...{[`aria-${t}`]: v}}>", "const k = 'aria-' + 'sort';",
      '<th {...{["aria" + "-sort"]: "ascending"}}>', '<th {...{[`aria${"-sort"}`]: "ascending"}}>', '<th {...{["aria-so" + "rt"]: "x"}}>',
      'const k = ["aria", "sort"].join("-");', 'const k = "aria".concat("-sort");', 'const A = "aria"; const k = A + "-sort";', 'const k = "aria-" + atributo;',
    ]) expect(ariaSortNoFonte(fonte), fonte).not.toEqual([]);
    expect(ariaSortNoFonte('export const ORDEM = "aria-sort";', "helper.ts")).not.toEqual([]);
    for (const fonte of ['<th aria-label="Valor">', 'const t = "ordenar";', "<th className={`px-${n}`}>", 'const s = "Página " + n;'])
      expect(ariaSortNoFonte(fonte), fonte).toEqual([]);
  });
});
