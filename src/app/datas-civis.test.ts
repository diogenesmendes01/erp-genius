import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// E5 (docs/42-auditoria-frontend-ux.md): datas civis ("2026-10-15") e competências ("2026-10") eram
// impressas cruas. Campos de data civil/competência impressos em JSX ou template passam por
// formatarDataCivil / formatarCompetencia (src/lib/data-civil.ts).
//
// Campos: qualquer "*vencimento*" (menos dia/ajuste, que não são datas), coberturaInicio/Fim e
// variantes, dataCivil, dataPagamento, dataCobertura, dataReferencia, dataInicialInformada, e
// inicio/fim/vencimento sob cobertura*/compensacao/periodo; competência em qualquer "competencia*".
const CIVIL = /(\.(?!dia|ajuste)(\w*[vV]encimento\w*)|\.(cobertura(Inicio|Fim)\w*|dataCivil|dataPagamento|dataCobertura|dataReferencia|dataInicialInformada)|\.(cobertura\w*|compensacao|periodo)\??\.(inicio|fim\w*|vencimento))$/;
const COMPETENCIA = /\.competencia\w*$/;

/**
 * O que de uma expressão chega impresso na tela. Desce por `??`/`||` (os dois lados), `&&` (só o
 * direito — o esquerdo é condição), ternário (só os ramos), parênteses, `!`, `as`, `String(x)` e
 * `.slice/.substring/.trim/.toString` (cortar o ISO não o formata). Qualquer outra chamada é tratada
 * como formatação.
 */
function impressos(e: ts.Expression): ts.PropertyAccessExpression[] {
  if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e)) return impressos(e.expression);
  if (ts.isBinaryExpression(e)) {
    const op = e.operatorToken.kind;
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) return [...impressos(e.left), ...impressos(e.right)];
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return impressos(e.right);
    return [];
  }
  if (ts.isConditionalExpression(e)) return [...impressos(e.whenTrue), ...impressos(e.whenFalse)];
  if (ts.isCallExpression(e)) {
    const f = e.expression;
    if (ts.isPropertyAccessExpression(f) && ["slice", "substring", "substr", "trim", "toString"].includes(f.name.text)) return impressos(f.expression);
    if (ts.isIdentifier(f) && f.text === "String" && e.arguments[0]) return impressos(e.arguments[0]);
    return [];
  }
  return ts.isPropertyAccessExpression(e) ? [e] : [];
}

export function datasCruas(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    let expr: ts.Expression | undefined;
    if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) expr = n.expression;
    if (ts.isTemplateSpan(n)) expr = n.expression;
    for (const p of expr ? impressos(expr) : []) {
      const t = p.getText(sf).replace(/\s+/g, "");
      if (CIVIL.test(t) || COMPETENCIA.test(t)) achados.push(t);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

// C52 da #170: `new Date(campoCivil).toLocaleDateString()` passa o dia pelo fuso do navegador — um dia gravado à
// meia-noite UTC aparece como o anterior em UTC−3. Além dos campos de CIVIL, o início/término da turma.
const CIVIL_DA_TURMA = /\.data(Inicio|Fim)$/;

/**
 * Campos civis mostrados como dia pelo fuso do navegador: `new Date(x.vencimento).toLocaleDateString(...)`.
 * `toLocaleString` (com hora) fica de fora: quem mostra a hora está tratando o campo como instante.
 */
export function civisComoInstante(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === "toLocaleDateString") {
      let alvo: ts.Expression = n.expression.expression;
      while (ts.isParenthesizedExpression(alvo)) alvo = alvo.expression;
      if (ts.isNewExpression(alvo) && ts.isIdentifier(alvo.expression) && alvo.expression.text === "Date" && alvo.arguments?.[0]) {
        for (const p of impressos(alvo.arguments[0])) {
          const t = p.getText(sf).replace(/\s+/g, "");
          if (CIVIL.test(t) || CIVIL_DA_TURMA.test(t)) achados.push(t);
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

/** Usos conhecidos fora do recorte da C52, contados por arquivo — a lista só encolhe. */
// Vazia desde o fuso pessoal nas telas: a data do pagamento dos informes é data civil gravada ao meio-dia da escola
// (dataOpcional + analisarComDatasDaEscola) e sai por formatarDiaCivilGravado.
const CIVIS_COMO_INSTANTE_CONHECIDOS: Record<string, { usos: number; motivo: string }> = {};

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

  it("nenhum campo civil formatado como instante (new Date(…).toLocaleDateString), fora dos usos contados (C52 da #170)", () => {
    const porArquivo = telas
      .map(({ arquivo, conteudo }) => ({ arquivo, achados: civisComoInstante(conteudo) }))
      .filter(({ achados }) => achados.length > 0);
    const ofensores = porArquivo
      .filter(({ arquivo, achados }) => achados.length > (CIVIS_COMO_INSTANTE_CONHECIDOS[arquivo]?.usos ?? 0))
      .map(({ arquivo, achados }) => `${arquivo}: ${achados.join(", ")}`);
    expect(ofensores).toEqual([]);
    // A lista não sobra: uso corrigido sai daqui.
    const sobrando = Object.entries(CIVIS_COMO_INSTANTE_CONHECIDOS)
      .filter(([arquivo, { usos }]) => (porArquivo.find((p) => p.arquivo === arquivo)?.achados.length ?? 0) < usos)
      .map(([arquivo]) => arquivo);
    expect(sobrando).toEqual([]);
  });

  it("o detector de civil como instante pega vencimento, cobertura e início/término da turma; instante e dia já formatado passam", () => {
    expect(civisComoInstante('<td>{new Date(f.vencimento).toLocaleDateString("pt-BR")}</td>')).toEqual(["f.vencimento"]);
    expect(civisComoInstante('<td>{t.dataInicio ? new Date(t.dataInicio).toLocaleDateString("pt-BR") : "—"}</td>')).toEqual(["t.dataInicio"]);
    expect(civisComoInstante("const s = `até ${(new Date(p.cobertura.fim)).toLocaleDateString()}`;")).toEqual(["p.cobertura.fim"]);
    expect(civisComoInstante('<option>{new Date(item.dataPagamento).toLocaleString("pt-BR")}</option>')).toEqual([]); // com hora: instante
    expect(civisComoInstante('<td>{new Date(t.dataFim ?? "").toLocaleDateString()}</td>')).toEqual(["t.dataFim"]);
    expect(civisComoInstante('<td>{new Date(c.emitidoEmISO).toLocaleDateString("pt-BR")}</td>')).toEqual([]);
    expect(civisComoInstante("<td>{formatarDataCivil(t.dataInicio.slice(0, 10))}</td>")).toEqual([]);
    expect(civisComoInstante("<td>{new Date(t.dataInicio).getTime()}</td>")).toEqual([]);
  });

  it("o detector pega JSX e template, e aceita o valor formatado ou usado como atributo", () => {
    expect(datasCruas("<p>vence {c.vencimento}</p>")).toEqual(["c.vencimento"]);
    expect(datasCruas("const t = `de ${p.cobertura.inicio} a ${p.cobertura.fim}`;")).toEqual(["p.cobertura.inicio", "p.cobertura.fim"]);
    expect(datasCruas("<p>{f.competencia}</p>")).toEqual(["f.competencia"]);
    expect(datasCruas("<p>vence {formatarDataCivil(c.vencimento)}</p>")).toEqual([]);
    expect(datasCruas('<input defaultValue={c.vencimento} type="date" />')).toEqual([]);
  });

  it("o detector não é furado por operadores, ternário nem corte do ISO", () => {
    expect(datasCruas('<p>{item.vencimento ?? ""}</p>')).toEqual(["item.vencimento"]);
    expect(datasCruas('<p>{c.coberturaInicio || "pendente"}</p>')).toEqual(["c.coberturaInicio"]);
    expect(datasCruas("<p>{ok && c.coberturaFimNova}</p>")).toEqual(["c.coberturaFimNova"]);
    expect(datasCruas('<p>{x ? p.dados.taxaVencimento : "—"}</p>')).toEqual(["p.dados.taxaVencimento"]);
    expect(datasCruas("<td>{c.vencimento.slice(0,10)}</td>")).toEqual(["c.vencimento"]);
    expect(datasCruas("<p>{(a.proximoVencimento!.dataCivil)}</p>")).toEqual(["a.proximoVencimento!.dataCivil"]);
    expect(datasCruas("const t = `de ${p.periodo?.inicio} até ${p.periodo?.fimExclusivo}`;")).toEqual(["p.periodo?.inicio", "p.periodo?.fimExclusivo"]);
    // Condição de && não é impressa; dia e ajuste de vencimento não são datas; formatado passa.
    expect(datasCruas("<p>{item.vencimento && <span>{formatarDataCivil(item.vencimento)}</span>}</p>")).toEqual([]);
    expect(datasCruas("<p>dia {r.diaVencimento} · {r.ajusteVencimento}</p>")).toEqual([]);
    expect(datasCruas('<p>{formatarDataCivil(c.coberturaInicio, "pendente")}</p>')).toEqual([]);
  });
});
