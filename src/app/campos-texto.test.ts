import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// E1/E7 (docs/42-auditoria-frontend-ux.md): 266 <textarea minLength> escondiam o mínimo até o envio.
// Todo campo de texto longo das telas é <CampoTexto> (src/components/CampoTexto.tsx), que mostra o
// mínimo e a contagem ligados por aria-describedby.
//
// A trava não depende da sintaxe (R1 da #121): em vez de reconhecer cada forma de escrever o elemento
// (JSX, createElement, tag em variável, membro, atributo minúsculo…), a PALAVRA "textarea", em qualquer
// caixa, simplesmente não aparece no código das telas — só em CampoTexto.tsx. A única exceção é o tipo
// HTMLTextAreaElement (tipo do TypeScript, não cria elemento). Em comentário, escreva "campo de texto".

const TIPO_PERMITIDO = /HTMLTextAreaElement/g;

/** Ocorrências da palavra textarea (qualquer caixa) num fonte, fora do tipo HTMLTextAreaElement. */
export function mencoesDeTextarea(fonte: string): number {
  return fonte.replace(TIPO_PERMITIDO, "").match(/textarea/gi)?.length ?? 0;
}

/**
 * Elemento com tag DINÂMICA — o caminho para criar o campo nativo sem escrever a palavra (R2 da #121:
 * "text"+"area", template, fromCharCode, join, escape unicode). As telas não usam nenhum dos dois:
 * - chamada a createElement / jsx / jsxs / jsxDEV / cloneElement;
 * - tag JSX com inicial maiúscula ligada, no próprio arquivo, a uma expressão que produz texto
 *   (literal, template, +, fromCharCode, join, concat, String, raw). Componente de verdade (função,
 *   import, ícone de um mapa) não produz texto e passa.
 */
export function tagsDinamicas(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const locais = new Map<string, ts.Expression>();
  const coletar = (n: ts.Node) => {
    if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name) && n.initializer) locais.set(n.name.text, n.initializer);
    ts.forEachChild(n, coletar);
  };
  coletar(sf);
  const produzTexto = (e: ts.Node): boolean =>
    ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e) ||
    (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.PlusToken) ||
    (ts.isCallExpression(e) && ["fromCharCode", "join", "concat", "String", "raw", "fromCodePoint"].includes(ts.isIdentifier(e.expression) ? e.expression.text : ts.isPropertyAccessExpression(e.expression) ? e.expression.name.text : "")) ||
    (ts.forEachChild(e, produzTexto) ?? false);
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const c = n.expression;
      const nome = ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : "";
      if (["createElement", "jsx", "jsxs", "jsxDEV", "cloneElement"].includes(nome)) achados.push(`${nome}(…)`);
    }
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ts.isIdentifier(n.tagName) && /^[A-Z]/.test(n.tagName.text)) {
      const ini = locais.get(n.tagName.text);
      if (ini && produzTexto(ini)) achados.push(`<${n.tagName.text}> = ${ini.getText(sf).slice(0, 60)}`);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

const fontes = ["src/app", "src/components"].flatMap((raiz) =>
  (readdirSync(raiz, { recursive: true }) as string[])
    .filter((f) => /\.(t|j)sx?$/.test(f) && !/\.test\./.test(f))
    .map((f) => ({ arquivo: join(raiz, f).split("\\").join("/"), conteudo: readFileSync(join(raiz, f), "utf-8") })),
);

describe("campo de texto longo só pelo CampoTexto", () => {
  it("a palavra \"textarea\" (qualquer caixa, qualquer sintaxe) só aparece em src/components/CampoTexto.tsx", () => {
    const ofensores = fontes
      .filter(({ arquivo }) => arquivo !== "src/components/CampoTexto.tsx")
      .filter(({ conteudo }) => mencoesDeTextarea(conteudo) > 0)
      .map(({ arquivo, conteudo }) => `${arquivo}: ${mencoesDeTextarea(conteudo)}`);
    expect(ofensores).toEqual([]);
  });

  it("nenhuma tela cria elemento com tag dinâmica (createElement/jsx ou tag JSX ligada a texto)", () => {
    const ofensores = fontes.flatMap(({ arquivo, conteudo }) => tagsDinamicas(conteudo).map((t) => `${arquivo}: ${t}`));
    expect(ofensores).toEqual([]);
  });

  it("o detector de tag dinâmica pega as montagens do nome e aceita componente de verdade", () => {
    for (const fonte of [
      'createElement("text" + "area", { minLength: 5 })',
      "createElement(`text${\"\"}area`, { minLength: 5 })",
      "React.createElement(String.fromCharCode(116, 101, 120, 116, 97, 114, 101, 97), { minLength: 5 })",
      'jsx(["text", "area"].join(""), { minLength: 5 })',
      'createElement("\\u0074extarea", { minLength: 5 })',
      'const Tag = "text" + "area"; <Tag minLength={5} />',
      "const Tag = `text${x}`; <Tag minLength={5} />",
      'function F({ as: Tag = "text" + "area" }) { return <Tag minLength={5} />; }',
      "cloneElement(el, { minLength: 5 })",
    ]) expect(tagsDinamicas(fonte), fonte).not.toEqual([]);
    expect(tagsDinamicas("const Icon = ICONS[item.icon] ?? IconHome; <Icon />")).toEqual([]);
    expect(tagsDinamicas('import { Botao } from "x"; <Botao>Ok</Botao>')).toEqual([]);
    expect(tagsDinamicas("const form = new FormData(); <form />")).toEqual([]);
  });

  it("todos os campos de texto longo estão no CampoTexto (a migração não perdeu nenhum)", () => {
    const usos = fontes.reduce((s, { conteudo }) => s + (conteudo.match(/<CampoTexto\b/g)?.length ?? 0), 0);
    expect(usos).toBeGreaterThanOrEqual(319); // 266 com mínimo + 53 sem
  });

  it("o detector pega JSX, createElement, tag em variável, membro e atributo minúsculo; aceita o tipo", () => {
    expect(mencoesDeTextarea('<textarea name="m" minLength={5} />')).toBe(1);
    expect(mencoesDeTextarea('createElement("textarea", { minLength: 5 })')).toBe(1);
    expect(mencoesDeTextarea('const Tag = "textarea"; <Tag minLength={5} />')).toBe(1);
    expect(mencoesDeTextarea("<foo.textarea minLength={5} />")).toBe(1);
    expect(mencoesDeTextarea("<TEXTAREA minlength={5} />")).toBe(1);
    expect(mencoesDeTextarea("(e.target as HTMLTextAreaElement).name")).toBe(0);
    expect(mencoesDeTextarea('<CampoTexto name="m" minLength={5} />')).toBe(0);
  });
});
