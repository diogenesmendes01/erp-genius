import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EstadoVazio, EstadoVazioLinha } from "@/components/EstadoVazio";
import { EXCECOES_ESTADO_VAZIO, MAPA_ESTADOS_VAZIOS } from "./estados-vazios-mapa";

// Trava do estado vazio (docs/42-auditoria-frontend-ux.md, E1): havia mais de 200 textos de "nada
// aqui" em texto cru, cada um com uma cor. Agora, o que a tela mostra quando uma lista está vazia
// é <EstadoVazio> (ou <EstadoVazioLinha> numa tabela).
//
// "Lista vazia" é reconhecida pela condição, não pelo texto: `!x.length && …`, `x.length === 0 ? … : …`,
// `x.length ? … : …` (o ramo falso), `if (!x.length) return …`, e composições com && e ||
// (`total === 0 || x.length === 0`). O ramo é conferido quando a tela o mostra (filho JSX, return,
// ou valor guardado numa variável que tenha elemento em algum lado).
//
// Cada folha do ramo vazio passa por uma lista do PERMITIDO: <EstadoVazio>/<EstadoVazioLinha>,
// nulo/booleano/número, marcador sem letras (`<div>—</div>`) e — só quando o outro lado da
// condição também é texto (frase: `Informes: a, b` × `nenhum`) — texto. Todo o resto é cru:
// outra tag, componente, texto solto ao lado de um elemento, e qualquer valor que a sintaxe não
// mostra (chamada, `createElement`/`React.createElement`/alias, identificador).
//
// Exceções: ancoradas em arquivo + condição + folha, texto exato (src/app/estados-vazios-mapa.ts);
// cada uma tem de casar com exatamente um ramo. O mesmo manifesto lista cada <EstadoVazio> de cada
// arquivo: trocar um por outra coisa (ou apagá-lo) muda o mapa e falha aqui e em
// src/components/EstadoVazio.test.ts, que confere a contagem por outro caminho.
//
// Fora do alcance (declarado): vazio decidido só por outra condição (`total === 0`, `!dados`), que a
// sintaxe não liga a uma lista.

const RAIZES = ["src/app", "src/components"];
const COMPONENTES_DE_VAZIO = new Set(["EstadoVazio", "EstadoVazioLinha"]);
const FABRICAS = new Set(["createElement", "jsx", "jsxs", "jsxDEV", "cloneElement"]);
const SO_LAYOUT = /^-?m[trblxy]?-\S+$/;

const normaliza = (t: string) => t.replace(/\s+/g, " ").trim();

function desembrulha(e: ts.Expression): ts.Expression {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) || ts.isSatisfiesExpression(e)) e = e.expression;
  return e;
}

/** `.length` de uma lista (não de texto: `x.trim().length` fica fora). */
function ehTamanho(e: ts.Expression): boolean {
  e = desembrulha(e);
  if (!ts.isPropertyAccessExpression(e) || e.name.text !== "length") return false;
  const alvo = desembrulha(e.expression);
  return !(ts.isCallExpression(alvo) && ts.isPropertyAccessExpression(alvo.expression) && /^(trim|trimStart|trimEnd)$/.test(alvo.expression.name.text));
}

/** true: a condição vale quando a lista está vazia; false: quando não está; null: não é teste de tamanho. */
export function testeDeVazio(e: ts.Expression): boolean | null {
  e = desembrulha(e);
  const K = ts.SyntaxKind;
  if (ts.isPrefixUnaryExpression(e) && e.operator === K.ExclamationToken) {
    const r = testeDeVazio(e.operand);
    return r === null ? null : !r;
  }
  if (ehTamanho(e)) return false;
  if (ts.isBinaryExpression(e) && ehTamanho(e.left)) {
    const direita = desembrulha(e.right);
    if (!ts.isNumericLiteral(direita)) return null;
    const n = Number(direita.text), op = e.operatorToken.kind;
    if (n === 0 && [K.EqualsEqualsEqualsToken, K.EqualsEqualsToken, K.LessThanEqualsToken].includes(op)) return true;
    if (n === 1 && op === K.LessThanToken) return true;
    if (n === 0 && [K.GreaterThanToken, K.ExclamationEqualsEqualsToken, K.ExclamationEqualsToken].includes(op)) return false;
    if (n === 1 && op === K.GreaterThanEqualsToken) return false;
  }
  if (ts.isBinaryExpression(e) && (e.operatorToken.kind === K.AmpersandAmpersandToken || e.operatorToken.kind === K.BarBarToken)) {
    const a = testeDeVazio(e.left), b = testeDeVazio(e.right);
    // `vazio && outra`: verdadeira só com a lista vazia. `cheia || outra`: falsa só com a lista vazia.
    if (e.operatorToken.kind === K.AmpersandAmpersandToken) {
      if ((a === true && b !== false) || (b === true && a !== false)) return true;
      if (a === false && b === false) return false;
    } else {
      if ((a === false && b !== true) || (b === false && a !== true)) return false;
      // `total === 0 || x.length === 0`: os dois lados dizem "vazio".
      if (a === true && b === true) return true;
      if ((a === true && b === null && ehContagemZero(e.right)) || (b === true && a === null && ehContagemZero(e.left))) return true;
    }
  }
  return null;
}

/** `total === 0` / `!total` — contagem zerada ao lado de um teste de lista. */
function ehContagemZero(e: ts.Expression): boolean {
  e = desembrulha(e);
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.ExclamationToken && ts.isIdentifier(desembrulha(e.operand))) return true;
  return ts.isBinaryExpression(e) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(e.operatorToken.kind)
    && ts.isNumericLiteral(desembrulha(e.right)) && desembrulha(e.right).getText() === "0";
}

type Achado = { linha: number; condicao: string; folha: string; problema: string };

/** As folhas que o ramo mostra, atravessando &&, ||, ?? e ternários. */
function folhas(e: ts.Expression): ts.Expression[] {
  e = desembrulha(e);
  if (ts.isConditionalExpression(e)) return [...folhas(e.whenTrue), ...folhas(e.whenFalse)];
  if (ts.isBinaryExpression(e) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) {
    return e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? folhas(e.right) : [...folhas(e.left), ...folhas(e.right)];
  }
  return [e];
}

function textoVisivel(e: ts.Node): string {
  if (ts.isJsxText(e)) return e.text;
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isJsxAttributes(e)) return "";
  let t = "";
  ts.forEachChild(e, (c) => { t += textoVisivel(c); });
  // Expressão não literal ({nome}) pode mostrar texto.
  if (ts.isJsxExpression(e) && e.expression && !ts.isStringLiteral(e.expression) && !ts.isConditionalExpression(e.expression)) t += "x";
  return t;
}

function nomeDaTag(e: ts.Node, sf: ts.SourceFile): string | null {
  if (ts.isJsxElement(e)) return e.openingElement.tagName.getText(sf);
  if (ts.isJsxSelfClosingElement(e)) return e.tagName.getText(sf);
  return null;
}

const ehTexto = (e: ts.Expression) => ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) || ts.isTemplateExpression(e);
const ehInerte = (e: ts.Expression) =>
  e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.TrueKeyword || e.kind === ts.SyntaxKind.FalseKeyword
  || ts.isNumericLiteral(e) || (ts.isIdentifier(e) && e.text === "undefined");
/** `xs.join(", ")` — o lado cheio de uma frase. */
const ehJuncao = (e: ts.Expression) => ts.isCallExpression(e) && ts.isPropertyAccessExpression(e.expression) && e.expression.name.text === "join";
/** Um lado "de texto": frase, não elemento. */
const ladoDeTexto = (e: ts.Expression) => folhas(e).every((f) => ehTexto(f) || ehInerte(f) || ehJuncao(f));

/** Ramos de "lista vazia" cuja folha não está no permitido. */
export function vaziosCrus(fonte: string, arquivo = "x.tsx"): Achado[] {
  const sf = ts.createSourceFile(arquivo, fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const achados: Achado[] = [];

  // Aliases de fábrica: `import { createElement as h }`, `const mk = createElement`, `React.createElement`.
  const fabricas = new Set(FABRICAS);
  const coletaAlias = (n: ts.Node) => {
    if (ts.isImportSpecifier(n) && FABRICAS.has((n.propertyName ?? n.name).text)) fabricas.add(n.name.text);
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
      const ini = desembrulha(n.initializer);
      if ((ts.isIdentifier(ini) && fabricas.has(ini.text)) || (ts.isPropertyAccessExpression(ini) && FABRICAS.has(ini.name.text))) fabricas.add(n.name.text);
    }
    ts.forEachChild(n, coletaAlias);
  };
  coletaAlias(sf);
  const ehFabrica = (e: ts.Expression) => {
    if (!ts.isCallExpression(e)) return false;
    const c = desembrulha(e.expression);
    return (ts.isIdentifier(c) && fabricas.has(c.text)) || (ts.isPropertyAccessExpression(c) && FABRICAS.has(c.name.text));
  };
  const ehElemento = (e: ts.Expression) => ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e) || ehFabrica(e);

  const confere = (condicao: ts.Node, ramo: ts.Expression, textoPermitido: boolean) => {
    const cond = normaliza(condicao.getText(sf));
    const acusa = (no: ts.Node, problema: string) =>
      achados.push({ linha: sf.getLineAndCharacterOfPosition(no.getStart(sf)).line + 1, condicao: cond, folha: normaliza(no.getText(sf)), problema });
    for (const folha of folhas(ramo)) {
      if (ts.isJsxFragment(folha)) {
        // Fragmento: cada filho conta como folha (texto solto aqui é sempre cru).
        for (const filho of folha.children) {
          if (ts.isJsxText(filho)) { if (filho.getText(sf).trim()) acusa(filho, "texto solto no fragmento"); continue; }
          if (ts.isJsxExpression(filho)) { if (filho.expression) confere(condicao, filho.expression, false); continue; }
          const tag = nomeDaTag(filho, sf)!;
          if (!COMPONENTES_DE_VAZIO.has(tag)) acusa(filho, `<${tag}>`);
        }
        continue;
      }
      const tag = nomeDaTag(folha, sf);
      if (tag !== null) {
        // Marcador sem letras (`<div>—</div>` num indicador) não é mensagem. Componente
        // (`<Resumo />`) pode mostrar texto: sempre conta.
        const marcador = /^[a-z]/.test(tag) && !/\p{L}/u.test(textoVisivel(folha));
        if (!COMPONENTES_DE_VAZIO.has(tag) && !marcador) acusa(folha, `<${tag}>`);
        continue;
      }
      if (ehInerte(folha)) continue;
      if (ehTexto(folha)) { if (!textoPermitido && /\p{L}/u.test(folha.getText(sf))) acusa(folha, "texto solto"); continue; }
      if (textoPermitido && !ehFabrica(folha)) continue; // valor de uma frase (`xs.join(", ")` × `"nenhum"`)
      acusa(folha, ehFabrica(folha) ? "fábrica de elemento" : `não verificável (${ts.SyntaxKind[folha.kind]})`);
    }
  };

  // A tela mostra o valor: filho JSX, return, corpo de arrow — ou, fora disso, quando algum lado é elemento.
  const posicaoExibida = (n: ts.Node) => {
    let p = n.parent;
    while (p && (ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p) || ts.isBinaryExpression(p))) p = p.parent;
    return !!p && (ts.isJsxExpression(p) || ts.isReturnStatement(p) || ts.isArrowFunction(p));
  };
  const temElemento = (e: ts.Expression) => folhas(e).some(ehElemento);
  const funcaoComJsx = (n: ts.Node): boolean => {
    let f: ts.Node | undefined = n.parent;
    while (f && !ts.isFunctionLike(f)) f = f.parent;
    if (!f) return false;
    let tem = false;
    const procura = (m: ts.Node) => { if (tem) return; if (ts.isJsxElement(m) || ts.isJsxSelfClosingElement(m) || ts.isJsxFragment(m) || (ts.isCallExpression(m) && ehFabrica(m))) tem = true; else ts.forEachChild(m, procura); };
    procura(f);
    return tem;
  };

  // Um `a && b` que é só parte de uma condição maior (`(a && b) && <p/>`, `a && b ? … : …`) não é ramo.
  const parteDeCondicao = (n: ts.Node) => {
    let p = n.parent, filho: ts.Node = n;
    while (p && ts.isParenthesizedExpression(p)) { filho = p; p = p.parent; }
    if (!p) return false;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken].includes(p.operatorToken.kind) && p.left === filho) return true;
    if (ts.isConditionalExpression(p) && p.condition === filho) return true;
    if (ts.isIfStatement(p) && p.expression === filho) return true;
    return ts.isPrefixUnaryExpression(p);
  };

  const visita = (n: ts.Node) => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && !parteDeCondicao(n) && testeDeVazio(n.left) === true
      && (posicaoExibida(n) || temElemento(n.right))) confere(n.left, n.right, false);
    if (ts.isConditionalExpression(n)) {
      const t = testeDeVazio(n.condition);
      if (t !== null) {
        const [vazio, cheio] = t ? [n.whenTrue, n.whenFalse] : [n.whenFalse, n.whenTrue];
        if (posicaoExibida(n) || temElemento(vazio) || temElemento(cheio)) confere(n.condition, vazio, ladoDeTexto(cheio));
      }
    }
    if (ts.isIfStatement(n) && testeDeVazio(n.expression) === true && funcaoComJsx(n)) {
      const corpo = n.thenStatement;
      const retorno = ts.isReturnStatement(corpo) ? corpo : ts.isBlock(corpo) ? corpo.statements.find(ts.isReturnStatement) : undefined;
      if (retorno?.expression) confere(n.expression, retorno.expression, false);
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return achados;
}

/** Cada <EstadoVazio>/<EstadoVazioLinha> do arquivo, na ordem: variante e mensagem. */
export function mapaDeEstadosVazios(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const itens: string[] = [];
  const visita = (n: ts.Node) => {
    if (ts.isJsxElement(n) && COMPONENTES_DE_VAZIO.has(n.openingElement.tagName.getText(sf))) {
      const tag = n.openingElement.tagName.getText(sf);
      const bloco = n.openingElement.attributes.properties.some((a) => ts.isJsxAttribute(a) && a.name.getText(sf) === "bloco");
      const mensagem = normaliza(fonte.slice(n.openingElement.end, n.closingElement.getStart(sf)).replace(/\{\/\*[\s\S]*?\*\/\}/g, "")).slice(0, 100);
      itens.push(`${tag === "EstadoVazioLinha" ? "linha" : bloco ? "bloco" : "compacto"} · ${mensagem}`);
    }
    if (ts.isJsxSelfClosingElement(n) && COMPONENTES_DE_VAZIO.has(n.tagName.getText(sf))) itens.push("sem mensagem");
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return itens;
}

/** className de <EstadoVazio> que não é só posição. */
export function aparenciaForaDoComponente(fonte: string): string[] {
  const sf = ts.createSourceFile("x.tsx", fonte, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const erros: string[] = [];
  const visita = (n: ts.Node) => {
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && COMPONENTES_DE_VAZIO.has(n.tagName.getText(sf))) {
      for (const a of n.attributes.properties) {
        if (ts.isJsxSpreadAttribute(a)) { erros.push(`spread em <${n.tagName.getText(sf)}>`); continue; }
        if (a.name.getText(sf) !== "className") continue;
        const ini = a.initializer;
        if (!ini || !ts.isStringLiteral(ini)) { erros.push(`className dinâmico: ${a.getText(sf)}`); continue; }
        const fora = ini.text.split(/\s+/).filter((c) => c && !SO_LAYOUT.test(c));
        if (fora.length) erros.push(`className fora de posição: ${fora.join(" ")}`);
      }
    }
    ts.forEachChild(n, visita);
  };
  visita(sf);
  return erros;
}

function telas(): { arquivo: string; fonte: string }[] {
  const saida: { arquivo: string; fonte: string }[] = [];
  for (const raiz of RAIZES) for (const f of readdirSync(raiz, { recursive: true }) as string[]) {
    if (!f.endsWith(".tsx") || f.includes(".test.")) continue;
    const arquivo = join(raiz, f).split("\\").join("/");
    saida.push({ arquivo, fonte: readFileSync(arquivo, "utf8") });
  }
  return saida;
}

describe("EstadoVazio — componente (HTML exato; os invariantes de design estão em src/components/EstadoVazio.test.ts)", () => {
  it("compacto por padrão; bloco tracejado e centralizado para a lista principal", () => {
    const compacto = renderToStaticMarkup(EstadoVazio({ children: "Nenhuma turma." }));
    expect(compacto).toBe('<div data-estado-vazio="" class="rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-500"><p>Nenhuma turma.</p></div>');
    const bloco = renderToStaticMarkup(EstadoVazio({ bloco: true, children: "Nenhuma turma." }));
    expect(bloco).toBe('<div data-estado-vazio="" class="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500"><p>Nenhuma turma.</p></div>');
  });

  it("a ação (próximo passo) vem depois da mensagem; margem de posição e role são repassados", () => {
    const html = renderToStaticMarkup(EstadoVazio({ bloco: true, className: "mt-4", role: "status", "aria-busy": true, acao: createElement("a", { href: "/novo" }, "Criar"), children: "Nada." }));
    expect(html).toBe('<div data-estado-vazio="" class="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 mt-4" role="status" aria-busy="true"><p>Nada.</p><div class="mt-3 flex flex-wrap justify-center gap-2"><a href="/novo">Criar</a></div></div>');
    expect(renderToStaticMarkup(EstadoVazio({ acao: createElement("a", { href: "/novo" }, "Criar"), children: "Nada." }))).toContain('<p>Nada.</p><div class="mt-2 flex flex-wrap gap-2"><a href="/novo">Criar</a></div>');
  });

  it("na tabela: uma linha que ocupa todas as colunas; role/aria-busy dentro da célula", () => {
    const html = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, EstadoVazioLinha({ colSpan: 5, children: "Nenhum aluno." }))));
    expect(html).toBe('<table><tbody><tr><td colSpan="5" data-estado-vazio="" class="px-4 py-8 text-center text-sm text-gray-500"><div><p>Nenhum aluno.</p></div></td></tr></tbody></table>');
    const comFiltro = renderToStaticMarkup(createElement("table", null, createElement("tbody", null, EstadoVazioLinha({ colSpan: 2, role: "status", "aria-busy": true, children: "Nada." }))));
    expect(comFiltro).toContain('<tr><td colSpan="2" data-estado-vazio="" class="px-4 py-8 text-center text-sm text-gray-500"><div role="status" aria-busy="true"><p>Nada.</p></div></td></tr>');
  });
});

describe("detector de lista vazia (autoteste)", () => {
  const cru = (corpo: string, cabeca = "") => vaziosCrus(`${cabeca}\nexport function T({ xs, ys, t, total, P }: any) { ${corpo} }`).map((a) => a.problema);

  it("acusa texto cru em cada forma de condição de lista vazia", () => {
    expect(cru("return <div>{!xs.length && <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length === 0 && <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length == 0 && <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length <= 0 && <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length < 1 ? <p>Nada.</p> : null}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length ? <ul /> : <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length > 0 ? <ul /> : <div>Nada.</div>}</div>;")).toEqual(["<div>"]);
    expect(cru("return <div>{!!xs.length ? <ul /> : <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs?.length ? <ul /> : <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <table><tbody>{xs.length === 0 ? <tr><td>Nada.</td></tr> : null}</tbody></table>;")).toEqual(["<tr>"]);
    expect(cru("if (!xs.length) return <p>Nada.</p>; return <ul />;")).toEqual(["<p>"]);
    expect(cru("if (xs.length === 0) { return (<section><p>Nada.</p></section>); } return <ul />;")).toEqual(["<section>"]);
  });

  it("condições compostas: && com outra condição, || com contagem zerada", () => {
    expect(cru("return <div>{xs.length === 0 && !t ? <p>Nada.</p> : <ul />}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{!t && !xs.length && <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length === 0 && !t && <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length === 0 && !t && <EstadoVazio>Nada.</EstadoVazio>}</div>;")).toEqual([]);
    expect(cru("return <div>{t.ok && t.itens?.length === 0 && <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{total === 0 || xs.length === 0 ? <p>Nada.</p> : <ul />}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length > 0 || t ? <ul /> : <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    // `erro || vazio` não é só vazio: fica fora.
    expect(cru("return <div>{t || !xs.length ? <p>Erro ou nada.</p> : <ul />}</div>;")).toEqual([]);
  });

  it("atravessa condições aninhadas, fragmentos e texto solto", () => {
    expect(cru("return <div>{xs.length ? <ul /> : t && <p>Nada.</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{xs.length ? <ul /> : t ? <EstadoVazio>A</EstadoVazio> : <p>B</p>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{!xs.length && <><EstadoVazio>A</EstadoVazio><p>B</p></>}</div>;")).toEqual(["<p>"]);
    expect(cru("return <div>{!xs.length && <>Nada.</>}</div>;")).toEqual(["texto solto no fragmento"]);
    expect(cru('return <p>{xs.length ? <ul /> : "Nada."}</p>;')).toEqual(["texto solto"]);
    expect(cru("return <p>{xs.length ? <ul /> : `Nada de ${t}.`}</p>;")).toEqual(["texto solto"]);
    expect(cru('return <div>{!xs.length && "Nada."}</div>;')).toEqual(["texto solto"]);
    expect(cru("return <div>{!xs.length && <p>{t}</p>}</div>;")).toEqual(["<p>"]);
    // O lado cheio é lista (.map), não frase: o texto do vazio é cru.
    expect(cru('return <ul>{xs.length ? xs.map((x: any) => <li key={x}>{x}</li>) : "Nada."}</ul>;')).toEqual(["texto solto"]);
  });

  it("B1 — fábricas de elemento, alias, tag variável, função auxiliar e valor guardado são crus", () => {
    const imp = 'import React, { createElement } from "react";';
    expect(cru('return <div>{!xs.length && createElement("p", null, "Nada.")}</div>;', imp)).toEqual(["fábrica de elemento"]);
    expect(cru('return <div>{xs.length ? <ul /> : React.createElement("p", null, "Nada.")}</div>;', imp)).toEqual(["fábrica de elemento"]);
    expect(cru('return <div>{xs.length === 0 ? createElement(P, null, "Nada.") : null}</div>;', imp)).toEqual(["fábrica de elemento"]);
    expect(cru('return <table><tbody>{!xs.length && createElement("tr", null, createElement("td", null, "Nada."))}</tbody></table>;', imp)).toEqual(["fábrica de elemento"]);
    expect(cru('return <div>{!xs.length && h("p", null, "Nada.")}</div>;', 'import { createElement as h } from "react";')).toEqual(["fábrica de elemento"]);
    expect(cru('const mk = createElement; return <div>{!xs.length && mk("p", null, "Nada.")}</div>;', imp)).toEqual(["fábrica de elemento"]);
    expect(cru('return <div>{!xs.length && jsx("p", { children: "Nada." })}</div>;', 'import { jsx } from "react/jsx-runtime";')).toEqual(["fábrica de elemento"]);
    expect(cru('if (!xs.length) return createElement("p", null, "Nada."); return <ul />;', imp)).toEqual(["fábrica de elemento"]);
    // Chamada ou identificador no lugar do elemento: a sintaxe não mostra o que sai.
    expect(cru("return <div>{!xs.length && vazio()}</div>;")).toEqual(["não verificável (CallExpression)"]);
    expect(cru("return <div>{xs.length ? <ul /> : t}</div>;")).toEqual(["não verificável (Identifier)"]);
    expect(cru("if (!xs.length) return renderVazio(); return <ul />;")).toEqual(["não verificável (CallExpression)"]);
    // Valor guardado numa variável e mostrado depois.
    expect(cru("const v = !xs.length ? <p>Nada.</p> : null; return <div>{v}</div>;")).toEqual(["<p>"]);
    expect(cru('const v = xs.length ? <ul /> : createElement("p", null, "Nada."); return <div>{v}</div>;', imp)).toEqual(["fábrica de elemento"]);
    expect(cru("const v = !xs.length && <p>Nada.</p>; return <div>{v}</div>;")).toEqual(["<p>"]);
  });

  it("frase com os dois lados em texto, função que devolve texto e marcador sem letras não são estado vazio", () => {
    expect(cru('return <p>Informes: {xs.length ? xs.join(", ") : "nenhum"}.</p>;')).toEqual([]);
    expect(cru('return xs.length ? xs.join(" · ") : "Resumo limpo";')).toEqual([]);
    expect(cru('return <p>{total === 0 || xs.length === 0 ? "Nenhuma" : `${xs.length} de ${total}`}</p>;')).toEqual([]);
    expect(cru('return <div>{xs.length === 0 ? <div className="text-2xl">—</div> : <b>{xs.length}</b>}</div>;')).toEqual([]);
    // Componente sem filhos pode mostrar texto: conta.
    expect(cru("return <div>{!xs.length && <Aviso tipo={t} />}</div>;")).toEqual(["<Aviso>"]);
  });

  it("aceita EstadoVazio/EstadoVazioLinha, nulo e marcadores sem letras; ignora texto e cálculo", () => {
    expect(cru("return <div>{!xs.length && <EstadoVazio>Nada.</EstadoVazio>}</div>;")).toEqual([]);
    expect(cru("return <div>{xs.length ? <ul /> : <EstadoVazio bloco>Nada.</EstadoVazio>}</div>;")).toEqual([]);
    expect(cru("return <table><tbody>{!xs.length && <EstadoVazioLinha colSpan={3}>Nada.</EstadoVazioLinha>}</tbody></table>;")).toEqual([]);
    expect(cru("if (!xs.length) return <EstadoVazio>Nada.</EstadoVazio>; return <ul />;")).toEqual([]);
    expect(cru('return <td>{xs.length ? xs.join(", ") : "—"}</td>;')).toEqual([]);
    expect(cru("return <div>{xs.length ? <ul /> : null}</div>;")).toEqual([]);
    expect(cru("if (!xs.length) return null; return <ul />;")).toEqual([]);
    // Texto digitado não é lista; conta calculada não é tela; função sem JSX não é tela.
    expect(cru("return <div>{t.trim().length === 0 && <p>Escreva algo.</p>}</div>;")).toEqual([]);
    expect(cru("const r = xs.length ? 1 : 2; return <p>{r}</p>;")).toEqual([]);
    expect(cru("const media = xs.length ? soma(xs) / xs.length : 0; return <p>{media}</p>;")).toEqual([]);
    expect(vaziosCrus('export function f(xs: string[]) { if (!xs.length) return "nenhum"; return xs.join(", "); }')).toEqual([]);
    // Ramo verdadeiro de uma lista com itens não é o vazio.
    expect(cru("return <div>{xs.length > 0 && <ul><li>a</li></ul>}</div>;")).toEqual([]);
  });

  it("className de EstadoVazio: só posição", () => {
    expect(aparenciaForaDoComponente('<EstadoVazio className="mt-4">A</EstadoVazio>')).toEqual([]);
    expect(aparenciaForaDoComponente('<EstadoVazio className="mt-4 text-gray-400">A</EstadoVazio>')).toEqual(["className fora de posição: text-gray-400"]);
    expect(aparenciaForaDoComponente("<EstadoVazio className={c}>A</EstadoVazio>")).toHaveLength(1);
    expect(aparenciaForaDoComponente("<EstadoVazio {...p}>A</EstadoVazio>")).toHaveLength(1);
  });

  it("mapa: variante e mensagem de cada EstadoVazio, na ordem", () => {
    expect(mapaDeEstadosVazios('<><EstadoVazio bloco acao={<a />}>{/* nota */}Nenhuma  turma.</EstadoVazio><EstadoVazioLinha colSpan={2}>Nada {x}.</EstadoVazioLinha><EstadoVazio>Sem itens.</EstadoVazio></>'))
      .toEqual(["bloco · Nenhuma turma.", "linha · Nada {x}.", "compacto · Sem itens."]);
  });
});

describe("estados vazios nas telas", () => {
  const todas = telas();

  it("todo ramo de lista vazia mostra EstadoVazio (ou é exceção ancorada: arquivo + condição + folha)", () => {
    const casadas = new Map<number, number>();
    const crus: string[] = [];
    for (const { arquivo, fonte } of todas) {
      for (const a of vaziosCrus(fonte, arquivo)) {
        const i = EXCECOES_ESTADO_VAZIO.findIndex((e) => e.arquivo === arquivo && e.condicao === a.condicao && e.folha === a.folha);
        if (i >= 0) { casadas.set(i, (casadas.get(i) ?? 0) + 1); continue; }
        crus.push(`${arquivo}:${a.linha} ${a.problema} | ${a.condicao} | ${a.folha.slice(0, 120)}`);
      }
    }
    expect(crus).toEqual([]);
    // Cada exceção casa com exatamente um ramo: vencida (0) ou ampla demais (2+) falha.
    const fora = EXCECOES_ESTADO_VAZIO.map((e, i) => ({ vezes: casadas.get(i) ?? 0, e })).filter((x) => x.vezes !== 1).map((x) => `${x.vezes}× ${x.e.arquivo} | ${x.e.folha.slice(0, 80)}`);
    expect(fora).toEqual([]);
  });

  it("cada tela tem exatamente os estados vazios do manifesto (trocar ou apagar um aparece aqui)", () => {
    const real: Record<string, string[]> = {};
    for (const { arquivo, fonte } of todas) {
      const itens = mapaDeEstadosVazios(fonte);
      if (itens.length && arquivo !== "src/components/EstadoVazio.tsx") real[arquivo] = itens;
    }
    expect(real).toEqual(MAPA_ESTADOS_VAZIOS);
  });

  it("EstadoVazio não recebe aparência de fora (className só de posição)", () => {
    const erros = todas.flatMap(({ arquivo, fonte }) => aparenciaForaDoComponente(fonte).map((e) => `${arquivo}: ${e}`));
    expect(erros).toEqual([]);
  });
});
