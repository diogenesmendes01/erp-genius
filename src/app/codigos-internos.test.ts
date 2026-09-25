import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ORIGEM_VENCIMENTO_LABEL, rotuloVencimento } from "@/lib/vencimento-civil";

// E5 (docs/42-auditoria-frontend-ux.md): códigos internos de especificação (Q23, Q92, Q121, Q165,
// M01, S15…) apareciam na tela como se fossem termos de negócio. O operador não sabe o que é "Q165";
// sabe o que é "acerto financeiro antes da ativação". Comentários podem citar o código; texto de
// tela (JSX e literais de string) não.
const CODIGO = /\b(Q\d{2,3}|M0\d|S1\d|D\d{2})\b/;

export function codigosNaTela(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    let texto: string | null = null;
    if (ts.isJsxText(n)) texto = n.getText(sf);
    else if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) && !ts.isImportDeclaration(n.parent)) texto = n.text;
    if (texto && CODIGO.test(texto)) achados.push(texto.replace(/\s+/g, " ").trim().slice(0, 80));
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

/** <Link href=…>texto</Link> de um fonte: href como escrito (literal ou template) e o texto. */
function linksDaTela(fonte: string): { href: string; texto: string }[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const links: { href: string; texto: string }[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText(sf) === "Link") {
      const href = n.openingElement.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "href") as ts.JsxAttribute | undefined;
      const ini = href?.initializer;
      const valor = ini && ts.isJsxExpression(ini) && ini.expression ? ini.expression.getText(sf) : ini?.getText(sf) ?? "";
      links.push({ href: valor, texto: n.children.map((c) => c.getText(sf)).join("").trim() });
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return links;
}

const telas = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

describe("códigos internos de especificação fora da tela", () => {
  it("nenhum texto de tela cita Q23/Q165/M01/S15… (use o nome do fluxo)", () => {
    const ofensores = telas.flatMap(({ arquivo, conteudo }) => codigosNaTela(conteudo).map((t) => `${arquivo}: "${t}"`));
    expect(ofensores).toEqual([]);
  });

  it("origem do vencimento sai em texto de operação (\"M01_HISTORICO\" aparecia cru)", () => {
    for (const rotulo of Object.values(ORIGEM_VENCIMENTO_LABEL)) expect(rotulo, rotulo).not.toMatch(CODIGO);
    const texto = rotuloVencimento({ estado: "CONFIRMADO", dataCivil: "2099-02-28", fuso: null, origem: "M01_HISTORICO" });
    expect(texto).toBe("vence 28/02/2099 · origem: histórico da migração");
  });

  it("onde o código virou nome de fluxo com destino, o link para o destino existe (Q23 → diário; Q92 → condições por hora)", () => {
    const fonte = (arquivo: string) => telas.find((t) => t.arquivo === arquivo)?.conteudo ?? "";
    expect(linksDaTela(fonte("src/app/(app)/configuracao/migracao/presenca/[linhaId]/PresencaHistorica.tsx"))).toContainEqual({ href: '"/diario"', texto: "diário de aulas" });
    expect(linksDaTela(fonte("src/app/(app)/matriculas/[id]/ocorrencias-financeiras/revisoes-correcao-aula/page.tsx"))).toContainEqual({ href: "`/matriculas/${id}/condicoes-horas`", texto: "condições por hora" });
  });

  it("o detector pega texto JSX e literais, e ignora comentários", () => {
    expect(codigosNaTela("<p>Sem regra Q165 nesta versão.</p>")).toHaveLength(1);
    expect(codigosNaTela('const t = "mapa M01 da matrícula";')).toHaveLength(1);
    expect(codigosNaTela("const t = `template aprovado (S15) ${x}`;")).toHaveLength(1);
    expect(codigosNaTela("// regra Q165 (docs)\nconst t = 1;")).toEqual([]);
    expect(codigosNaTela("{/* Q23 */}<p>Correção de aula</p>")).toEqual([]);
  });
});
