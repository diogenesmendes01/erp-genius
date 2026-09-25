import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { MAPA_BOTOES } from "./botoes-mapa";

// E1 (docs/42-auditoria-frontend-ux.md): o botão tem uma fonte só (botaoClasses / <Botao>, em
// src/components/Botao.tsx). A migração é por ÁREA; nas áreas desta lista (que só cresce):
// - nenhum literal de classe (string, template, concatenação) desenha um botão primário à mão;
// - nenhum <button> com padding e borda/fundo escreve as classes à mão em vez de botaoClasses;
// - a variante e o tamanho decididos para cada botão na migração ficam travados (botoes-mapa.ts).
// A análise é pelo AST do TypeScript (qualquer forma de className), não por regex de atributo.
const AREAS_MIGRADAS = ["src/app/(app)/configuracao", "src/app/(app)/diario", "src/app/(app)/academico"];

/** Exceções contadas por arquivo: não são botões de ação (chips de seleção, item de lista). */
const NAO_SAO_BOTOES_DE_ACAO: Record<string, number> = {
  "src/app/(app)/configuracao/turmas/TurmaFormulario.tsx": 2, // chip de dia da semana (selecionado = marca)
  "src/app/(app)/configuracao/whatsapp/PoliticaPainel.tsx": 2, // chip de dia da semana (selecionado = marca)
  "src/app/(app)/configuracao/whatsapp/ReguaComercialPainel.tsx": 1, // item de lista suspensa
};

const PRIMARIO = /\bbg-(brand-solid|brand-600|brand-700|black|danger)\b/;

/** Ofensas num fonte TSX: literais de botão primário e <button> com classes de botão à mão. */
export function botoesCrus(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  // className={campo}: a classe pode estar numa constante string do arquivo — o detector a resolve.
  const constantes = new Map<string, string>();
  const coletar = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) constantes.set(n.name.text, n.initializer.text);
    ts.forEachChild(n, coletar);
  };
  coletar(sf);
  const visitar = (n: ts.Node) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) {
      const t = n.text.split(/\s+/);
      if (!t.some((x) => x.startsWith("file:")) && PRIMARIO.test(n.text) && t.includes("text-white")) achados.push(`primário: "${n.text}"`);
    }
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === "button") {
      const attr = n.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === "className");
      const ini = attr && ts.isJsxAttribute(attr) ? attr.initializer : undefined;
      const expr = ini && ts.isJsxExpression(ini) ? ini.expression : undefined;
      const texto = expr && ts.isIdentifier(expr) && constantes.has(expr.text) ? constantes.get(expr.text)! : ini ? ini.getText(sf) : "";
      // Padding em qualquer forma (px-, py-, p-) com borda ou fundo: cara de botão.
      if (texto && !/botaoClasses|\bbtn[A-Z]\w*/.test(texto) && /\bp[xy]?-\d/.test(texto) && /\b(border|bg-)/.test(texto)) achados.push(`<button> à mão: ${texto.slice(0, 80)}`);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

/** Textos visíveis de um elemento JSX (texto e literais dos filhos), para localizar o botão no mapa. */
function textosVisiveis(el: ts.JsxElement, sf: ts.SourceFile): string {
  const partes: string[] = [];
  const coletar = (n: ts.Node) => {
    if (ts.isJsxAttributes(n)) return;
    if (ts.isJsxText(n)) {
      const t = n.getText(sf).replace(/\s+/g, " ").trim();
      if (t) partes.push(t);
    } else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) partes.push(n.text);
    ts.forEachChild(n, coletar);
  };
  for (const c of el.children) coletar(c);
  return partes.join(" · ").slice(0, 60);
}

/**
 * Cada chamada a botaoClasses(...) do fonte, em ordem: "<rótulo> → variante/tamanho". Rótulo é o
 * texto visível do elemento (ou `const nome`); omitidos valem primario/md, como em Botao.tsx.
 */
export function mapaDeBotoes(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const itens: string[] = [];
  const valor = (i: ts.Expression) =>
    ts.isStringLiteral(i) ? i.text : ts.isConditionalExpression(i) && ts.isStringLiteral(i.whenTrue) && ts.isStringLiteral(i.whenFalse) ? `${i.whenTrue.text}|${i.whenFalse.text}` : "?";
  const visitar = (n: ts.Node) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "botaoClasses") {
      let variante = "primario", tamanho = "md";
      const arg = n.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) {
          if (!ts.isPropertyAssignment(p)) continue;
          if (p.name.getText(sf) === "variante") variante = valor(p.initializer);
          if (p.name.getText(sf) === "tamanho") tamanho = valor(p.initializer);
        }
      } else if (arg) variante = tamanho = "?";
      let rotulo = "?";
      for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
        if (ts.isVariableDeclaration(p)) { rotulo = `const ${p.name.getText(sf)}`; break; }
        if (ts.isJsxAttribute(p)) {
          const el = p.parent.parent;
          rotulo = `<${el.tagName.getText(sf)}> ${ts.isJsxOpeningElement(el) ? textosVisiveis(el.parent, sf) : ""}`.trim();
          break;
        }
      }
      itens.push(`${rotulo} → ${variante}/${tamanho}`);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return itens;
}

const arquivos = AREAS_MIGRADAS.flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.tsx$/.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

describe("botões nas áreas migradas", () => {
  it("nenhum botão de ação montado à mão (use botaoClasses ou <Botao>); exceções contadas", () => {
    const ofensores = arquivos.flatMap(({ arquivo, conteudo }) => {
      const achados = botoesCrus(conteudo);
      return achados.length > (NAO_SAO_BOTOES_DE_ACAO[arquivo] ?? 0) ? [`${arquivo}: ${achados.join(" | ")}`] : [];
    });
    expect(ofensores).toEqual([]);
  });

  it("a lista de áreas migradas só cresce (uma área não sai num rebase distraído)", () => {
    expect(AREAS_MIGRADAS).toEqual(expect.arrayContaining(["src/app/(app)/configuracao", "src/app/(app)/diario", "src/app/(app)/academico"]));
  });

  it("variante e tamanho de cada botão migrado ficam como decididos (src/app/botoes-mapa.ts)", () => {
    const real: Record<string, string[]> = {};
    for (const { arquivo, conteudo } of arquivos) {
      if (/\.test\./.test(arquivo)) continue;
      const itens = mapaDeBotoes(conteudo);
      if (itens.length) real[arquivo.replace("src/app/(app)/", "")] = itens;
    }
    expect(real).toEqual(MAPA_BOTOES);
  });

  it("o mapa localiza cada chamada: rótulo pelo texto do botão ou pela constante; omitidos valem primario/md", () => {
    expect(mapaDeBotoes('<button className={botaoClasses({ variante: "perigo" })}>{ocupado ? "Rejeitando…" : "Rejeitar"}</button>')).toEqual(["<button> Rejeitando… · Rejeitar → perigo/md"]);
    expect(mapaDeBotoes('const principal = botaoClasses({ tamanho: "lg" });')).toEqual(["const principal → primario/lg"]);
    expect(mapaDeBotoes("<Link className={`${botaoClasses()} mt-2`} href=\"/x\">Propor</Link>")).toEqual(["<Link> Propor → primario/md"]);
    expect(mapaDeBotoes('<button className={botaoClasses({ variante: on ? "perigo" : "secundario" })}>X</button>')).toEqual(["<button> X → perigo|secundario/md"]);
  });

  it("a lista de exceções não sobra", () => {
    const sobrando = Object.entries(NAO_SAO_BOTOES_DE_ACAO).filter(([a, n]) => botoesCrus(arquivos.find((x) => x.arquivo === a)?.conteudo ?? "").length < n);
    expect(sobrando).toEqual([]);
  });

  it("o detector pega todas as formas: atributo, expressão, template, concatenação, brand-600, secundário curto", () => {
    const casos = [
      '<button className="rounded-md bg-brand-solid px-4 py-2 text-sm text-white">x</button>',
      '<button className={"rounded-md bg-brand-solid px-4 py-2 text-white"}>x</button>',
      "<button className={`rounded bg-brand-solid px-3 py-2 text-white ${a}`}>x</button>",
      '<button className="rounded bg-brand-600 px-3 py-2 text-white">x</button>',
      '<button className="rounded border px-3 py-2">x</button>',
      '<button type="button" className="rounded border p-2">Adicionar</button>',
      '<button className={"rounded-md px-3 " + (a ? "bg-danger text-white" : "border")}>x</button>',
      'const c = "rounded bg-black px-4 py-2 text-white";',
      'const campo = "rounded-md border px-3 py-2"; <button className={campo}>Cancelar</button>',
    ];
    for (const c of casos) expect(botoesCrus(c).length, c).toBeGreaterThan(0);
    for (const ok of [
      '<button className={botaoClasses({ tamanho: "lg" })}>x</button>',
      '<button className={`${botaoClasses()} mt-4`}>x</button>',
      "<button className={btnSec}>x</button>",
      'const campo = "rounded border p-2"; <input className={campo} />',
      "const botao = botaoClasses(); <button className={botao}>x</button>",
      '<input className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />',
      '<input className="file:bg-brand-solid file:text-white text-sm" />',
      '<button className="text-sm text-brand-700 hover:underline">x</button>',
    ]) expect(botoesCrus(ok), ok).toEqual([]);
  });
});
