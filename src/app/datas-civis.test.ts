import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// E5 (docs/42-auditoria-frontend-ux.md): datas civis ("2026-10-15") e competências ("2026-10") eram
// impressas cruas. Campos de data civil/competência impressos direto em JSX ou template passam por
// formatarDataCivil / formatarCompetencia (src/lib/data-civil.ts).
const CIVIL = /(\.(vencimento|vencimentoNovo|vencimentoProposto|dataPagamento|dataCobertura|coberturaInicio|coberturaFim|dataReferencia|dataInicialInformada)|\.(cobertura|compensacao|periodo|coberturaCalculada\??|coberturaAnterior)\.(inicio|fim|vencimento))$/;
const COMPETENCIA = /\.competencia$/;

export function datasCruas(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    let expr: ts.Expression | undefined;
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) expr = n.expression;
    if (ts.isTemplateSpan(n)) expr = n.expression;
    if (expr && ts.isPropertyAccessExpression(expr)) {
      const t = expr.getText(sf);
      if (CIVIL.test(t) || COMPETENCIA.test(t)) achados.push(t);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

const telas = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

describe("datas civis e competências formatadas", () => {
  it("nenhum vencimento/cobertura/competência impresso cru (use formatarDataCivil / formatarCompetencia)", () => {
    const ofensores = telas.flatMap(({ arquivo, conteudo }) => datasCruas(conteudo).map((t) => `${arquivo}: {${t}}`));
    expect(ofensores).toEqual([]);
  });

  it("o detector pega JSX e template, e aceita o valor formatado ou usado como atributo", () => {
    expect(datasCruas("<p>vence {c.vencimento}</p>")).toEqual(["c.vencimento"]);
    expect(datasCruas("const t = `de ${p.cobertura.inicio} a ${p.cobertura.fim}`;")).toEqual(["p.cobertura.inicio", "p.cobertura.fim"]);
    expect(datasCruas("<p>{f.competencia}</p>")).toEqual(["f.competencia"]);
    expect(datasCruas("<p>vence {formatarDataCivil(c.vencimento)}</p>")).toEqual([]);
    expect(datasCruas('<input defaultValue={c.vencimento} type="date" />')).toEqual([]);
  });
});
