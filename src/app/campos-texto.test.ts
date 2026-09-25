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
 * Caminhos para criar o campo nativo sem escrever a palavra (R2/R3 da #121: nome montado, alias da
 * fábrica, tag reatribuída, fábrica que devolve texto). A trava é por LISTA DO QUE É PERMITIDO:
 * - as fábricas de elemento (createElement, jsx, jsxs, jsxDEV, cloneElement) nem aparecem nas telas —
 *   nenhum import, alias, referência ou chamada, sob qualquer nome local;
 * - toda tag JSX com inicial maiúscula precisa ser comprovadamente um COMPONENTE: import, função ou
 *   classe do arquivo, constante de componente (função, memo, forwardRef, lazy, dynamic) — e, quando a
 *   sintaxe não prova (prop, mapa de ícones), o verificador de tipos do TypeScript: o tipo da tag tem
 *   de ser chamável/construível. Texto (string, any, template montado) não é componente.
 */
const FABRICAS = new Set(["createElement", "jsx", "jsxs", "jsxDEV", "cloneElement"]);
const HOCS = new Set(["memo", "forwardRef", "lazy", "dynamic"]);

/** Menções às fábricas de elemento, em qualquer papel (import, alias, referência, chamada). */
export function fabricasDeElemento(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: string[] = [];
  const visitar = (n: ts.Node) => {
    if (ts.isIdentifier(n) && FABRICAS.has(n.text)) achados.push(n.text);
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return achados;
}

/** Tags JSX maiúsculas que a sintaxe não prova serem componente (vão para o verificador de tipos). */
export function tagsSemProvaSintatica(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const importados = new Set<string>();
  const funcoes = new Set<string>();
  const valores = new Map<string, ts.Expression>();
  const coletar = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && n.importClause) {
      const c = n.importClause;
      if (c.name) importados.add(c.name.text);
      if (c.namedBindings && ts.isNamedImports(c.namedBindings)) for (const e of c.namedBindings.elements) importados.add(e.name.text);
      if (c.namedBindings && ts.isNamespaceImport(c.namedBindings)) importados.add(c.namedBindings.name.text);
    }
    if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) funcoes.add(n.name.text);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && n.parent.flags & ts.NodeFlags.Const) valores.set(n.name.text, n.initializer);
    ts.forEachChild(n, coletar);
  };
  coletar(sf);
  const componente = (e: ts.Expression): boolean => {
    while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e)) e = e.expression;
    if (ts.isArrowFunction(e) || ts.isFunctionExpression(e) || ts.isClassExpression(e)) return true;
    if (ts.isCallExpression(e)) {
      const c = e.expression;
      return HOCS.has(ts.isIdentifier(c) ? c.text : ts.isPropertyAccessExpression(c) ? c.name.text : "");
    }
    return false;
  };
  const pendentes = new Set<string>();
  const visitar = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ts.isIdentifier(n.tagName) && /^[A-Z]/.test(n.tagName.text)) {
      const t = n.tagName.text;
      const provado = importados.has(t) || funcoes.has(t) || (valores.has(t) && componente(valores.get(t)!));
      if (!provado) pendentes.add(t);
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return [...pendentes];
}

const opcoesTs = (() => {
  const arquivo = ts.findConfigFile(".", ts.sys.fileExists, "tsconfig.json")!;
  const lido = ts.readConfigFile(arquivo, ts.sys.readFile);
  return ts.parseJsonConfigFileContent(lido.config, ts.sys, ".").options;
})();

/**
 * Pelo verificador de tipos: das tags maiúsculas não provadas pela sintaxe, as que NÃO são componente
 * (tipo sem assinatura de chamada/construção — string, any, número…). `virtuais` permite conferir
 * fontes que não estão em disco (autoteste).
 */
export function tagsQueNaoSaoComponente(arquivos: string[], virtuais: Record<string, string> = {}): string[] {
  if (!arquivos.length) return [];
  const host = ts.createCompilerHost(opcoesTs);
  const lerOriginal = host.readFile.bind(host);
  const existeOriginal = host.fileExists.bind(host);
  const fonteOriginal = host.getSourceFile.bind(host);
  host.readFile = (f) => virtuais[f.split("\\").join("/")] ?? lerOriginal(f);
  host.fileExists = (f) => f.split("\\").join("/") in virtuais || existeOriginal(f);
  host.getSourceFile = (f, versao, ...resto) => {
    const v = virtuais[f.split("\\").join("/")];
    return v !== undefined ? ts.createSourceFile(f, v, versao, true, ts.ScriptKind.TSX) : fonteOriginal(f, versao, ...resto);
  };
  const programa = ts.createProgram({ rootNames: arquivos, options: { ...opcoesTs, noEmit: true }, host });
  const verificador = programa.getTypeChecker();
  const chamavel = (t: ts.Type): boolean =>
    t.isUnion() ? t.types.every(chamavel) : !(t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.StringLike)) && (t.getCallSignatures().length > 0 || t.getConstructSignatures().length > 0);
  const achados: string[] = [];
  for (const arquivo of arquivos) {
    const sf = programa.getSourceFile(arquivo);
    if (!sf) continue;
    const pendentes = new Set(tagsSemProvaSintatica(sf.getFullText()));
    const visitar = (n: ts.Node) => {
      if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && ts.isIdentifier(n.tagName) && pendentes.has(n.tagName.text)) {
        const tipo = verificador.getTypeAtLocation(n.tagName);
        if (!chamavel(tipo)) achados.push(`${arquivo}: <${n.tagName.text}> é ${verificador.typeToString(tipo)}`);
      }
      ts.forEachChild(n, visitar);
    };
    visitar(sf);
  }
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

  it("nenhuma tela menciona as fábricas de elemento (createElement, jsx…) — nem por alias", () => {
    const ofensores = fontes.flatMap(({ arquivo, conteudo }) => fabricasDeElemento(conteudo).map((t) => `${arquivo}: ${t}`));
    expect(ofensores).toEqual([]);
  });

  it("toda tag JSX maiúscula das telas é componente — pela sintaxe ou, se não der, pelo verificador de tipos", () => {
    const pendentes = fontes.filter(({ conteudo }) => /<[A-Z]/.test(conteudo) && tagsSemProvaSintatica(conteudo).length > 0).map(({ arquivo }) => arquivo);
    expect(tagsQueNaoSaoComponente(pendentes)).toEqual([]);
  }, 120_000);

  it("fábricas: pega chamada, alias no import, reatribuição e React.createElement", () => {
    for (const fonte of [
      'createElement("text" + "area", { minLength: 5 })',
      'import { createElement as ce } from "react"; ce("text" + "area", { minLength: 5 });',
      "const mk = createElement; mk(nome, { minLength: 5 });",
      "React.createElement(String.fromCharCode(116, 101, 120, 116, 97, 114, 101, 97), { minLength: 5 })",
      'jsx(["text", "area"].join(""), {}); cloneElement(el, {});',
    ]) expect(fabricasDeElemento(fonte), fonte).not.toEqual([]);
    expect(fabricasDeElemento('import { Botao } from "x"; <Botao>Ok</Botao>')).toEqual([]);
  });

  it("tags: texto montado, reatribuído ou vindo de fábrica não é componente; ícone tipado e prop de componente são", () => {
    const f = (nome: string) => `src/app/__fixture_${nome}.tsx`;
    const virtuais: Record<string, string> = {
      [f("concat")]: 'export function A() { const Tag = "text" + "area"; return <Tag minLength={5} />; }',
      [f("let")]: 'export function A() { let Tag; Tag = "text" + "area"; return <Tag minLength={5} />; }',
      [f("fabrica")]: 'const make = () => "text" + "area"; export function A() { const Tag = make(); return <Tag minLength={5} />; }',
      [f("prop")]: "export function A({ as: Tag }: { as: string }) { return <Tag minLength={5} />; }",
      [f("icone")]: 'import { IconHome, type Icon as Icone } from "@tabler/icons-react"; const ICONS: Record<string, Icone> = { Home: IconHome }; export function A({ k }: { k: string }) { const Icon = ICONS[k] ?? IconHome; return <Icon />; }',
      [f("componente")]: 'import type { ComponentType } from "react"; export function A({ icone: Icone }: { icone: ComponentType<{ className?: string }> }) { return <Icone className="x" />; }',
    };
    const ruins = tagsQueNaoSaoComponente([f("concat"), f("let"), f("fabrica"), f("prop")], virtuais);
    expect(ruins.map((r) => r.split(":")[0])).toEqual([f("concat"), f("let"), f("fabrica"), f("prop")]);
    expect(tagsQueNaoSaoComponente([f("icone"), f("componente")], virtuais)).toEqual([]);
    // A sintaxe já prova import e função — nem chega ao verificador.
    expect(tagsSemProvaSintatica('import { Botao } from "x"; function Local() { return null; } <><Botao /><Local /></>')).toEqual([]);
  }, 120_000);

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
